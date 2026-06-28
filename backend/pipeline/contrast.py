import time
from .interface import PipelineStage, DocState

class ContrastStage(PipelineStage):
    @property
    def name(self) -> str:
        return "contrast"

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        spacy_doc = doc.spacy_doc
        if not spacy_doc or not doc.aspects:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        # Check if the document contains contrastive conjunction markers
        contrast_markers = {"but", "however", "lekin", "yet", "although", "still"}
        text_words = [t.text.lower() for t in spacy_doc]
        
        has_contrast = any(m in text_words for m in contrast_markers)
        if not has_contrast:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        # Re-weight aspect scores based on contrast positions
        # Find index of the first contrast word in the token list
        contrast_indices = [idx for idx, w in enumerate(text_words) if w in contrast_markers]
        first_contrast_idx = contrast_indices[0] if contrast_indices else len(text_words)
        
        reweighted = []
        overall_score = 0.0
        
        for aspect_item in doc.aspects:
            # Reconstruct index of aspect words to see if they follow the contrast marker
            clause_tokens = aspect_item["tokens"]
            is_post_contrast = False
            
            # Simple heuristic: if the clause text matches words that appear after the contrast word, 
            # we increase its weight
            try:
                first_token = clause_tokens[0]
                token_pos_in_text = text_words.index(first_token.lower())
                if token_pos_in_text > first_contrast_idx:
                    is_post_contrast = True
            except ValueError:
                pass
                
            score = aspect_item["score"]
            if is_post_contrast:
                # Post-contrast clause gets 1.5x weight multiplier
                score = round(score * 1.5, 2)
                aspect_item["score"] = score
                aspect_item["triggers"].append("contrastive-weight (1.5x)")
                
            reweighted.append(aspect_item)
            overall_score += score
            
        doc.aspects = reweighted
        
        # Recalculate overall sentiment
        doc_sentiment = "NEUTRAL"
        has_positive = any(a["score"] > 0.3 for a in doc.aspects)
        has_negative = any(a["score"] < -0.3 for a in doc.aspects)
        
        if has_positive and has_negative:
            # Conjunctions resolve to the post-contrast sentiment if strong
            # E.g. "Good taste but expensive" resolved to NEGATIVE
            post_contrast_neg = any(a["score"] < -0.3 and "contrastive-weight" in "".join(a["triggers"]) for a in doc.aspects)
            post_contrast_pos = any(a["score"] > 0.3 and "contrastive-weight" in "".join(a["triggers"]) for a in doc.aspects)
            if post_contrast_neg:
                doc_sentiment = "NEGATIVE"
            elif post_contrast_pos:
                doc_sentiment = "POSITIVE"
            else:
                doc_sentiment = "NEUTRAL"
        elif overall_score > 0.4:
            doc_sentiment = "POSITIVE"
        elif overall_score < -0.4:
            doc_sentiment = "NEGATIVE"
            
        doc.overall_sentiment = doc_sentiment
        doc.explanations.append(f"Layer 8: Contrast conjunction resolution complete. Revised score: {round(overall_score, 2)} ({doc_sentiment})")
        
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
