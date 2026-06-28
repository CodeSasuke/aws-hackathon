import time
from typing import List
from .interface import DocState, PipelineStage
from .normalizer import NormalizerStage
from .lang_detect import LanguageDetectionStage
from .parser import ParserStage
from .aspect import AspectStage
from .negation import NegationStage
from .valence import ValenceStage
from .contrast import ContrastStage
from .phrases import PhraseMatchingStage
from .competitor import CompetitorStage
from .intent import IntentStage
from .emotion import EmotionStage
from .suggestion import SuggestionStage
from .temporal import TemporalStage
from .contradiction import ContradictionStage
from .ensemble import EnsembleStage

class AnalysisEngine:
    def __init__(self):
        # Instantiate stages in order
        self.stages: List[PipelineStage] = [
            NormalizerStage(),
            LanguageDetectionStage(),
            ParserStage(),
            AspectStage(),
            NegationStage(),
            ValenceStage(),
            ContrastStage(),
            PhraseMatchingStage(),
            CompetitorStage(),
            IntentStage(),
            EmotionStage(),
            SuggestionStage(),
            TemporalStage(),
            ContradictionStage(),
            EnsembleStage()
        ]

    def analyze_comment(self, doc_id: str, text: str, project_metadata: dict = None) -> DocState:
        doc = DocState(doc_id, text)
        
        # Sequentially process each stage
        for stage in self.stages:
            try:
                doc = stage.process(doc)
            except Exception as e:
                # Log error and continue to avoid crashing the whole pipeline
                doc.explanations.append(f"Error in stage '{stage.name}': {str(e)}")
                doc.timings[stage.name] = 0.0
                
        return doc

    def analyze_batch(self, items: List[dict]) -> List[DocState]:
        # Batch analysis helper
        results = []
        for item in items:
            doc = self.analyze_comment(item["id"], item["text"])
            results.append(doc)
        return results
