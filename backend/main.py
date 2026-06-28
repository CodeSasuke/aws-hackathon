import os
import sys
import uuid
import time
import psutil
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# Initialize environment loader
backend_dir = os.path.abspath(os.path.dirname(__file__))
sys.path.append(backend_dir)

from database.connection import get_session, init_db
from database.repositories.job_repository import JobRepository
from database.repositories.response_repository import ResponseRepository
from database.models import AnalysisJob, Response, Project
from pipeline.engine import AnalysisEngine
from pipeline.parser import get_spacy_model
from pipeline.embeddings import get_embedding_model

app = FastAPI(title="SurveyIQ Offline NLP Engine", version="1.0.0")

# Enable CORS for Next.js frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup loader
@app.on_event("startup")
def startup_event():
    print("[FastAPI] Initializing offline resources...", flush=True)
    init_db()
    # Trigger model loads so they are cached in memory on startup
    get_spacy_model()
    get_embedding_model()
    print("[FastAPI] Offline models successfully loaded into RAM.", flush=True)

# Pydantic schemas
class SingleAnalyzeRequest(BaseModel):
    text: str
    projectId: Optional[str] = None

class ProjectAnalyzeRequest(BaseModel):
    priority: Optional[int] = 0

class OverrideRequest(BaseModel):
    userId: str
    field: str
    oldValue: str
    newValue: str
    reason: Optional[str] = "Manual correction"

# Endpoints
@app.post("/api/analyze")
def analyze_single_comment(request: SingleAnalyzeRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    
    try:
        nlp_config = {}
        if request.projectId:
            session = get_session()
            try:
                project = session.query(Project).filter_by(id=request.projectId).first()
                if project and project.nlpConfig:
                    nlp_config = project.nlpConfig
            finally:
                session.close()
                
        engine = AnalysisEngine()
        doc = engine.analyze_comment("single_run", request.text, project_id=request.projectId, nlp_config=nlp_config)
        return doc.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

@app.post("/api/projects/{project_id}/analyze")
def trigger_project_job(project_id: str, request: ProjectAnalyzeRequest):
    session = get_session()
    try:
        # Check if project exists
        project = session.query(Project).filter_by(id=project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found.")
            
        # Create a new AnalysisJob in the queue
        job_id = f"job_{uuid.uuid4().hex[:8]}"
        job = AnalysisJob(
            id=job_id,
            projectId=project_id,
            status="PENDING",
            priority=request.priority or 0,
            progress=0,
            maxRetries=3
        )
        session.add(job)
        
        # Update parent Project status
        project.status = "PENDING"
        
        session.commit()
        return {
            "jobId": job_id,
            "projectId": project_id,
            "status": "PENDING"
        }
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()

@app.post("/api/responses/{response_id}/override")
def override_response_fields(response_id: str, request: OverrideRequest):
    session = get_session()
    try:
        response = ResponseRepository.get_response_by_id(session, response_id)
        if not response:
            raise HTTPException(status_code=404, detail="Response record not found.")
            
        # Update fields
        updates = {request.field: request.newValue}
        
        # If theme is changed, we resolve themeId
        if request.field == "theme":
            theme = ResponseRepository.get_or_create_theme(session, response.projectId, request.newValue, response.category)
            updates = {
                "themeId": theme.id,
                "theme": theme.name
            }
            
        ResponseRepository.update_response(session, response_id, updates)
        
        # Log manual audit trail
        ResponseRepository.log_override(
            session=session,
            user_id=request.userId,
            project_id=response.projectId,
            response_id=response_id,
            field=request.field,
            old_val=request.oldValue,
            new_val=request.newValue,
            reason=request.reason
        )
        
        # Recalculate theme counts
        ResponseRepository.update_theme_counts(session, response.projectId)
        
        return {"status": "SUCCESS", "responseId": response_id}
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()

# ----------------- Operational health checks -----------------

@app.get("/health")
def health_check():
    session = get_session()
    try:
        # Verify DB connection works
        session.execute("SELECT 1")
        return {"status": "HEALTHY", "database": "CONNECTED"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection issue: {str(e)}")
    finally:
        session.close()

@app.get("/ready")
def ready_check():
    # Verify both models are loaded and available in the global variables
    spacy_loaded = get_spacy_model() is not None
    embed_loaded = get_embedding_model() is not None
    
    if spacy_loaded and embed_loaded:
        return {"status": "READY", "models": {"spacy": "loaded", "embeddings": "loaded"}}
    else:
        raise HTTPException(status_code=503, detail="Models are still loading.")

@app.get("/metrics")
def metrics_endpoint():
    session = get_session()
    try:
        # 1. Memory usage
        process = psutil.Process(os.getpid())
        ram_mb = process.memory_info().rss / (1024 * 1024)
        
        # 2. Queue statistics
        pending_jobs = session.query(AnalysisJob).filter_by(status="PENDING").count()
        running_jobs = session.query(AnalysisJob).filter_by(status="ANALYZING").count()
        completed_jobs = session.query(AnalysisJob).filter_by(status="COMPLETED").count()
        failed_jobs = session.query(AnalysisJob).filter_by(status="FAILED").count()
        dlq_jobs = session.query(AnalysisJob).filter_by(status="DEAD_LETTER").count()
        
        # 3. Calculate avg timings from completed jobs
        timing_avg_ms = 0.0
        timings = session.query(AnalysisJob.processingTimeMs).filter(AnalysisJob.status == "COMPLETED").all()
        if timings:
            timing_avg_ms = sum(t[0] for t in timings) / len(timings)
            
        return {
            "worker_process": {
                "memoryUsageMB": round(ram_mb, 2),
                "cpuUsagePercent": psutil.cpu_percent()
            },
            "job_queue": {
                "pending": pending_jobs,
                "running": running_jobs,
                "completed": completed_jobs,
                "failed": failed_jobs,
                "dead_letter": dlq_jobs
            },
            "performance": {
                "averageJobProcessingTimeMs": round(timing_avg_ms, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        session.close()
