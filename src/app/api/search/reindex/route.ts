import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { reindexWorkspace } from "@/lib/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const counts = await reindexWorkspace(user.id);
    return NextResponse.json({ ok: true, indexed: counts });
  } catch (error) {
    console.error("Reindex failed:", error);
    return NextResponse.json({ error: "Could not rebuild the search index." }, { status: 500 });
  }
}
