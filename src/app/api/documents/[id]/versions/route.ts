import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceDocuments, workspaceDocumentVersions } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { plainTextFromHtml } from "@/lib/markdown";
import { serializeDocument, validUuid } from "@/lib/workspace-server";
import type { DocumentVersion } from "@/types/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { id } = await params;
  if (!validUuid(id)) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  const [doc] = await db
    .select({ id: workspaceDocuments.id })
    .from(workspaceDocuments)
    .where(and(eq(workspaceDocuments.id, id), eq(workspaceDocuments.userId, user.id)))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(workspaceDocumentVersions)
    .where(
      and(
        eq(workspaceDocumentVersions.documentId, id),
        eq(workspaceDocumentVersions.userId, user.id)
      )
    )
    .orderBy(desc(workspaceDocumentVersions.createdAt))
    .limit(20);

  const versions: DocumentVersion[] = rows.map((r) => ({
    id: r.id,
    documentId: r.documentId,
    title: r.title,
    wordCount: r.wordCount,
    changeSummary: r.changeSummary,
    blocks: r.blocks || [],
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ versions });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { id } = await params;
  if (!validUuid(id)) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const rollbackVersionId = body.rollbackVersionId;

  const [doc] = await db
    .select()
    .from(workspaceDocuments)
    .where(and(eq(workspaceDocuments.id, id), eq(workspaceDocuments.userId, user.id)))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  // Rollback to specific version
  if (rollbackVersionId && validUuid(rollbackVersionId)) {
    const [targetVer] = await db
      .select()
      .from(workspaceDocumentVersions)
      .where(
        and(
          eq(workspaceDocumentVersions.id, rollbackVersionId),
          eq(workspaceDocumentVersions.documentId, id),
          eq(workspaceDocumentVersions.userId, user.id)
        )
      )
      .limit(1);

    if (!targetVer) {
      return NextResponse.json({ error: "Version not found." }, { status: 404 });
    }

    // Save current version as backup before rolling back
    const wordCount = (doc.blocks || [])
      .map((b) => plainTextFromHtml(b.content || ""))
      .join(" ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    await db.insert(workspaceDocumentVersions).values({
      documentId: id,
      userId: user.id,
      title: doc.title || "Untitled",
      blocks: doc.blocks || [],
      wordCount,
      changeSummary: "Automatic backup before restore",
    });

    const [updatedDoc] = await db
      .update(workspaceDocuments)
      .set({
        title: targetVer.title,
        blocks: targetVer.blocks,
        updatedAt: new Date(),
      })
      .where(and(eq(workspaceDocuments.id, id), eq(workspaceDocuments.userId, user.id)))
      .returning();

    return NextResponse.json({
      restored: true,
      document: serializeDocument(updatedDoc),
    });
  }

  // Create new version checkpoint
  const summary =
    typeof body.summary === "string" ? body.summary.trim().slice(0, 120) : "Version checkpoint";

  const wordCount = (doc.blocks || [])
    .map((b) => plainTextFromHtml(b.content || ""))
    .join(" ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const [created] = await db
    .insert(workspaceDocumentVersions)
    .values({
      documentId: id,
      userId: user.id,
      title: doc.title || "Untitled",
      blocks: doc.blocks || [],
      wordCount,
      changeSummary: summary || "Manual snapshot",
    })
    .returning();

  const version: DocumentVersion = {
    id: created.id,
    documentId: created.documentId,
    title: created.title,
    wordCount: created.wordCount,
    changeSummary: created.changeSummary,
    blocks: created.blocks || [],
    createdAt: created.createdAt.toISOString(),
  };

  return NextResponse.json({ version }, { status: 201 });
}
