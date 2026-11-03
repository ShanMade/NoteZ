export type BlockType =
  | "paragraph"
  | "heading1"
  | "heading2"
  | "heading3"
  | "todo"
  | "bullet"
  | "numbered"
  | "toggle"
  | "quote"
  | "callout"
  | "code"
  | "divider"
  | "table";

export type FontStyle = "sans" | "serif" | "mono";

export type CalloutTone = "indigo" | "amber" | "emerald" | "rose" | "slate";

export interface TableColumn {
  id: string;
  name: string;
  type: "text" | "status" | "tag";
}

export interface TableRow {
  id: string;
  cells: Record<string, string>;
}

export interface BlockProps {
  checked?: boolean;
  expanded?: boolean;
  details?: string;
  icon?: string;
  tone?: CalloutTone;
  language?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
}

export interface NotePage {
  id: string;
  parentId: string | null;
  title: string;
  icon: string;
  coverImage: string | null;
  fontStyle: FontStyle;
  fullWidth: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  isAiGenerated: boolean;
  sourceRunId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface NoteBlock {
  id: string;
  pageId: string;
  type: BlockType;
  content: string;
  props: BlockProps;
  position: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PageDetailResponse {
  page: NotePage;
  blocks: NoteBlock[];
  breadcrumbs: Array<{ id: string; title: string; icon: string }>;
  subpages: NotePage[];
}

export interface SearchHit {
  pageId: string;
  title: string;
  icon: string;
  snippet: string;
  matchType: "title" | "content";
  updatedAt: string;
}

export interface CoverPreset {
  id: string;
  label: string;
  value: string;
  kind: "image" | "gradient";
  previewStyle: string;
}

export const COVER_PRESETS: CoverPreset[] = [
  {
    id: "editorial-paper",
    label: "Editorial Linen",
    value: "/covers/editorial-paper.jpg",
    kind: "image",
    previewStyle: "url('/covers/editorial-paper.jpg') center/cover no-repeat",
  },
  {
    id: "indigo-ink",
    label: "Sumi Indigo Wash",
    value: "/covers/indigo-ink.jpg",
    kind: "image",
    previewStyle: "url('/covers/indigo-ink.jpg') center/cover no-repeat",
  },
  {
    id: "gradient-indigo-dawn",
    label: "Indigo Dawn",
    value: "gradient:linear-gradient(135deg, #312E81 0%, #4F46E5 48%, #C7D2FE 100%)",
    kind: "gradient",
    previewStyle: "linear-gradient(135deg, #312E81 0%, #4F46E5 48%, #C7D2FE 100%)",
  },
  {
    id: "gradient-warm-atelier",
    label: "Warm Atelier",
    value: "gradient:linear-gradient(135deg, #FEF3C7 0%, #FDE68A 35%, #FCA5A5 100%)",
    kind: "gradient",
    previewStyle: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 35%, #FCA5A5 100%)",
  },
  {
    id: "gradient-sage-paper",
    label: "Botanical Sage",
    value: "gradient:linear-gradient(135deg, #134E4A 0%, #0F766E 50%, #99F6E4 100%)",
    kind: "gradient",
    previewStyle: "linear-gradient(135deg, #134E4A 0%, #0F766E 50%, #99F6E4 100%)",
  },
  {
    id: "gradient-obsidian-gold",
    label: "Obsidian Studio",
    value: "gradient:linear-gradient(135deg, #18181B 0%, #27272A 55%, #52525B 100%)",
    kind: "gradient",
    previewStyle: "linear-gradient(135deg, #18181B 0%, #27272A 55%, #52525B 100%)",
  },
];

export const EMOJI_CATEGORIES: Array<{ label: string; emojis: string[] }> = [
  {
    label: "Workspace",
    emojis: ["📄", "✨", "🚀", "📓", "📐", "📌", "🗂️", "📝", "🎯", "💡", "🧠", "⚡", "🔍", "📊", "🛠️", "🏛️"],
  },
  {
    label: "Creative & Editorial",
    emojis: ["🎨", "✒️", "📚", "🔖", "🗞️", "🎭", "🌿", "☕", "🌙", "☀️", "🌊", "🪴", "🔮", "💎", "🧭", "🏔️"],
  },
  {
    label: "Status & Symbols",
    emojis: ["✅", "🔥", "⭐", "🟣", "🟢", "🟠", "🔵", "❤️", "🛡️", "⚙️", "🧪", "📦", "📣", "🗓️", "🏆", "🤝"],
  },
];

export const CODE_LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "sql",
  "bash",
  "json",
  "css",
  "html",
  "rust",
  "go",
  "markdown",
];

export const STATUS_OPTIONS = [
  { label: "Not Started", bg: "bg-stone-200/80 text-stone-700 dark:bg-stone-700/60 dark:text-stone-200" },
  { label: "Planned", bg: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200" },
  { label: "In Progress", bg: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200" },
  { label: "In Review", bg: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200" },
  { label: "Shipped", bg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200" },
];
