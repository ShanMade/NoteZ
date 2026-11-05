CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text DEFAULT 'draft' NOT NULL,
	"mode" text DEFAULT 'draft' NOT NULL,
	"provider" text DEFAULT 'local' NOT NULL,
	"model" text DEFAULT 'notez-local-1' NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"input_text" text DEFAULT '' NOT NULL,
	"title" text DEFAULT 'AI Note' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"result" jsonb NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"source_page_id" uuid,
	"created_page_id" uuid,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"type" text DEFAULT 'paragraph' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"icon" text DEFAULT '📄' NOT NULL,
	"cover_image" text,
	"font_style" text DEFAULT 'sans' NOT NULL,
	"full_width" boolean DEFAULT false NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_ai_generated" boolean DEFAULT false NOT NULL,
	"source_run_id" uuid,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'Voice Note' NOT NULL,
	"transcript" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'en-US' NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'browser' NOT NULL,
	"audio_name" text,
	"summary" text,
	"structured_note" jsonb,
	"created_page_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nz_assistant_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"thread_id" uuid,
	"document_id" uuid,
	"scope" text DEFAULT 'none' NOT NULL,
	"prompt" text NOT NULL,
	"answer" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tool_calls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text DEFAULT 'basic' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nz_document_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"change_summary" text DEFAULT 'Auto-saved version' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nz_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"icon" text DEFAULT 'file' NOT NULL,
	"cover" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_confidential" boolean DEFAULT false NOT NULL,
	"is_ai_generated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nz_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nz_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "nz_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nz_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "nz_vectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document_id" uuid,
	"voice_id" uuid,
	"chunk_index" integer DEFAULT 0 NOT NULL,
	"entity_type" text DEFAULT 'document' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"is_confidential" boolean DEFAULT false NOT NULL,
	"embedding" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"qdrant_point_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nz_voice_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voice_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nz_voice_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Voice note' NOT NULL,
	"status" text DEFAULT 'recording' NOT NULL,
	"transcript" text DEFAULT '' NOT NULL,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"source" text DEFAULT 'gemini' NOT NULL,
	"document_id" uuid,
	"speaker_map" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"structured" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nz_assistant_runs" ADD CONSTRAINT "nz_assistant_runs_user_id_nz_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nz_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nz_document_versions" ADD CONSTRAINT "nz_document_versions_document_id_nz_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."nz_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nz_document_versions" ADD CONSTRAINT "nz_document_versions_user_id_nz_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nz_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nz_documents" ADD CONSTRAINT "nz_documents_user_id_nz_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nz_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nz_sessions" ADD CONSTRAINT "nz_sessions_user_id_nz_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nz_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nz_vectors" ADD CONSTRAINT "nz_vectors_user_id_nz_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nz_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nz_voice_chunks" ADD CONSTRAINT "nz_voice_chunks_voice_id_nz_voice_notes_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."nz_voice_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nz_voice_notes" ADD CONSTRAINT "nz_voice_notes_user_id_nz_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."nz_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_runs_created_at_idx" ON "ai_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_runs_mode_idx" ON "ai_runs" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "ai_runs_favorite_idx" ON "ai_runs" USING btree ("is_favorite");--> statement-breakpoint
CREATE INDEX "blocks_page_id_position_idx" ON "blocks" USING btree ("page_id","position");--> statement-breakpoint
CREATE INDEX "pages_parent_id_idx" ON "pages" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "pages_is_archived_idx" ON "pages" USING btree ("is_archived");--> statement-breakpoint
CREATE INDEX "pages_is_ai_generated_idx" ON "pages" USING btree ("is_ai_generated");--> statement-breakpoint
CREATE INDEX "voice_sessions_created_at_idx" ON "voice_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "nz_assistant_user_idx" ON "nz_assistant_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nz_assistant_thread_idx" ON "nz_assistant_runs" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "nz_doc_versions_doc_idx" ON "nz_document_versions" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "nz_doc_versions_user_idx" ON "nz_document_versions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nz_documents_user_idx" ON "nz_documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nz_documents_parent_idx" ON "nz_documents" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "nz_documents_confidential_idx" ON "nz_documents" USING btree ("is_confidential");--> statement-breakpoint
CREATE INDEX "nz_sessions_user_idx" ON "nz_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nz_vectors_user_idx" ON "nz_vectors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "nz_vectors_doc_idx" ON "nz_vectors" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "nz_vectors_entity_idx" ON "nz_vectors" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "nz_vectors_confidential_idx" ON "nz_vectors" USING btree ("is_confidential");--> statement-breakpoint
CREATE UNIQUE INDEX "nz_voice_chunk_unique" ON "nz_voice_chunks" USING btree ("voice_id","chunk_index");--> statement-breakpoint
CREATE INDEX "nz_voice_user_idx" ON "nz_voice_notes" USING btree ("user_id");