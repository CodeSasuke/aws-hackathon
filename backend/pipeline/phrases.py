import os
import time
import yaml
from .interface import PipelineStage, DocState

_phrases_config = None

def get_phrases_config():
    global _phrases_config
    if _phrases_config is not None:
        return _phrases_config
        
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    phrases_path = os.path.join(backend_dir, "rules", "phrases.yaml")
    
    with open(phrases_path, "r") as f:
        data = yaml.safe_load(f)
    _phrases_config = data.get("phrase_overrides", [])
    return _phrases_config

class PhraseMatchingStage(PipelineStage):
    @property
    def name(self) -> str:
        return "phrases"

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        text = doc.clean_text
        if not text:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        overrides = get_phrases_config()
        
        for item in overrides:
            phrase = item["phrase"].lower()
            if phrase in text:
                # Override document classification fields directly
                doc.overall_sentiment = item["sentiment"]
                doc.category = item["category"]
                doc.theme = item["theme"]
                doc.intent = item.get("intent", doc.intent)
                doc.confidence = 0.98  # Very high confidence for exact idiomatic phrase match
                
                # Clear standard parsed aspects and set a dedicated phrase aspect
                doc.aspects = [{
                    "aspect": item["category"],
                    "clause": doc.text,
                    "sentiment": item["sentiment"],
                    "score": 3.0 if item["sentiment"] == "POSITIVE" else -3.0 if item["sentiment"] == "NEGATIVE" else 0.0,
                    "triggers": [f"idiom-match: {phrase}"]
                }]
                
                doc.explanations.append(f"Layer 9: Phrase match override triggered for idiom: '{phrase}'.")
                break # Stop at first matched override
                
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
