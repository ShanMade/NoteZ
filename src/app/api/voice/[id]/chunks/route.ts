import { NextRequest, NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceVoiceChunks, workspaceVoiceNotes } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { geminiJson } from "@/lib/gemini";
import { serializeVoice, validUuid } from "@/lib/workspace-server";
import type { VoiceSegment } from "@/types/workspace";
import { indexVoiceNote, queueIndex } from "@/lib/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;
  if (!validUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const [note] = await db.select().from(workspaceVoiceNotes).where(and(eq(workspaceVoiceNotes.id, id), eq(workspaceVoiceNotes.userId, user.id))).limit(1);
  if (!note || note.source !== "gemini") return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  try {
    const form = await request.formData();
    const file = form.get("audio");
    const index = Number(form.get("index"));
    const start = Number(form.get("start"));
    const duration = Number(form.get("duration"));
    if (!(file instanceof File) || file.size < 1 || file.size > 8 * 1024 * 1024 || !Number.isInteger(index) || index < 0 || index > 500 || !Number.isFinite(start) || start < 0 || !Number.isFinite(duration) || duration <= 0 || duration > 45) return NextResponse.json({ error: "Invalid audio chunk." }, { status: 400 });
    const mime = file.type.split(";")[0] || "audio/webm";
    if (!["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"].includes(mime)) return NextResponse.json({ error: "Unsupported audio format." }, { status: 400 });
    const [existing] = await db.select().from(workspaceVoiceChunks).where(and(eq(workspaceVoiceChunks.voiceId, id), eq(workspaceVoiceChunks.chunkIndex, index))).limit(1);
    if (existing) return NextResponse.json({ note: serializeVoice(note), segments: existing.segments, duplicate: true });
    const prior = (note.segments ?? []).slice(-8).map((s) => `${s.speaker}: ${s.text}`).join("\n").slice(-2500);
    const audio = Buffer.from(await file.arrayBuffer()).toString("base64");
    const raw = await geminiJson(`Transcribe the supplied audio accurately and perform speaker diarization. This is chunk ${index + 1} of a longer recording, beginning at ${start} seconds. Identify distinct voices as Speaker 1, Speaker 2, etc. Use the prior transcript as conversational context when choosing labels, but do not guess identities or invent words. Cross-chunk labels are estimates. Include approximate start and end times in seconds RELATIVE to this chunk. If no speech is audible, return an empty segments array. Return ONLY JSON: {"segments":[{"speaker":"Speaker 1","text":"spoken words","startSeconds":0,"endSeconds":4}]}.\nPrior transcript for continuity:\n${prior || "None"}`, { data: audio, mimeType: mime });
    const obj = raw && typeof raw === "object" ? raw as { segments?: unknown } : {};
    const segments: VoiceSegment[] = Array.isArray(obj.segments) ? obj.segments.slice(0, 100).flatMap((v): VoiceSegment[] => {
      if (!v || typeof v !== "object") return [];
      const s = v as Record<string, unknown>;
      const text = typeof s.text === "string" ? s.text.trim().slice(0, 4000) : "";
      if (!text) return [];
      const speaker = typeof s.speaker === "string" && /^speaker\s*[1-8]$/i.test(s.speaker.trim()) ? s.speaker.trim().replace(/^speaker\s*/i, "Speaker ") : "Speaker 1";
      const localStart = typeof s.startSeconds === "number" ? Math.max(0, Math.min(duration, s.startSeconds)) : 0;
      const localEnd = typeof s.endSeconds === "number" ? Math.max(localStart, Math.min(duration, s.endSeconds)) : duration;
      return [{ speaker, text, startSeconds: Math.round(start + localStart), endSeconds: Math.round(start + localEnd), chunkIndex: index }];
    }) : [];
    await db.insert(workspaceVoiceChunks).values({ voiceId: id, chunkIndex: index, segments }).onConflictDoNothing();
    const chunks = await db.select().from(workspaceVoiceChunks).where(eq(workspaceVoiceChunks.voiceId, id)).orderBy(asc(workspaceVoiceChunks.chunkIndex));
    const all = chunks.flatMap((c) => c.segments);
    const transcript = all.map((s) => `${s.speaker}: ${s.text}`).join("\n");
    const [updated] = await db.update(workspaceVoiceNotes).set({ segments: all, transcript, durationSeconds: Math.max(note.durationSeconds, Math.round(start + duration)), updatedAt: new Date() }).where(and(eq(workspaceVoiceNotes.id, id), eq(workspaceVoiceNotes.userId, user.id))).returning();
    queueIndex(indexVoiceNote(user.id, id));
    return NextResponse.json({ note: serializeVoice(updated), segments });
  } catch (error) {
    console.error("Transcribe voice chunk:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not transcribe this chunk." }, { status: 502 });
  }
}
