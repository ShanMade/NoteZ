import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { searchStatus } from "@/lib/search";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const status = await searchStatus(user.id);
  return NextResponse.json(status);
}
