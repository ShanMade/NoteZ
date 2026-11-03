"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Type,
  Heading1,
  Heading2,
  Heading3,
  CheckSquare,
  List,
  ListOrdered,
  ChevronRightSquare,
  Lightbulb,
  Quote,
  Table,
  Code2,
  Minus,
} from "lucide-react";
import type { BlockType } from "@/types/notez";

export interface SlashMenuItem {
  type: BlockType;
  label: string;
  description: string;
  shortcut?: string;
  category: "Basic" | "Lists" | "Rich & Structured";
  keywords: string[];
  icon: React.ReactNode;
}

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  {
    type: "paragraph",
    label: "Text",
    description: "Start writing with plain editorial text.",
    category: "Basic",
    keywords: ["text", "paragraph", "plain", "p"],
    icon: <Type className="h-4 w-4" />,
  },
  {
    type: "heading1",
    label: "Heading 1",
    description: "Large primary section heading.",
    shortcut: "#",
    category: "Basic",
    keywords: ["h1", "heading1", "title", "large"],
    icon: <Heading1 className="h-4 w-4" />,
  },
  {
    type: "heading2",
    label: "Heading 2",
    description: "Medium section heading.",
    shortcut: "##",
    category: "Basic",
    keywords: ["h2", "heading2", "subtitle", "medium"],
    icon: <Heading2 className="h-4 w-4" />,
  },
  {
    type: "heading3",
    label: "Heading 3",
    description: "Compact subsection heading.",
    shortcut: "###",
    category: "Basic",
    keywords: ["h3", "heading3", "small"],
    icon: <Heading3 className="h-4 w-4" />,
  },
  {
    type: "todo",
    label: "To-do List",
    description: "Track tasks and action items with a checkbox.",
    shortcut: "[]",
    category: "Lists",
    keywords: ["todo", "task", "check", "checkbox", "action"],
    icon: <CheckSquare className="h-4 w-4" />,
  },
  {
    type: "bullet",
    label: "Bulleted List",
    description: "Create a clean bulleted list.",
    shortcut: "-",
    category: "Lists",
    keywords: ["bullet", "list", "ul", "unordered"],
    icon: <List className="h-4 w-4" />,
  },
  {
    type: "numbered",
    label: "Numbered List",
    description: "Sequential numbered list items.",
    shortcut: "1.",
    category: "Lists",
    keywords: ["number", "numbered", "ordered", "ol"],
    icon: <ListOrdered className="h-4 w-4" />,
  },
  {
    type: "toggle",
    label: "Toggle Section",
    description: "Collapsible header that expands nested details.",
    shortcut: ">>>",
    category: "Lists",
    keywords: ["toggle", "collapse", "accordion", "details"],
    icon: <ChevronRightSquare className="h-4 w-4" />,
  },
  {
    type: "callout",
    label: "Callout",
    description: "Make key insights stand out with an icon box.",
    shortcut: "!",
    category: "Rich & Structured",
    keywords: ["callout", "info", "alert", "tip", "box", "note"],
    icon: <Lightbulb className="h-4 w-4" />,
  },
  {
    type: "quote",
    label: "Quote",
    description: "Capture a pull-quote or key excerpt.",
    shortcut: ">",
    category: "Rich & Structured",
    keywords: ["quote", "blockquote", "citation"],
    icon: <Quote className="h-4 w-4" />,
  },
  {
    type: "table",
    label: "Inline Table",
    description: "Structured database table with status & tag columns.",
    category: "Rich & Structured",
    keywords: ["table", "database", "grid", "spreadsheet", "tracker"],
    icon: <Table className="h-4 w-4" />,
  },
  {
    type: "code",
    label: "Code Block",
    description: "Monospace code snippet with language selector.",
    shortcut: "```",
    category: "Rich & Structured",
    keywords: ["code", "snippet", "pre", "typescript", "programming"],
    icon: <Code2 className="h-4 w-4" />,
  },
  {
    type: "divider",
    label: "Divider",
    description: "Visually separate sections with a thin line.",
    shortcut: "---",
    category: "Rich & Structured",
    keywords: ["divider", "hr", "line", "separator"],
    icon: <Minus className="h-4 w-4" />,
  },
];

interface SlashCommandMenuProps {
  query: string;
  anchorRect: { top: number; left: number; bottom: number };
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export function SlashCommandMenu({
  query,
  anchorRect,
  onSelect,
  onClose,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SLASH_MENU_ITEMS;
    return SLASH_MENU_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q))
    );
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (filteredItems.length > 0) {
          setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (filteredItems.length > 0) {
          setSelectedIndex(
            (prev) => (prev - 1 + filteredItems.length) % filteredItems.length
          );
        }
      } else if (e.key === "Enter") {
        if (filteredItems[selectedIndex]) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(filteredItems[selectedIndex].type);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [filteredItems, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Keep active item scrolled into view
  useEffect(() => {
    const activeEl = menuRef.current?.querySelector(
      `[data-slash-index="${selectedIndex}"]`
    );
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const viewportHeight =
    typeof window !== "undefined" ? window.innerHeight : 800;
  const menuHeight = 350;
  const openUpward = anchorRect.bottom + menuHeight > viewportHeight - 16;

  const topPos = openUpward
    ? Math.max(12, anchorRect.top - Math.min(menuHeight, 330) - 6)
    : anchorRect.bottom + 6;
  const leftPos = Math.min(
    Math.max(12, anchorRect.left),
    (typeof window !== "undefined" ? window.innerWidth : 1200) - 324
  );

  // Group filtered items while maintaining flat index for keyboard nav
  const categories: Array<"Basic" | "Lists" | "Rich & Structured"> = [
    "Basic",
    "Lists",
    "Rich & Structured",
  ];

  let runningIndex = -1;

  return (
    <div
      ref={menuRef}
      style={{ top: topPos, left: leftPos, borderRadius: 16 }}
      className="notez-popover notez-scroll fixed z-50 max-h-[356px] w-[324px] overflow-y-auto p-1.5"
      role="listbox"
      aria-label="Insert block menu"
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        <span>{query ? `Filtering "/${query}"` : "Insert Block"}</span>
        <span className="font-editorial-mono text-[10px] opacity-75">↑↓ ↵</span>
      </div>

      {filteredItems.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
          No matching block for{" "}
          <span className="font-medium text-[var(--text-primary)]">
            &ldquo;/{query}&rdquo;
          </span>
        </div>
      ) : (
        categories.map((category) => {
          const group = filteredItems.filter((i) => i.category === category);
          if (group.length === 0) return null;

          return (
            <div key={category} className="mb-1 last:mb-0">
              <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]/80">
                {category}
              </div>
              {group.map((item) => {
                runningIndex += 1;
                const itemIndex = runningIndex;
                const isSelected = itemIndex === selectedIndex;

                return (
                  <button
                    key={item.type}
                    type="button"
                    data-slash-index={itemIndex}
                    onMouseEnter={() => setSelectedIndex(itemIndex)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(item.type);
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-[var(--accent-soft)] text-[var(--text-primary)]"
                        : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        isSelected
                          ? "border-indigo-500/30 bg-indigo-500/10 text-[var(--accent)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-muted)]"
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium">
                          {item.label}
                        </span>
                        {item.shortcut && (
                          <span className="font-editorial-mono rounded bg-[var(--bg-sidebar)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                            {item.shortcut}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })
      )}

      <div className="mt-1 flex items-center justify-between border-t border-[var(--border-subtle)] px-2.5 py-2 text-[10px] text-[var(--text-muted)]">
        <span className="flex items-center gap-1">
          <span className="notez-kbd">↑</span>
          <span className="notez-kbd">↓</span>
          <span className="ml-1">Navigate</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="notez-kbd">↵</span>
          <span className="ml-1">Select</span>
          <span className="notez-kbd ml-2">ESC</span>
        </span>
      </div>
    </div>
  );
}
