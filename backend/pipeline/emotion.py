import time
from .interface import PipelineStage, DocState

class EmotionStage(PipelineStage):
    @property
    def name(self) -> str:
        return "emotion"

    def __init__(self):
        self.emotion_lexicon = {
            "Joy": ["love", "happy", "glad", "excited", "pleased", "thrilled", "excellent", "perfect", "delicious", "tasty", "sweet"],
            "Frustration": ["frustrated", "annoyed", "irritated", "slow", "pain", "bother", "hard", "difficult", "annoy", "bothersome", "harsh"],
            "Anger": ["angry", "mad", "furious", "hate", "terrible", "garbage", "crap", "worst", "waste", "useless", "trash"],
            "Trust": ["trust", "loyal", "rely", "always", "honest", "classic", "depend", "recommend", "consistent", "standard"],
            "Confusion": ["confused", "dont understand", "don't understand", "misleading", "unclear", "explain", "why", "how", "what", "not sure"],
            "Disappointment": ["disappointed", "sad", "wish", "let down", "regret", "pity", "disappointment", "unfortunately", "unfortunate"],
            "Surprise": ["surprised", "unexpected", "shocked", "wow", "suddenly", "impressed", "impressive", "different", "different than"]
        }

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        text = doc.clean_text
        if not text:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        matched_emotions = []
        for emotion, keywords in self.emotion_lexicon.items():
            if any(kw in text for kw in keywords):
                matched_emotions.append(emotion)
                
        doc.emotions = matched_emotions
        if matched_emotions:
            doc.explanations.append(f"Layer 12: Emotion detection complete: {matched_emotions}")
            
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
