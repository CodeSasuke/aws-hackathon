import os
import time
import yaml
from typing import List, Dict, Any
from .interface import PipelineStage, DocState
from .negation import get_negators

class ValenceStage(PipelineStage):
    @property
    def name(self) -> str:
        return "valence"

    def __init__(self):
        # Local lexicon mapping words to base valence scores
        self.lexicon = {
            # Positive
            "good": 2.0,
            "great": 3.0,
            "amazing": 3.5,
            "excellent": 4.0,
            "perfect": 4.0,
            "awesome": 3.5,
            "love": 3.0,
            "like": 1.5,
            "nice": 2.0,
            "smooth": 2.0,
            "tasty": 2.5,
            "delicious": 3.0,
            "fine": 1.0,
            "impressed": 2.5,
            "refreshing": 2.5,
            "clean": 1.5,
            "praise": 2.0,
            "classic": 1.5,
            "sweet": 1.5,
            
            # Negative
            "bad": -2.0,
            "poor": -3.0,
            "terrible": -4.0,
            "horrible": -3.5,
            "soap": -2.0,
            "soapy": -2.0,
            "hate": -3.0,
            "dislike": -2.0,
            "issue": -2.0,
            "error": -2.0,
            "slow": -2.0,
            "fail": -3.0,
            "failed": -3.0,
            "defect": -3.0,
            "harsh": -2.0,
            "expensive": -2.0,
            "costly": -2.0,
            "weak": -1.5,
            "watery": -1.5,
            "heavy": -1.0,
            "disappointed": -3.0,
            "disgust": -3.0,
            "anger": -3.0,
            "frustrated": -3.0
        }
        
        # Load intensifiers / downtoners from negation.yaml
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        negation_path = os.path.join(backend_dir, "rules", "negation.yaml")
        
        if os.path.exists(negation_path):
            with open(negation_path, "r") as f:
                data = yaml.safe_load(f)
            self.intensifiers = data.get("intensifiers", {})
            self.downtoners = data.get("downtoners", {})
        else:
            self.intensifiers = {"very": 1.5}
            self.downtoners = {"slightly": 0.5}

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        tokens = doc.tokens
        if not tokens:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        negated_tokens = set(doc.nlpMetadata.get("negated_tokens", []))
        
        # Score each aspect clause found in doc.aspects
        scored_aspects = []
        overall_score = 0.0
        has_positive_clause = False
        has_negative_clause = False
        
        for aspect_item in doc.aspects:
            clause_tokens = aspect_item["tokens"]
            clause_score = 0.0
            matched_words = []
            
            # Look for amplifiers and downtoners inside the clause
            multiplier = 1.0
            for t in clause_tokens:
                t_lower = t.lower()
                if t_lower in self.intensifiers:
                    multiplier *= self.intensifiers[t_lower]
                elif t_lower in self.downtoners:
                    multiplier *= self.downtoners[t_lower]
            
            for t in clause_tokens:
                t_lower = t.lower()
                # Check base lexicon matching
                if t_lower in self.lexicon:
                    base_val = self.lexicon[t_lower]
                    
                    # Sarcasm override: "oh great" behaves as negative
                    if t_lower == "great" and "oh great" in doc.clean_text:
                        base_val = -2.0
                    
                    # Apply multiplier (intensifier/downtoner)
                    val = base_val * multiplier
                    
                    # Apply negation inversion
                    if t_lower in negated_tokens:
                        val *= -1.0
                        matched_words.append(f"not-{t_lower} ({val})")
                    else:
                        matched_words.append(f"{t_lower} ({val})")
                        
                    clause_score += val
                    
            sentiment_label = "NEUTRAL"
            if clause_score > 0.3:
                sentiment_label = "POSITIVE"
                has_positive_clause = True
            elif clause_score < -0.3:
                sentiment_label = "NEGATIVE"
                has_negative_clause = True
                
            scored_aspects.append({
                "aspect": aspect_item["aspect"],
                "clause": aspect_item["clause"],
                "tokens": aspect_item["tokens"],
                "sentiment": sentiment_label,
                "score": round(clause_score, 2),
                "triggers": matched_words
            })
            
            overall_score += clause_score
            
        doc.aspects = scored_aspects
        
        # Resolve overall document sentiment
        doc_sentiment = "NEUTRAL"
        if has_positive_clause and has_negative_clause:
            doc_sentiment = "NEUTRAL" # Mixed feedback maps to Neutral overall
        elif overall_score > 0.4:
            doc_sentiment = "POSITIVE"
        elif overall_score < -0.4:
            doc_sentiment = "NEGATIVE"
            
        doc.overall_sentiment = doc_sentiment
        
        # Calculate a basic confidence score based on lexicon coverage and score strength
        lexicon_hits = sum(len(a["triggers"]) for a in scored_aspects)
        if lexicon_hits > 0:
            doc.confidence = min(0.95, 0.70 + (0.05 * lexicon_hits))
        else:
            doc.confidence = 0.75 # Default fallback certainty
            
        doc.explanations.append(f"Layer 7: Valence sentiment score resolved: {round(overall_score, 2)} ({doc_sentiment})")
        
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
