import time
from .interface import PipelineStage, DocState

class ContradictionStage(PipelineStage):
    @property
    def name(self) -> str:
        return "contradiction"

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        text = doc.clean_text
        if not text:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        # 1. Check for extreme conflicting adjectives in the same text
        has_positive_cue = any(w in text for w in ["love", "amazing", "excellent", "great", "perfect", "awesome"])
        has_negative_cue = any(w in text for w in ["hate", "terrible", "worst", "garbage", "never buy", "never purchase", "waste"])
        
        # 2. Check for conflicting aspect clauses
        has_strong_pos_aspect = any(a["score"] >= 2.0 for a in doc.aspects)
        has_strong_neg_aspect = any(a["score"] <= -2.0 for a in doc.aspects)
        
        if (has_positive_cue and has_negative_cue) or (has_strong_pos_aspect and has_strong_neg_aspect):
            doc.is_contradictory = True
            doc.explanations.append("Layer 15: Conflicting/contradictory expressions identified inside the response.")
            
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
