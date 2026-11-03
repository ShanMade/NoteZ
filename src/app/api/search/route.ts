import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceDocuments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { keywordSearchInDocument, searchContent, type SearchSourceType } from "@/lib/search";
import { validUuid } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VALID_TYPES: SearchSourceType[] = ["note", "voice", "ai"];

/**
 * Unified search.
 *  - `scope=note` + `documentId` → SQL keyword search inside a single note.
 *  - otherwise → semantic + keyword hybrid across the user's own content.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").slice(0, 400);
  const scope = searchParams.get("scope") === "note" ? "note" : "all";
  const documentId = searchParams.get("documentId");
  const typesParam = searchParams.get("types");
  const sourceTypes = typesParam
    ? (typesParam.split(",").filter((t) => VALID_TYPES.includes(t as SearchSourceType)) as SearchSourceType[])
    : undefined;

  if (scope === "note") {
    if (!validUuid(documentId)) {
      return NextResponse.json({ error: "A note is required for in-note search." }, { status: 400 });
    }
    const [doc] = await db
      .select({ id: workspaceDocuments.id, title: workspaceDocuments.title })
      .from(workspaceDocuments)
      .where(and(eq(workspaceDocuments.id, documentId), eq(workspaceDocuments.userId, user.id)))
      .limit(1);
    if (!doc) return NextResponse.json({ error: "Note not found." }, { status: 404 });

    const started = Date.now();
    const hits = await keywordSearchInDocument(user.id, documentId, query);
    return NextResponse.json({
      hits,
      mode: "keyword",
      scope: "note",
      note: { id: doc.id, title: doc.title },
      elapsedMs: Date.now() - started,
    });
  }

  const result = await searchContent({
    userId: user.id,
    query,
    sourceTypes,
    limit: Number(searchParams.get("limit")) || 24,
  });

  const documentIds = Array.from(
    new Set(result.hits.map((h) => h.documentId).filter((id): id is string => Boolean(id)))
  );
  const docs = documentIds.length
    ? await db
        .select({ id: workspaceDocuments.id, title: workspaceDocuments.title, icon: workspaceDocuments.icon, isArchived: workspaceDocuments.isArchived })
        .from(workspaceDocuments)
        .where(eq(workspaceDocuments.userId, user.id))
    : [];
  const docMap = new Map(docs.map((d) => [d.id, d]));

  return NextResponse.json({
    hits: result.hits.map((hit) => {
      const target = hit.sourceType === "note" ? hit.sourceId : hit.documentId;
      const meta = target ? docMap.get(target) : undefined;
      return {
        ...hit,
        targetId: target ?? null,
        documentTitle: meta?.title ?? null,
        documentIcon: meta?.icon ?? null,
        documentArchived: meta?.isArchived ?? false,
      };
    }),
    mode: "semantic",
    scope: "all",
    backend: result.backend,
    embedding: result.embedding,
    elapsedMs: result.elapsedMs,
  });
}
