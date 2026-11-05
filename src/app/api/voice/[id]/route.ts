import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceDocuments, workspaceVoiceNotes } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import {
  sanitizeSpeakerMap,
  sanitizeStructured,
  serializeVoice,
  validUuid,
} from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

type VoiceRow = typeof workspaceVoiceNotes.$inferSelect;

async function owned(id: string, userId: string): Promise<VoiceRow | null> {
  if (!validUuid(id)) return null;
  const [row] = await db
    .select()
    .from(workspaceVoiceNotes)
    .where(and(eq(workspaceVoiceNotes.id, id), eq(workspaceVoiceNotes.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;
  const row = await owned(id, user.id);
  if (!row) return NextResponse.json({ error: "Voice note not found." }, { status: 404 });
  return NextResponse.json({ note: serializeVoice(row) });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;
  const existing = await owned(id, user.id);
  if (!existing) return NextResponse.json({ error: "Voice note not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const patch: Partial<typeof workspaceVoiceNotes.$inferInsert> = { updatedAt: new Date() };

  if (typeof body.title === "string") patch.title = body.title.trim().slice(0, 120) || "Voice note";
  if (body.status === "ready" || body.status === "recording") patch.status = body.status;
  if (typeof body.durationSeconds === "number") {
    patch.durationSeconds = Math.max(0, Math.min(14400, Math.round(body.durationSeconds)));
  }

  // Single-speaker sources (typed or dictated) store their transcript directly.
  if (typeof body.transcript === "string" && (existing.source === "browser" || existing.source === "manual")) {
    const transcript = body.transcript.slice(0, 100000);
    patch.transcript = transcript;
    patch.segments = transcript.trim()
      ? [
          {
            speaker: "Speaker 1",
            text: transcript.trim(),
            startSeconds: 0,
            endSeconds: patch.durationSeconds ?? existing.durationSeconds,
            chunkIndex: 0,
          },
        ]
      : [];
  }

  if (body.speakerMap !== undefined) patch.speakerMap = sanitizeSpeakerMap(body.speakerMap);
  if (body.structured === null) patch.structured = null;
  else if (body.structured && typeof body.structured === "object") {
    patch.structured = sanitizeStructured(body.structured);
  }

  if (body.documentId === null) patch.documentId = null;
  else if (validUuid(body.documentId)) {
    const [doc] = await db
      .select({ id: workspaceDocuments.id })
      .from(workspaceDocuments)
      .where(and(eq(workspaceDocuments.id, body.documentId), eq(workspaceDocuments.userId, user.id)))
      .limit(1);
    if (doc) patch.documentId = doc.id;
  }

  const [updated] = await db
    .update(workspaceVoiceNotes)
    .set(patch)
    .where(and(eq(workspaceVoiceNotes.id, id), eq(workspaceVoiceNotes.userId, user.id)))
    .returning();

  return NextResponse.json({ note: serializeVoice(updated) });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;
  if (!validUuid(id)) return NextResponse.json({ error: "Voice note not found." }, { status: 404 });
  await db
    .delete(workspaceVoiceNotes)
    .where(and(eq(workspaceVoiceNotes.id, id), eq(workspaceVoiceNotes.userId, user.id)));
  return NextResponse.json({ ok: true });
}
