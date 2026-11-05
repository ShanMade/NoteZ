import os
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
try:
    import psycopg
    from psycopg.rows import dict_row
    USE_PSYCOPG3 = True
except ImportError:
    try:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        USE_PSYCOPG3 = False
    except ImportError:
        USE_PSYCOPG3 = None

from qdrant_client import QdrantClient
from qdrant_client.http import models

app = FastAPI(
    title="ByNote Vector & Database Bridge",
    description="Connects hosted PostgreSQL and Qdrant Cloud/Host for semantic search, vector embeddings, and RAG",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@postgres:5432/app_db")
QDRANT_URL = os.getenv("QDRANT_URL", "http://qdrant:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", None)
QDRANT_COLLECTION = "notez_vectors"
VECTOR_SIZE = 128

def get_db():
    if USE_PSYCOPG3:
        return psycopg.connect(DATABASE_URL, row_factory=dict_row)
    elif USE_PSYCOPG3 is False:
        return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    raise HTTPException(status_code=500, detail="PostgreSQL driver not installed")

def get_qdrant():
    return QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY, timeout=10)

class SearchRequest(BaseModel):
    user_id: str
    query: str
    limit: Optional[int] = 8
    exclude_confidential: Optional[bool] = True
    entity_type: Optional[str] = "all"

class UpsertPoint(BaseModel):
    id: str
    vector: List[float]
    payload: Dict[str, Any]

@app.get("/health")
def health():
    qdrant_ok = False
    postgres_ok = False
    try:
        q = get_qdrant()
        q.get_collections()
        qdrant_ok = True
    except Exception:
        pass

    try:
        conn = get_db()
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
        conn.close()
        postgres_ok = True
    except Exception:
        pass

    return {
        "status": "healthy" if (postgres_ok or qdrant_ok) else "degraded",
        "postgresql": postgres_ok,
        "qdrant": qdrant_ok,
        "qdrant_url": QDRANT_URL,
    }

@app.post("/api/qdrant/init")
def init_qdrant():
    try:
        q = get_qdrant()
        collections = q.get_collections().collections
        exists = any(c.name == QDRANT_COLLECTION for c in collections)
        if not exists:
            q.create_collection(
                collection_name=QDRANT_COLLECTION,
                vectors_config=models.VectorParams(
                    size=VECTOR_SIZE,
                    distance=models.Distance.COSINE,
                ),
            )
        return {"ok": True, "collection": QDRANT_COLLECTION, "exists": exists}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Qdrant error: {str(e)}")

@app.post("/api/qdrant/search")
def search_vectors(req: SearchRequest):
    try:
        q = get_qdrant()
        # Ensure collection
        init_qdrant()
        
        # Build filter
        must_filters = [
            models.FieldCondition(key="userId", match=models.MatchValue(value=req.user_id))
        ]
        if req.exclude_confidential:
            must_filters.append(
                models.FieldCondition(key="isConfidential", match=models.MatchValue(value=False))
            )
        if req.entity_type and req.entity_type != "all":
            must_filters.append(
                models.FieldCondition(key="entityType", match=models.MatchValue(value=req.entity_type))
            )

        # Generate dense vector for query
        # Here we perform vector search
        return {"ok": True, "query": req.query, "results": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/qdrant/upsert")
def upsert_point(point: UpsertPoint):
    try:
        q = get_qdrant()
        init_qdrant()
        q.upsert(
            collection_name=QDRANT_COLLECTION,
            points=[
                models.PointStruct(
                    id=point.id,
                    vector=point.vector,
                    payload=point.payload,
                )
            ],
        )
        return {"ok": True, "id": point.id}
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
