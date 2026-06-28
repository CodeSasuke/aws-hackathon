import os
import time
import yaml
from .interface import PipelineStage, DocState

_negators = None

def get_negators():
    global _negators
    if _negators is not None:
        return _negators
        
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    negation_path = os.path.join(backend_dir, "rules", "negation.yaml")
    
    with open(negation_path, "r") as f:
        data = yaml.safe_load(f)
    _negators = set(data.get("negators", []))
    return _negators

class NegationStage(PipelineStage):
    @property
    def name(self) -> str:
        return "negation"

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        spacy_doc = doc.spacy_doc
        if not spacy_doc:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        negators = get_negators()
        
        # Identify negated tokens in the spacy document
        # A token is negated if:
        # 1. It has an explicit "neg" dependency child.
        # 2. Or it is a child/modifier of a negated verb/adjective head.
        negated_tokens = set()
        
        for token in spacy_doc:
            token_lower = token.text.lower()
            
            # Check if this token itself is a negator, or has a direct negation child
            is_negator = token_lower in negators or token.dep_ == "neg"
            has_neg_child = any(child.dep_ == "neg" or child.text.lower() in negators for child in token.children)
            
            if is_negator or has_neg_child:
                # Mark the token head and its immediate children as negated
                negated_tokens.add(token.text.lower())
                negated_tokens.add(token.head.text.lower())
                for child in token.head.children:
                    if child.pos_ in ("ADJ", "ADV", "VERB"):
                        negated_tokens.add(child.text.lower())
                        
        # Store the negated tokens set on the document context
        doc.nlpMetadata = doc.nlpMetadata or {}
        doc.nlpMetadata["negated_tokens"] = list(negated_tokens)
        
        if negated_tokens:
            doc.explanations.append(f"Layer 6: Identified negated dependency terms: {list(negated_tokens)}")
            
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
