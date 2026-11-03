import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceDocuments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { normalizeBlocks, serializeDocument, validUuid } from "@/lib/workspace-server";
import { indexDocument, queueIndex } from "@/lib/search";

export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const rows = await db.select().from(workspaceDocuments).where(eq(workspaceDocuments.userId, user.id)).orderBy(desc(workspaceDocuments.updatedAt));
  return NextResponse.json({ documents: rows.map(serializeDocument), provider: { configured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY), provider: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY ? "gemini" : "basic", model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite" } });
}
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({}));
    let parentId: string | null = null;
    if (validUuid(body.parentId)) {
      const [parent] = await db.select({ id: workspaceDocuments.id }).from(workspaceDocuments).where(and(eq(workspaceDocuments.id, body.parentId), eq(workspaceDocuments.userId, user.id), eq(workspaceDocuments.isArchived, false))).limit(1);
      if (!parent) return NextResponse.json({ error: "Parent page not found." }, { status: 404 });
      parentId = parent.id;
    }
    const id = randomUUID();
    const incoming = normalizeBlocks(body.blocks, id);
    const initial = incoming.length ? incoming : normalizeBlocks([{ type: "paragraph", content: "", props: {} }], id);
    const [row] = await db.insert(workspaceDocuments).values({ id, userId: user.id, parentId, title: typeof body.title === "string" ? body.title.trim().slice(0, 180) : "Untitled", icon: typeof body.icon === "string" ? body.icon.slice(0, 30) : "file", cover: typeof body.cover === "string" ? body.cover.slice(0, 30) : null, blocks: initial, isAiGenerated: body.isAiGenerated === true }).returning();
    queueIndex(indexDocument(user.id, row.id));
    return NextResponse.json({ document: serializeDocument(row) }, { status: 201 });
  } catch (error) {
    console.error("Create document:", error);
    return NextResponse.json({ error: "Could not create your note." }, { status: 500 });
  }
}
