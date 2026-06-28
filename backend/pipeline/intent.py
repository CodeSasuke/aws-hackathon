import time
from .interface import PipelineStage, DocState

class IntentStage(PipelineStage):
    @property
    def name(self) -> str:
        return "intent"

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        text = doc.clean_text
        if not text:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        # Prioritize competitor intent (Switch Brand) if already assigned in Layer 10
        if doc.intent == "Switch Brand":
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        intent = "Feedback"
        
        # Resolve mixed aspects to Feedback
        has_pos = any(a["sentiment"] == "POSITIVE" for a in doc.aspects)
        has_neg = any(a["sentiment"] == "NEGATIVE" for a in doc.aspects)
        
        # 1. Mixed aspects -> Feedback
        if has_pos and has_neg:
            intent = "Feedback"
        # 2. Purchase Again Intent
        elif any(p in text for p in ["buy again", "purchase again", "will buy", "will purchase", "regular buy", "definitely buy", "rather buy this", "rather buy our"]):
            intent = "Purchase Again"
        # 3. Refund Intent
        elif any(p in text for p in ["refund", "money back", "return", "chargeback"]):
            intent = "Refund"
        # 4. Feature Request Intent
        elif any(p in text for p in ["should", "needs", "need", "wish", "please make", "would like", "can you", "should be"]):
            intent = "Feature Request"
        # 5. Question / Inquiry Intent
        elif any(p in text for p in ["why", "how", "what", "question", "inquire", "ask"]):
            intent = "Inquiry"
        # 6. Praise Intent
        elif doc.overall_sentiment == "POSITIVE" and any(p in text for p in ["love", "great", "excellent", "awesome", "perfect", "good", "thanks"]):
            intent = "Praise"
        # 7. Complaint Intent
        elif doc.overall_sentiment == "NEGATIVE" and any(p in text for p in ["bad", "poor", "terrible", "issue", "dislike", "hate", "worst", "broke", "soap", "soapy", "watered", "watery", "disappointed", "disgust", "crap"]):
            intent = "Complaint"
            
        doc.intent = intent
        doc.explanations.append(f"Layer 11: Intent detection complete: '{intent}'")
        
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
