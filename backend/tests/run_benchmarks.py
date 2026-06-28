import os
import sys
import time
import psutil
import statistics

# Ensure backend directory is in path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(backend_dir)

from pipeline.engine import AnalysisEngine
from pipeline.parser import get_spacy_model
from pipeline.embeddings import get_embedding_model

def generate_mock_comments(count: int) -> list:
    base_comments = [
        "The taste is absolutely delicious and super smooth.",
        "Bottle design looks neat but it is too expensive.",
        "I just prefer other brands with much greater taste.",
        "Taste acha hai but bottle bakwas hai",
        "Very high calories and too sugary.",
        "I can never find this brand in my local retail stores.",
        "Not my cup of tea, leaves a terrible aftertaste.",
        "Excellent packaging, easy to open and looks premium.",
        "Price is very reasonable, will definitely buy again.",
        "Watery flavor and poor color, very disappointed."
    ]
    # Multiply list to match count
    comments = []
    for idx in range(count):
        comments.append({
            "id": f"mock_{idx}",
            "text": base_comments[idx % len(base_comments)]
        })
    return comments

def run_performance_benchmarks():
    print("====================================================")
    print("SURVEYIQ NLP PIPELINE PERFORMANCE BENCHMARKS")
    print("====================================================")
    
    # Warm up models
    print("Pre-loading models into memory...", flush=True)
    get_spacy_model()
    get_embedding_model()
    
    engine = AnalysisEngine()
    test_sizes = [100, 500, 1000]
    
    for size in test_sizes:
        print(f"\n[Benchmark] Generating dataset of {size} responses...")
        dataset = generate_mock_comments(size)
        
        # Measure initial RAM
        process = psutil.Process(os.getpid())
        ram_start = process.memory_info().rss / (1024 * 1024)
        
        print(f"[Benchmark] Starting processing of {size} items...")
        start_time = time.perf_counter()
        
        # We simulate batch loop
        latencies = []
        for item in dataset:
            row_start = time.perf_counter()
            engine.analyze_comment(item["id"], item["text"])
            latencies.append((time.perf_counter() - row_start) * 1000) # milliseconds
            
        elapsed_sec = time.perf_counter() - start_time
        ram_end = process.memory_info().rss / (1024 * 1024)
        
        # Calculate stats
        throughput = size / elapsed_sec
        p50 = statistics.median(latencies)
        p95 = percentiles(latencies, 95)
        p99 = percentiles(latencies, 99)
        
        print(f"[Results] Size {size} items:")
        print(f"  - Total Elapsed Time:  {round(elapsed_sec, 2)} seconds")
        print(f"  - Throughput:          {round(throughput, 1)} records/second")
        print(f"  - p50 (Median) Latency: {round(p50, 1)} ms")
        print(f"  - p95 Latency:          {round(p95, 1)} ms")
        print(f"  - p99 Latency:          {round(p99, 1)} ms")
        print(f"  - Peak Memory Usage:   {round(ram_end, 1)} MB (Allocated + {round(ram_end - ram_start, 1)} MB)")
        print("-" * 50)

def percentiles(data, percent):
    if not data:
        return 0.0
    sorted_data = sorted(data)
    idx = int(len(sorted_data) * (percent / 100.0))
    return sorted_data[min(idx, len(sorted_data) - 1)]

if __name__ == "__main__":
    run_performance_benchmarks()
