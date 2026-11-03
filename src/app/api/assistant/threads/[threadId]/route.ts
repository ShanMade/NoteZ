import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceAssistantRuns } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { validUuid } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ threadId: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { threadId } = await params;
  if (!validUuid(threadId)) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  await db
    .delete(workspaceAssistantRuns)
    .where(and(eq(workspaceAssistantRuns.threadId, threadId), eq(workspaceAssistantRuns.userId, user.id)));

  return NextResponse.json({ ok: true });
}
