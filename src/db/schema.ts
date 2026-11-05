import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { BlockProps, NoteBlock } from "@/types/notez";
import type { AiDraftResult } from "@/types/ai";
import type {
  AiToolCallTrace,
  AiToolProposal,
  AssistantResult,
  AssistantSource,
  VoiceSegment,
  VoiceStructured,
  WorkspaceSettings,
} from "@/types/workspace";

// ---------------------------------------------------------------------------
// Legacy tables (kept intact so existing data is never destroyed on upgrade)
// ---------------------------------------------------------------------------

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentId: uuid("parent_id"),
    title: text("title").notNull().default("Untitled"),
    icon: text("icon").notNull().default("📄"),
    coverImage: text("cover_image"),
    fontStyle: text("font_style").notNull().default("sans"),
    fullWidth: boolean("full_width").notNull().default(false),
    isFavorite: boolean("is_favorite").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    isAiGenerated: boolean("is_ai_generated").notNull().default(false),
    sourceRunId: uuid("source_run_id"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("pages_parent_id_idx").on(table.parentId),
    index("pages_is_archived_idx").on(table.isArchived),
    index("pages_is_ai_generated_idx").on(table.isAiGenerated),
  ]
);

export const blocks = pgTable(
  "blocks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("paragraph"),
    content: text("content").notNull().default(""),
    props: jsonb("props").$type<BlockProps>().notNull().default({}),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("blocks_page_id_position_idx").on(table.pageId, table.position)]
);

export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull().default("draft"),
    mode: text("mode").notNull().default("draft"),
    provider: text("provider").notNull().default("local"),
    model: text("model").notNull().default("notez-local-1"),
    status: text("status").notNull().default("completed"),
    prompt: text("prompt").notNull().default(""),
    inputText: text("input_text").notNull().default(""),
    title: text("title").notNull().default("AI Note"),
    summary: text("summary").notNull().default(""),
    result: jsonb("result").$type<AiDraftResult>().notNull(),
    isFavorite: boolean("is_favorite").notNull().default(false),
    sourcePageId: uuid("source_page_id"),
    createdPageId: uuid("created_page_id"),
    durationMs: integer("duration_ms").notNull().default(0),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ai_runs_created_at_idx").on(table.createdAt),
    index("ai_runs_mode_idx").on(table.mode),
    index("ai_runs_favorite_idx").on(table.isFavorite),
  ]
);

export const voiceSessions = pgTable(
  "voice_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull().default("Voice Note"),
    transcript: text("transcript").notNull().default(""),
    language: text("language").notNull().default("en-US"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    source: text("source").notNull().default("browser"),
    audioName: text("audio_name"),
    summary: text("summary"),
    structuredNote: jsonb("structured_note").$type<AiDraftResult>(),
    createdPageId: uuid("created_page_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("voice_sessions_created_at_idx").on(table.createdAt)]
);

// ---------------------------------------------------------------------------
// Authenticated workspace tables (PostgreSQL)
// ---------------------------------------------------------------------------

export const workspaceUsers = pgTable("nz_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  isDemo: boolean("is_demo").notNull().default(false),
  settings: jsonb("settings").$type<Partial<WorkspaceSettings>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const workspaceSessions = pgTable(
  "nz_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => workspaceUsers.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("nz_sessions_user_idx").on(table.userId)]
);

export const workspaceDocuments = pgTable(
  "nz_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => workspaceUsers.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    title: text("title").notNull().default("Untitled"),
    icon: text("icon").notNull().default("file"),
    cover: text("cover"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    blocks: jsonb("blocks").$type<NoteBlock[]>().notNull().default([]),
    isFavorite: boolean("is_favorite").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    isConfidential: boolean("is_confidential").notNull().default(false),
    isAiGenerated: boolean("is_ai_generated").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("nz_documents_user_idx").on(table.userId),
    index("nz_documents_parent_idx").on(table.parentId),
    index("nz_documents_confidential_idx").on(table.isConfidential),
  ]
);

export const workspaceDocumentVersions = pgTable(
  "nz_document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => workspaceDocuments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => workspaceUsers.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Untitled"),
    blocks: jsonb("blocks").$type<NoteBlock[]>().notNull().default([]),
    wordCount: integer("word_count").notNull().default(0),
    changeSummary: text("change_summary").notNull().default("Auto-saved version"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("nz_doc_versions_doc_idx").on(table.documentId),
    index("nz_doc_versions_user_idx").on(table.userId),
  ]
);

export const workspaceAssistantRuns = pgTable(
  "nz_assistant_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => workspaceUsers.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id"),
    documentId: uuid("document_id"),
    scope: text("scope").notNull().default("none"),
    prompt: text("prompt").notNull(),
    answer: text("answer").notNull(),
    title: text("title").notNull().default(""),
    blocks: jsonb("blocks").$type<AssistantResult["blocks"]>().notNull().default([]),
    sources: jsonb("sources").$type<AssistantSource[]>().notNull().default([]),
    toolCalls: jsonb("tool_calls").$type<AiToolCallTrace[]>().notNull().default([]),
    proposals: jsonb("proposals").$type<AiToolProposal[]>().notNull().default([]),
    provider: text("provider").notNull().default("basic"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("nz_assistant_user_idx").on(table.userId),
    index("nz_assistant_thread_idx").on(table.threadId),
  ]
);

export const workspaceVoiceNotes = pgTable(
  "nz_voice_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => workspaceUsers.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("Voice note"),
    status: text("status").notNull().default("recording"),
    transcript: text("transcript").notNull().default(""),
    segments: jsonb("segments").$type<VoiceSegment[]>().notNull().default([]),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    source: text("source").notNull().default("gemini"),
    documentId: uuid("document_id"),
    speakerMap: jsonb("speaker_map").$type<Record<string, string>>().notNull().default({}),
    structured: jsonb("structured").$type<VoiceStructured>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("nz_voice_user_idx").on(table.userId)]
);

export const workspaceVoiceChunks = pgTable(
  "nz_voice_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    voiceId: uuid("voice_id")
      .notNull()
      .references(() => workspaceVoiceNotes.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    segments: jsonb("segments").$type<VoiceSegment[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("nz_voice_chunk_unique").on(table.voiceId, table.chunkIndex)]
);

export const workspaceVectors = pgTable(
  "nz_vectors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => workspaceUsers.id, { onDelete: "cascade" }),
    documentId: uuid("document_id"),
    voiceId: uuid("voice_id"),
    chunkIndex: integer("chunk_index").notNull().default(0),
    entityType: text("entity_type").notNull().default("document"), // 'document' | 'voice' | 'library'
    title: text("title").notNull().default(""),
    content: text("content").notNull().default(""),
    isConfidential: boolean("is_confidential").notNull().default(false),
    embedding: jsonb("embedding").$type<number[]>().notNull().default([]),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    qdrantPointId: text("qdrant_point_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("nz_vectors_user_idx").on(table.userId),
    index("nz_vectors_doc_idx").on(table.documentId),
    index("nz_vectors_entity_idx").on(table.entityType),
    index("nz_vectors_confidential_idx").on(table.isConfidential),
  ]
);

export type PageRow = typeof pages.$inferSelect;
export type NewPageRow = typeof pages.$inferInsert;
export type BlockRow = typeof blocks.$inferSelect;
export type NewBlockRow = typeof blocks.$inferInsert;
export type AiRunRow = typeof aiRuns.$inferSelect;
export type NewAiRunRow = typeof aiRuns.$inferInsert;
export type VoiceSessionRow = typeof voiceSessions.$inferSelect;
export type NewVoiceSessionRow = typeof voiceSessions.$inferInsert;
export type DocumentVersionRow = typeof workspaceDocumentVersions.$inferSelect;
export type VectorRow = typeof workspaceVectors.$inferSelect;
