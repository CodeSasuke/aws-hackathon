import time
from .interface import PipelineStage, DocState

class SuggestionStage(PipelineStage):
    @property
    def name(self) -> str:
        return "suggestion"

    def process(self, doc: DocState) -> DocState:
        start_time = time.perf_counter()
        
        spacy_doc = doc.spacy_doc
        if not spacy_doc:
            doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
            return doc
            
        suggestion_cues = {"should", "needs", "need", "wish", "please", "could", "make it", "ought"}
        
        # Split document into clauses by punctuation or conjunctions to isolate the suggestion phrase
        clauses = []
        current_clause = []
        for token in spacy_doc:
            if token.text in (",", ".", ";", "but", "and"):
                if current_clause:
                    clauses.append(" ".join([t.text for t in current_clause]))
                    current_clause = []
            else:
                current_clause.append(token)
        if current_clause:
            clauses.append(" ".join([t.text for t in current_clause]))
            
        feature_requests = []
        for clause in clauses:
            clause_lower = clause.lower()
            if any(cue in clause_lower for cue in suggestion_cues):
                # Ensure it's not a generic statement like "i dont need"
                if "dont need" not in clause_lower and "don't need" not in clause_lower:
                    feature_requests.append(clause.strip())
                    
        doc.feature_requests = feature_requests
        if feature_requests:
            doc.explanations.append(f"Layer 13: Feature suggestion detected: {feature_requests}")
            
        doc.timings[self.name] = (time.perf_counter() - start_time) * 1000
        return doc
