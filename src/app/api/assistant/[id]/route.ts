import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceAssistantRuns } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { validUuid } from "@/lib/workspace-server";
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;
  if (!validUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  await db.delete(workspaceAssistantRuns).where(and(eq(workspaceAssistantRuns.id, id), eq(workspaceAssistantRuns.userId, user.id)));
  return NextResponse.json({ ok: true });
}
