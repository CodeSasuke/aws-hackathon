import os
import sys
import time
import uuid
import psutil
import threading
from datetime import datetime

# Initialize environment loader
backend_dir = os.path.abspath(os.path.dirname(__file__))
sys.path.append(backend_dir)

from database.connection import get_session, init_db, get_session
from database.repositories.job_repository import JobRepository
from database.repositories.response_repository import ResponseRepository
from database.models import Project, SurveyFile, Response
from pipeline.engine import AnalysisEngine
from pipeline.clustering import ClusteringStage

class HeartbeatRunner:
    def __init__(self, session_factory, job_id: str, interval: int = 10):
        self.session_factory = session_factory
        self.job_id = job_id
        self.interval = interval
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        
    def _run(self):
        while not self.stop_event.wait(self.interval):
            session = self.session_factory()
            try:
                JobRepository.update_heartbeat(session, self.job_id)
            except Exception as e:
                print(f"[Worker Heartbeat Error] Job {self.job_id}: {e}", flush=True)
            finally:
                session.close()

def process_job(session_factory, job) -> dict:
    session = session_factory()
    try:
        job_id = job.id
        project_id = job.projectId
        
        # 1. Update project status to PARSING
        project = session.query(Project).filter_by(id=project_id).first()
        if project:
            project.status = "PARSING"
            session.commit()
            
        # Get survey file mappings
        survey_file = session.query(SurveyFile).filter_by(projectId=project_id).first()
        if not survey_file:
            raise ValueError(f"Survey file not found for project {project_id}")
            
        mappings = survey_file.columnMappings
        text_cols = mappings.get("textCols", [])
        if not text_cols:
            raise ValueError("No open-ended text response columns mapped.")
            
        # We read the first text column to classify
        text_col_name = text_cols[0]
        
        # 2. Fetch all raw responses
        responses = session.query(Response).filter_by(projectId=project_id).order_by(Response.rowIndex.asc()).all()
        if not responses:
            return {"responsesProcessed": 0, "tokensProcessed": 0, "memoryUsageMB": 0.0}
            
        # Update progress to ANALYZING (40)
        JobRepository.update_progress(session, job_id, 40, "ANALYZING")
        if project:
            project.status = "ANALYZING"
            session.commit()
            
        # 3. Process each response through the NLP engine
        nlp_config = project.nlpConfig if (project and project.nlpConfig) else {}
        engine = AnalysisEngine()
        doc_states = []
        token_count = 0
        
        # Deduplication cache to speed up processing of repeating short answers (Idempotency)
        processed_cache = {}
        
        print(f"[Worker] Running pipeline on {len(responses)} responses...", flush=True)
        
        for idx, resp in enumerate(responses):
            raw_data = resp.rawData or {}
            comment_text = str(raw_data.get(text_col_name, "")).strip()
            
            # Estimate word count/tokens
            token_count += len(comment_text.split())
            
            if comment_text in processed_cache:
                # Idempotency / Cache Hit
                cached_doc = processed_cache[comment_text]
                # Clone doc state for this distinct row ID
                from copy import deepcopy
                import copy
                doc_copy = copy.copy(cached_doc)
                doc_copy.id = resp.id
                doc_states.append(doc_copy)
            else:
                # Run complete analysis
                doc = engine.analyze_comment(resp.id, comment_text, project_id=project_id, nlp_config=nlp_config)
                processed_cache[comment_text] = doc
                doc_states.append(doc)
                
            # Periodically update job progress metrics
            if idx % 10 == 0:
                progress_val = 40 + int(30 * (idx / len(responses)))
                JobRepository.update_progress(session, job_id, progress_val, "ANALYZING")
                
        # 4. Run Clustering on unique responses
        JobRepository.update_progress(session, job_id, 75, "CLUSTERING")
        if project:
            project.status = "CLUSTERING"
            session.commit()
            
        # Cluster the processed documents in a batch
        doc_states = ClusteringStage.cluster_documents(doc_states)
        
        # 5. Save all enriched responses back to PostgreSQL
        JobRepository.update_progress(session, job_id, 90, "GENERATING_REPORTS")
        if project:
            project.status = "GENERATING_REPORTS"
            session.commit()
            
        for doc in doc_states:
            resp_id = doc.id
            
            # Resolve Theme record
            theme_name = doc.theme
            theme_cat = doc.category
            theme = ResponseRepository.get_or_create_theme(session, project_id, theme_name, theme_cat)
            
            # Map sentiment string to enum
            db_sentiment = "NEUTRAL"
            if doc.overall_sentiment in ("POSITIVE", "NEGATIVE", "NEUTRAL"):
                db_sentiment = doc.overall_sentiment
                
            # Write to database
            updates = {
                "sentiment": db_sentiment,
                "themeId": theme.id,
                "category": doc.category,
                "intent": doc.intent,
                "urgency": doc.urgency,
                "productArea": doc.product_area,
                "suggestedAction": doc.suggested_action,
                "confidenceScore": doc.confidence,
                "isSpam": doc.is_spam,
                "isDuplicate": doc.is_duplicate,
                "representativeQuote": doc.representative_quote,
                "clusterId": doc.cluster_id,
                "language": doc.language,
                "nlpMetadata": doc.to_dict(),
                "nlpVersion": "1.0.0",
                "ontologyVersion": "1.0.0",
                "ruleVersion": "1.0.0"
            }
            ResponseRepository.update_response(session, resp_id, updates)
            
        # 6. Recalculate theme counts
        ResponseRepository.update_theme_counts(session, project_id)
        
        # 6.5 Run Background Competitor Suggestion Discovery
        try:
            from pipeline.competitor import discover_potential_competitors
            discover_potential_competitors(session, project_id, doc_states, nlp_config)
            print(f"[Worker] Competitor brand suggestion discovery scan completed for project {project_id}.", flush=True)
        except Exception as suggest_err:
            print(f"[Worker Error] Competitor brand suggestion discovery scan failed: {suggest_err}", flush=True)

        # 7. Update parent Project status to COMPLETED
        if project:
            project.status = "COMPLETED"
            session.commit()
            
        # Measure RAM usage (RSS)
        process = psutil.Process(os.getpid())
        ram_mb = process.memory_info().rss / (1024 * 1024)
        
        return {
            "responsesProcessed": len(responses),
            "tokensProcessed": token_count,
            "memoryUsageMB": round(ram_mb, 2)
        }
    finally:
        session.close()

def main_loop():
    worker_id = f"worker_{uuid.uuid4().hex[:8]}"
    print(f"Starting Background Analysis Queue Worker. Worker ID: '{worker_id}'", flush=True)
    
    # Initialize connection engine
    init_db()
    
    while True:
        session = get_session()
        try:
            # Query queue with FOR UPDATE SKIP LOCKED
            job = JobRepository.get_next_job(session, worker_id)
            if job:
                print(f"[Worker] Locked pending job {job.id} for project {job.projectId}", flush=True)
                start_time = time.perf_counter()
                
                # Start background lease heartbeat
                heartbeat = HeartbeatRunner(get_session, job.id)
                heartbeat.start()
                
                try:
                    metrics = process_job(get_session, job)
                    
                    duration_ms = int((time.perf_counter() - start_time) * 1000)
                    metrics["processingTimeMs"] = duration_ms
                    
                    # Commit successful completion metrics
                    JobRepository.complete_job(session, job.id, metrics)
                    print(f"[Worker] Job {job.id} completed successfully in {duration_ms}ms.", flush=True)
                except Exception as run_err:
                    print(f"[Worker Error] Job {job.id} failed: {run_err}", flush=True)
                    JobRepository.fail_job(session, job.id, str(run_err))
                finally:
                    heartbeat.stop()
            else:
                # No job available, sleep and poll again
                time.sleep(2.0)
        except Exception as loop_err:
            print(f"[Worker Loop Exception] {loop_err}", flush=True)
            time.sleep(5.0)
        finally:
            session.close()

if __name__ == "__main__":
    main_loop()
