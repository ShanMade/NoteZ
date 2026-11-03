import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceDocuments } from "@/db/schema";
import { getOrCreateDemoUser, getSessionUser } from "@/lib/auth";
import { geminiConfig } from "@/lib/gemini";
import { serializeDocument, serializeUser } from "@/lib/workspace-server";
import { NoteZClientRoot } from "@/components/NoteZClientRoot";
import { ensureWorkspaceIndexed } from "@/lib/search";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; demo?: string; bypass?: string }>;
}) {
  const params = await searchParams;
  const config = geminiConfig();
  const provider = {
    configured: Boolean(config.key),
    provider: (config.key ? "gemini" : "basic") as "gemini" | "basic",
    model: config.model,
  };

  const demoUserRow = await getOrCreateDemoUser();
  await ensureWorkspaceIndexed(demoUserRow.id);
  const demoDocRows = await db
    .select()
    .from(workspaceDocuments)
    .where(eq(workspaceDocuments.userId, demoUserRow.id))
    .orderBy(desc(workspaceDocuments.updatedAt));

  const demoFallbackUser = serializeUser(demoUserRow);
  const demoFallbackDocuments = demoDocRows.map(serializeDocument);

  const sessionUser =
    (await getSessionUser()) ??
    (params.demo === "1" || params.bypass === "1" ? demoUserRow : null);

  let initialUser = sessionUser ? serializeUser(sessionUser) : null;
  let initialDocuments = demoFallbackDocuments;

  if (sessionUser) await ensureWorkspaceIndexed(sessionUser.id);

  if (sessionUser && sessionUser.id !== demoUserRow.id) {
    const rows = await db
      .select()
      .from(workspaceDocuments)
      .where(eq(workspaceDocuments.userId, sessionUser.id))
      .orderBy(desc(workspaceDocuments.updatedAt));
    initialDocuments = rows.map(serializeDocument);
  } else if (!sessionUser) {
    initialUser = null;
    initialDocuments = [];
  }

  return (
    <NoteZClientRoot
      initialUser={initialUser}
      initialDocuments={initialDocuments}
      initialPageId={params.page || null}
      provider={provider}
      demoFallbackUser={demoFallbackUser}
      demoFallbackDocuments={demoFallbackDocuments}
    />
  );
}
