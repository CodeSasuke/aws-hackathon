import os
import time
import yaml
from typing import List, Dict, Any, Optional
from .interface import PipelineStage, DocState

_project_config_cache: Dict[str, dict] = {}
_comparison_phrases: Optional[list] = None

def get_project_config(project_id: Optional[str] = None) -> dict:
    cache_key = project_id or "default"
    if cache_key in _project_config_cache:
        return _project_config_cache[cache_key]
        
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    default_path = os.path.join(backend_dir, "config", "default", "competitors.yaml")
    
    config = {
        "primaryBrand": "SurveyIQ",
        "competitors": []
    }
    
    if os.path.exists(default_path):
        with open(default_path, "r") as f:
            default_data = yaml.safe_load(f)
        config["primaryBrand"] = default_data.get("primaryBrand", "SurveyIQ")
        config["competitors"] = default_data.get("competitors", [])
        
    if project_id:
        proj_path = os.path.join(backend_dir, "config", f"project_{project_id}", "competitors.yaml")
        if os.path.exists(proj_path):
            with open(proj_path, "r") as f:
                proj_data = yaml.safe_load(f)
            config["primaryBrand"] = proj_data.get("primaryBrand", config["primaryBrand"])
            config["competitors"] = proj_data.get("competitors", config["competitors"])
            
    _project_config_cache[cache_key] = config
    return config

def get_global_comparison_phrases() -> list:
    global _comparison_phrases
    if _comparison_phrases is not None:
        return _comparison_phrases
        
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    comp_path = os.path.join(backend_dir, "rules", "comparison.yaml")
    
    if not os.path.exists(comp_path):
        return []
        
    with open(comp_path, "r") as f:
        data = yaml.safe_load(f)
    _comparison_phrases = data.get("comparative_phrases", [])
    return _comparison_phrases

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
            
        config = get_project_config(doc.project_id)
        primary_brand = config.get("primaryBrand", "SurveyIQ").lower()
        competitors = config.get("competitors", [])
        
        # 1. Detect if any competitor brand names are mentioned
        mentioned_competitors = []
        for comp in competitors:
            comp_lower = comp.lower()
            if f" {comp_lower} " in f" {text} ":
                mentioned_competitors.append(comp)
                
        primary_mentioned = f" {primary_brand} " in f" {text} "
        
        if mentioned_competitors:
            doc.competitor_mention = True
            doc.competitor_info = {
                "brands": mentioned_competitors,
                "preference": "Neutral"
            }
            doc.explanations.append(f"Layer 10: Competitor brand mention detected: {mentioned_competitors}")
            
        # 2. Check for comparative phrases
        comparative_phrases = get_global_comparison_phrases()
        triggered_phrase = None
        phrase_sentiment = "NEGATIVE"
        phrase_intent = "Switch Brand"
        
        for phrase_item in comparative_phrases:
            phrase = phrase_item["phrase"].lower()
            if phrase in text:
                triggered_phrase = phrase
                phrase_sentiment = phrase_item["sentiment"]
                phrase_intent = phrase_item["intent"]
                break
                
        # Also support generic comparative words near competitor mentions
        generic_comparisons = ["prefer", "better than", "worse than", "switched to", "going back to", "rather buy", "compared to", "rather have", "instead of"]
        has_comparative_cue = any(c in text for c in generic_comparisons)
        
        # If triggered by a global phrase OR dynamically by a competitor + comparative verb
        if triggered_phrase or (mentioned_competitors and has_comparative_cue):
            # Exception: "rather buy this/our" is positive choice
            if "rather buy this" in text or "rather buy our" in text:
                pass
            else:
                doc.competitor_mention = True
                
                # Determine preference direction
                # If competitor is mentioned in a comparative context, it's a switch
                is_switching = True
                # If they say "prefer [primaryBrand]", it is a positive choice for primary!
                if primary_mentioned and any(x in text for x in ["prefer " + primary_brand, "better than " + primary_brand]):
                    is_switching = False
                    
                if is_switching:
                    doc.overall_sentiment = phrase_sentiment
                    doc.intent = phrase_intent
                    doc.category = "Brand Preference"
                    doc.theme = "Competitor Preference"
                    doc.confidence = max(doc.confidence, 0.96)
                    
                    doc.competitor_info = doc.competitor_info or {}
                    doc.competitor_info["brands"] = mentioned_competitors if mentioned_competitors else ["unspecified_competitor"]
                    doc.competitor_info["preference"] = "Competitor"
                    
                    # Force negative aspect sentiment
                    doc.aspects = [{
                        "aspect": "Price" if any(x in (triggered_phrase or "") or x in text for x in ["buy", "price", "expensive"]) else "Product.Taste",
                        "clause": doc.text,
                        "sentiment": "NEGATIVE",
                        "score": -2.5,
                        "triggers": [f"competitor-switching: {triggered_phrase or 'competitor + comparative_cue'}"]
                    }]
                    doc.explanations.append(f"Layer 10: Comparative competitor preference triggered: '{triggered_phrase or 'competitor + comparative cue'}' (Switch Brand).")
                else:
                    doc.competitor_info = doc.competitor_info or {}
                    doc.competitor_info["preference"] = "Primary"
                    doc.explanations.append(f"Layer 10: Primary brand preference matched positively.")
                    
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
