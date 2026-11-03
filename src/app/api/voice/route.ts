import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceVoiceNotes } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { geminiConfig } from "@/lib/gemini";
import { serializeVoice } from "@/lib/workspace-server";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const notes = await db.select().from(workspaceVoiceNotes).where(eq(workspaceVoiceNotes.userId, user.id)).orderBy(desc(workspaceVoiceNotes.createdAt)).limit(50);
  return NextResponse.json({ notes: notes.map(serializeVoice) });
}
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const source = body.source === "browser" || body.source === "manual" ? body.source : "gemini";
  if (source === "gemini" && !geminiConfig().key) return NextResponse.json({ error: "Add GEMINI_API_KEY on the server to transcribe audio. You can also use browser dictation or paste a transcript." }, { status: 503 });
  const [row] = await db.insert(workspaceVoiceNotes).values({ userId: user.id, title: typeof body.title === "string" ? body.title.trim().slice(0, 120) || "Voice note" : "Voice note", source, status: "recording" }).returning();
  return NextResponse.json({ note: serializeVoice(row) }, { status: 201 });
}
