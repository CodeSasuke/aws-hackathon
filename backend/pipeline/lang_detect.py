import time
import re
from .interface import PipelineStage, DocState

class LanguageDetectionStage(PipelineStage):
    @property
    def name(self) -> str:
        return "lang_detect"

    def __init__(self):
        # Common Hinglish terms to detect Hinglish code-mixing
        self.hinglish_cues = {
            "hai", "tha", "acha", "achha", "badhiya", "mast", "sahi", "bakwas", "kharab",
            "bekar", "bekaar", "nahi", "nahin", "bohot", "bahut", "lekin", "aur", "bhi",
            "kaise", "kya", "toh", "hi", "he", "yaar", "pasand", "ganda", "accha"
        }
        
        # Hinglish to English translation dictionary
        self.hinglish_translation = {
            r"\bachha\b": "good",
            r"\baccha\b": "good",
            r"\bacha\b": "good",
            r"\bbadiya\b": "good",
            r"\bbadhiya\b": "good",
            r"\bmast\b": "good",
            r"\bsahi\b": "good",
            r"\bbakwas\b": "bad",
            r"\bkharab\b": "bad",
            r"\bbekar\b": "bad",
            r"\bbekaar\b": "bad",
            r"\bganda\b": "bad",
            r"\bnahi\b": "not",
            r"\bnahin\b": "not",
            r"\bbohot\b": "very",
            r"\bbahut\b": "very",
            r"\blekin\b": "but",
            r"\baur\b": "and",
            r"\bpasand\b": "like",
            r"\bhai\b": "is",
            r"\btha\b": "was",
            r"\bthik\b": "ok",
            r"\btheek\b": "ok"
        }

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        text = doc.clean_text
        if not text:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        # 1. Detect Devanagari Script (Hindi)
        if re.search(r"[\u0900-\u097F]", text):
            doc.language = "Hindi"
            doc.explanations.append("Layer 1: Hindi script detected.")
        else:
            # 2. Detect Hinglish Code-Mixed
            words = set(text.split())
            matching_cues = words.intersection(self.hinglish_cues)
            
            if len(matching_cues) >= 1:
                doc.language = "Hinglish"
                doc.explanations.append(f"Layer 1: Hinglish code-mixed language detected (matched cues: {list(matching_cues)}).")
                
                # Normalize / Translate Hinglish to English keywords
                normalized_text = text
                for hinglish_regex, english_word in self.hinglish_translation.items():
                    normalized_text = re.sub(hinglish_regex, english_word, normalized_text)
                
                doc.clean_text = normalized_text
                doc.explanations.append(f"Layer 1: Hinglish normalized to: '{doc.clean_text}'")
            else:
                doc.language = "English"
                doc.explanations.append("Layer 1: English language detected.")

        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
