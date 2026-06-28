import os
import time
import yaml
from .interface import PipelineStage, DocState

_competitor_config = None

def get_competitor_config():
    global _competitor_config
    if _competitor_config is not None:
        return _competitor_config
        
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    comp_path = os.path.join(backend_dir, "rules", "competitor.yaml")
    
    with open(comp_path, "r") as f:
        data = yaml.safe_load(f)
    _competitor_config = data
    return _competitor_config

class CompetitorStage(PipelineStage):
    @property
    def name(self) -> str:
        return "competitor"

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        text = doc.clean_text
        if not text:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        config = get_competitor_config()
        competitors = config.get("competitors", [])
        phrases = config.get("comparative_phrases", [])
        
        # 1. Detect if any competitor brand names are mentioned
        mentioned_competitors = []
        for comp in competitors:
            if f" {comp} " in f" {text} ":
                mentioned_competitors.append(comp)
                
        if mentioned_competitors:
            doc.competitor_mention = True
            doc.competitor_info = {
                "brands": mentioned_competitors,
                "preference": "Neutral"
            }
            doc.explanations.append(f"Layer 10: Competitor brand mention detected: {mentioned_competitors}")
            
        # 2. Check for comparative phrases that indicate switching preference
        for phrase_item in phrases:
            phrase = phrase_item["phrase"].lower()
            if phrase in text:
                # Exception: "rather buy this" or "rather buy our" is positive
                if phrase == "rather buy" and ("rather buy this" in text or "rather buy our" in text):
                    continue
                    
                doc.competitor_mention = True
                doc.overall_sentiment = phrase_item["sentiment"]
                doc.intent = phrase_item["intent"]
                doc.category = "Brand Preference"
                doc.theme = "Competitor Preference"
                doc.confidence = max(doc.confidence, 0.96)
                
                # Update competitor preference info
                doc.competitor_info = doc.competitor_info or {}
                doc.competitor_info["brands"] = doc.competitor_info.get("brands", ["unspecified_competitor"])
                doc.competitor_info["preference"] = "Competitor"
                
                # Force negative sentiment aspect mapping using ontology qualified name
                doc.aspects = [{
                    "aspect": "Price" if "buy" in phrase or "price" in text else "Product.Taste",
                    "clause": doc.text,
                    "sentiment": "NEGATIVE",
                    "score": -2.5,
                    "triggers": [f"competitor-switching-phrase: {phrase}"]
                }]
                
                doc.explanations.append(f"Layer 10: Comparative competitor preference triggered: '{phrase}' (Switch Brand).")
                break
                
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
