import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import {
  workspaceAssistantRuns,
  workspaceDocuments,
  workspaceUsers,
  workspaceVoiceNotes,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import type { BlockProps, BlockType, NoteBlock } from "@/types/notez";
import {
  ACCENTS,
  DEFAULT_SETTINGS,
  type AiScope,
  type AssistantHistoryItem,
  type AssistantSource,
  type VoiceNote,
  type VoiceSegment,
  type VoiceStructured,
  type WorkspaceDocument,
  type WorkspaceSettings,
  type WorkspaceUser,
} from "@/types/workspace";

const allowedTypes = new Set<BlockType>([
  "paragraph",
  "heading1",
  "heading2",
  "heading3",
  "todo",
  "bullet",
  "numbered",
  "toggle",
  "quote",
  "callout",
  "code",
  "divider",
  "table",
]);

export const validUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

// Preserve only the inline formatting tags produced by the editor; never retain attributes.
export function safeInlineHtml(value: string): string {
  return value.slice(0, 30000).replace(/<[^>]*>/g, (tag) => {
    const match = tag.match(/^<\s*(\/?)\s*(strong|b|em|i|u|s|del|strike|code|br|div|p)\s*\/?>$/i);
    return match ? `<${match[1]}${match[2].toLowerCase()}>` : "";
  });
}

export function normalizeBlocks(value: unknown, documentId: string): NoteBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, 300)
    .filter((v) => v && typeof v === "object")
    .map((raw, index) => {
      const item = raw as Record<string, unknown>;
      const type = allowedTypes.has(item.type as BlockType) ? (item.type as BlockType) : "paragraph";
      let props: BlockProps = {};
      if (item.props && typeof item.props === "object" && !Array.isArray(item.props)) {
        try {
          const json = JSON.stringify(item.props);
          if (json.length < 30000) props = JSON.parse(json) as BlockProps;
        } catch {
          props = {};
        }
      }
      return {
        id: validUuid(item.id) ? item.id : randomUUID(),
        pageId: documentId,
        type,
        content: safeInlineHtml(typeof item.content === "string" ? item.content : ""),
        props,
        position: index,
      };
    });
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeSettings(input: unknown): WorkspaceSettings {
  const raw =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const lang =
    typeof raw.voiceLanguage === "string" && /^[a-z]{2}-[A-Z]{2}$/.test(raw.voiceLanguage)
      ? raw.voiceLanguage
      : DEFAULT_SETTINGS.voiceLanguage;
  return {
    theme: pick(raw.theme, ["light", "dark", "system"] as const, DEFAULT_SETTINGS.theme),
    showTips: bool(raw.showTips, DEFAULT_SETTINGS.showTips),
    accent: pick(raw.accent, ACCENTS, DEFAULT_SETTINGS.accent),
    density: pick(raw.density, ["comfortable", "compact"] as const, DEFAULT_SETTINGS.density),
    editorWidth: pick(
      raw.editorWidth,
      ["comfortable", "wide", "full"] as const,
      DEFAULT_SETTINGS.editorWidth
    ),
    editorFont: pick(raw.editorFont, ["sans", "serif", "mono"] as const, DEFAULT_SETTINGS.editorFont),
    spellcheck: bool(raw.spellcheck, DEFAULT_SETTINGS.spellcheck),
    defaultAiScope: pick(
      raw.defaultAiScope,
      ["none", "current", "workspace"] as const,
      DEFAULT_SETTINGS.defaultAiScope
    ),
    voiceLanguage: lang,
    speakerLabels: bool(raw.speakerLabels, DEFAULT_SETTINGS.speakerLabels),
    autoStructureVoice: bool(raw.autoStructureVoice, DEFAULT_SETTINGS.autoStructureVoice),
  };
}

export function labelSpeaker(speaker: string, map: Record<string, string> | null | undefined): string {
  return map?.[speaker]?.trim() || speaker;
}

export function sanitizeSpeakerMap(input: unknown): Record<string, string> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (/^Speaker \d{1,2}$/.test(key) && typeof value === "string") {
      const name = value.trim().slice(0, 40);
      if (name) out[key] = name;
    }
  }
  return out;
}

export function sanitizeStructured(value: unknown): VoiceStructured | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  const strings = (v: unknown, max: number, len: number): string[] =>
    Array.isArray(v)
      ? v
          .filter((x): x is string => typeof x === "string")
          .map((s) => s.trim().slice(0, len))
          .filter(Boolean)
          .slice(0, max)
      : [];
  const actionItems = Array.isArray(r.actionItems)
    ? r.actionItems
        .flatMap((item: unknown) => {
          if (!item || typeof item !== "object") return [];
          const it = item as Record<string, unknown>;
          const task = typeof it.task === "string" ? it.task.trim().slice(0, 240) : "";
          if (!task) return [];
          const owner = typeof it.owner === "string" && it.owner.trim() ? it.owner.trim().slice(0, 60) : "Unassigned";
          return [{ task, owner }];
        })
        .slice(0, 20)
    : [];
  return {
    title: typeof r.title === "string" ? r.title.trim().slice(0, 120) : "Voice note",
    summary: typeof r.summary === "string" ? r.summary.trim().slice(0, 1200) : "",
    keyPoints: strings(r.keyPoints, 10, 240),
    decisions: strings(r.decisions, 10, 240),
    actionItems,
    openQuestions: strings(r.openQuestions, 8, 240),
  };
}

export function serializeUser(row: typeof workspaceUsers.$inferSelect): WorkspaceUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    isDemo: row.isDemo,
    settings: normalizeSettings(row.settings),
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeDocument(row: typeof workspaceDocuments.$inferSelect): WorkspaceDocument {
  return {
    id: row.id,
    parentId: row.parentId,
    title: row.title,
    icon: row.icon,
    cover: row.cover,
    tags: Array.isArray(row.tags) ? row.tags.filter((t): t is string => typeof t === "string") : [],
    blocks: row.blocks ?? [],
    isFavorite: row.isFavorite,
    isArchived: row.isArchived,
    isAiGenerated: row.isAiGenerated,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeAssistant(row: typeof workspaceAssistantRuns.$inferSelect): AssistantHistoryItem {
  return {
    id: row.id,
    threadId: row.threadId ?? null,
    documentId: row.documentId ?? null,
    scope: row.scope as AiScope,
    prompt: row.prompt,
    answer: row.answer,
    title: row.title,
    blocks: row.blocks ?? [],
    sources: row.sources ?? [],
    provider: row.provider,
    createdAt: row.createdAt.toISOString(),
  };
}

export function serializeVoice(row: typeof workspaceVoiceNotes.$inferSelect): VoiceNote {
  return {
    id: row.id,
    title: row.title,
    status: row.status as VoiceNote["status"],
    transcript: row.transcript,
    segments: row.segments ?? [],
    durationSeconds: row.durationSeconds,
    source: row.source as VoiceNote["source"],
    documentId: row.documentId ?? null,
    speakerMap: row.speakerMap ?? {},
    structured: row.structured ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function starterBlock(pageId: string, type: BlockType, content: string, props: BlockProps = {}): NoteBlock {
  return { id: randomUUID(), pageId, type, content, props, position: 0 };
}

export async function seedPersonalWorkspace(userId: string): Promise<void> {
  const [existing] = await db
    .select({ id: workspaceDocuments.id })
    .from(workspaceDocuments)
    .where(eq(workspaceDocuments.userId, userId))
    .limit(1);
  if (existing) return;

  const welcomeId = randomUUID();
  const roadmapId = randomUUID();
  const meetingId = randomUUID();
  const ideasId = randomUUID();
  const readingId = randomUUID();

  const entries: Array<{
    id: string;
    title: string;
    icon: string;
    cover: string | null;
    tags: string[];
    isFavorite: boolean;
    blocks: NoteBlock[];
  }> = [
    {
      id: welcomeId,
      title: "Welcome to NoteZ",
      icon: "sparkles",
      cover: "lavender",
      tags: ["start-here"],
      isFavorite: true,
      blocks: [
        starterBlock(welcomeId, "paragraph", "A little space for big ideas. This is your starting point for writing, planning, and thinking clearly."),
        starterBlock(welcomeId, "heading2", "Make this space yours"),
        starterBlock(welcomeId, "bullet", "Create a page for anything on your mind. Type / to add headings, lists, tasks, and tables."),
        starterBlock(welcomeId, "bullet", "Ask NoteZ AI about your notes, or turn a rough thought into a structured draft."),
        starterBlock(welcomeId, "bullet", "Record a voice note and it becomes a summary, decisions, and action items."),
        starterBlock(welcomeId, "heading2", "A few things to try"),
        starterBlock(welcomeId, "todo", "Create your first note", { checked: false }),
        starterBlock(welcomeId, "todo", "Ask AI to pull out your open tasks", { checked: false }),
        starterBlock(welcomeId, "callout", "Your notes save automatically. AI only reads what you choose to share, and it never edits a note without your approval.", { icon: "💡", tone: "indigo" }),
      ],
    },
    {
      id: roadmapId,
      title: "Project roadmap",
      icon: "compass",
      cover: "peach",
      tags: ["planning"],
      isFavorite: true,
      blocks: [
        starterBlock(roadmapId, "paragraph", "What we're building, why it matters, and what comes next."),
        starterBlock(roadmapId, "heading2", "Our focus"),
        starterBlock(roadmapId, "bullet", "Make capturing ideas feel effortless."),
        starterBlock(roadmapId, "bullet", "Build a workspace that stays out of the way."),
        starterBlock(roadmapId, "heading2", "Next up"),
        starterBlock(roadmapId, "todo", "Shape the first experience", { checked: true }),
        starterBlock(roadmapId, "todo", "Collect feedback from the team", { checked: false }),
        starterBlock(roadmapId, "todo", "Plan the next release", { checked: false }),
      ],
    },
    {
      id: meetingId,
      title: "Weekly team sync",
      icon: "calendar",
      cover: null,
      tags: ["meetings"],
      isFavorite: false,
      blocks: [
        starterBlock(meetingId, "paragraph", "A simple place to capture what moves work forward."),
        starterBlock(meetingId, "heading2", "Updates"),
        starterBlock(meetingId, "bullet", "Share progress and what you're working on."),
        starterBlock(meetingId, "heading2", "Decisions & next steps"),
        starterBlock(meetingId, "todo", "Add the next action item here", { checked: false }),
      ],
    },
    {
      id: ideasId,
      title: "Ideas & inspiration",
      icon: "lightbulb",
      cover: "mint",
      tags: ["ideas"],
      isFavorite: false,
      blocks: [
        starterBlock(ideasId, "paragraph", "A home for the small sparks that might become something bigger."),
        starterBlock(ideasId, "bullet", "Collect interesting ideas without worrying about structure."),
        starterBlock(ideasId, "bullet", "Come back later and connect the dots."),
        starterBlock(ideasId, "quote", "The best ideas often start as a note to yourself."),
      ],
    },
    {
      id: readingId,
      title: "Reading list",
      icon: "book",
      cover: null,
      tags: [],
      isFavorite: false,
      blocks: [
        starterBlock(readingId, "paragraph", "Articles, books, and ideas to revisit when there's time to think."),
        starterBlock(readingId, "heading2", "Up next"),
        starterBlock(readingId, "todo", "Add something you'd like to read", { checked: false }),
      ],
    },
  ];

  await db.insert(workspaceDocuments).values(
    entries.map((entry) => ({
      id: entry.id,
      userId,
      title: entry.title,
      icon: entry.icon,
      cover: entry.cover,
      tags: entry.tags,
      isFavorite: entry.isFavorite,
      blocks: entry.blocks.map((b, i) => ({ ...b, position: i })),
    }))
  );
}
