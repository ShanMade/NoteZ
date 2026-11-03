import "server-only";
import { EMBEDDING_DIM } from "./embeddings";

/**
 * Minimal Qdrant REST client. Everything degrades safely:
 * if QDRANT_URL is absent or Qdrant is unreachable, callers fall back to the
 * Postgres vector index and the UI reports the actual backend in use.
 */

export interface QdrantConfig {
  url: string;
  apiKey: string;
  collection: string;
}

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: Record<string, unknown>;
}

export function qdrantConfig(): QdrantConfig | null {
  const url = (process.env.QDRANT_URL || "").trim().replace(/\/+$/, "");
  if (!url) return null;
  return {
    url,
    apiKey: (process.env.QDRANT_API_KEY || "").trim(),
    collection: (process.env.QDRANT_COLLECTION || "notez_content").trim(),
  };
}

export function qdrantConfigured(): boolean {
  return qdrantConfig() !== null;
}

async function request(path: string, init: RequestInit = {}): Promise<Response | null> {
  const cfg = qdrantConfig();
  if (!cfg) return null;
  try {
    return await fetch(`${cfg.url}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(cfg.apiKey ? { "api-key": cfg.apiKey } : {}),
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    console.error("Qdrant request failed:", error);
    return null;
  }
}

export async function qdrantHealthy(): Promise<boolean> {
  const res = await request("/collections", { method: "GET" });
  return Boolean(res?.ok);
}

export async function ensureQdrantCollection(): Promise<boolean> {
  const cfg = qdrantConfig();
  if (!cfg) return false;

  const existing = await request(`/collections/${encodeURIComponent(cfg.collection)}`, { method: "GET" });
  if (existing?.ok) return true;

  const created = await request(`/collections/${encodeURIComponent(cfg.collection)}`, {
    method: "PUT",
    body: JSON.stringify({ vectors: { size: EMBEDDING_DIM, distance: "Cosine" } }),
  });
  if (!created?.ok) return false;

  // Payload indexes keep per-user filtering fast.
  for (const [field, schema] of [
    ["userId", "keyword"],
    ["sourceType", "keyword"],
    ["documentId", "keyword"],
  ] as const) {
    await request(`/collections/${encodeURIComponent(cfg.collection)}/index`, {
      method: "PUT",
      body: JSON.stringify({ field_name: field, field_schema: schema }),
    });
  }
  return true;
}

export async function qdrantUpsert(points: QdrantPoint[]): Promise<boolean> {
  const cfg = qdrantConfig();
  if (!cfg || points.length === 0) return false;
  const res = await request(`/collections/${encodeURIComponent(cfg.collection)}/points?wait=false`, {
    method: "PUT",
    body: JSON.stringify({
      points: points.map((p) => ({ id: p.id, vector: p.vector, payload: p.payload })),
    }),
  });
  return Boolean(res?.ok);
}

export async function qdrantDelete(ids: string[]): Promise<boolean> {
  const cfg = qdrantConfig();
  if (!cfg || ids.length === 0) return false;
  const res = await request(`/collections/${encodeURIComponent(cfg.collection)}/points/delete?wait=false`, {
    method: "POST",
    body: JSON.stringify({ points: ids }),
  });
  return Boolean(res?.ok);
}

export async function qdrantDeleteByDocument(userId: string, documentId: string): Promise<boolean> {
  const cfg = qdrantConfig();
  if (!cfg) return false;
  const res = await request(`/collections/${encodeURIComponent(cfg.collection)}/points/delete?wait=false`, {
    method: "POST",
    body: JSON.stringify({
      filter: {
        must: [
          { key: "userId", match: { value: userId } },
          { key: "documentId", match: { value: documentId } },
        ],
      },
    }),
  });
  return Boolean(res?.ok);
}

export interface QdrantHit {
  id: string;
  score: number;
  payload: Record<string, unknown>;
}

export async function qdrantSearch(
  userId: string,
  vector: number[],
  options: { limit?: number; documentId?: string } = {}
): Promise<QdrantHit[]> {
  const cfg = qdrantConfig();
  if (!cfg) return [];

  const must: Array<Record<string, unknown>> = [{ key: "userId", match: { value: userId } }];
  if (options.documentId) must.push({ key: "documentId", match: { value: options.documentId } });

  const res = await request(`/collections/${encodeURIComponent(cfg.collection)}/points/search`, {
    method: "POST",
    body: JSON.stringify({
      vector,
      limit: options.limit ?? 20,
      with_payload: true,
      filter: { must },
    }),
  });
  if (!res?.ok) return [];

  const data = (await res.json().catch(() => ({}))) as {
    result?: Array<{ id?: string | number; score?: number; payload?: Record<string, unknown> }>;
  };
  return (data.result ?? []).map((hit) => ({
    id: String(hit.id ?? ""),
    score: hit.score ?? 0,
    payload: hit.payload ?? {},
  }));
}
