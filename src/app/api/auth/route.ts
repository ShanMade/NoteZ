import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceDocuments, workspaceUsers } from "@/db/schema";
import {
  createSession,
  destroyCurrentSession,
  getOrCreateDemoUser,
  getSessionUser,
  hashPassword,
  SESSION_COOKIE,
  verifyPassword,
} from "@/lib/auth";
import { geminiConfig } from "@/lib/gemini";
import { seedPersonalWorkspace, serializeDocument, serializeUser } from "@/lib/workspace-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getProviderStatus() {
  const config = geminiConfig();
  const qdrantUrl = (process.env.QDRANT_URL || "http://localhost:6333").replace(/\/+$/, "");
  return {
    configured: Boolean(config.key),
    provider: (config.key ? "gemini" : "basic") as "gemini" | "basic",
    model: config.model,
    qdrantConfigured: Boolean(process.env.QDRANT_URL),
    qdrantMode: (process.env.QDRANT_URL ? "qdrant" : "postgres_vector") as "qdrant" | "postgres_vector",
    qdrantUrl,
  };
}

async function getDocumentsForUser(userId: string) {
  const rows = await db
    .select()
    .from(workspaceDocuments)
    .where(eq(workspaceDocuments.userId, userId))
    .orderBy(desc(workspaceDocuments.updatedAt));
  return rows.map(serializeDocument);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null, documents: [], provider: getProviderStatus() });
  }
  const documents = await getDocumentsForUser(user.id);
  return NextResponse.json({
    user: serializeUser(user),
    documents,
    provider: getProviderStatus(),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === "logout") {
      await destroyCurrentSession();
      const response = NextResponse.json({ ok: true });
      response.cookies.set(SESSION_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return response;
    }

    const action = body.action;
    if (!["login", "register", "demo", "bypass"].includes(action)) {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    let user: typeof workspaceUsers.$inferSelect | undefined;

    if (action === "bypass") {
      user = await getOrCreateDemoUser();
    } else if (action === "demo") {
      const suffix = randomBytes(8).toString("hex");
      [user] = await db
        .insert(workspaceUsers)
        .values({
          name: "Alex Morgan",
          email: `demo-${suffix}@notez.local`,
          isDemo: true,
        })
        .returning();
      await seedPersonalWorkspace(user.id);
    } else {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      const password = typeof body.password === "string" ? body.password : "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length > 256) {
        return NextResponse.json(
          { error: "Please enter a valid email and password." },
          { status: 400 }
        );
      }
      if (action === "register") {
        const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
        if (name.length < 2 || password.length < 8) {
          return NextResponse.json(
            { error: "Enter your name and a password of at least 8 characters." },
            { status: 400 }
          );
        }
        const [existing] = await db
          .select({ id: workspaceUsers.id })
          .from(workspaceUsers)
          .where(eq(workspaceUsers.email, email))
          .limit(1);
        if (existing) {
          return NextResponse.json(
            { error: "An account with that email already exists." },
            { status: 409 }
          );
        }
        [user] = await db
          .insert(workspaceUsers)
          .values({ name, email, passwordHash: hashPassword(password) })
          .returning();
        await seedPersonalWorkspace(user.id);
      } else {
        [user] = await db
          .select()
          .from(workspaceUsers)
          .where(eq(workspaceUsers.email, email))
          .limit(1);
        if (!user || user.isDemo || !verifyPassword(password, user.passwordHash)) {
          return NextResponse.json(
            { error: "Incorrect email or password." },
            { status: 401 }
          );
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unable to start a session." }, { status: 500 });
    }

    const { token, expiresAt } = await createSession(user.id);
    const documents = await getDocumentsForUser(user.id);
    const provider = getProviderStatus();

    const response = NextResponse.json({
      user: serializeUser(user),
      token,
      documents,
      provider,
    });

    const secure =
      request.headers.get("x-forwarded-proto") === "https" ||
      request.nextUrl.protocol === "https:";

    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: secure ? "none" : "lax",
      path: "/",
      expires: expiresAt,
    });

    return response;
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
