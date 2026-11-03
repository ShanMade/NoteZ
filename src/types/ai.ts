import type { BlockProps, BlockType, FontStyle } from "@/types/notez";

export type AiMode =
  | "draft"
  | "meeting"
  | "voice-note"
  | "study"
  | "brainstorm"
  | "journal"
  | "summarize"
  | "improve"
  | "action-items"
  | "outline"
  | "expand"
  | "fix"
  | "title";

export type AiTone =
  | "balanced"
  | "concise"
  | "detailed"
  | "executive"
  | "creative"
  | "academic";

export type AiProvider = "openai" | "local" | "local-fallback";

export interface AiDraftBlock {
  type: BlockType;
  content: string;
  props?: BlockProps;
}

export interface AiDraftResult {
  title: string;
  icon: string;
  summary: string;
  tags: string[];
  actionItems: string[];
  decisions: string[];
  questions: string[];
  blocks: AiDraftBlock[];
  coverImage?: string | null;
  fontStyle?: FontStyle;
  tone?: AiTone;
}

export interface AiStudioDraft {
  runId?: string;
  voiceSessionId?: string;
  mode: AiMode;
  prompt: string;
  tone: AiTone;
  provider: AiProvider;
  result: AiDraftResult;
}

export interface AiRun {
  id: string;
  kind: "draft" | "voice" | "transform" | "manual";
  mode: AiMode;
  provider: AiProvider;
  model: string;
  status: "completed" | "failed";
  prompt: string;
  inputText: string;
  title: string;
  summary: string;
  result: AiDraftResult;
  isFavorite: boolean;
  sourcePageId: string | null;
  createdPageId: string | null;
  durationMs: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceSession {
  id: string;
  title: string;
  transcript: string;
  language: string;
  durationSeconds: number;
  source: "browser" | "openai" | "manual" | "upload";
  audioName: string | null;
  summary: string | null;
  structuredNote: AiDraftResult | null;
  createdPageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiStatus {
  configured: boolean;
  provider: "openai" | "local";
  model: string;
  transcriptionModel: string;
  engine: string;
  features: string[];
  runCount: number;
  voiceSessionCount: number;
}

export const AI_BLOCK_TYPES: BlockType[] = [
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
];

export const AI_CREATE_MODES: Array<{
  id: AiMode;
  label: string;
  icon: string;
  description: string;
  placeholder: string;
}> = [
  {
    id: "draft",
    label: "Smart Draft",
    icon: "✨",
    description: "Turn any brief into a structured, editable document.",
    placeholder:
      "Draft a launch brief for a calm productivity app with a clean block editor, local database, and AI voice notes…",
  },
  {
    id: "meeting",
    label: "Meeting Notes",
    icon: "🗓️",
    description: "Agenda, decisions, action items, and open questions.",
    placeholder:
      "Today we reviewed the Q3 roadmap. We agreed to ship the block editor first. Priya will finalize design specs by Friday. Need to decide on dark mode tokens…",
  },
  {
    id: "study",
    label: "Study Guide",
    icon: "📚",
    description: "Core concepts, review prompts, and a concise recap.",
    placeholder:
      "Explain spaced repetition, active recall, and interleaving for a study guide…",
  },
  {
    id: "brainstorm",
    label: "Idea Sprint",
    icon: "💡",
    description: "Generate ideas, experiments, and a priority matrix.",
    placeholder:
      "Brainstorm ways to make a note-taking workspace feel more tactile and delightful…",
  },
  {
    id: "journal",
    label: "Editorial Journal",
    icon: "✒️",
    description: "A reflective serif journal with highlights and prompts.",
    placeholder:
      "Today I spent the morning simplifying the editor. It felt calm when the interface stayed quiet…",
  },
  {
    id: "summarize",
    label: "Executive Summary",
    icon: "📝",
    description: "Condense long notes into a crisp brief and takeaways.",
    placeholder: "Paste long notes, a transcript, or research text to summarize…",
  },
];

export const AI_REFINE_MODES: Array<{
  id: AiMode;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    id: "summarize",
    label: "Summarize",
    icon: "📝",
    description: "Condense the page into key takeaways.",
  },
  {
    id: "improve",
    label: "Improve writing",
    icon: "✍️",
    description: "Sharpen clarity, flow, and rhythm.",
  },
  {
    id: "action-items",
    label: "Extract tasks",
    icon: "✅",
    description: "Turn commitments into a tracked action plan.",
  },
  {
    id: "outline",
    label: "Build outline",
    icon: "🧭",
    description: "Create a navigable section structure.",
  },
  {
    id: "expand",
    label: "Expand ideas",
    icon: "🌱",
    description: "Add depth and supporting points.",
  },
  {
    id: "fix",
    label: "Fix & polish",
    icon: "🛠️",
    description: "Clean up wording and formatting.",
  },
  {
    id: "title",
    label: "Title ideas",
    icon: "🏷️",
    description: "Suggest a stronger title and framing.",
  },
];

export const AI_TONES: Array<{
  id: AiTone;
  label: string;
  description: string;
}> = [
  { id: "balanced", label: "Balanced", description: "Clear and natural" },
  { id: "concise", label: "Concise", description: "Short and direct" },
  { id: "detailed", label: "Detailed", description: "Thorough and rich" },
  { id: "executive", label: "Executive", description: "Decision-ready" },
  { id: "creative", label: "Creative", description: "Expressive and warm" },
  { id: "academic", label: "Academic", description: "Precise and formal" },
];

export function isAiMode(value: unknown): value is AiMode {
  return (
    typeof value === "string" &&
    [
      "draft",
      "meeting",
      "voice-note",
      "study",
      "brainstorm",
      "journal",
      "summarize",
      "improve",
      "action-items",
      "outline",
      "expand",
      "fix",
      "title",
    ].includes(value)
  );
}

export function isAiTone(value: unknown): value is AiTone {
  return (
    typeof value === "string" &&
    ["balanced", "concise", "detailed", "executive", "creative", "academic"].includes(
      value
    )
  );
}
