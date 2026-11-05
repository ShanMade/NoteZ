import type { NoteBlock } from "@/types/notez";

export const ACCENTS = ["indigo", "rose", "teal", "amber"] as const;
export type AccentName = (typeof ACCENTS)[number];
export type ThemePreference = "light" | "dark" | "system";
export type EditorWidth = "comfortable" | "wide" | "full";
export type EditorFont = "sans" | "serif" | "mono";
export type AiScope = "none" | "current" | "workspace";
export type Density = "comfortable" | "compact";

export interface WorkspaceSettings {
  theme: ThemePreference;
  showTips: boolean;
  accent: AccentName;
  density: Density;
  editorWidth: EditorWidth;
  editorFont: EditorFont;
  spellcheck: boolean;
  defaultAiScope: AiScope;
  voiceLanguage: string;
  speakerLabels: boolean;
  autoStructureVoice: boolean;
  excludeConfidentialFromSearch: boolean;
}

export const DEFAULT_SETTINGS: WorkspaceSettings = {
  theme: "light",
  showTips: true,
  accent: "indigo",
  density: "comfortable",
  editorWidth: "comfortable",
  editorFont: "sans",
  spellcheck: false,
  defaultAiScope: "workspace",
  voiceLanguage: "en-US",
  speakerLabels: true,
  autoStructureVoice: false,
  excludeConfidentialFromSearch: true,
};

export interface WorkspaceUser {
  id: string;
  name: string;
  email: string;
  isDemo: boolean;
  settings: WorkspaceSettings;
  createdAt: string;
}

export interface WorkspaceDocument {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  cover: string | null;
  tags: string[];
  blocks: NoteBlock[];
  isFavorite: boolean;
  isArchived: boolean;
  isConfidential: boolean;
  isAiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  title: string;
  wordCount: number;
  changeSummary: string;
  blocks: NoteBlock[];
  createdAt: string;
}

export interface AssistantSource {
  id: string;
  title: string;
  similarityScore?: number;
  entityType?: "document" | "voice" | "library";
}

export type AiToolName =
  | "qdrant_semantic_search"
  | "sql_keyword_search"
  | "rename_note"
  | "modify_note"
  | "summarize_note"
  | "reproduce_note"
  | "extract_tasks"
  | "organize_note"
  | "append_blocks"
  | "create_note";

export interface AiToolCallTrace {
  id: string;
  tool: AiToolName;
  label: string;
  status: "executed" | "awaiting_confirmation";
  detail: string;
}

export interface AiToolProposal {
  id: string;
  tool: Exclude<AiToolName, "qdrant_semantic_search" | "sql_keyword_search">;
  label: string;
  description: string;
  targetDocumentId?: string | null;
  targetDocumentTitle?: string;
  /** For rename_note */
  proposedTitle?: string;
  previousTitle?: string;
  /** For organize_note / reproduce_note */
  proposedIcon?: string;
  proposedCover?: string | null;
  proposedTags?: string[];
  /** For modify_note / summarize_note / reproduce_note / extract_tasks / append_blocks / create_note */
  proposedBlocks?: Array<Pick<NoteBlock, "type" | "content" | "props">>;
  /** How blocks should be applied to the target note */
  applyMode?: "replace_blocks" | "prepend_blocks" | "append_blocks" | "create_new_note" | "metadata_only";
}

export interface AssistantResult {
  answer: string;
  title: string;
  blocks: Array<Pick<NoteBlock, "type" | "content" | "props">>;
  sources: AssistantSource[];
  toolCalls?: AiToolCallTrace[];
  proposals?: AiToolProposal[];
  semanticSearchPerformed?: boolean;
}

export interface AssistantHistoryItem {
  id: string;
  threadId: string | null;
  documentId: string | null;
  scope: AiScope;
  prompt: string;
  answer: string;
  title: string;
  blocks: AssistantResult["blocks"];
  sources: AssistantSource[];
  toolCalls?: AiToolCallTrace[];
  proposals?: AiToolProposal[];
  provider: string;
  createdAt: string;
}

export interface VoiceSegment {
  speaker: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
  chunkIndex: number;
}

export interface VoiceActionItem {
  task: string;
  owner: string;
}

export interface VoiceStructured {
  title: string;
  summary: string;
  keyPoints: string[];
  decisions: string[];
  actionItems: VoiceActionItem[];
  openQuestions: string[];
}

export interface VoiceNote {
  id: string;
  title: string;
  status: "recording" | "ready";
  transcript: string;
  segments: VoiceSegment[];
  durationSeconds: number;
  source: "gemini" | "browser" | "manual";
  documentId: string | null;
  speakerMap: Record<string, string>;
  structured: VoiceStructured | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderStatus {
  configured: boolean;
  provider: "gemini" | "basic";
  model: string;
  qdrantConfigured: boolean;
  qdrantMode: "qdrant" | "postgres_vector" | "local_hybrid";
  qdrantUrl?: string;
  vectorIndexedCount?: number;
}

export interface SemanticSearchResult {
  id: string;
  documentId?: string | null;
  voiceId?: string | null;
  title: string;
  snippet: string;
  score: number;
  similarityPercent: number;
  entityType: "document" | "voice" | "library";
  isConfidential: boolean;
  tags: string[];
  updatedAt: string;
}

export interface NoteKeywordMatch {
  blockId: string;
  position: number;
  blockType: string;
  snippet: string;
  occurrences: number;
}

export interface InNoteSearchResponse {
  query: string;
  totalOccurrences: number;
  matchingBlocks: NoteKeywordMatch[];
}
