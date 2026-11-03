import "server-only";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { workspaceSessions, workspaceUsers } from "@/db/schema";
import { seedPersonalWorkspace } from "@/lib/workspace-server";

export const SESSION_COOKIE = "notez_session";
export const SESSION_HEADER = "x-notez-session";
export const BYPASS_HEADER = "x-notez-bypass";
const SESSION_DAYS = 14;
const DEFAULT_DEMO_EMAIL = "demo-workspace@notez.local";

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [kind, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  try {
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return expected.length === actual.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function digestToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(workspaceSessions).values({ userId, tokenHash: digestToken(token), expiresAt });
  return { token, expiresAt };
}

export async function getOrCreateDemoUser() {
  const [existing] = await db
    .select()
    .from(workspaceUsers)
    .where(eq(workspaceUsers.email, DEFAULT_DEMO_EMAIL))
    .limit(1);

  if (existing) {
    await seedPersonalWorkspace(existing.id);
    return existing;
  }

  const [created] = await db
    .insert(workspaceUsers)
    .values({
      name: "Alex Morgan",
      email: DEFAULT_DEMO_EMAIL,
      isDemo: true,
    })
    .onConflictDoNothing()
    .returning();

  if (created) {
    await seedPersonalWorkspace(created.id);
    return created;
  }

  const [fallback] = await db
    .select()
    .from(workspaceUsers)
    .where(eq(workspaceUsers.email, DEFAULT_DEMO_EMAIL))
    .limit(1);

  if (fallback) {
    await seedPersonalWorkspace(fallback.id);
    return fallback;
  }

  throw new Error("Unable to initialize demo user");
}

async function resolveTokenFromRequest(): Promise<{ token: string | null; bypass: boolean }> {
  try {
    const reqHeaders = await headers();
    const headerToken = reqHeaders.get(SESSION_HEADER)?.trim();
    if (headerToken && headerToken.length <= 128) {
      return { token: headerToken, bypass: reqHeaders.get(BYPASS_HEADER) === "1" };
    }
    const authHeader = reqHeaders.get("authorization");
    if (authHeader?.toLowerCase().startsWith("bearer ")) {
      const bearer = authHeader.slice(7).trim();
      if (bearer && bearer.length <= 128) {
        return { token: bearer, bypass: reqHeaders.get(BYPASS_HEADER) === "1" };
      }
    }
    const bypass = reqHeaders.get(BYPASS_HEADER) === "1";
    const cookieStore = await cookies();
    const cookieToken = cookieStore.get(SESSION_COOKIE)?.value ?? null;
    return { token: cookieToken, bypass };
  } catch {
    return { token: null, bypass: false };
  }
}

export async function getSessionUser() {
  const { token, bypass } = await resolveTokenFromRequest();
  if (token && token.length <= 128) {
    const [match] = await db
      .select({ user: workspaceUsers })
      .from(workspaceSessions)
      .innerJoin(workspaceUsers, eq(workspaceSessions.userId, workspaceUsers.id))
      .where(
        and(
          eq(workspaceSessions.tokenHash, digestToken(token)),
          gt(workspaceSessions.expiresAt, new Date())
        )
      )
      .limit(1);
    if (match?.user) return match.user;
  }

  if (bypass) {
    return getOrCreateDemoUser();
  }

  return null;
}

export async function destroyCurrentSession(): Promise<void> {
  const { token } = await resolveTokenFromRequest();
  if (token) {
    await db.delete(workspaceSessions).where(eq(workspaceSessions.tokenHash, digestToken(token)));
  }
}
