import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceDocuments } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { plainTextFromHtml } from "@/lib/markdown";
import { validUuid } from "@/lib/workspace-server";
import type { InNoteSearchResponse, NoteKeywordMatch } from "@/types/workspace";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const { id } = await params;
  if (!validUuid(id)) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() || "";

  const [doc] = await db
    .select()
    .from(workspaceDocuments)
    .where(and(eq(workspaceDocuments.id, id), eq(workspaceDocuments.userId, user.id)))
    .limit(1);

  if (!doc) {
    return NextResponse.json({ error: "Note not found." }, { status: 404 });
  }

  if (!query) {
    const emptyResp: InNoteSearchResponse = {
      query: "",
      totalOccurrences: 0,
      matchingBlocks: [],
    };
    return NextResponse.json(emptyResp);
  }

  const qLower = query.toLowerCase();
  const matchingBlocks: NoteKeywordMatch[] = [];
  let totalOccurrences = 0;

  (doc.blocks || []).forEach((block, idx) => {
    const text = plainTextFromHtml(block.content || "");
    const textLower = text.toLowerCase();
    if (!textLower.includes(qLower)) return;

    let occurrences = 0;
    let pos = 0;
    while ((pos = textLower.indexOf(qLower, pos)) !== -1) {
      occurrences++;
      pos += qLower.length;
    }

    if (occurrences > 0) {
      totalOccurrences += occurrences;

      // Extract context snippet
      const firstIdx = textLower.indexOf(qLower);
      const start = Math.max(0, firstIdx - 40);
      const end = Math.min(text.length, firstIdx + query.length + 50);
      const prefix = start > 0 ? "…" : "";
      const suffix = end < text.length ? "…" : "";
      const snippet = `${prefix}${text.substring(start, end).trim()}${suffix}`;

      matchingBlocks.push({
        blockId: block.id,
        position: idx,
        blockType: block.type,
        snippet,
        occurrences,
      });
    }
  });

  const response: InNoteSearchResponse = {
    query,
    totalOccurrences,
    matchingBlocks,
  };

  return NextResponse.json(response);
}
