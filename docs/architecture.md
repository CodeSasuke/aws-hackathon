# SurveyIQ Offline NLP Engine Architecture

This document outlines the detailed system and pipeline architectures of the SurveyIQ fully-offline NLP engine.

---

## 1. High-Level Component Interactions

This system decouples the Next.js presentation server from the heavy NLP computation worker using a PostgreSQL row-locked job queue.

```mermaid
graph TD
    subgraph Client Layer
        WebUI[Next.js React Frontend]
    end

    subgraph API Gateway & Presentation
        NextAPI[Next.js API Handler]
    end

    subgraph Database Layer
        Postgres[(PostgreSQL Database)]
        ResponseTable[Response Table]
        JobTable[AnalysisJob Queue]
        ThemeTable[Theme Aggregates]
        AuditTable[AuditLog Overrides]
    end

    subgraph Python Backend Services
        FastAPI[FastAPI Server]
        WorkerPool[Python Worker Pool]
        PipelineEngine[NLP Pipeline Engine]
    end

    WebUI -->|Trigger Bulk Job| NextAPI
    WebUI -->|Live Override / Single Classify| FastAPI
    NextAPI -->|Insert Job PENDING| JobTable
    FastAPI -->|Query / Update Response| ResponseTable
    FastAPI -->|Log Override| AuditTable
    
    WorkerPool -->|SKIP LOCKED Poll| JobTable
    WorkerPool -->|Lease Heartbeat| JobTable
    WorkerPool -->|Fetch Responses| ResponseTable
    WorkerPool -->|Run Stages| PipelineEngine
    WorkerPool -->|Save Enriched Data| ResponseTable
    WorkerPool -->|Increment Counts| ThemeTable
```

---

## 2. NLP Pipeline Parsing Flow (Layer 0 to Layer 20)

Every survey response undergoes a 15-stage pipeline processing path. The output of each layer feeds directly into subsequent modules.

```mermaid
sequenceDiagram
    autonumber
    participant Engine as Pipeline Coordinator
    participant Norm as Layer 0: Normalizer
    participant Lang as Layer 1: Language Detector
    participant Parse as Layer 4: spaCy Parser
    participant Aspect as Layer 5: Aspect Extractor
    participant Neg as Layer 6: Negation Scoper
    participant Val as Layer 7: Valence Score
    participant Con as Layer 8: Contrast Resolver
    participant Phrase as Layer 9: Phrase Override
    participant Comp as Layer 10: Competitor Detector
    participant Ensemble as Layer 20: Ensemble Decision

    Engine ->> Norm: Raw Comment Text
    activate Norm
    Note over Norm: Unicode norm, contraction expansion,<br/>emoji map, repeated char fix
    Norm -->> Engine: Cleaned Lowercase Text
    deactivate Norm

    Engine ->> Lang: Cleaned Text
    activate Lang
    Note over Lang: Hinglish detect & Translates<br/>Hinglish adjectives (acha -> good)
    Lang -->> Engine: Standardized English Text
    deactivate Lang

    Engine ->> Parse: Standardized Text
    activate Parse
    Note over Parse: spaCy POS Tagging &<br/>Dependency Tree Mapping
    Parse -->> Engine: spaCy Doc & Tokens List
    deactivate Parse

    Engine ->> Aspect: spaCy Doc
    activate Aspect
    Note over Aspect: Map lemmas to layered ontology<br/>(Taste, Packaging, Price, Availability)
    Aspect -->> Engine: Aspect Clauses list
    deactivate Aspect

    Engine ->> Neg: Dependency Tree
    activate Neg
    Note over Neg: Scopes negations (not, never, doesn't)<br/>to target head words
    Neg -->> Engine: List of negated token index flags
    deactivate Neg

    Engine ->> Val: Aspects + Negated tokens
    activate Val
    Note over Val: Sum lexicon scores (+/-) adjusted<br/>by Negators & Intensifiers
    Val -->> Engine: Scored Aspect clauses
    deactivate Val

    Engine ->> Con: Scored Aspect clauses
    activate Con
    Note over Con: Multiplies weight of clauses<br/>after "but/however" by 1.5x
    Con -->> Engine: Reweighted Aspect Scores
    deactivate Con

    Engine ->> Phrase: Cleaned Text
    activate Phrase
    Note over Phrase: Checks idiom overrides<br/>(waste of money, top notch)
    Phrase -->> Engine: Direct Sentiment Override (if matched)
    deactivate Phrase

    Engine ->> Comp: Cleaned Text
    activate Comp
    Note over Comp: Detects competitor mentions &<br/>comparative preference patterns
    Comp -->> Engine: Brand Preference metadata
    deactivate Comp

    Engine ->> Ensemble: Scored Aspects + Overrides
    activate Ensemble
    Note over Ensemble: Fuses outputs, computes confidence,<br/>sets categories & telemetry details
    Ensemble -->> Engine: Final Enriched Document State
    deactivate Ensemble
```

---

## 3. Concurrency Polling & Heartbeat Lease Locks

To prevent race conditions across parallel python instances running the worker daemon, jobs are leased using database-level locking and self-renewing timers.

```mermaid
stateDiagram-v2
    [*] --> PENDING : User uploads CSV

    state Poll_Queue <<choice>>
    PENDING --> Poll_Queue : Worker loop checks DB
    
    state "SELECT FOR UPDATE SKIP LOCKED" as LockJob
    Poll_Queue --> LockJob : Found Pending Job
    Poll_Queue --> [*] : No Jobs (Sleep 2s)

    state Locked_Executing {
        [*] --> Spawn_Heartbeat : Start Worker Process
        Spawn_Heartbeat --> Run_Pipeline : Spawns daemon thread to update heartbeatEvery 10s
        Run_Pipeline --> Complete_Process : pipeline processes all rows
        Run_Pipeline --> Error_Catch : Pipeline throws exception
    }

    state DLQ_Check <<choice>>
    Error_Catch --> DLQ_Check : Retry count updated

    Complete_Process --> COMPLETED : Job completed metrics written
    DLQ_Check --> PENDING : retryCount < maxRetries (lease cleared)
    DLQ_Check --> DEAD_LETTER : retryCount >= maxRetries
    
    COMPLETED --> [*]
    DEAD_LETTER --> [*]
```
