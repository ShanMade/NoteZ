import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { checkQdrantStatus, reindexAllUserData } from "@/lib/qdrant";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const status = await checkQdrantStatus();
  return NextResponse.json(status);
}

export async function POST(_request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const result = await reindexAllUserData(user.id);
  const status = await checkQdrantStatus();

  return NextResponse.json({
    reindexed: true,
    ...result,
    status,
  });
}
