import uuid
from datetime import datetime
from ..models import Response, Theme, AuditLog

class ResponseRepository:
    @staticmethod
    def get_project_responses(session, project_id: str):
        return session.query(Response).filter_by(projectId=project_id).order_by(Response.rowIndex.asc()).all()

    @staticmethod
    def get_response_by_id(session, response_id: str):
        return session.query(Response).filter_by(id=response_id).first()

    @staticmethod
    def update_response(session, response_id: str, updates: dict):
        response = session.query(Response).filter_by(id=response_id).first()
        if response:
            for key, val in updates.items():
                if hasattr(response, key):
                    setattr(response, key, val)
            response.processedAt = datetime.utcnow()
            session.commit()
        return response

    @staticmethod
    def get_or_create_theme(session, project_id: str, theme_name: str, category: str = None):
        theme = session.query(Theme).filter_by(projectId=project_id, name=theme_name).first()
        if not theme:
            theme = Theme(
                id="cuid_" + str(uuid.uuid4())[:8],
                projectId=project_id,
                name=theme_name,
                category=category,
                count=0
            )
            session.add(theme)
            session.commit()
            session.refresh(theme)
        return theme

    @staticmethod
    def update_theme_counts(session, project_id: str):
        # Recalculates theme counts from responses
        themes = session.query(Theme).filter_by(projectId=project_id).all()
        for t in themes:
            count = session.query(Response).filter_by(projectId=project_id, themeId=t.id).count()
            t.count = count
        session.commit()

    @staticmethod
    def log_override(session, user_id: str, project_id: str, response_id: str, field: str, old_val: str, new_val: str, reason: str):
        log = AuditLog(
            id="cuid_" + str(uuid.uuid4())[:8],
            userId=user_id,
            projectId=project_id,
            action="MANUAL_OVERRIDE",
            metadata={
                "responseId": response_id,
                "field": field,
                "oldValue": old_val,
                "newValue": new_val,
                "reason": reason
            }
        )
        session.add(log)
        session.commit()
        return log
