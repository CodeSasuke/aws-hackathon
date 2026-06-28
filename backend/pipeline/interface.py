from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class DocState:
    def __init__(self, doc_id: str, text: str):
        self.id: str = doc_id
        self.text: str = text
        self.clean_text: str = text
        self.language: str = "English"
        
        # NLP Parsed details
        self.tokens: List[Dict[str, Any]] = []
        self.spacy_doc: Any = None # Keep reference if needed internally
        
        # Rich Payload Properties
        self.nlpMetadata: Dict[str, Any] = {}
        self.aspects: List[Dict[str, Any]] = []
        self.overall_sentiment: str = "NEUTRAL"
        self.category: str = "Other"
        self.theme: str = "General Feedback"
        self.intent: str = "Feedback"
        self.urgency: int = 1
        self.product_area: str = "General"
        self.suggested_action: str = "Review feedback details."
        self.emotions: List[str] = []
        self.feature_requests: List[str] = []
        self.competitor_mention: bool = False
        self.competitor_info: Optional[Dict[str, Any]] = None
        self.temporal: Optional[Dict[str, Any]] = None
        self.is_contradictory: bool = False
        self.is_spam: bool = False
        self.is_duplicate: bool = False
        self.representative_quote: Optional[str] = None
        self.cluster_id: Optional[str] = None
        
        # Engine details
        self.confidence: float = 1.0
        self.explanations: List[str] = []
        self.timings: Dict[str, float] = {}

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "language": self.language,
            "overallSentiment": self.overall_sentiment,
            "category": self.category,
            "theme": self.theme,
            "intent": self.intent,
            "urgency": self.urgency,
            "productArea": self.product_area,
            "suggestedAction": self.suggested_action,
            "aspects": self.aspects,
            "emotions": self.emotions,
            "featureRequests": self.feature_requests,
            "competitorMention": self.competitor_mention,
            "competitorInfo": self.competitor_info,
            "temporal": self.temporal,
            "isContradictory": self.is_contradictory,
            "isSpam": self.is_spam,
            "isDuplicate": self.is_duplicate,
            "representativeQuote": self.representative_quote,
            "clusterId": self.cluster_id,
            "confidence": self.confidence,
            "explanation": self.explanations,
            "timings": self.timings
        }

class PipelineStage(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def process(self, doc: DocState) -> DocState:
        pass
