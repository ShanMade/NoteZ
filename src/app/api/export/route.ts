import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceAssistantRuns, workspaceDocuments, workspaceVoiceNotes } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { serializeAssistant, serializeDocument, serializeVoice, serializeUser } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const [docs, voice, runs] = await Promise.all([
    db.select().from(workspaceDocuments).where(eq(workspaceDocuments.userId, user.id)).orderBy(desc(workspaceDocuments.updatedAt)),
    db.select().from(workspaceVoiceNotes).where(eq(workspaceVoiceNotes.userId, user.id)).orderBy(desc(workspaceVoiceNotes.createdAt)),
    db.select().from(workspaceAssistantRuns).where(eq(workspaceAssistantRuns.userId, user.id)).orderBy(desc(workspaceAssistantRuns.createdAt)),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    format: "notez-export-v2",
    account: serializeUser(user),
    notes: docs.map(serializeDocument),
    voiceNotes: voice.map(serializeVoice),
    aiConversations: runs.map(serializeAssistant),
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="notez-export-${stamp}.json"`,
    },
  });
}
