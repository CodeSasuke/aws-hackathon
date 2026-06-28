import time
import numpy as np
from typing import List
from .interface import PipelineStage, DocState
from .embeddings import EmbeddingsStage

class ClusteringStage(PipelineStage):
    @property
    def name(self) -> str:
        return "clustering"

    def process(self, doc: DocState) -> DocState:
        # Clustering is a batch-level operation, so single-doc process is a no-op
        start_time = time.perf_counter()
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc

    @staticmethod
    def cluster_documents(docs: List[DocState]) -> List[DocState]:
        if not docs:
            return docs

        start_time = time.perf_counter()
        
        # 1. Extract non-empty clean texts
        valid_docs = [d for d in docs if d.clean_text and not d.is_spam]
        if len(valid_docs) < 2:
            # Not enough documents to cluster
            for d in docs:
                d.cluster_id = "cluster_0"
                d.representative_quote = d.text
            return docs

        texts = [d.clean_text for d in valid_docs]
        
        # 2. Generate embeddings in a batch
        embeddings = np.array(EmbeddingsStage.generate_batch_embeddings(texts))
        
        # 3. Perform Agglomerative Clustering
        from sklearn.cluster import AgglomerativeClustering
        
        # We use a cosine distance threshold to group similar statements together
        # Statements with cosine distance < 0.35 (i.e. similarity > 0.65) are clustered
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=0.35,
            metric="cosine",
            linkage="average"
        )
        
        labels = clustering.fit_predict(embeddings)
        
        # Group doc indices by cluster label
        clusters = {}
        for idx, label in enumerate(labels):
            clusters.setdefault(label, []).append(idx)
            
        # 4. Find the representative quote for each cluster (closest to cluster mean)
        representatives = {}
        for label, indices in clusters.items():
            cluster_embeddings = embeddings[indices]
            mean_embedding = np.mean(cluster_embeddings, axis=0)
            
            # Find index closest to the mean
            distances = np.linalg.norm(cluster_embeddings - mean_embedding, axis=1)
            closest_idx = indices[np.argmin(distances)]
            representatives[label] = valid_docs[closest_idx].text
            
        # 5. Assign cluster details to valid docs
        for idx, label in enumerate(labels):
            valid_docs[idx].cluster_id = f"cluster_{label}"
            valid_docs[idx].representative_quote = representatives[label]
            
        # Assign defaults to remaining spam/empty docs
        for d in docs:
            if d.cluster_id is None:
                d.cluster_id = "cluster_unclassified"
                d.representative_quote = d.text
                
        # Inject timings to all processed docs
        duration_ms = (time.perf_counter() - start_time) * 1000
        for d in docs:
            d.timings["clustering"] = duration_ms
            
        return docs
