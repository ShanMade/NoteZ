import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceDocuments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { normalizeBlocks, serializeDocument, validUuid } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";
async function owned(id: string, userId: string) {
  if (!validUuid(id)) return null;
  const [row] = await db.select().from(workspaceDocuments).where(and(eq(workspaceDocuments.id, id), eq(workspaceDocuments.userId, userId))).limit(1);
  return row ?? null;
}
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;
  const row = await owned(id, user.id);
  if (!row) return NextResponse.json({ error: "Note not found." }, { status: 404 });
  return NextResponse.json({ document: serializeDocument(row) });
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;
  const row = await owned(id, user.id);
  if (!row) return NextResponse.json({ error: "Note not found." }, { status: 404 });
  try {
    const body = await request.json();
    const patch: Partial<typeof workspaceDocuments.$inferInsert> = { updatedAt: new Date() };
    if (typeof body.title === "string") patch.title = body.title.slice(0, 180);
    if (typeof body.icon === "string") patch.icon = body.icon.slice(0, 30);
    if (typeof body.cover === "string" || body.cover === null) patch.cover = typeof body.cover === "string" ? body.cover.slice(0, 30) : null;
    if (typeof body.isFavorite === "boolean") patch.isFavorite = body.isFavorite;
    if (typeof body.isArchived === "boolean") patch.isArchived = body.isArchived;
    if (typeof body.isConfidential === "boolean") patch.isConfidential = body.isConfidential;
    if (Array.isArray(body.tags)) {
      patch.tags = body.tags
        .filter((t: unknown): t is string => typeof t === "string")
        .map((t: string) => t.trim().replace(/^#/, "").slice(0, 24))
        .filter(Boolean)
        .slice(0, 8);
    }
    if (Array.isArray(body.blocks)) patch.blocks = normalizeBlocks(body.blocks, id);
    if (body.parentId === null) patch.parentId = null;
    else if (validUuid(body.parentId) && body.parentId !== id) {
      const all = await db.select({ id: workspaceDocuments.id, parentId: workspaceDocuments.parentId }).from(workspaceDocuments).where(eq(workspaceDocuments.userId, user.id));
      const byId = new Map(all.map((d) => [d.id, d.parentId]));
      if (!byId.has(body.parentId)) return NextResponse.json({ error: "Parent page not found." }, { status: 404 });
      let cursor: string | null | undefined = body.parentId;
      const seen = new Set<string>();
      while (cursor) {
        if (cursor === id || seen.has(cursor)) return NextResponse.json({ error: "A page cannot be moved inside itself." }, { status: 400 });
        seen.add(cursor); cursor = byId.get(cursor);
      }
      patch.parentId = body.parentId;
    }
    const [updated] = await db.update(workspaceDocuments).set(patch).where(and(eq(workspaceDocuments.id, id), eq(workspaceDocuments.userId, user.id))).returning();
    const doc = serializeDocument(updated);

    // Auto-sync into Qdrant & vector store
    try {
      const { indexDocumentVector } = await import("@/lib/qdrant");
      void indexDocumentVector(doc, user.id);
    } catch {
      // background
    }

    return NextResponse.json({ document: doc });
  } catch (error) {
    console.error("Update document:", error);
    return NextResponse.json({ error: "Could not save this note." }, { status: 500 });
  }
}
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;
  const row = await owned(id, user.id);
  if (!row) return NextResponse.json({ error: "Note not found." }, { status: 404 });
  await db.transaction(async (tx) => {
    await tx.update(workspaceDocuments).set({ parentId: row.parentId }).where(and(eq(workspaceDocuments.parentId, id), eq(workspaceDocuments.userId, user.id)));
    await tx.delete(workspaceDocuments).where(and(eq(workspaceDocuments.id, id), eq(workspaceDocuments.userId, user.id)));
  });
  return NextResponse.json({ ok: true });
}
