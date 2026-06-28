import time
from .interface import PipelineStage, DocState

class EnsembleStage(PipelineStage):
    @property
    def name(self) -> str:
        return "ensemble"

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        # Resolve final categorizations and confidence fusions
        # 1. spam checks
        if len(doc.clean_text.strip()) < 2:
            doc.is_spam = True
            doc.overall_sentiment = "NEUTRAL"
            doc.confidence = 1.0
            doc.category = "Spam/Noise"
            doc.theme = "Blank Response"
            doc.suggested_action = "Discard from report."
            doc.explanations.append("Layer 20: Classified as Spam (Length filter).")
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        # 2. If phrase override has already assigned values, preserve it
        is_phrase_match = any("idiom-match" in "".join(a.get("triggers", [])) for a in doc.aspects)
        is_comp_override = any("competitor" in "".join(a.get("triggers", [])) for a in doc.aspects)
        
        if is_phrase_match:
            doc.confidence = 0.98
            doc.explanations.append("Layer 20: Confirmed classification from Phrase Dictionary matches.")
        elif is_comp_override:
            doc.confidence = 0.96
            doc.explanations.append("Layer 20: Confirmed classification from Competitor comparative phrases.")
        else:
            # Standard fusion
            # Find dominant aspect and assign doc-level category/theme
            if doc.aspects:
                # Find aspect with highest absolute score or first aspect
                dominant_aspect = max(doc.aspects, key=lambda a: abs(a["score"]))
                aspect_name = dominant_aspect["aspect"]
                
                # Split root vs subcat
                parts = aspect_name.split(".")
                doc.category = parts[0]
                doc.theme = parts[1] if len(parts) > 1 else f"General {parts[0]}"
                doc.product_area = parts[0]
                
                # Derive suggested action based on sentiment
                if dominant_aspect["sentiment"] == "POSITIVE":
                    doc.suggested_action = f"Maintain high performance in {doc.theme}."
                elif dominant_aspect["sentiment"] == "NEGATIVE":
                    doc.suggested_action = f"Address user complaints regarding {doc.theme}."
                    doc.urgency = 3
                else:
                    doc.suggested_action = f"Monitor feedback regarding {doc.theme}."
            else:
                doc.category = "General"
                doc.theme = "General Feedback"
                doc.product_area = "General"
                doc.suggested_action = "Review general qualitative responses."

        # Add versions to nlpMetadata for complete auditability
        doc.nlpMetadata = doc.nlpMetadata or {}
        doc.nlpMetadata["pipelineVersion"] = "1.0.0"
        doc.nlpMetadata["embeddingModel"] = "BAAI/bge-small-en-v1.5"
        doc.nlpMetadata["parserModel"] = "en_core_web_sm"
        doc.nlpMetadata["ruleSet"] = "valence-shifter-v1.0"
        doc.nlpMetadata["ontology"] = "beer-concept-v1.0"
        
        doc.explanations.append(f"Layer 20: Final Ensemble classification: sentiment={doc.overall_sentiment}, category={doc.category}, confidence={round(doc.confidence * 100)}%")
        
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
