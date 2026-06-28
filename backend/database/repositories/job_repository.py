from datetime import datetime, timedelta
from sqlalchemy import or_, and_
from ..models import AnalysisJob

class JobRepository:
    @staticmethod
    def get_next_job(session, worker_id: str):
        now = datetime.utcnow()
        
        # SELECT ... FOR UPDATE SKIP LOCKED
        # Finds PENDING jobs, or ANALYZING jobs that timed out (expired leases)
        job = session.query(AnalysisJob).filter(
            or_(
                AnalysisJob.status == "PENDING",
                and_(
                    AnalysisJob.status == "ANALYZING",
                    AnalysisJob.leaseExpiresAt < now
                )
            )
        ).order_by(
            AnalysisJob.priority.desc(),
            AnalysisJob.createdAt.asc()
        ).with_for_update(skip_locked=True).first()
        
        if job:
            job.status = "ANALYZING"
            job.workerId = worker_id
            job.startedAt = now
            job.heartbeatAt = now
            job.leaseExpiresAt = now + timedelta(seconds=30)
            session.commit()
            
        return job

    @staticmethod
    def update_heartbeat(session, job_id: str):
        job = session.query(AnalysisJob).filter_by(id=job_id).first()
        if job:
            now = datetime.utcnow()
            job.heartbeatAt = now
            job.leaseExpiresAt = now + timedelta(seconds=30)
            session.commit()

    @staticmethod
    def update_progress(session, job_id: str, progress: int, status: str = "ANALYZING"):
        job = session.query(AnalysisJob).filter_by(id=job_id).first()
        if job:
            job.progress = progress
            job.status = status
            session.commit()

    @staticmethod
    def complete_job(session, job_id: str, metrics: dict):
        job = session.query(AnalysisJob).filter_by(id=job_id).first()
        if job:
            job.status = "COMPLETED"
            job.progress = 100
            job.completedAt = datetime.utcnow()
            job.processingTimeMs = metrics.get("processingTimeMs", 0)
            job.tokensProcessed = metrics.get("tokensProcessed", 0)
            job.responsesProcessed = metrics.get("responsesProcessed", 0)
            job.memoryUsageMB = metrics.get("memoryUsageMB", 0.0)
            job.error = None
            session.commit()

    @staticmethod
    def fail_job(session, job_id: str, error_msg: str):
        job = session.query(AnalysisJob).filter_by(id=job_id).first()
        if job:
            job.retryCount += 1
            if job.retryCount >= job.maxRetries:
                job.status = "DEAD_LETTER"
            else:
                job.status = "PENDING"
            job.error = error_msg
            job.completedAt = datetime.utcnow()
            session.commit()
