import os
import sys
import json
import time

# Ensure backend directory is in path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(backend_dir)

from pipeline.engine import AnalysisEngine
from pipeline.parser import get_spacy_model
from pipeline.embeddings import get_embedding_model

def run_test_suite():
    print("====================================================")
    print("SURVEYIQ NLP PIPELINE REGRESSION TEST SUITE")
    print("====================================================")
    
    # Warm up models
    print("Loading models into memory...", flush=True)
    get_spacy_model()
    get_embedding_model()
    print("Models ready! Starting evaluation...", flush=True)
    
    engine = AnalysisEngine()
    datasets_dir = os.path.join(backend_dir, "tests", "datasets")
    
    test_files = ["sentiment.json", "aspects.json", "negation.json", "sarcasm.json", "hinglish.json"]
    
    total_passed = 0
    total_failed = 0
    total_assertions = 0
    
    for file_name in test_files:
        file_path = os.path.join(datasets_dir, file_name)
        if not os.path.exists(file_path):
            print(f"Warning: Test dataset file missing at {file_path}")
            continue
            
        with open(file_path, "r") as f:
            cases = json.load(f)
            
        print(f"\nEvaluating dataset: '{file_name}' ({len(cases)} cases)")
        print("-" * 50)
        
        for idx, case in enumerate(cases):
            text = case["text"]
            expected = case["expected"]
            
            # Run pipeline
            doc = engine.analyze_comment(f"test_{idx}", text)
            
            passed = True
            failures = []
            
            # Check Sentiment
            if "sentiment" in expected:
                total_assertions += 1
                if doc.overall_sentiment != expected["sentiment"]:
                    passed = False
                    failures.append(f"Sentiment: expected '{expected['sentiment']}', got '{doc.overall_sentiment}'")
            
            # Check Intent
            if "intent" in expected:
                total_assertions += 1
                if doc.intent != expected["intent"]:
                    passed = False
                    failures.append(f"Intent: expected '{expected['intent']}', got '{doc.intent}'")
                    
            # Check Aspects (subset match)
            if "aspects" in expected:
                total_assertions += 1
                pred_aspects = [a["aspect"] for a in doc.aspects]
                for exp_asp in expected["aspects"]:
                    # Support fuzzy matched prefix (e.g. if expected is Taste and got Taste.Sweetness, that matches)
                    matched = any(p.startswith(exp_asp) or exp_asp.startswith(p) for p in pred_aspects)
                    if not matched:
                        passed = False
                        failures.append(f"Aspects: expected '{exp_asp}' to be detected. Got: {pred_aspects}")
            
            if passed:
                total_passed += 1
                print(f"  ✓ CASE {idx+1}: PASSED - \"{text[:40]}...\"")
            else:
                total_failed += 1
                print(f"  ✗ CASE {idx+1}: FAILED - \"{text[:40]}...\"")
                for f_msg in failures:
                    print(f"      - {f_msg}")
                    
    print("\n====================================================")
    print("EVALUATION METRICS SUMMARY")
    print("====================================================")
    accuracy = (total_passed / (total_passed + total_failed)) * 100 if (total_passed + total_failed) > 0 else 0
    print(f"Total Cases Evaluated: {total_passed + total_failed}")
    print(f"Total Passed Cases:    {total_passed}")
    print(f"Total Failed Cases:    {total_failed}")
    print(f"Case-Level Accuracy:   {round(accuracy, 2)}%")
    print(f"Total Assertions Run:  {total_assertions}")
    print("====================================================")
    
    if total_failed > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    run_test_suite()
