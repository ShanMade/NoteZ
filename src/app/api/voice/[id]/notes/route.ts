import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceVoiceNotes } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { geminiConfig, geminiJson } from "@/lib/gemini";
import { labelSpeaker, sanitizeStructured, serializeVoice, validUuid } from "@/lib/workspace-server";
import type { VoiceSegment, VoiceStructured } from "@/types/workspace";
import { indexVoiceNote, queueIndex } from "@/lib/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const stamp = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Deterministic meeting notes used when Gemini isn't configured. Only stated content is used. */
function basicStructure(segments: VoiceSegment[], map: Record<string, string>, fallbackText: string): VoiceStructured {
  const items = segments.length
    ? segments.map((s) => ({ speaker: labelSpeaker(s.speaker, map), text: s.text }))
    : fallbackText.split(/\n+/).map((text) => ({ speaker: "Unassigned", text }));

  const sentences = items
    .flatMap((item) =>
      item.text
        .split(/(?<=[.!?])\s+/)
        .map((t) => ({ speaker: item.speaker, text: t.trim() }))
    )
    .filter((s) => s.text.length > 3);

  const actionRe =
    /\b(will|need to|needs to|should|must|follow up|action|todo|to do|assign|send|share|schedule|by (monday|tuesday|wednesday|thursday|friday|tomorrow|next|end))\b/i;
  const decisionRe = /\b(agreed|decided|decision|approved|we'll go with|we will go with|settled|confirmed)\b/i;
  const questionRe = /\?$|\b(open question|not sure|unclear|unknown|who owns|how do we)\b/i;

  return {
    title: "Meeting notes",
    summary: sentences.slice(0, 2).map((s) => s.text).join(" ").slice(0, 600) || "No speech was detected.",
    keyPoints: sentences.filter((s) => s.text.length > 25).slice(0, 6).map((s) => s.text.slice(0, 240)),
    decisions: sentences.filter((s) => decisionRe.test(s.text)).slice(0, 8).map((s) => s.text.slice(0, 240)),
    actionItems: sentences
      .filter((s) => actionRe.test(s.text))
      .slice(0, 10)
      .map((s) => ({ task: s.text.slice(0, 240), owner: s.speaker })),
    openQuestions: sentences.filter((s) => questionRe.test(s.text)).slice(0, 6).map((s) => s.text.slice(0, 240)),
  };
}

const MEETING_PROMPT = [
  "You turn a voice transcript into useful meeting notes.",
  "Speaker labels are estimates; use the names provided. Only include facts stated in the transcript. Never invent owners, dates, or decisions.",
  "If a field has nothing supported by the transcript, return an empty array.",
  "Return ONLY JSON: {\"title\": string (short and specific), \"summary\": string (2-4 sentences), \"keyPoints\": string[], \"decisions\": string[], \"actionItems\": [{\"task\": string, \"owner\": string}], \"openQuestions\": string[]}.",
  "Use the speaker's name as the owner only when the transcript clearly assigns the task; otherwise use \"Unassigned\".",
].join("\n");

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { id } = await params;
  if (!validUuid(id)) return NextResponse.json({ error: "Voice note not found." }, { status: 404 });

  const [note] = await db
    .select()
    .from(workspaceVoiceNotes)
    .where(and(eq(workspaceVoiceNotes.id, id), eq(workspaceVoiceNotes.userId, user.id)))
    .limit(1);
  if (!note) return NextResponse.json({ error: "Voice note not found." }, { status: 404 });

  const segments = note.segments ?? [];
  const map = note.speakerMap ?? {};
  const transcriptText = segments.length
    ? segments.map((s) => `${labelSpeaker(s.speaker, map)} [${stamp(s.startSeconds)}]: ${s.text}`).join("\n")
    : note.transcript;

  if (!transcriptText.trim()) {
    return NextResponse.json({ error: "There's no transcript to structure yet." }, { status: 400 });
  }

  let structured: VoiceStructured;
  let provider: "gemini" | "basic" = "basic";
  const config = geminiConfig();

  if (config.key) {
    try {
      const raw = await geminiJson(
        `${MEETING_PROMPT}\n\nTRANSCRIPT:\n<transcript>\n${transcriptText.slice(0, 60000)}\n</transcript>`
      );
      const parsed = sanitizeStructured(raw);
      if (!parsed) throw new Error("Empty structure");
      structured = parsed;
      provider = "gemini";
    } catch (error) {
      console.error("Structure voice note:", error);
      structured = basicStructure(segments, map, note.transcript);
    }
  } else {
    structured = basicStructure(segments, map, note.transcript);
  }

  const [updated] = await db
    .update(workspaceVoiceNotes)
    .set({ structured, updatedAt: new Date() })
    .where(and(eq(workspaceVoiceNotes.id, id), eq(workspaceVoiceNotes.userId, user.id)))
    .returning();

  queueIndex(indexVoiceNote(user.id, id));
  return NextResponse.json({ note: serializeVoice(updated), provider });
}
