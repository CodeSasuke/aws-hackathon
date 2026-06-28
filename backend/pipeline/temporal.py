import time
from .interface import PipelineStage, DocState

class TemporalStage(PipelineStage):
    @property
    def name(self) -> str:
        return "temporal"

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        text = doc.clean_text
        if not text:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        # Detect patterns representing changes over time
        # E.g. "used to love it but now it is bad"
        is_used_to_now = "used to" in text and ("now" in text or "today" in text or "but" in text)
        is_previously_now = ("previously" in text or "past" in text or "before" in text) and "now" in text
        
        if is_used_to_now or is_previously_now:
            # We determine historical vs current based on clause patterns
            # Used to [positive word] -> historical POSITIVE, current NEGATIVE (since they are providing feedback now)
            # Standard valence resolver will yield negative overall if they say "but now it is bad".
            historical = "NEUTRAL"
            current = doc.overall_sentiment
            
            # Simple keyword cues for the historical clause
            first_half = text.split("but")[0] if "but" in text else text
            if any(w in first_half for w in ["love", "like", "great", "good", "favorite", "enjoyed"]):
                historical = "POSITIVE"
            elif any(w in first_half for w in ["hate", "bad", "dislike", "poor", "terrible"]):
                historical = "NEGATIVE"
                
            doc.temporal = {
                "historical_sentiment": historical,
                "current_sentiment": current,
                "transition": "used_to_now" if is_used_to_now else "previously_now"
            }
            doc.explanations.append(f"Layer 14: Temporal sentiment shift detected: Historical={historical} -> Current={current}")
            
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
