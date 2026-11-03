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
  isAiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantSource {
  id: string;
  title: string;
}

export interface AssistantResult {
  answer: string;
  title: string;
  blocks: Array<Pick<NoteBlock, "type" | "content" | "props">>;
  sources: AssistantSource[];
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
}
