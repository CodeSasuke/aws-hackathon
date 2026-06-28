import os
import time
import yaml
from typing import List, Dict, Any, Optional
from .interface import PipelineStage, DocState

_project_config_cache: Dict[str, dict] = {}
_comparison_phrases: Optional[list] = None

def get_project_config(project_id: Optional[str] = None, nlp_config: dict = None) -> dict:
    if nlp_config and ("primaryBrand" in nlp_config or "competitors" in nlp_config):
        primary = nlp_config.get("primaryBrand", "SurveyIQ")
        comps = []
        for comp in nlp_config.get("competitors", []):
            if isinstance(comp, dict):
                name = comp.get("name")
                aliases = comp.get("aliases", [])
                if name:
                    comps.append(name)
                for alias in aliases:
                    if alias:
                        comps.append(alias)
            elif isinstance(comp, str):
                comps.append(comp)
        return {
            "primaryBrand": primary,
            "competitors": comps
        }

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
            
        config = get_project_config(doc.project_id, doc.nlp_config)
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

def discover_potential_competitors(session, project_id: str, doc_states: list, nlp_config: dict) -> None:
    from collections import Counter
    import uuid
    from database.models import CompetitorSuggestion
    
    candidate_counts = Counter()
    
    comp_keywords = {"prefer", "better than", "worse than", "switched to", "going back to", "rather buy", "compared to", "instead of", "switching", "than"}
    
    primary_brand = (nlp_config or {}).get("primaryBrand", "SurveyIQ").lower()
    configured_brands = set()
    for comp in (nlp_config or {}).get("competitors", []):
        if isinstance(comp, dict):
            configured_brands.add(comp.get("name", "").lower())
            for alias in comp.get("aliases", []):
                configured_brands.add(alias.lower())
        elif isinstance(comp, str):
            configured_brands.add(comp.lower())
            
    stopwords_to_ignore = {
        "i", "we", "you", "they", "he", "she", "it", "me", "us", "them", "him", "her",
        "surveyiq", "app", "application", "software", "system", "program", "tool", "website",
        "company", "competitor", "competitors", "product", "products", "service", "services",
        "price", "quality", "taste", "packaging", "beer", "flavor", "bottle", "can",
        "one", "time", "day", "month", "year", "people", "user", "users", "customer", "customers",
        "support", "team", "staff", "manager", "representative", "phone", "email", "chat",
        "google", "amazon", "apple", "microsoft", "michelob", "ultra", "michelob ultra",
        "survey", "feedback", "response", "question", "answer", "platform"
    }
    
    for doc in doc_states:
        spacy_doc = doc.spacy_doc
        if not spacy_doc:
            continue
            
        text_lower = doc.clean_text.lower()
        in_comparison_context = any(k in text_lower for k in comp_keywords)
        
        # Extract Named Entities of type ORG or PRODUCT
        for ent in spacy_doc.ents:
            if ent.label_ in ("ORG", "PRODUCT"):
                ent_text = ent.text.strip()
                ent_lower = ent_text.lower()
                
                if len(ent_text) < 3 or len(ent_text) > 40:
                    continue
                if ent_lower in stopwords_to_ignore or primary_brand in ent_lower:
                    continue
                if ent_lower in configured_brands:
                    continue
                if any(stop == ent_lower or stop in ent_lower for stop in stopwords_to_ignore):
                    continue
                    
                weight = 2 if in_comparison_context else 1
                candidate_counts[ent_text] += weight
                
        # Fallback proper noun matching
        for token in spacy_doc:
            if token.pos_ == "PROPN":
                token_text = token.text.strip()
                token_lower = token_text.lower()
                
                if len(token_text) < 3 or len(token_text) > 30:
                    continue
                if token_lower in stopwords_to_ignore or primary_brand in token_lower:
                    continue
                if token_lower in configured_brands:
                    continue
                if any(stop == token_lower or stop in token_lower for stop in stopwords_to_ignore):
                    continue
                    
                is_near_comp = False
                idx = token.i
                start_idx = max(0, idx - 4)
                end_idx = min(len(spacy_doc), idx + 5)
                for t in spacy_doc[start_idx:end_idx]:
                    if t.text.lower() in comp_keywords:
                        is_near_comp = True
                        break
                
                if is_near_comp:
                    candidate_counts[token_text] += 2
                    
    # Upsert suggestions
    for brand, weight in candidate_counts.items():
        # Title case to be nice
        brand_cleaned = brand.strip()
        if not any(char.isalpha() for char in brand_cleaned):
            continue
            
        existing = session.query(CompetitorSuggestion).filter_by(projectId=project_id, brandName=brand_cleaned).first()
        
        mentions_raw = max(1, weight // 2)
        conf_score = min(0.98, 0.5 + (weight * 0.05))
        
        if existing:
            if existing.status == "PENDING":
                existing.mentions += mentions_raw
                existing.confidence = max(existing.confidence, conf_score)
        else:
            suggestion = CompetitorSuggestion(
                id="cuid_" + str(uuid.uuid4())[:8],
                projectId=project_id,
                brandName=brand_cleaned,
                mentions=mentions_raw,
                confidence=conf_score,
                status="PENDING"
            )
            session.add(suggestion)
            
    session.commit()
