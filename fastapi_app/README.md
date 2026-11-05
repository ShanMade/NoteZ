# FastAPI Vector & Database Bridge (`fastapi_app`)

This directory contains an independent Python microservice built with **FastAPI** that bridges PostgreSQL and Qdrant for semantic vector search, custom embedding pipelines, and RAG operations.

---

## 🛠️ Key Capabilities

- **Health Check & Diagnostics (`/health`)**:
  - Verifies connectivity to both PostgreSQL and Qdrant clusters.
- **Collection Management (`/api/qdrant/init`)**:
  - Asserts existence of the 128-dimensional Cosine vector collection (`notez_vectors`).
- **Semantic Vector Search (`/api/qdrant/search`)**:
  - Executes dense vector lookups filtered by `userId`, document confidentiality flags, and entity types.
- **Point Upsertion (`/api/qdrant/upsert`)**:
  - Upserts vector embeddings with associated document and chunk metadata payloads.

---

## 📂 File Overview

- `main.py`: Core FastAPI service definition, CORS middleware, Pydantic schemas, and endpoint handlers.
- `requirements.txt`: Python package requirements (`fastapi`, `uvicorn`, `qdrant-client`, `psycopg2-binary`, etc.).
- `Dockerfile`: Production-ready container image for deploying to Cloud Run, ECS, or Docker Compose.
- `.env.example`: Environment variables template for database and Qdrant configurations.

---

## 🚀 Running Locally

1. **Create and activate a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: .\venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the development server**:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   Interactive Swagger documentation will be available at [http://localhost:8000/docs](http://localhost:8000/docs).
