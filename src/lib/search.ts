import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { workspaceAssistantRuns, workspaceDocuments, workspaceSearchChunks, workspaceVoiceNotes } from "@/db/schema";
import { plainTextFromHtml } from "@/lib/markdown";
import { cosine, embedTexts, embeddingRuntime } from "@/lib/embeddings";
import {
  ensureQdrantCollection,
  qdrantConfigured,
  qdrantDeleteByDocument,
  qdrantHealthy,
  qdrantSearch,
  qdrantUpsert,
} from "@/lib/qdrant";

export type SearchSourceType = "note" | "voice" | "ai";

export interface SearchHit {
  id: string;
  sourceType: SearchSourceType;
  sourceId: string;
  documentId: string | null;
  title: string;
  snippet: string;
  chunkIndex: number;
  score: number;
  semanticScore: number;
  keywordScore: number;
  backend: "qdrant" | "postgres";
  updatedAt: string;
}

interface ChunkRecord {
  id: string;
  sourceType: SearchSourceType;
  sourceId: string;
  documentId: string | null;
  title: string;
  content: string;
  chunkIndex: number;
}

const CHUNK_CHARS = 900;
const MAX_CHUNKS_PER_SOURCE = 60;
const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "will", "your", "you", "are",
  "was", "were", "but", "not", "can", "our", "out", "any", "all", "into", "then", "them",
  "they", "there", "what", "when", "where", "which", "who", "how", "why", "its", "a", "an",
  "of", "to", "in", "on", "at", "is", "as", "by", "or", "be", "we", "i",
]);

const fingerprint = (value: string) => createHash("sha256").update(value).digest("hex").slice(0, 32);

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= CHUNK_CHARS) return [clean];

  const chunks: string[] = [];
  const paragraphs = clean.split(/\n{2,}/);
  let current = "";
  for (const para of paragraphs) {
    if ((current + para).length > CHUNK_CHARS && current) {
      chunks.push(current.trim());
      current = "";
    }
    if (para.length > CHUNK_CHARS) {
      for (let i = 0; i < para.length; i += CHUNK_CHARS) {
        chunks.push(para.slice(i, i + CHUNK_CHARS).trim());
      }
    } else {
      current += `${para}\n\n`;
    }
    if (chunks.length >= MAX_CHUNKS_PER_SOURCE) break;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.slice(0, MAX_CHUNKS_PER_SOURCE).filter(Boolean);
}

function makeSnippet(content: string, query: string): string {
  const terms = tokenize(query);
  const lower = content.toLowerCase();
  let idx = -1;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found >= 0 && (idx < 0 || found < idx)) idx = found;
  }
  const start = Math.max(0, idx - 70);
  const slice = content.slice(start, start + 220).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${slice}${start + 220 < content.length ? "…" : ""}`;
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9'-]+/g) ?? []).filter(
    (t) => t.length > 1 && !STOP.has(t)
  );
}

/** Postgres-side keyword score: exact token overlap + prefix matches. */
function keywordScore(content: string, terms: string[]): number {
  if (!terms.length) return 0;
  const lower = content.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (lower.includes(term)) score += 1;
    else if (term.length > 4 && lower.includes(term.slice(0, 4))) score += 0.3;
  }
  return score / terms.length;
}

async function indexRecords(userId: string, records: ChunkRecord[]): Promise<void> {
  if (records.length === 0) return;

  const ids = records.map((r) => r.id);
  const existing = await db
    .select({ id: workspaceSearchChunks.id, fingerprint: workspaceSearchChunks.fingerprint })
    .from(workspaceSearchChunks)
    .where(and(eq(workspaceSearchChunks.userId, userId), inArray(workspaceSearchChunks.id, ids)));
  const known = new Map(existing.map((row) => [row.id, row.fingerprint]));

  const changed = records.filter((r) => known.get(r.id) !== fingerprint(`${r.title}\n${r.content}`));
  if (changed.length === 0) return;

  const { vectors } = await embedTexts(changed.map((r) => `${r.title}\n${r.content}`));

  const rows = changed.map((record, i) => ({
    id: record.id,
    userId,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    documentId: record.documentId,
    title: record.title.slice(0, 300),
    content: record.content,
    chunkIndex: record.chunkIndex,
    vector: vectors[i] ?? [],
    fingerprint: fingerprint(`${record.title}\n${record.content}`),
    updatedAt: new Date(),
  }));

  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    await db
      .insert(workspaceSearchChunks)
      .values(batch)
      .onConflictDoUpdate({
        target: workspaceSearchChunks.id,
        set: {
          title: sqlExcluded("title"),
          content: sqlExcluded("content"),
          vector: sqlExcluded("vector"),
          fingerprint: sqlExcluded("fingerprint"),
          documentId: sqlExcluded("document_id"),
          updatedAt: sqlExcluded("updated_at"),
        },
      });
  }

  if (qdrantConfigured() && (await ensureQdrantCollection())) {
    await qdrantUpsert(
      rows.map((row) => ({
        id: row.id,
        vector: row.vector,
        payload: {
          userId,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          documentId: row.documentId ?? "",
          title: row.title,
          chunkIndex: row.chunkIndex,
        },
      }))
    );
  }
}

// Small helper keeps the upsert readable.
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}

/** Rebuild the search documents for one note. Safe to call on every save. */
export async function indexDocument(userId: string, documentId: string): Promise<void> {
  const [doc] = await db
    .select()
    .from(workspaceDocuments)
    .where(and(eq(workspaceDocuments.id, documentId), eq(workspaceDocuments.userId, userId)))
    .limit(1);
  if (!doc) return;

  if (doc.isArchived) {
    await removeFromIndex(userId, "note", documentId);
    return;
  }

  const body = (doc.blocks ?? [])
    .map((b) => plainTextFromHtml(b.content))
    .filter(Boolean)
    .join("\n\n");
  const text = [doc.title, doc.tags?.map((t) => `#${t}`).join(" "), body].filter(Boolean).join("\n");
  const chunks = chunkText(text);

  await db
    .delete(workspaceSearchChunks)
    .where(
      and(
        eq(workspaceSearchChunks.userId, userId),
        eq(workspaceSearchChunks.sourceType, "note"),
        eq(workspaceSearchChunks.sourceId, documentId)
      )
    );

  await indexRecords(
    userId,
    chunks.map((content, i) => ({
      id: `note:${documentId}:${i}`,
      sourceType: "note" as const,
      sourceId: documentId,
      documentId,
      title: doc.title || "Untitled",
      content,
      chunkIndex: i,
    }))
  );
}

/** Index (or re-index) a voice note transcript so it is semantically searchable. */
export async function indexVoiceNote(userId: string, voiceId: string): Promise<void> {
  const [note] = await db
    .select()
    .from(workspaceVoiceNotes)
    .where(and(eq(workspaceVoiceNotes.id, voiceId), eq(workspaceVoiceNotes.userId, userId)))
    .limit(1);
  if (!note) return;

  const transcript = note.segments?.length
    ? note.segments.map((s) => `${note.speakerMap?.[s.speaker] || s.speaker}: ${s.text}`).join("\n")
    : note.transcript;

  await db
    .delete(workspaceSearchChunks)
    .where(
      and(
        eq(workspaceSearchChunks.userId, userId),
        eq(workspaceSearchChunks.sourceType, "voice"),
        eq(workspaceSearchChunks.sourceId, voiceId)
      )
    );

  if (!transcript.trim()) return;
  const text = [note.title, note.structured?.summary, transcript].filter(Boolean).join("\n");
  const chunks = chunkText(text);
  await indexRecords(
    userId,
    chunks.map((content, i) => ({
      id: `voice:${voiceId}:${i}`,
      sourceType: "voice" as const,
      sourceId: voiceId,
      documentId: note.documentId ?? null,
      title: note.title || "Voice note",
      content,
      chunkIndex: i,
    }))
  );
}

/** Index saved AI answers so past conversations are searchable too. */
export async function indexAssistantRun(userId: string, runId: string): Promise<void> {
  const [run] = await db
    .select()
    .from(workspaceAssistantRuns)
    .where(and(eq(workspaceAssistantRuns.id, runId), eq(workspaceAssistantRuns.userId, userId)))
    .limit(1);
  if (!run) return;

  const text = [run.title, run.prompt, run.answer].filter(Boolean).join("\n");
  const chunks = chunkText(text);
  await indexRecords(
    userId,
    chunks.map((content, i) => ({
      id: `ai:${runId}:${i}`,
      sourceType: "ai" as const,
      sourceId: runId,
      documentId: run.documentId ?? null,
      title: run.title || "AI answer",
      content,
      chunkIndex: i,
    }))
  );
}

async function removeFromIndex(userId: string, sourceType: SearchSourceType, sourceId: string): Promise<void> {
  await db
    .delete(workspaceSearchChunks)
    .where(
      and(
        eq(workspaceSearchChunks.userId, userId),
        eq(workspaceSearchChunks.sourceType, sourceType),
        eq(workspaceSearchChunks.sourceId, sourceId)
      )
    );
  if (sourceType === "note" && qdrantConfigured()) {
    await qdrantDeleteByDocument(userId, sourceId);
  }
}

export async function removeVoiceFromIndex(userId: string, voiceId: string): Promise<void> {
  await removeFromIndex(userId, "voice", voiceId);
}

/** Queue indexing without blocking the request response. */
export function queueIndex(task: Promise<unknown>): void {
  void task.catch((error) => console.error("Search indexing failed:", error));
}

export interface SearchOptions {
  userId: string;
  query: string;
  scope?: "all" | "note";
  documentId?: string;
  sourceTypes?: SearchSourceType[];
  limit?: number;
}

export async function searchContent(options: SearchOptions): Promise<{
  hits: SearchHit[];
  backend: "qdrant" | "postgres";
  embedding: "gemini" | "local";
  elapsedMs: number;
}> {
  const started = Date.now();
  const query = options.query.trim().slice(0, 400);
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const types = options.sourceTypes?.length ? options.sourceTypes : (["note", "voice", "ai"] as SearchSourceType[]);
  const embedding = embeddingRuntime().provider;

  if (!query) return { hits: [], backend: qdrantConfigured() ? "qdrant" : "postgres", embedding, elapsedMs: 0 };

  const filters = [eq(workspaceSearchChunks.userId, options.userId), inArray(workspaceSearchChunks.sourceType, types)];
  if (options.scope === "note" && options.documentId) {
    filters.push(eq(workspaceSearchChunks.documentId, options.documentId));
  }

  const rows = await db.select().from(workspaceSearchChunks).where(and(...filters)).limit(4000);
  if (rows.length === 0) {
    return { hits: [], backend: qdrantConfigured() ? "qdrant" : "postgres", embedding, elapsedMs: Date.now() - started };
  }

  const { vectors } = await embedTexts([query], "RETRIEVAL_QUERY");
  const queryVector = vectors[0] ?? [];

  // Semantic ranking: Qdrant when available, always fused with the local index.
  let backend: "qdrant" | "postgres" = "postgres";
  const semantic = new Map<string, number>();
  if (qdrantConfigured() && (await qdrantHealthy())) {
    const qHits = await qdrantSearch(options.userId, queryVector, {
      limit: 40,
      documentId: options.scope === "note" ? options.documentId : undefined,
    });
    if (qHits.length) {
      backend = "qdrant";
      for (const hit of qHits) {
        if (String(hit.payload.sourceType ?? "") === "ai" && !types.includes("ai")) continue;
        semantic.set(hit.id, hit.score);
      }
    }
  }
  for (const row of rows) {
    const local = cosine(queryVector, row.vector ?? []);
    semantic.set(row.id, Math.max(semantic.get(row.id) ?? 0, local));
  }

  const terms = tokenize(query);
  const scored = rows.map((row) => {
    const kw = keywordScore(`${row.title} ${row.content}`, terms);
    const sem = semantic.get(row.id) ?? 0;
    // Reciprocal-rank-style blend: semantic leads, keywords break ties and fix exact matches.
    const score = sem * 0.68 + kw * 0.32 + (row.title.toLowerCase().includes(query.toLowerCase()) ? 0.18 : 0);
    return { row, kw, sem, score };
  });

  const best = new Map<string, (typeof scored)[number]>();
  for (const item of scored) {
    const key = `${item.row.sourceType}:${item.row.sourceId}`;
    const prev = best.get(key);
    if (!prev || item.score > prev.score) best.set(key, item);
  }

  const hits: SearchHit[] = Array.from(best.values())
    .filter((item) => item.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      id: item.row.id,
      sourceType: item.row.sourceType as SearchSourceType,
      sourceId: item.row.sourceId,
      documentId: item.row.documentId ?? null,
      title: item.row.title || "Untitled",
      snippet: makeSnippet(item.row.content, query),
      chunkIndex: item.row.chunkIndex,
      score: Number(item.score.toFixed(4)),
      semanticScore: Number(item.sem.toFixed(4)),
      keywordScore: Number(item.kw.toFixed(4)),
      backend,
      updatedAt: item.row.updatedAt.toISOString(),
    }));

  return { hits, backend, embedding, elapsedMs: Date.now() - started };
}

/** SQL keyword search intended for "find in this note". */
export async function keywordSearchInDocument(
  userId: string,
  documentId: string,
  query: string
): Promise<SearchHit[]> {
  const q = query.trim().slice(0, 200);
  if (!q) return [];

  const rows = await db
    .select()
    .from(workspaceSearchChunks)
    .where(
      and(
        eq(workspaceSearchChunks.userId, userId),
        eq(workspaceSearchChunks.documentId, documentId)
      )
    )
    .limit(2000);

  const terms = tokenize(q);
  return rows
    .map((row) => {
      const kw = keywordScore(`${row.title} ${row.content}`, terms);
      return { row, kw };
    })
    .filter((item) => item.kw > 0)
    .sort((a, b) => b.kw - a.kw)
    .slice(0, 20)
    .map((item) => ({
      id: item.row.id,
      sourceType: item.row.sourceType as SearchSourceType,
      sourceId: item.row.sourceId,
      documentId: item.row.documentId ?? null,
      title: item.row.title,
      snippet: makeSnippet(item.row.content, q),
      chunkIndex: item.row.chunkIndex,
      score: item.kw,
      semanticScore: 0,
      keywordScore: item.kw,
      backend: "postgres" as const,
      updatedAt: item.row.updatedAt.toISOString(),
    }));
}

export async function searchStatus(userId: string) {
  const rows = await db
    .select({ id: workspaceSearchChunks.id, sourceType: workspaceSearchChunks.sourceType })
    .from(workspaceSearchChunks)
    .where(eq(workspaceSearchChunks.userId, userId));
  const embedding = embeddingRuntime();
  return {
    postgres: { connected: true, chunks: rows.length },
    qdrant: {
      configured: qdrantConfigured(),
      connected: qdrantConfigured() ? await qdrantHealthy() : false,
    },
    embeddings: { provider: embedding.provider, model: embedding.model, dimension: embedding.dimension },
    breakdown: {
      notes: rows.filter((r) => r.sourceType === "note").length,
      voice: rows.filter((r) => r.sourceType === "voice").length,
      ai: rows.filter((r) => r.sourceType === "ai").length,
    },
  };
}

/** Rebuild every chunk for a user (used by the settings "reindex" action). */
export async function reindexWorkspace(userId: string): Promise<{ notes: number; voice: number; ai: number }> {
  const docs = await db
    .select({ id: workspaceDocuments.id })
    .from(workspaceDocuments)
    .where(and(eq(workspaceDocuments.userId, userId), eq(workspaceDocuments.isArchived, false)));
  const voices = await db
    .select({ id: workspaceVoiceNotes.id })
    .from(workspaceVoiceNotes)
    .where(eq(workspaceVoiceNotes.userId, userId));
  const runs = await db
    .select({ id: workspaceAssistantRuns.id })
    .from(workspaceAssistantRuns)
    .where(eq(workspaceAssistantRuns.userId, userId));

  for (const doc of docs) await indexDocument(userId, doc.id);
  for (const voice of voices) await indexVoiceNote(userId, voice.id);
  for (const run of runs) await indexAssistantRun(userId, run.id);

  return { notes: docs.length, voice: voices.length, ai: runs.length };
}

/**
 * Make sure a workspace has a search index. Older content (created before the
 * index existed) is built on first load; later loads are a cheap count check.
 */
export async function ensureWorkspaceIndexed(userId: string): Promise<void> {
  try {
    const existing = await db
      .select({ id: workspaceSearchChunks.id })
      .from(workspaceSearchChunks)
      .where(eq(workspaceSearchChunks.userId, userId))
      .limit(1);
    if (existing.length) return;
    const docs = await db
      .select({ id: workspaceDocuments.id })
      .from(workspaceDocuments)
      .where(and(eq(workspaceDocuments.userId, userId), eq(workspaceDocuments.isArchived, false)))
      .limit(1);
    if (!docs.length) return;
    await reindexWorkspace(userId);
  } catch (error) {
    console.error("Initial index build failed:", error);
  }
}
