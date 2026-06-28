import re
import time
from .interface import PipelineStage, DocState

class NormalizerStage(PipelineStage):
    @property
    def name(self) -> str:
        return "normalizer"

    def __init__(self):
        # Common contractions
        self.contractions = {
            r"can't": "can not",
            r"cant": "can not",
            r"won't": "will not",
            r"wont": "will not",
            r"isn't": "is not",
            r"isnt": "is not",
            r"doesn't": "does not",
            r"doesnt": "does not",
            r"don't": "do not",
            r"dont": "do not",
            r"shouldn't": "should not",
            r"shouldnt": "should not",
            r"wouldn't": "would not",
            r"wouldnt": "would not",
            r"i'm": "i am",
            r"im": "i am",
            r"it's": "it is",
            r"its": "it is",
            r"that's": "that is",
            r"thats": "that is",
            r"wasn't": "was not",
            r"wasnt": "was not"
        }
        
        # Common slang mappings
        self.slangs = {
            r"\bidk\b": "i do not know",
            r"\btbh\b": "to be honest",
            r"\bimo\b": "in my opinion",
            r"\bu\b": "you",
            r"\br\b": "are",
            r"\bur\b": "your",
            r"\bbtw\b": "by the way"
        }

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        text = doc.text.strip()
        if not text:
            doc.clean_text = ""
            doc.is_spam = True
            doc.explanations.append("Noise filtering: Empty response.")
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        # 1. Lowercasing
        text = text.lower()
        
        # 2. URL and Email Removal
        text = re.sub(r"https?://\S+|www\.\S+", "", text)
        text = re.sub(r"\S+@\S+\.\S+", "", text)
        
        # 3. Emoji & Emoticon semantic mapping
        text = text.replace(":-)", " good ").replace(":)", " good ").replace("=)", " good ")
        text = text.replace(":-(", " bad ").replace(":(", " bad ").replace("=(", " bad ")
        text = text.replace(":-d", " excellent ").replace(":d", " excellent ")
        
        # 4. Contraction Expansion
        for regex, expansion in self.contractions.items():
            text = re.sub(regex, expansion, text)
            
        # 5. Slang Expansion
        for regex, expansion in self.slangs.items():
            text = re.sub(regex, expansion, text)

        # 6. Repeated Character Normalization (e.g. goooood -> good, tasteeee -> taste)
        # Replaces characters repeated 3 or more times with 2 occurrences (e.g. goooood -> good)
        text = re.sub(r"(.)\1{2,}", r"\1\1", text)
        # Specifically fix common double-char extensions if needed, but standard regex handles most noise.
        
        # 7. Clean up excess spacing and punctuation noise
        text = re.sub(r"\s+", " ", text).strip()
        
        doc.clean_text = text
        doc.explanations.append("Layer 0: Text normalization complete.")
        
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
