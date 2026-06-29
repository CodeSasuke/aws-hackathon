# 📊 SurveyIQ — Enterprise Feedback Intelligence Platform

SurveyIQ is a high-performance customer feedback analysis platform. It enables organizations to instantly transform unstructured text responses (from uploaded survey spreadsheets) into granular, categorized, and multi-layered sentiment insights in real-time. 

Designed for both automated processing and precision human review, SurveyIQ combines a fast **Next.js 15** web application with a specialized **10-stage offline Python NLP Pipeline** backed by **Amazon Web Services (AWS)**.

---

## 🚀 Key Features

* **📦 Asynchronous Batch Uploads:** Upload massive Excel/CSV spreadsheets directly to **Amazon S3** with a guided onboarding column mapper.
* **🧠 Multi-Layered NLP Pipeline:** Deconstructs customer sentences using lemmatization, POS tagging, Hinglish translation, negation scoping, valence scoring, and competitor mention classification.
* **🛡️ Row-Leasing & Heartbeats:** Multi-worker safety built with PostgreSQL `SKIP LOCKED` concurrency control and heartbeat lease expirations.
* **✍️ Human-in-the-Loop Overrides:** Provides a dashboard allowing manual metadata correction with a secure database audit trail.
* **🔌 Real-Time Excel Add-In:** Synchronize cell selections directly with a Next.js cache layer and localized Jaccard character 3-gram clustering matching engine to write classifications directly back to your spreadsheet.
* **📈 Executive Reports:** Dynamic, responsive visualizations (Recharts) with instant exports to professional PDF and Excel summaries.

---

## 🛠️ Architecture & Tech Stack

### System Design
```mermaid
graph TD
    subgraph Client Layer
        WebUI[Next.js React Frontend]
        ExcelUI[Excel Add-In Frontend]
    end

    subgraph API Gateway & Presentation Layer
        NextAPI[Next.js API Handler]
        ExcelAPI[Excel Add-In API Endpoint]
    end

    subgraph Database Layer (PostgreSQL)
        Postgres[(PostgreSQL Database)]
        ResponseTable[Response Table]
        JobTable[AnalysisJob Queue]
        ThemeTable[Theme Aggregates]
        CacheTable[ResponseCache Table]
        AuditTable[AuditLog Overrides]
    end

    subgraph Python Backend Services
        FastAPI[FastAPI Server]
        WorkerPool[Python Worker Pool]
        PipelineEngine[NLP Pipeline Engine]
    end

    WebUI -->|Trigger Bulk Job / View| NextAPI
    WebUI -->|Live Override / Single Classify| FastAPI
    ExcelUI -->|Request Cell Analysis| ExcelAPI
    NextAPI -->|Insert Job PENDING| JobTable
    ExcelAPI -->|Read/Write Cache| CacheTable
    ExcelAPI -->|Fallback to Local Engine| PipelineEngine
    FastAPI -->|Query / Update Response| ResponseTable
    FastAPI -->|Log Override| AuditTable
    
    WorkerPool -->|SKIP LOCKED Poll| JobTable
    WorkerPool -->|Lease Heartbeat| JobTable
    WorkerPool -->|Fetch Responses| ResponseTable
    WorkerPool -->|Run Stages| PipelineEngine
    WorkerPool -->|Save Enriched Data| ResponseTable
    WorkerPool -->|Increment Counts| ThemeTable
```

### Technology Stack
* **Frontend:** Next.js 15 (Turbopack, React 19), Tailwind CSS, Recharts, TanStack Query & Table, Office.js
* **Backend:** FastAPI, Uvicorn, Python Worker Pool
* **NLP Models:** spaCy (English core), Sentence Transformers (embeddings)
* **Cloud Services (AWS):** Aurora / RDS PostgreSQL, S3 (file uploads), IAM secure access
* **Database & ORM:** Prisma Client (TypeScript), SQLAlchemy (Python)
* **Reporting:** PDFKit, ExcelJS, XLSX

---

## ⚡ Mathematical Sentiment Formulation

To accurately score the sentiment ($S_a$) of distinct aspect clauses (e.g., *Price*, *Taste*, *Packaging*), our engine uses a custom valence scoring function:

$$S_a = w_c \cdot \sum_{i \in T} \Big( V(t_i) \cdot I(t_i) \cdot N(t_i) \Big)$$

Where:
* $V(t_i)$ is the base sentiment value of token $t_i$.
* $I(t_i)$ is the intensifier multiplier (e.g., "very" or "extremely").
* $N(t_i) \in \{-1, 1\}$ is the negation multiplier (swapping signs dynamically if linked to a negation token in the spaCy dependency tree).
* $w_c$ is the contrast resolution weight. We boost clauses that come after contrastive words like *"but"* or *"however"* by $1.5\times$ ($w_c = 1.5$) because that's usually where the user's true conclusion lies.

---

## 🏃 Getting Started

### 📋 Prerequisites
Ensure you have the following installed on your local machine:
* Node.js (v18.x or higher)
* Python (v3.10 or higher)
* PostgreSQL Database (or an active AWS RDS Instance)

---

### ⚙️ Environment Configuration (`.env`)
Create a `.env` file in the root directory and add the following parameters (substituting your actual values):

```env
# Database Connections (AWS RDS / Aurora)
DATABASE_URL="postgresql://username:password@rds-endpoint:5432/surveyiq?sslmode=require"
DIRECT_URL="postgresql://username:password@rds-endpoint:5432/surveyiq?sslmode=require"

# NextAuth.js Config
NEXTAUTH_SECRET="your-nextauth-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# AWS Configuration (S3 & Credentials)
AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID"
AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
AWS_REGION="ap-south-1"
AWS_S3_BUCKET="your-s3-bucket-name"
```

---

### 🖥️ Next.js Web App Setup

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Generate Prisma Client:**
   ```bash
   npx prisma generate
   ```

3. **Deploy Database Migrations (optional if pushing to RDS):**
   ```bash
   npx prisma db push
   ```

4. **Start Web Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### 🐍 Python NLP Backend & Worker Setup

1. **Navigate to the Backend Directory:**
   From your project root, open a separate terminal window and move to the backend directory:
   ```bash
   cd backend
   ```

2. **Set Up Python Virtual Environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install Requirements:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Download the spaCy Language Model:**
   ```bash
   python -m spacy download en_core_web_sm
   ```

5. **Run the FastAPI Server:**
   ```bash
   python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

6. **Start the Background Queue Worker:**
   Open another terminal tab, activate the virtual environment, and run:
   ```bash
   python worker.py
   ```

---

## 🎯 Verification & Testing

* **API Health Check:** Run a GET request to `http://localhost:8000/health` to confirm the backend and database connection status.
* **Ready Check:** Run a GET request to `http://localhost:8000/ready` to ensure NLP models are successfully cached in memory.
* **Metrics:** Access the `http://localhost:8000/metrics` endpoint to monitor worker memory usage, CPU load, and active job queue metrics.
