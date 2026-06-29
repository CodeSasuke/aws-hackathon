# 🐍 SurveyIQ Enterprise Offline NLP Engine

This directory contains the enterprise-grade, offline Python NLP pipeline and background worker system. 

## 🌐 Current System Status

For the hackathon demonstration and serverless hosting compatibility (such as Vercel FaaS), the active SurveyIQ application defaults to the high-performance TypeScript/Next.js local rule-based pipeline (`src/lib/pipeline.ts`). 

This Python backend is preserved as a **Future/Enterprise Roadmap Architecture** designed for high-throughput production environments running on dedicated virtual servers (like Amazon EC2 or Amazon ECS Fargate).

---

## 🏗️ Architecture & Component Overview

The Python subsystem consists of two main services:

1. **FastAPI Web Server (`main.py`):** Exposes operational endpoints for single comment analysis, health/metrics monitoring, and manual overrides.
2. **Background Queue Worker (`worker.py`):** An asynchronous worker process that pulls analysis jobs from PostgreSQL using the `SELECT ... FOR UPDATE SKIP LOCKED` database concurrency pattern.

### The 15-Stage NLP Pipeline Engine

The core pipeline ([pipeline/engine.py](pipeline/engine.py)) sequentially processes unstructured comment text through 15 specialized stages:

1. **Normalizer:** Text cleaning, unicode normalization, and casing adjustments.
2. **Language Detection:** Detects input language and tags non-English inputs.
3. **Grammatical Parser:** Grammatical tokenization and POS tagging via `spaCy`.
4. **Aspect Extractor:** Maps words and lemmas to categories using the taxonomy schema.
5. **Negation Scoper:** Tracks negation cues to invert adjacent valence markers.
6. **Valence Scorer:** Assigns base sentiment values to tokens.
7. **Contrast Resolver:** Boosts the weight of clauses following contrastive words like *"but"* or *"however"*.
8. **Phrase Matcher:** Identifies multi-word brand and product phrases.
9. **Competitor Classifier:** Scans proper nouns and entities to detect competitor brand names.
10. **Intent Classifier:** Classifies customer intent (e.g. Complaint, Praise, Bug Report, Inquiry).
11. **Emotion Detector:** Detects sentiment-based emotional cues.
12. **Action Suggestion:** Recommends tactical product resolutions.
13. **Temporal Extractor:** Isolates time-relative mentions.
14. **Contradiction Resolver:** Cleans up conflicting positive/negative markers in the same sentence.
15. **Ensemble Aggregator:** Synthesizes final sentiment, urgency, and category tags.

---

## 🏃 Future Production Deployment

To transition the system to the full Python NLP engine in production:

1. **Disable Next.js Execution:**
   In [src/app/api/projects/[id]/analyze/route.ts](../src/app/api/projects/%5Bid%5D/analyze/route.ts), remove or toggle off the async call to `runSurveyAnalysisPipeline(id)` so that the web app only acts as a job publisher to the database queue.
   
2. **Launch the Python Worker:**
   Deploy the backend folder as a Docker container to **AWS ECS (Fargate)** or run it on **Amazon EC2**:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   python -m spacy download en_core_web_sm
   
   # Run the worker process
   python worker.py
   ```

3. **Enable FastAPI for Live Overrides & Add-In Queries:**
   Launch the FastAPI gateway to handle Excel Add-in fallback logic and human-in-the-loop override logging:
   ```bash
   python -m uvicorn main:app --host 0.0.0.0 --port 8000
   ```
