import "server-only";

/**
 * Embedding providers.
 *
 * - `gemini`  : real embedding model (gemini-embedding-001) when GEMINI_API_KEY exists.
 * - `local`   : a deterministic, dependency-free hashed bag-of-words projection.
 *
 * The local projection is normalized and supports cosine similarity, so semantic-ish
 * ranking works offline; it is not a neural model and we label it honestly in the UI.
 */

export const EMBEDDING_DIM = 384;

export type EmbeddingProvider = "gemini" | "local";

export interface EmbeddingRuntime {
  provider: EmbeddingProvider;
  model: string;
  dimension: number;
}

export function embeddingRuntime(): EmbeddingRuntime {
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  return key
    ? { provider: "gemini", model: "gemini-embedding-001", dimension: EMBEDDING_DIM }
    : { provider: "local", model: "notez-local-hash-384", dimension: EMBEDDING_DIM };
}

const STOP = new Set([
  "the", "and", "for", "with", "that", "this", "from", "have", "will", "your", "you", "are",
  "was", "were", "but", "not", "can", "our", "out", "any", "all", "into", "then", "them",
  "they", "there", "here", "what", "when", "where", "which", "who", "how", "why", "its",
  "it's", "a", "an", "of", "to", "in", "on", "at", "is", "as", "by", "or", "be", "we", "i",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9'-]+/g) ?? []).filter(
    (t) => t.length > 1 && !STOP.has(t)
  );
}

/** Stable 32-bit FNV-1a hash. */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function localEmbed(text: string): number[] {
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);
  const tokens = tokenize(text);
  if (tokens.length === 0) return vec;

  const push = (term: string, weight: number) => {
    const h = hash(term);
    const idx = h % EMBEDDING_DIM;
    const sign = (h & 0x80000000) === 0 ? 1 : -1;
    vec[idx] += sign * weight;
  };

  for (const token of tokens) push(token, 1);

  // Light character n-grams give partial credit for near-misses and morphology.
  for (const token of tokens) {
    if (token.length < 5) continue;
    for (let i = 0; i + 3 <= token.length; i++) push(`#${token.slice(i, i + 3)}`, 0.35);
  }

  // Bigram context adds a little word-order signal.
  for (let i = 0; i + 1 < tokens.length; i++) push(`${tokens[i]}_${tokens[i + 1]}`, 0.5);

  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}

async function geminiEmbedBatch(texts: string[], taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  const key = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
  if (!key) throw new Error("No Gemini key");

  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: text.slice(0, 8000) }] },
          taskType,
          outputDimensionality: EMBEDDING_DIM,
        })),
      }),
      signal: AbortSignal.timeout(45_000),
    }
  );

  if (!res.ok) throw new Error(`Embedding request failed (${res.status})`);
  const data = (await res.json()) as { embeddings?: Array<{ values?: number[] }> };
  const vectors = (data.embeddings ?? []).map((e) => e.values ?? []);
  if (vectors.length !== texts.length || vectors.some((v) => v.length !== EMBEDDING_DIM)) {
    throw new Error("Embedding response shape mismatch");
  }
  return vectors;
}

/** Batch embeddings with graceful per-item fallback to the local projection. */
export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
): Promise<{ vectors: number[][]; provider: EmbeddingProvider }> {
  if (texts.length === 0) return { vectors: [], provider: embeddingRuntime().provider };
  if (embeddingRuntime().provider === "gemini") {
    try {
      const out: number[][] = [];
      for (let i = 0; i < texts.length; i += 32) {
        out.push(...(await geminiEmbedBatch(texts.slice(i, i + 32), taskType)));
      }
      return { vectors: out, provider: "gemini" };
    } catch (error) {
      console.error("Gemini embeddings unavailable, using local projection:", error);
    }
  }
  return { vectors: texts.map(localEmbed), provider: "local" };
}

export function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}
