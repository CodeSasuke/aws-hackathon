# 📊 SurveyIQ — Enterprise Feedback Intelligence Platform

SurveyIQ is a high-performance customer feedback analysis platform. It enables organizations to instantly transform unstructured text responses (from uploaded survey spreadsheets) into granular, categorized, and multi-layered sentiment insights in real-time. 

Designed for both automated processing and precision human review, SurveyIQ combines a fast **Next.js 15** web application with a specialized **10-stage offline Python NLP Pipeline** backed by **Amazon Web Services (AWS)**.

> [!NOTE]
> **What does "Offline" mean in SurveyIQ?**
> Although spreadsheets are uploaded online to cloud storage (**Amazon S3**) via the web interface, the analytical pipeline is **offline** in two key ways:
> 1. **Offline Inference:** The NLP engine executes local, self-contained models (spaCy and cached SentenceTransformers) directly on the worker server. It never transmits customer feedback to third-party online APIs (like OpenAI or Claude).
> 2. **Offline Batch Processing:** Processing is fully decoupled from the web server. Uploaded files are queued and processed asynchronously in the background by separate worker processes rather than blocking synchronous HTTP request/response loops.

---

## 🚀 Key Features

* **📦 Asynchronous Batch Uploads:** Upload massive Excel/CSV spreadsheets directly to **Amazon S3** with a guided onboarding column mapper.
* **🧠 Multi-Layered NLP Pipeline:** Deconstructs customer sentences using lemmatization, POS tagging, Hinglish translation, negation scoping, valence scoring, and competitor mention classification.
* **🛡️ Row-Leasing & Heartbeats:** Multi-worker safety built with PostgreSQL `SKIP LOCKED` concurrency control and heartbeat lease expirations.
* **✍️ Human-in-the-Loop Overrides:** Provides a dashboard allowing manual metadata correction with a secure database audit trail.
* **🔌 Real-Time Excel Add-In:** Synchronize cell selections directly with a Next.js cache layer and localized Jaccard character 3-gram clustering matching engine to write classifications directly back to your spreadsheet.
* **📈 Executive Reports:** Dynamic, responsive visualizations (Recharts) with instant exports to professional PDF and Excel summaries.

---

## 🖥️ Platform Tour & Core Features

Here is a visual walkthrough of the SurveyIQ platform, detailing key pages, user interfaces, and their underlying backend functionalities:

### 1. Secure Authentication & Gateway
<p align="center">
  <img src="docs/Screenshots/login.png" alt="SurveyIQ Login Page" width="850" />
</p>

* **Description**: A modern, secure gateway serving as the landing interface for user authentication.
* **Core Functionality**:
  * Powered by **NextAuth.js** for robust session management and CSRF protection.
  * Ensures secure entry control, shielding all analytical backend services and database operations from unauthorized access.
  * Restricts access using role-based routing (RBAC) to ensure audit logs and system settings can only be accessed by authorized admins.

---

### 2. Executive Analytics Dashboard
<p align="center">
  <img src="docs/Screenshots/dashboard.png" alt="SurveyIQ Dashboard" width="850" />
</p>

* **Description**: The operational nerve center of the application, displaying high-level key performance indicators and workspace status.
* **Core Functionality**:
  * Real-time metrics showing total processed rows, overall positive/negative sentiment splits, and pending analysis jobs.
  * Live worker thread status indicating active, idle, and queued states of background NLP services.
  * Quick-launch buttons to initiate new spreadsheet uploads or review pending manual validation jobs.

---

### 3. Predefined Analytical Queries
<p align="center">
  <img src="docs/Screenshots/predefined-queries.png" alt="SurveyIQ Predefined Queries List" width="850" />
</p>
<p align="center">
  <img src="docs/Screenshots/query-response.png" alt="SurveyIQ Predefined Query Results" width="850" />
</p>

* **Description**: An executive decision-making tool containing pre-packaged SQL and NLP analytical queries designed to answer critical business questions.
* **Core Functionality**:
  * Offers structured prompts such as *"What are customers most unhappy about?"* or *"What features are competitors winning on?"*.
  * On selection, triggers a fast aggregate search utilizing PostgreSQL database indexing and NLP category classifications.
  * Groups and displays specific customer quotes, sentiment scores, and category occurrences to pinpoint root-cause complaints instantly.

---

### 4. Interactive Feedback Grid
<p align="center">
  <img src="docs/Screenshots/excel-grid.png" alt="SurveyIQ Excel Grid Data" width="850" />
</p>

* **Description**: A dynamic, tabular representation of all feedback entries, showing deep-analyzed metadata per response.
* **Core Functionality**:
  * Features full-text search, column sorting, pagination, and color-coded tags for sentiment classifications (*Positive*, *Neutral*, *Negative*).
  * Displays specific tokens, aspect mappings, Hinglish-to-English translations, and active row lock leases.
  * Integrated directly with human-in-the-loop overrides—allowing reviewers to manually correct categories or weights with a direct write-back to PostgreSQL and AWS RDS.

---

### 5. Deep-Dive Executive Reports
<p align="center">
  <img src="docs/Screenshots/executive-reports.png" alt="SurveyIQ Executive Reports" width="850" />
</p>

* **Description**: An interactive reporting space built with dynamic visualization panels.
* **Core Functionality**:
  * Leverages **Recharts** to display aspect-sentiment correlation matrices, theme distributions, and trendlines.
  * Enables multi-dimensional filtering (by date, product line, or channel) to view localized customer experiences.
  * Features export buttons to download print-ready PDF reports or styled Excel sheets containing complete pipeline metrics.

---

### 6. Brand & Product Configurator
<p align="center">
  <img src="docs/Screenshots/brand-settings.png" alt="SurveyIQ Brand Settings" width="850" />
</p>
<p align="center">
  <img src="docs/Screenshots/product-settings.png" alt="SurveyIQ Product Settings" width="850" />
</p>

* **Description**: Global administrative panels where target search models, brand tags, and product associations are defined.
* **Core Functionality**:
  * Allows administrators to configure active brand keywords and target competitors for sentiment tracking.
  * Sets specific product boundaries and lemmatized tags that the FastAPI NLP worker pool scans for during sentence dependency mapping.
  * Automatically propagates changes to the active spaCy token matching rules without requiring code deployment or server restarts.

---

## 🛠️ Architecture & Tech Stack

### System Design
```mermaid
graph TD
    subgraph ClientLayer ["Client Layer"]
        WebUI[Next.js React Frontend]
        ExcelUI[Excel Add-In Frontend]
    end

    subgraph APILayer ["API Gateway & Presentation Layer"]
        NextAPI[Next.js API Handler]
        ExcelAPI[Excel Add-In API Endpoint]
    end

    subgraph DBLayer ["Database Layer (PostgreSQL)"]
        Postgres[(PostgreSQL Database)]
        ResponseTable[Response Table]
        JobTable[AnalysisJob Queue]
        ThemeTable[Theme Aggregates]
        CacheTable[ResponseCache Table]
        AuditTable[AuditLog Overrides]
    end

    subgraph BackendLayer ["Python Backend Services"]
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
