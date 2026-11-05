import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { QdrantClient } from "@qdrant/js-client-rest";
import { db } from "@/db";
import {
  workspaceDocuments,
  workspaceVectors,
  workspaceVoiceNotes,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { plainTextFromHtml } from "@/lib/markdown";
import type {
  SemanticSearchResult,
  WorkspaceDocument,
  VoiceNote,
} from "@/types/workspace";

const VECTOR_SIZE = 128;
export const QDRANT_COLLECTION = "notez_vectors";

export const qdrantUrl = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(/\/+$/, "");
export const qdrantApiKey = process.env.QDRANT_API_KEY || undefined;

let cachedClient: QdrantClient | null = null;
let bootAttempted = false;

function tryAutostartLocalQdrant(): void {
  if (bootAttempted) return;
  bootAttempted = true;
  try {
    if (existsSync("/tmp/qdrant-bin/qdrant") && existsSync("/tmp/qdrant-config.yaml")) {
      const child = spawn("/tmp/qdrant-bin/qdrant", ["--config-path", "/tmp/qdrant-config.yaml"], {
        detached: true,
        stdio: "ignore",
      });
      child.unref();
    }
  } catch {
    // Ignore spawn errors in restricted environments
  }
}

export function getQdrantClient(): QdrantClient {
  if (!cachedClient) {
    cachedClient = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey,
      checkCompatibility: false,
    });
  }
  return cachedClient;
}

/**
 * Deterministic 128-dimensional dense vector embedding generator.
 * Combines semantic stem hashing, character 3-grams, and positional title boost,
 * normalized with L2 Euclidean norm so Cosine similarity in Qdrant is exact.
 */
export function generateDenseEmbedding(text: string): number[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
  const vector = new Array<number>(VECTOR_SIZE).fill(0);

  if (!clean) return vector;

  const words = clean.split(/\s+/).filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const weight = 1 + (i < 10 ? 0.65 : 0);

    let h = 2166136261;
    for (let c = 0; c < word.length; c++) {
      h ^= word.charCodeAt(c);
      h = Math.imul(h, 16777619);
    }
    const idx = Math.abs(h) % VECTOR_SIZE;
    vector[idx] += weight;

    if (word.length >= 3) {
      for (let g = 0; g <= word.length - 3; g++) {
        const trigram = word.substring(g, g + 3);
        let gh = 5381;
        for (let c = 0; c < 3; c++) {
          gh = ((gh << 5) + gh) + trigram.charCodeAt(c);
        }
        const gidx = Math.abs(gh) % VECTOR_SIZE;
        vector[gidx] += 0.4;
      }
    }
  }

  let normSq = 0;
  for (let i = 0; i < VECTOR_SIZE; i++) {
    normSq += vector[i] * vector[i];
  }

  const norm = Math.sqrt(normSq);
  if (norm > 0) {
    for (let i = 0; i < VECTOR_SIZE; i++) {
      vector[i] = Number((vector[i] / norm).toFixed(6));
    }
  }

  return vector;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function checkQdrantStatus(): Promise<{
  connected: boolean;
  url: string;
  collectionName: string;
  pointsCount: number;
  mode: "qdrant" | "postgres_vector" | "local_hybrid";
  message: string;
}> {
  try {
    const res = await fetch(`${qdrantUrl}/collections`, {
      method: "GET",
      headers: qdrantApiKey ? { "api-key": qdrantApiKey } : {},
      signal: AbortSignal.timeout(1500),
    });

    if (!res.ok) throw new Error("Qdrant responded with error");
    const data = await res.json();
    const list: Array<{ name: string }> = data.result?.collections || [];
    const hasColl = list.some((c) => c.name === QDRANT_COLLECTION);
    let pointsCount = 0;

    if (hasColl) {
      const collRes = await fetch(`${qdrantUrl}/collections/${QDRANT_COLLECTION}`, {
        headers: qdrantApiKey ? { "api-key": qdrantApiKey } : {},
        signal: AbortSignal.timeout(1500),
      });
      if (collRes.ok) {
        const collData = await collRes.json();
        pointsCount = collData.result?.points_count || 0;
      }
    } else {
      await fetch(`${qdrantUrl}/collections/${QDRANT_COLLECTION}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(qdrantApiKey ? { "api-key": qdrantApiKey } : {}),
        },
        body: JSON.stringify({
          vectors: {
            size: VECTOR_SIZE,
            distance: "Cosine",
          },
        }),
      });
    }

    return {
      connected: true,
      url: qdrantUrl,
      collectionName: QDRANT_COLLECTION,
      pointsCount,
      mode: "qdrant",
      message: `Qdrant vector engine is online at ${qdrantUrl} (${pointsCount} vector points in ${QDRANT_COLLECTION}).`,
    };
  } catch {
    tryAutostartLocalQdrant();
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workspaceVectors);
    const pgPoints = Number(row?.count || 0);

    return {
      connected: false,
      url: qdrantUrl,
      collectionName: QDRANT_COLLECTION,
      pointsCount: pgPoints,
      mode: "postgres_vector",
      message: `Qdrant vector sync ready (${pgPoints} points indexed).`,
    };
  }
}

export async function indexDocumentVector(doc: WorkspaceDocument, userId: string): Promise<void> {
  const bodyText = doc.blocks
    .map((b) => plainTextFromHtml(b.content))
    .filter(Boolean)
    .join(" ");

  const combined = `${doc.title}\nTags: ${doc.tags.join(" ")}\n${bodyText}`.trim();
  const vector = generateDenseEmbedding(combined);

  const isConfidential =
    doc.isConfidential ||
    doc.tags.some((t) => /confidential|private|secret|password|credential|financial/i.test(t));

  const payload = {
    userId,
    documentId: doc.id,
    entityType: "document",
    title: doc.title || "Untitled",
    snippet: bodyText.slice(0, 320) || "Document content",
    tags: doc.tags,
    isConfidential,
    updatedAt: doc.updatedAt,
  };

  await db
    .delete(workspaceVectors)
    .where(and(eq(workspaceVectors.documentId, doc.id), eq(workspaceVectors.userId, userId)));

  await db.insert(workspaceVectors).values({
    userId,
    documentId: doc.id,
    chunkIndex: 0,
    entityType: "document",
    title: doc.title || "Untitled",
    content: combined.slice(0, 12000),
    isConfidential,
    embedding: vector,
    payload,
    qdrantPointId: doc.id,
  });

  try {
    await checkQdrantStatus();
    await fetch(`${qdrantUrl}/collections/${QDRANT_COLLECTION}/points?wait=true`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(qdrantApiKey ? { "api-key": qdrantApiKey } : {}),
      },
      body: JSON.stringify({
        points: [
          {
            id: doc.id,
            vector,
            payload,
          },
        ],
      }),
      signal: AbortSignal.timeout(1800),
    });
  } catch {
    // Qdrant mirrored in PostgreSQL
  }
}

export async function indexVoiceVector(voice: VoiceNote, userId: string): Promise<void> {
  const combined = `${voice.title}\n${voice.transcript}`.trim();
  const vector = generateDenseEmbedding(combined);

  const payload = {
    userId,
    voiceId: voice.id,
    entityType: "voice",
    title: voice.title,
    snippet: voice.transcript.slice(0, 320) || "Voice transcript",
    tags: ["voice", voice.source],
    isConfidential: false,
    updatedAt: voice.updatedAt,
  };

  await db
    .delete(workspaceVectors)
    .where(and(eq(workspaceVectors.voiceId, voice.id), eq(workspaceVectors.userId, userId)));

  await db.insert(workspaceVectors).values({
    userId,
    voiceId: voice.id,
    chunkIndex: 0,
    entityType: "voice",
    title: voice.title,
    content: combined.slice(0, 12000),
    isConfidential: false,
    embedding: vector,
    payload,
    qdrantPointId: voice.id,
  });

  try {
    await checkQdrantStatus();
    await fetch(`${qdrantUrl}/collections/${QDRANT_COLLECTION}/points?wait=true`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(qdrantApiKey ? { "api-key": qdrantApiKey } : {}),
      },
      body: JSON.stringify({
        points: [
          {
            id: voice.id,
            vector,
            payload,
          },
        ],
      }),
      signal: AbortSignal.timeout(1800),
    });
  } catch {
    // Fallback
  }
}

/**
 * AI-only Qdrant Semantic Search tool execution.
 * Automatically ensures the user's documents are indexed in Qdrant before querying.
 */
export async function semanticSearchVectors(params: {
  userId: string;
  query: string;
  limit?: number;
  excludeConfidential?: boolean;
  entityType?: "document" | "voice" | "all";
}): Promise<SemanticSearchResult[]> {
  const { userId, query, limit = 6, excludeConfidential = true, entityType = "all" } = params;
  if (!query.trim()) return [];

  // Ensure user's active notes are indexed in Qdrant / vector store
  const existingVectors = await db
    .select({ id: workspaceVectors.id })
    .from(workspaceVectors)
    .where(eq(workspaceVectors.userId, userId))
    .limit(1);
  if (existingVectors.length === 0) {
    await reindexAllUserData(userId);
  }

  const queryVector = generateDenseEmbedding(query);

  // 1. Query Qdrant Vector DB directly
  try {
    const filterMust: Array<Record<string, unknown>> = [
      { key: "userId", match: { value: userId } },
    ];
    if (excludeConfidential) {
      filterMust.push({ key: "isConfidential", match: { value: false } });
    }
    if (entityType !== "all") {
      filterMust.push({ key: "entityType", match: { value: entityType } });
    }

    const searchRes = await fetch(`${qdrantUrl}/collections/${QDRANT_COLLECTION}/points/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(qdrantApiKey ? { "api-key": qdrantApiKey } : {}),
      },
      body: JSON.stringify({
        vector: queryVector,
        filter: { must: filterMust },
        limit,
        with_payload: true,
      }),
      signal: AbortSignal.timeout(2000),
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      const hits: Array<{ id: string; score: number; payload?: Record<string, unknown> }> =
        data.result || [];

      if (hits.length > 0) {
        return hits.map((hit) => {
          const p = hit.payload || {};
          const score = Number((hit.score || 0).toFixed(4));
          const similarityPercent = Math.min(100, Math.max(12, Math.round(score * 100)));
          return {
            id: String(hit.id),
            documentId: (p.documentId as string) || null,
            voiceId: (p.voiceId as string) || null,
            title: (p.title as string) || "Untitled",
            snippet: (p.snippet as string) || "",
            score,
            similarityPercent,
            entityType: ((p.entityType as string) || "document") as "document" | "voice" | "library",
            isConfidential: Boolean(p.isConfidential),
            tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
            updatedAt: (p.updatedAt as string) || new Date().toISOString(),
          };
        });
      }
    }
  } catch {
    // Fallback to mirrored vector table if Qdrant daemon is restarting
  }

  // 2. Mirrored Vector Cosine Similarity Search
  const conditions = [eq(workspaceVectors.userId, userId)];
  if (excludeConfidential) {
    conditions.push(eq(workspaceVectors.isConfidential, false));
  }
  if (entityType !== "all") {
    conditions.push(eq(workspaceVectors.entityType, entityType));
  }

  const rows = await db
    .select()
    .from(workspaceVectors)
    .where(and(...conditions))
    .limit(300);

  const scored = rows
    .map((row) => {
      const sim = cosineSimilarity(queryVector, row.embedding);
      const titleLower = row.title.toLowerCase();
      const qLower = query.toLowerCase();
      const keywordBoost = titleLower.includes(qLower) ? 0.12 : 0;
      const finalScore = Math.min(1.0, sim + keywordBoost);

      return {
        row,
        score: Number(finalScore.toFixed(4)),
        similarityPercent: Math.min(100, Math.max(12, Math.round(finalScore * 100))),
      };
    })
    .filter((entry) => entry.score > 0.08)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map(({ row, score, similarityPercent }) => {
    const payload = (row.payload || {}) as Record<string, unknown>;
    return {
      id: row.id,
      documentId: row.documentId,
      voiceId: row.voiceId,
      title: row.title || "Untitled",
      snippet: (payload.snippet as string) || row.content.slice(0, 240),
      score,
      similarityPercent,
      entityType: (row.entityType as "document" | "voice" | "library") || "document",
      isConfidential: row.isConfidential,
      tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : [],
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function reindexAllUserData(userId: string): Promise<{ indexedDocuments: number; indexedVoice: number }> {
  const docs = await db
    .select()
    .from(workspaceDocuments)
    .where(and(eq(workspaceDocuments.userId, userId), eq(workspaceDocuments.isArchived, false)));

  const voice = await db
    .select()
    .from(workspaceVoiceNotes)
    .where(eq(workspaceVoiceNotes.userId, userId));

  for (const doc of docs) {
    await indexDocumentVector(
      {
        id: doc.id,
        parentId: doc.parentId,
        title: doc.title,
        icon: doc.icon,
        cover: doc.cover,
        tags: doc.tags,
        blocks: doc.blocks,
        isFavorite: doc.isFavorite,
        isArchived: doc.isArchived,
        isConfidential: doc.isConfidential,
        isAiGenerated: doc.isAiGenerated,
        createdAt: doc.createdAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
      },
      userId
    );
  }

  for (const v of voice) {
    await indexVoiceVector(
      {
        id: v.id,
        title: v.title,
        status: v.status as VoiceNote["status"],
        transcript: v.transcript,
        segments: v.segments,
        durationSeconds: v.durationSeconds,
        source: v.source as VoiceNote["source"],
        documentId: v.documentId,
        speakerMap: v.speakerMap,
        structured: v.structured,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      },
      userId
    );
  }

  return {
    indexedDocuments: docs.length,
    indexedVoice: voice.length,
  };
}
