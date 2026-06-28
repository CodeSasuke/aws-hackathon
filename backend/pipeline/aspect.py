import os
import time
import yaml
import copy
from typing import List, Dict, Any
from .interface import PipelineStage, DocState

_ontology_cache = {}

def merge_dicts(dict1: dict, dict2: dict) -> dict:
    for k, v in dict2.items():
        if k == "synonyms" and isinstance(v, list) and k in dict1 and isinstance(dict1[k], list):
            dict1[k] = list(set(dict1[k] + v))
        elif isinstance(v, dict) and k in dict1 and isinstance(dict1[k], dict):
            merge_dicts(dict1[k], v)
        else:
            dict1[k] = v
    return dict1

def get_ontology(project_id: str = None, nlp_config: dict = None) -> dict:
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    default_path = os.path.join(backend_dir, "config", "default", "ontology.yaml")
    
    ontology = {}
    if os.path.exists(default_path):
        with open(default_path, "r") as f:
            default_data = yaml.safe_load(f)
        ontology = default_data.get("ontology", {})
        
    # Check if database configuration overrides are present
    if nlp_config and "categories" in nlp_config:
        compiled_ontology = {}
        for cat in nlp_config.get("categories", []):
            cat_name = cat.get("name")
            themes = cat.get("themes", [])
            cat_dict = {}
            for theme in themes:
                theme_name = theme.get("name")
                syns = theme.get("synonyms", [])
                cat_dict[theme_name] = {"synonyms": syns}
            compiled_ontology[cat_name] = cat_dict
        
        if compiled_ontology:
            ontology = merge_dicts(copy.deepcopy(ontology), compiled_ontology)
            return ontology

    # Fallback to local files cache
    cache_key = project_id or "default"
    if cache_key in _ontology_cache:
        return _ontology_cache[cache_key]
        
    if project_id:
        proj_path = os.path.join(backend_dir, "config", f"project_{project_id}", "ontology.yaml")
        if os.path.exists(proj_path):
            with open(proj_path, "r") as f:
                proj_data = yaml.safe_load(f)
            proj_ontology = proj_data.get("ontology", {})
            ontology = merge_dicts(copy.deepcopy(ontology), proj_ontology)
            
    _ontology_cache[cache_key] = ontology
    return ontology

class AspectStage(PipelineStage):
    @property
    def name(self) -> str:
        return "aspect"

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        spacy_doc = doc.spacy_doc
        if not spacy_doc:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        ontology = get_ontology(doc.project_id, doc.nlp_config)
        
        # Split document into clauses by conjunctions (e.g. but, and, although) 
        # or punctuations (comma, period)
        clauses = []
        current_clause = []
        
        for token in spacy_doc:
            # Conjunctions or punctuation break clauses
            if token.pos_ in ("CCONJ", "PUNCT") or token.text in (",", ".", ";", "but", "although", "yet"):
                if current_clause:
                    clauses.append(current_clause)
                    current_clause = []
                # Keep the conjunction in its own single-element list if it's a CC for contrast resolution later
                if token.text in ("but", "however", "although", "yet"):
                    clauses.append([token])
            else:
                current_clause.append(token)
        if current_clause:
            clauses.append(current_clause)

        # For each valid clause (excluding isolated conjunctions), find matched aspects
        extracted_aspects = []
        for clause in clauses:
            # Skip clauses that are just conjunctions
            if len(clause) == 1 and clause[0].text in ("but", "however", "although", "yet"):
                continue
                
            clause_text = " ".join([t.text for t in clause])
            clause_lemmas = [t.lemma_.lower() for t in clause]
            clause_words = [t.text.lower() for t in clause]
            
            # Search taxonomy
            for root_cat, details in ontology.items():
                is_nested = any(isinstance(v, dict) for k, v in details.items() if k != "synonyms")
                
                # If it's a direct root category (e.g. Price, Availability)
                if not is_nested:
                    # Skip Availability matches for positive choice phrases like "rather buy this"
                    if root_cat == "Availability" and ("rather buy this" in clause_text or "rather buy our" in clause_text):
                        continue
                        
                    syns = details.get("synonyms", [])
                    match = any(w in syns for w in clause_words) or any(l in syns for l in clause_lemmas)
                    if match:
                        extracted_aspects.append({
                            "aspect": root_cat,
                            "clause": clause_text,
                            "tokens": [t.text for t in clause]
                        })
                else:
                    # It's a nested root category (e.g. Product)
                    root_syns = details.get("synonyms", [])
                    root_match = any(w in root_syns for w in clause_words) or any(l in root_syns for l in clause_lemmas)
                    sub_match_found = False
                    
                    for sec_cat, sec_val in details.items():
                        if sec_cat == "synonyms":
                            continue
                        sec_syns = sec_val.get("synonyms", [])
                        sec_match = any(w in sec_syns for w in clause_words) or any(l in sec_syns for l in clause_lemmas)
                        
                        # Check subcategories (tertiary level)
                        subcategories = sec_val.get("subcategories", {})
                        for sub_cat, sub_val in subcategories.items():
                            sub_syns = sub_val.get("synonyms", [])
                            sub_match = any(w in sub_syns for w in clause_words) or any(l in sub_syns for l in clause_lemmas)
                            if sub_match:
                                extracted_aspects.append({
                                    "aspect": f"{root_cat}.{sec_cat}.{sub_cat}",
                                    "clause": clause_text,
                                    "tokens": [t.text for t in clause]
                                })
                                sub_match_found = True
                                
                        if sec_match and not sub_match_found:
                            extracted_aspects.append({
                                "aspect": f"{root_cat}.{sec_cat}",
                                "clause": clause_text,
                                "tokens": [t.text for t in clause]
                            })
                            sub_match_found = True
                            
                    # If root matches but no secondary/tertiary sub-match was found
                    if root_match and not sub_match_found:
                        extracted_aspects.append({
                            "aspect": root_cat,
                            "clause": clause_text,
                            "tokens": [t.text for t in clause]
                        })
                        sub_match_found = True
                        
            # If no aspects matched this clause, but the clause contains a general sentiment keyword, map to Product
            sentiment_cues = {"good", "bad", "amazing", "terrible", "great", "nice", "love", "like", "hate", "poor", "perfect", "awesome"}
            has_sentiment_cue = any(w in sentiment_cues for w in clause_words) or any(l in sentiment_cues for l in clause_lemmas)
            already_matched_clause = any(a["clause"] == clause_text for a in extracted_aspects)
            
            if has_sentiment_cue and not already_matched_clause:
                extracted_aspects.append({
                    "aspect": "Product",
                    "clause": clause_text,
                    "tokens": [t.text for t in clause]
                })
                        
        # Store temporary aspect clauses on document state
        doc.aspects = extracted_aspects
        doc.explanations.append(f"Layer 5: Aspect extraction complete. Identified aspects: {[a['aspect'] for a in extracted_aspects]}")
        
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
