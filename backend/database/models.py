from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from .connection import Base

class Project(Base):
    __tablename__ = "Project"
    
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="PENDING")
    organizationId = Column(String, nullable=False)
    createdById = Column(String, nullable=False)
    nlpConfig = Column(JSON, nullable=True)
    createdAt = Column(DateTime, default=func.now())
    updatedAt = Column(DateTime, default=func.now(), onupdate=func.now())

class SurveyFile(Base):
    __tablename__ = "SurveyFile"
    
    id = Column(String, primary_key=True)
    projectId = Column(String, ForeignKey("Project.id", ondelete="CASCADE"), nullable=False)
    s3Key = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    fileSize = Column(Integer, nullable=False)
    totalRowCount = Column(Integer, nullable=False)
    columnMappings = Column(JSON, nullable=False)
    createdAt = Column(DateTime, default=func.now())

class Response(Base):
    __tablename__ = "Response"
    
    id = Column(String, primary_key=True)
    projectId = Column(String, ForeignKey("Project.id", ondelete="CASCADE"), nullable=False)
    rowIndex = Column(Integer, nullable=False)
    rawData = Column(JSON, nullable=False)
    responseHash = Column(String, nullable=False)
    
    # Enrichment fields
    sentiment = Column(String, nullable=True)
    themeId = Column(String, ForeignKey("Theme.id", ondelete="SET NULL"), nullable=True)
    category = Column(String, nullable=True)
    intent = Column(String, nullable=True)
    urgency = Column(Integer, nullable=True)
    productArea = Column(String, nullable=True)
    suggestedAction = Column(String, nullable=True)
    confidenceScore = Column(Float, nullable=True)
    isSpam = Column(Boolean, default=False, nullable=False)
    isDuplicate = Column(Boolean, default=False, nullable=False)
    representativeQuote = Column(String, nullable=True)
    clusterId = Column(String, nullable=True)
    
    # Versioning & JSONB metadata
    language = Column(String, default="English", nullable=True)
    processedAt = Column(DateTime, nullable=True)
    nlpVersion = Column(String, nullable=True)
    ontologyVersion = Column(String, nullable=True)
    ruleVersion = Column(String, nullable=True)
    nlpMetadata = Column(JSON, nullable=True)
    
    createdAt = Column(DateTime, default=func.now())

class Theme(Base):
    __tablename__ = "Theme"
    
    id = Column(String, primary_key=True)
    projectId = Column(String, ForeignKey("Project.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    count = Column(Integer, default=0, nullable=False)
    createdAt = Column(DateTime, default=func.now())

class AnalysisJob(Base):
    __tablename__ = "AnalysisJob"
    
    id = Column(String, primary_key=True)
    projectId = Column(String, ForeignKey("Project.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="PENDING", nullable=False)
    priority = Column(Integer, default=0, nullable=False)
    progress = Column(Integer, default=0, nullable=False)
    retryCount = Column(Integer, default=0, nullable=False)
    maxRetries = Column(Integer, default=3, nullable=False)
    workerId = Column(String, nullable=True)
    error = Column(String, nullable=True)
    
    # Heartbeat
    heartbeatAt = Column(DateTime, nullable=True)
    leaseExpiresAt = Column(DateTime, nullable=True)
    
    # Telemetry
    processingTimeMs = Column(Integer, default=0, nullable=False)
    tokensProcessed = Column(Integer, default=0, nullable=False)
    responsesProcessed = Column(Integer, default=0, nullable=False)
    memoryUsageMB = Column(Float, default=0.0, nullable=False)
    
    createdAt = Column(DateTime, default=func.now())
    startedAt = Column(DateTime, nullable=True)
    completedAt = Column(DateTime, nullable=True)

class AuditLog(Base):
    __tablename__ = "AuditLog"
    
    id = Column(String, primary_key=True)
    userId = Column(String, nullable=False)
    projectId = Column(String, nullable=True)
    action = Column(String, nullable=False)
    metadata = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=func.now())

class CompetitorSuggestion(Base):
    __tablename__ = "CompetitorSuggestion"
    
    id = Column(String, primary_key=True)
    projectId = Column(String, ForeignKey("Project.id", ondelete="CASCADE"), nullable=False)
    brandName = Column(String, nullable=False)
    mentions = Column(Integer, default=0, nullable=False)
    confidence = Column(Float, default=0.0, nullable=False)
    status = Column(String, default="PENDING", nullable=False)
    createdAt = Column(DateTime, default=func.now())
    updatedAt = Column(DateTime, default=func.now(), onupdate=func.now())
