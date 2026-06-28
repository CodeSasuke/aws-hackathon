import os
import time
import yaml
from typing import List
from .interface import PipelineStage, DocState

_embedding_model = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is not None:
        return _embedding_model

    # Load registry to find local cache path
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    registry_path = os.path.join(backend_dir, "models", "registry.yaml")
    
    with open(registry_path, "r") as f:
        registry = yaml.safe_load(f)
        
    embed_info = registry["models"]["embedding"]
    model_name = embed_info["name"]
    cache_dir = os.path.join(backend_dir, "models", "cache")

    from sentence_transformers import SentenceTransformer
    # Initializing using local cache directory
    _embedding_model = SentenceTransformer(model_name, cache_folder=cache_dir)
    return _embedding_model

class EmbeddingsStage(PipelineStage):
    @property
    def name(self) -> str:
        return "embeddings"

    def process(self, doc: DocState) -> DocState:
        # For single items, we don't compute/store the embedding directly on the doc, 
        # but the stage is here to support bulk calculations.
        start_time = time.perf_counter()
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc

    @staticmethod
    def generate_batch_embeddings(texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        model = get_embedding_model()
        embeddings = model.encode(texts, show_progress_bar=False)
        return embeddings.tolist()
