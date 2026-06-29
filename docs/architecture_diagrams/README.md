# SurveyIQ Architecture Diagrams (Mermaid)

This directory contains detailed architecture and flow diagrams for the SurveyIQ platform, formatted as Mermaid diagrams.

## Directory Manifest

1. **[High-Level Component Interactions](file:///Users/siddhant/Projects/aws%20hackathon/docs/architecture_diagrams/high_level_architecture.mermaid)**
   - File: `high_level_architecture.mermaid`
   - Description: Displays the high-level decoupled structure separating the Next.js React frontend, API layer, PostgreSQL database tables, and the Python worker pool.

2. **[NLP Pipeline Flow](file:///Users/siddhant/Projects/aws%20hackathon/docs/architecture_diagrams/nlp_pipeline_flow.mermaid)**
   - File: `nlp_pipeline_flow.mermaid`
   - Description: Illustrates the sequence of the 15-stage analytical pipeline processing raw comment texts into fully normalized and categorized aspect records.

3. **[Concurrency and Job Heartbeats](file:///Users/siddhant/Projects/aws%20hackathon/docs/architecture_diagrams/concurrency_polling_heartbeats.mermaid)**
   - File: `concurrency_polling_heartbeats.mermaid`
   - Description: A state transition diagram detailing the worker row-leasing mechanism (`SKIP LOCKED`), heartbeats, retries, and the Dead Letter Queue (DLQ).

4. **[Database Schema ERD](file:///Users/siddhant/Projects/aws%20hackathon/docs/architecture_diagrams/database_schema_erd.mermaid)**
   - File: `database_schema_erd.mermaid`
   - Description: An Entity-Relationship Diagram detailing the tables, types, fields, and relationships defined in the Prisma ORM schema.

5. **[Onboarding Wizard States](file:///Users/siddhant/Projects/aws%20hackathon/docs/architecture_diagrams/onboarding_wizard_state.mermaid)**
   - File: `onboarding_wizard_state.mermaid`
   - Description: Shows the states, transitions, user validation, and API polling mechanisms within the SurveyIQ onboarding wizard.

6. **[Excel Add-In Integration Flow](file:///Users/siddhant/Projects/aws%20hackathon/docs/architecture_diagrams/excel_add_in_architecture.mermaid)**
   - File: `excel_add_in_architecture.mermaid`
   - Description: Sequence diagram mapping interactions between the Microsoft Excel grid interface, Office.js APIs, the custom Next.js endpoint, Postgres caching, and the local matching engine.

---

## How to Render

You can render these diagrams using any Mermaid-compatible parser:
- **VS Code**: Install the *Mermaid Preview* extension.
- **GitHub**: Rendered natively in markdown/code views.
- **Mermaid Live Editor**: Copy-paste contents into [mermaid.live](https://mermaid.live).
