"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Plus,
  GripVertical,
  Check,
  ChevronRight,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Files,
} from "lucide-react";
import {
  CODE_LANGUAGES,
  type BlockProps,
  type BlockType,
  type CalloutTone,
  type NoteBlock,
} from "@/types/notez";
import { TableBlockView } from "./TableBlockView";

interface EditableLineProps {
  blockId: string;
  blockType: BlockType;
  html: string;
  placeholder: string;
  alwaysShowPlaceholder?: boolean;
  className?: string;
  registerFocusable: (id: string, el: HTMLElement | null) => void;
  onInputHtml: (nextHtml: string, plainText: string, el: HTMLDivElement) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>, el: HTMLDivElement) => void;
  onFocus?: () => void;
}

function EditableLine({
  blockId,
  blockType,
  html,
  placeholder,
  alwaysShowPlaceholder = false,
  className = "",
  registerFocusable,
  onInputHtml,
  onKeyDown,
  onFocus,
}: EditableLineProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const lastEmittedRef = useRef<string>(html);

  useEffect(() => {
    const el = divRef.current;
    registerFocusable(blockId, el);
    return () => registerFocusable(blockId, null);
  }, [blockId, blockType, registerFocusable]);

  useEffect(() => {
    const el = divRef.current;
    if (!el) return;

    const isFocused = document.activeElement === el;
    // Only touch DOM innerHTML if changed externally (not from our own typing)
    if (el.innerHTML !== html && (!isFocused || html !== lastEmittedRef.current)) {
      el.innerHTML = html;
      lastEmittedRef.current = html;

      if (isFocused) {
        // Place caret at end after programmatic rewrite (e.g. stripping markdown prefix or slash cmd)
        try {
          const range = document.createRange();
          range.selectNodeContents(el);
          range.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        } catch {
          // Ignore selection errors
        }
      }
    }
  }, [html, blockId, blockType]);

  return (
    <div
      ref={divRef}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      data-placeholder={placeholder}
      data-always-placeholder={alwaysShowPlaceholder ? "true" : "false"}
      data-focused-only={alwaysShowPlaceholder ? "false" : "true"}
      onFocus={onFocus}
      onInput={(e) => {
        const el = e.currentTarget;
        // Normalize lone <br> into empty string so :empty::before placeholder works cleanly
        if (el.innerHTML === "<br>" || el.textContent === "") {
          if (el.innerHTML !== "") {
            el.innerHTML = "";
          }
        }
        const nextHtml = el.innerHTML;
        const plain = el.textContent ?? "";
        lastEmittedRef.current = nextHtml;
        onInputHtml(nextHtml, plain, el);
      }}
      onKeyDown={(e) => {
        if (divRef.current) {
          onKeyDown(e, divRef.current);
        }
      }}
      onPaste={(e) => {
        // Paste clean plain text so external styles don't corrupt editorial typography
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
      }}
      className={`notez-editable w-full break-words focus:outline-none ${className}`}
    />
  );
}

const CALLOUT_TONES: Record<
  CalloutTone,
  { wrapper: string; swatch: string; bar: string; label: string; chip: string }
> = {
  indigo: {
    wrapper:
      "border-indigo-500/25 bg-indigo-500/[0.06] dark:border-indigo-400/25 dark:bg-indigo-400/[0.09]",
    swatch: "bg-indigo-500",
    bar: "bg-indigo-500",
    label: "Indigo",
    chip: "text-indigo-600 dark:text-indigo-300",
  },
  amber: {
    wrapper:
      "border-amber-500/30 bg-amber-500/[0.07] dark:border-amber-400/25 dark:bg-amber-400/[0.09]",
    swatch: "bg-amber-500",
    bar: "bg-amber-500",
    label: "Amber",
    chip: "text-amber-700 dark:text-amber-300",
  },
  emerald: {
    wrapper:
      "border-emerald-500/25 bg-emerald-500/[0.07] dark:border-emerald-400/25 dark:bg-emerald-400/[0.09]",
    swatch: "bg-emerald-500",
    bar: "bg-emerald-500",
    label: "Emerald",
    chip: "text-emerald-700 dark:text-emerald-300",
  },
  rose: {
    wrapper:
      "border-rose-500/25 bg-rose-500/[0.07] dark:border-rose-400/25 dark:bg-rose-400/[0.09]",
    swatch: "bg-rose-500",
    bar: "bg-rose-500",
    label: "Rose",
    chip: "text-rose-700 dark:text-rose-300",
  },
  slate: {
    wrapper: "border-[var(--border-subtle)] bg-[var(--bg-sidebar)]",
    swatch: "bg-stone-500",
    bar: "bg-stone-400 dark:bg-stone-500",
    label: "Neutral",
    chip: "text-[var(--text-muted)]",
  },
};

const CALLOUT_ICONS = ["💡", "📌", "🎯", "⚡", "✨", "🔥", "🛠️", "📣", "🌿", "🧭"];

export interface BlockItemProps {
  block: NoteBlock;
  index: number;
  totalBlocks: number;
  numberedOrder: number;
  isSlashActiveOnThisBlock: boolean;
  registerFocusable: (id: string, el: HTMLElement | null) => void;
  onChangeBlock: (
    id: string,
    patch: Partial<Pick<NoteBlock, "type" | "content" | "props">>
  ) => void;
  onEnterKey: (id: string) => void;
  onBackspaceEmpty: (id: string) => void;
  onFocusAdjacent: (id: string, direction: "up" | "down") => void;
  onInsertBelowAndSlash: (id: string, anchorRect: { top: number; left: number; bottom: number }) => void;
  onSlashTyping: (
    id: string,
    query: string | null,
    anchorRect?: { top: number; left: number; bottom: number }
  ) => void;
  onDuplicateBlock: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onMoveBlockOffset: (id: string, delta: -1 | 1) => void;
  onDragStartBlock: (id: string) => void;
  onDropOnBlock: (targetId: string, position: "before" | "after") => void;
  draggingBlockId: string | null;
}

export function BlockItem({
  block,
  index,
  totalBlocks,
  numberedOrder,
  isSlashActiveOnThisBlock,
  registerFocusable,
  onChangeBlock,
  onEnterKey,
  onBackspaceEmpty,
  onFocusAdjacent,
  onInsertBelowAndSlash,
  onSlashTyping,
  onDuplicateBlock,
  onDeleteBlock,
  onMoveBlockOffset,
  onDragStartBlock,
  onDropOnBlock,
  draggingBlockId,
}: BlockItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<"before" | "after" | null>(
    null
  );
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (block.type === "code") {
      registerFocusable(block.id, codeRef.current);
      return () => registerFocusable(block.id, null);
    }
  }, [block.id, block.type, registerFocusable]);

  // Auto-resize code textarea
  useEffect(() => {
    if (block.type === "code" && codeRef.current) {
      codeRef.current.style.height = "auto";
      codeRef.current.style.height = `${Math.max(76, codeRef.current.scrollHeight)}px`;
    }
  }, [block.type, block.content]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  const isCaretAtStart = (el: HTMLElement): boolean => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    const preRange = range.cloneRange();
    preRange.selectNodeContents(el);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length === 0;
  };

  const handleTextInput = (
    nextHtml: string,
    plainText: string,
    el: HTMLDivElement
  ) => {
    // Normalize non-breaking spaces for shortcut matching
    const normalized = plainText.replace(/\u00A0/g, " ");

    // Live Markdown Auto-Formatting Shortcuts
    if (block.type === "paragraph") {
      if (normalized === "# ") {
        onChangeBlock(block.id, { type: "heading1", content: "" });
        onSlashTyping(block.id, null);
        return;
      }
      if (normalized === "## ") {
        onChangeBlock(block.id, { type: "heading2", content: "" });
        onSlashTyping(block.id, null);
        return;
      }
      if (normalized === "### ") {
        onChangeBlock(block.id, { type: "heading3", content: "" });
        onSlashTyping(block.id, null);
        return;
      }
      if (normalized === "- " || normalized === "* ") {
        onChangeBlock(block.id, { type: "bullet", content: "" });
        onSlashTyping(block.id, null);
        return;
      }
      if (normalized === "1. ") {
        onChangeBlock(block.id, { type: "numbered", content: "" });
        onSlashTyping(block.id, null);
        return;
      }
      if (normalized === "[] " || normalized === "[ ] ") {
        onChangeBlock(block.id, {
          type: "todo",
          content: "",
          props: { ...block.props, checked: false },
        });
        onSlashTyping(block.id, null);
        return;
      }
      if (normalized.toLowerCase() === "[x] ") {
        onChangeBlock(block.id, {
          type: "todo",
          content: "",
          props: { ...block.props, checked: true },
        });
        onSlashTyping(block.id, null);
        return;
      }
      if (normalized === "> ") {
        onChangeBlock(block.id, { type: "quote", content: "" });
        onSlashTyping(block.id, null);
        return;
      }
      if (normalized === ">>> ") {
        onChangeBlock(block.id, {
          type: "toggle",
          content: "",
          props: { ...block.props, expanded: true, details: "" },
        });
        onSlashTyping(block.id, null);
        return;
      }
      if (normalized === "! ") {
        onChangeBlock(block.id, {
          type: "callout",
          content: "",
          props: { ...block.props, icon: "💡", tone: "indigo" },
        });
        onSlashTyping(block.id, null);
        return;
      }
      if (normalized === "```" || normalized === "``` ") {
        onChangeBlock(block.id, {
          type: "code",
          content: "",
          props: { ...block.props, language: "typescript" },
        });
        onSlashTyping(block.id, null);
        return;
      }
      if (normalized === "---") {
        onChangeBlock(block.id, { type: "divider", content: "" });
        onSlashTyping(block.id, null);
        onEnterKey(block.id);
        return;
      }
    }

    onChangeBlock(block.id, { content: nextHtml });

    // Check for '/' slash command at start of block
    const slashMatch = normalized.match(/^\/([a-zA-Z0-9]*)$/);
    if (slashMatch) {
      const rect = el.getBoundingClientRect();
      onSlashTyping(block.id, slashMatch[1], {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
      });
    } else if (isSlashActiveOnThisBlock) {
      onSlashTyping(block.id, null);
    }
  };

  const handleEditableKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    el: HTMLDivElement
  ) => {
    // Let SlashCommandMenu handle navigation keys when active
    if (
      isSlashActiveOnThisBlock &&
      (e.key === "ArrowDown" ||
        e.key === "ArrowUp" ||
        e.key === "Enter" ||
        e.key === "Escape")
    ) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const plain = (el.textContent ?? "").trim();
      // Notion behavior: pressing Enter on an empty list/quote item resets it to a plain paragraph!
      if (
        plain === "" &&
        (block.type === "bullet" ||
          block.type === "numbered" ||
          block.type === "todo" ||
          block.type === "quote")
      ) {
        onChangeBlock(block.id, { type: "paragraph", content: "" });
        return;
      }
      onEnterKey(block.id);
      return;
    }

    if (e.key === "Backspace") {
      const plain = el.textContent ?? "";
      if (plain.length === 0) {
        e.preventDefault();
        if (block.type !== "paragraph") {
          onChangeBlock(block.id, { type: "paragraph" });
        } else {
          onBackspaceEmpty(block.id);
        }
        return;
      }
      if (isCaretAtStart(el) && block.type !== "paragraph") {
        e.preventDefault();
        onChangeBlock(block.id, { type: "paragraph" });
        return;
      }
    }

    if (e.key === "ArrowUp" && !e.shiftKey) {
      if (isCaretAtStart(el) || (el.textContent ?? "").length === 0) {
        e.preventDefault();
        onFocusAdjacent(block.id, "up");
      }
    } else if (e.key === "ArrowDown" && !e.shiftKey) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        const postRange = range.cloneRange();
        postRange.selectNodeContents(el);
        postRange.setStart(range.endContainer, range.endOffset);
        if (postRange.toString().length === 0) {
          e.preventDefault();
          onFocusAdjacent(block.id, "down");
        }
      }
    }
  };

  const updateProps = (patch: Partial<BlockProps>) => {
    onChangeBlock(block.id, {
      props: { ...block.props, ...patch },
    });
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(block.content || "");
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case "heading1":
        return (
          <div className="pt-7 pb-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-[2px] w-8 rounded-full bg-[var(--accent)]/70" />
              <span className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                Section
              </span>
            </div>
            <EditableLine
              blockId={block.id}
              blockType={block.type}
              html={block.content}
              placeholder="Heading 1"
              alwaysShowPlaceholder
              registerFocusable={registerFocusable}
              onInputHtml={handleTextInput}
              onKeyDown={handleEditableKeyDown}
              className="text-[1.9rem] font-bold leading-[1.22] tracking-[-0.035em] text-[var(--text-primary)]"
            />
          </div>
        );

      case "heading2":
        return (
          <div className="pt-6 pb-1">
            <div className="mb-1.5 h-[2px] w-6 rounded-full bg-[var(--accent)]/45" />
            <EditableLine
              blockId={block.id}
              blockType={block.type}
              html={block.content}
              placeholder="Heading 2"
              alwaysShowPlaceholder
              registerFocusable={registerFocusable}
              onInputHtml={handleTextInput}
              onKeyDown={handleEditableKeyDown}
              className="text-[1.5rem] font-semibold leading-[1.28] tracking-[-0.028em] text-[var(--text-primary)]"
            />
          </div>
        );

      case "heading3":
        return (
          <div className="pt-4 pb-0.5">
            <EditableLine
              blockId={block.id}
              blockType={block.type}
              html={block.content}
              placeholder="Heading 3"
              alwaysShowPlaceholder
              registerFocusable={registerFocusable}
              onInputHtml={handleTextInput}
              onKeyDown={handleEditableKeyDown}
              className="text-[1.22rem] font-semibold leading-[1.35] tracking-[-0.018em] text-[var(--text-primary)]"
            />
          </div>
        );

      case "todo": {
        const checked = Boolean(block.props?.checked);
        return (
          <div className="flex items-start gap-2.5 py-0.5">
            <button
              type="button"
              onClick={() => updateProps({ checked: !checked })}
              aria-label={checked ? "Mark task incomplete" : "Mark task complete"}
              className={`mt-[5px] flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border transition-all active:scale-90 ${
                checked
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_2px_6px_-2px_var(--accent)]"
                  : "border-[var(--border-strong)] bg-[var(--bg-elevated)]/60 hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
              }`}
            >
              {checked && <Check className="h-3 w-3 stroke-[2.75]" />}
            </button>
            <EditableLine
              blockId={block.id}
              blockType={block.type}
              html={block.content}
              placeholder="To-do"
              alwaysShowPlaceholder
              registerFocusable={registerFocusable}
              onInputHtml={handleTextInput}
              onKeyDown={handleEditableKeyDown}
              className={`text-[16px] leading-[1.65] transition-colors ${
                checked
                  ? "line-through text-[var(--text-muted)] opacity-75"
                  : "text-[var(--text-primary)]"
              }`}
            />
          </div>
        );
      }

      case "bullet":
        return (
          <div className="flex items-start gap-2.5 py-0.5">
            <span className="mt-[10px] h-[6px] w-[6px] shrink-0 rounded-full bg-[var(--text-primary)] opacity-80" />
            <EditableLine
              blockId={block.id}
              blockType={block.type}
              html={block.content}
              placeholder="List item"
              alwaysShowPlaceholder
              registerFocusable={registerFocusable}
              onInputHtml={handleTextInput}
              onKeyDown={handleEditableKeyDown}
              className="text-[16px] leading-[1.65] text-[var(--text-primary)]"
            />
          </div>
        );

      case "numbered":
        return (
          <div className="flex items-start gap-2 py-0.5">
            <span className="min-w-[22px] select-none pt-[1px] text-right font-medium tabular-nums text-[15.5px] leading-[1.65] text-[var(--text-muted)]">
              {numberedOrder}.
            </span>
            <EditableLine
              blockId={block.id}
              blockType={block.type}
              html={block.content}
              placeholder="List item"
              alwaysShowPlaceholder
              registerFocusable={registerFocusable}
              onInputHtml={handleTextInput}
              onKeyDown={handleEditableKeyDown}
              className="text-[16px] leading-[1.65] text-[var(--text-primary)]"
            />
          </div>
        );

      case "toggle": {
        const expanded = block.props?.expanded !== false;
        return (
          <div className="py-1.5">
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => updateProps({ expanded: !expanded })}
                aria-label={expanded ? "Collapse toggle" : "Expand toggle"}
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all ${
                  expanded
                    ? "border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    expanded ? "rotate-90" : ""
                  }`}
                />
              </button>
              <EditableLine
                blockId={block.id}
                blockType={block.type}
                html={block.content}
                placeholder="Toggle title"
                alwaysShowPlaceholder
                registerFocusable={registerFocusable}
                onInputHtml={handleTextInput}
                onKeyDown={handleEditableKeyDown}
                className="font-semibold text-[16px] leading-[1.6] text-[var(--text-primary)]"
              />
            </div>
            {expanded && (
              <div className="mt-2 ml-3 border-l-2 border-[var(--accent)]/35 pl-4">
                <textarea
                  value={block.props?.details ?? ""}
                  onChange={(e) => updateProps({ details: e.target.value })}
                  rows={Math.max(
                    2,
                    (block.props?.details ?? "").split("\n").length
                  )}
                  placeholder="Add collapsible details inside this toggle…"
                  className="w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-sidebar)]/60 px-3 py-2.5 text-[14px] leading-[1.65] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:border-[var(--accent)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/10"
                />
              </div>
            )}
          </div>
        );
      }

      case "quote":
        return (
          <blockquote className="relative my-3 rounded-r-xl border-l-[3px] border-[var(--accent)] bg-[var(--accent-soft)]/35 py-3 pr-3 pl-7">
            <span className="font-editorial-serif pointer-events-none absolute top-0.5 left-2.5 text-[34px] leading-none text-[var(--accent)]/35 select-none">
              &ldquo;
            </span>
            <EditableLine
              blockId={block.id}
              blockType={block.type}
              html={block.content}
              placeholder="Empty quote"
              alwaysShowPlaceholder
              registerFocusable={registerFocusable}
              onInputHtml={handleTextInput}
              onKeyDown={handleEditableKeyDown}
              className="font-editorial-serif italic text-[18px] leading-[1.65] text-[var(--text-primary)]/90"
            />
          </blockquote>
        );

      case "callout": {
        const tone: CalloutTone = block.props?.tone || "indigo";
        const icon = block.props?.icon || "💡";
        const styleCfg = CALLOUT_TONES[tone] || CALLOUT_TONES.indigo;

        const cycleIcon = () => {
          const idx = CALLOUT_ICONS.indexOf(icon);
          const next = CALLOUT_ICONS[(idx + 1) % CALLOUT_ICONS.length];
          updateProps({ icon: next });
        };

        return (
          <div
            className={`relative my-3 flex items-start gap-3 overflow-hidden border py-3.5 pr-4 pl-5 transition-colors ${styleCfg.wrapper}`}
            style={{ borderRadius: 16, boxShadow: "var(--shadow-sm)" }}
          >
            <span
              className={`absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full ${styleCfg.bar}`}
            />
            <button
              type="button"
              onClick={cycleIcon}
              title="Click to cycle callout icon"
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/80 text-lg shadow-xs hover:scale-105 active:scale-95 transition-transform select-none"
            >
              {icon}
            </button>
            <div className="min-w-0 flex-1">
              <div
                className={`mb-1 text-[9px] font-bold uppercase tracking-[0.16em] ${styleCfg.chip}`}
              >
                Highlight
              </div>
              <EditableLine
                blockId={block.id}
                blockType={block.type}
                html={block.content}
                placeholder="Write a callout note…"
                alwaysShowPlaceholder
                registerFocusable={registerFocusable}
                onInputHtml={handleTextInput}
                onKeyDown={handleEditableKeyDown}
                className="text-[15px] leading-[1.65] text-[var(--text-primary)]"
              />
            </div>
          </div>
        );
      }

      case "code": {
        const language = block.props?.language || "typescript";
        return (
          <div
            className="my-3 overflow-hidden border border-[var(--border-subtle)] bg-[#F6F5F1] dark:bg-[#111211]"
            style={{ borderRadius: 16, boxShadow: "var(--shadow-sm)" }}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]/45 px-3.5 py-2 text-xs text-[var(--text-muted)]">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </div>
                <select
                  value={language}
                  onChange={(e) => updateProps({ language: e.target.value })}
                  aria-label="Code language"
                  className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1 font-editorial-mono text-[10.5px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] focus:outline-none cursor-pointer"
                >
                  {CODE_LANGUAGES.map((lang) => (
                    <option
                      key={lang}
                      value={lang}
                      className="bg-[var(--bg-elevated)] text-[var(--text-primary)]"
                    >
                      {lang}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[10.5px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Copied
                    </span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy code</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              ref={codeRef}
              value={block.content}
              onChange={(e) =>
                onChangeBlock(block.id, { content: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const target = e.currentTarget;
                  const start = target.selectionStart;
                  const end = target.selectionEnd;
                  const next =
                    block.content.substring(0, start) +
                    "  " +
                    block.content.substring(end);
                  onChangeBlock(block.id, { content: next });
                  requestAnimationFrame(() => {
                    target.selectionStart = target.selectionEnd = start + 2;
                  });
                } else if (
                  e.key === "Backspace" &&
                  block.content.length === 0
                ) {
                  e.preventDefault();
                  onChangeBlock(block.id, { type: "paragraph", content: "" });
                }
              }}
              spellCheck={false}
              placeholder="// Write or paste code here…"
              className="font-editorial-mono block w-full resize-none bg-transparent p-4 text-[13px] leading-[1.7] text-[var(--text-primary)] placeholder:text-[var(--text-faint)]/70 focus:outline-none"
            />
          </div>
        );
      }

      case "divider":
        return (
          <div
            tabIndex={0}
            ref={(el) => registerFocusable(block.id, el)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" || e.key === "Delete") {
                e.preventDefault();
                onDeleteBlock(block.id);
              } else if (e.key === "Enter") {
                e.preventDefault();
                onEnterKey(block.id);
              }
            }}
            className="group/hr my-4 py-3 cursor-pointer focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-[var(--border-subtle)] group-focus/hr:bg-[var(--accent)]/60 transition-colors" />
              <span className="h-1.5 w-1.5 rotate-45 rounded-[2px] border border-[var(--border-strong)] bg-[var(--bg-canvas)] group-focus/hr:border-[var(--accent)] transition-colors" />
              <span className="h-px flex-1 bg-[var(--border-subtle)] group-focus/hr:bg-[var(--accent)]/60 transition-colors" />
            </div>
          </div>
        );

      case "table":
        return (
          <TableBlockView
            props={block.props}
            caption={block.content}
            onUpdateProps={(nextProps) =>
              onChangeBlock(block.id, { props: nextProps })
            }
          />
        );

      case "paragraph":
      default:
        return (
          <EditableLine
            blockId={block.id}
            blockType="paragraph"
            html={block.content}
            placeholder={
              totalBlocks === 1 && index === 0
                ? "Type '/' for commands, or start writing..."
                : "Type '/' for commands..."
            }
            alwaysShowPlaceholder={totalBlocks === 1 && index === 0}
            registerFocusable={registerFocusable}
            onInputHtml={handleTextInput}
            onKeyDown={handleEditableKeyDown}
            className="py-[3px] text-[16px] leading-[1.65] text-[var(--text-primary)]"
          />
        );
    }
  };

  const QUICK_TURN_INTO: Array<{ type: BlockType; label: string }> = [
    { type: "paragraph", label: "Text" },
    { type: "heading1", label: "Heading 1" },
    { type: "heading2", label: "Heading 2" },
    { type: "heading3", label: "Heading 3" },
    { type: "todo", label: "To-do" },
    { type: "bullet", label: "Bullet" },
    { type: "numbered", label: "Numbered" },
    { type: "toggle", label: "Toggle" },
    { type: "quote", label: "Quote" },
    { type: "callout", label: "Callout" },
    { type: "code", label: "Code" },
  ];

  return (
    <div
      ref={wrapperRef}
      id={`block-${block.id}`}
      data-block-id={block.id}
      onDragOver={(e) => {
        if (!draggingBlockId || draggingBlockId === block.id) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        setDropIndicator(e.clientY < midY ? "before" : "after");
      }}
      onDragLeave={() => setDropIndicator(null)}
      onDrop={(e) => {
        e.preventDefault();
        if (draggingBlockId && draggingBlockId !== block.id) {
          onDropOnBlock(block.id, dropIndicator || "after");
        }
        setDropIndicator(null);
      }}
      className={`group/block notez-block-target relative -mx-1 scroll-mt-28 rounded-xl px-1 transition-opacity ${
        draggingBlockId === block.id ? "opacity-40" : "opacity-100"
      }`}
    >
      {/* Drag drop line indicator */}
      {dropIndicator === "before" && (
        <div className="pointer-events-none absolute -top-0.5 right-0 left-0 z-20 h-[2.5px] rounded-full bg-[var(--accent)]" />
      )}
      {dropIndicator === "after" && (
        <div className="pointer-events-none absolute right-0 -bottom-0.5 left-0 z-20 h-[2.5px] rounded-full bg-[var(--accent)]" />
      )}

      {/* Left Gutter Controls (+ and ⋮⋮) */}
      <div
        className={`absolute -left-[3.1rem] top-0.5 flex items-center gap-0.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/95 px-0.5 py-0.5 shadow-[var(--shadow-sm)] backdrop-blur-sm select-none transition-opacity max-sm:hidden ${
          menuOpen
            ? "opacity-100"
            : "opacity-0 group-hover/block:opacity-100 focus-within:opacity-100"
        }`}
      >
        <button
          type="button"
          title="Click to add block below"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            onInsertBelowAndSlash(block.id, {
              top: rect.top,
              left: rect.left + 44,
              bottom: rect.bottom,
            });
          }}
          className="flex h-6 w-5 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", block.id);
              onDragStartBlock(block.id);
            }}
            onClick={() => setMenuOpen((prev) => !prev)}
            title="Drag to move • Click for block options"
            className="flex h-6 w-5 cursor-grab active:cursor-grabbing items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition-colors"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>

          {menuOpen && (
            <div className="notez-popover absolute top-8 left-0 z-40 w-60 p-2" style={{ borderRadius: 14 }}>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Turn into
              </div>
              <div className="grid grid-cols-2 gap-0.5 px-1 pb-1.5">
                {QUICK_TURN_INTO.map((opt) => (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      const nextProps: BlockProps = { ...block.props };
                      if (opt.type === "callout" && !nextProps.icon) {
                        nextProps.icon = "💡";
                        nextProps.tone = "indigo";
                      }
                      if (opt.type === "code" && !nextProps.language) {
                        nextProps.language = "typescript";
                      }
                      onChangeBlock(block.id, {
                        type: opt.type,
                        props: nextProps,
                      });
                      setMenuOpen(false);
                    }}
                    className={`rounded-md px-2 py-1 text-left text-xs transition-colors ${
                      block.type === opt.type
                        ? "bg-[var(--accent-soft)] font-medium text-[var(--accent)]"
                        : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {block.type === "callout" && (
                <>
                  <div className="my-1 border-t border-[var(--border-subtle)]" />
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                    Callout Tone
                  </div>
                  <div className="flex items-center gap-1.5 px-2 pb-1.5">
                    {(Object.keys(CALLOUT_TONES) as CalloutTone[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        title={CALLOUT_TONES[t].label}
                        onClick={() => {
                          updateProps({ tone: t });
                          setMenuOpen(false);
                        }}
                        className={`h-5 w-5 rounded-full ${CALLOUT_TONES[t].swatch} ring-offset-2 ring-offset-[var(--bg-elevated)] ${
                          (block.props?.tone || "indigo") === t
                            ? "ring-2 ring-[var(--text-primary)]"
                            : "opacity-75 hover:opacity-100"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}

              <div className="my-1 border-t border-[var(--border-subtle)]" />

              <button
                type="button"
                onClick={() => {
                  onDuplicateBlock(block.id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                <Files className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <span>Duplicate</span>
              </button>

              <button
                type="button"
                disabled={index === 0}
                onClick={() => {
                  onMoveBlockOffset(block.id, -1);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-35"
              >
                <ArrowUp className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <span>Move up</span>
              </button>

              <button
                type="button"
                disabled={index === totalBlocks - 1}
                onClick={() => {
                  onMoveBlockOffset(block.id, 1);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-35"
              >
                <ArrowDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <span>Move down</span>
              </button>

              <div className="my-1 border-t border-[var(--border-subtle)]" />

              <button
                type="button"
                onClick={() => {
                  onDeleteBlock(block.id);
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete block</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Block Content */}
      <div className="min-w-0">{renderBlockContent()}</div>
    </div>
  );
}
