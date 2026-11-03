import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceUsers } from "@/db/schema";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth";
import { normalizeSettings, serializeUser } from "@/lib/workspace-server";
import type { WorkspaceSettings } from "@/types/workspace";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const patch: Partial<typeof workspaceUsers.$inferInsert> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim().slice(0, 80);
    if (name.length < 2) {
      return NextResponse.json({ error: "Please enter a name with at least 2 characters." }, { status: 400 });
    }
    patch.name = name;
  }

  if (body.settings && typeof body.settings === "object" && !Array.isArray(body.settings)) {
    const merged: Partial<WorkspaceSettings> = { ...(user.settings ?? {}), ...body.settings };
    patch.settings = normalizeSettings(merged);
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ user: serializeUser(user) });
  }

  const [updated] = await db
    .update(workspaceUsers)
    .set(patch)
    .where(eq(workspaceUsers.id, user.id))
    .returning();

  return NextResponse.json({ user: serializeUser(updated) });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  // Cascades remove sessions, notes, AI history, and voice notes.
  await db.delete(workspaceUsers).where(eq(workspaceUsers.id, user.id));

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
