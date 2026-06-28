import os
import time
import yaml
from .interface import PipelineStage, DocState

_spacy_nlp = None

def get_spacy_model():
    global _spacy_nlp
    if _spacy_nlp is not None:
        return _spacy_nlp

    # Load registry to find local model name
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    registry_path = os.path.join(backend_dir, "models", "registry.yaml")
    
    with open(registry_path, "r") as f:
        registry = yaml.safe_load(f)
        
    parser_info = registry["models"]["parser"]
    model_name = parser_info["name"]

    import spacy
    _spacy_nlp = spacy.load(model_name)
    return _spacy_nlp

class ParserStage(PipelineStage):
    @property
    def name(self) -> str:
        return "parser"

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        text = doc.clean_text
        if not text:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        nlp = get_spacy_model()
        spacy_doc = nlp(text)
        doc.spacy_doc = spacy_doc # Preserve internally for dependency layers
        
        # Extract parsed token details
        doc.tokens = []
        for token in spacy_doc:
            doc.tokens.append({
                "text": token.text,
                "lemma": token.lemma_,
                "pos": token.pos_,
                "dep": token.dep_,
                "head": token.head.text,
                "head_pos": token.head.pos_
            })
            
        doc.explanations.append("Layer 4: spaCy grammatical dependency parsing complete.")
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
