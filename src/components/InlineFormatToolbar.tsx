"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Bold, Italic, Underline, Strikethrough, Code } from "lucide-react";

interface InlineFormatToolbarProps {
  onFormatApplied: () => void;
}

export function InlineFormatToolbar({
  onFormatApplied,
}: InlineFormatToolbarProps) {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );

  const updateSelectionPosition = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setCoords(null);
      return;
    }

    const text = sel.toString().trim();
    if (!text) {
      setCoords(null);
      return;
    }

    const anchorNode = sel.anchorNode;
    const parentEl =
      anchorNode?.nodeType === Node.ELEMENT_NODE
        ? (anchorNode as HTMLElement)
        : anchorNode?.parentElement;

    const editableContainer = parentEl?.closest(".notez-editable");
    if (!editableContainer) {
      setCoords(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setCoords(null);
      return;
    }

    setCoords({
      top: Math.max(12, rect.top - 44),
      left: Math.min(
        Math.max(16, rect.left + rect.width / 2 - 92),
        window.innerWidth - 200
      ),
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateSelectionPosition);
    window.addEventListener("scroll", updateSelectionPosition, true);
    return () => {
      document.removeEventListener("selectionchange", updateSelectionPosition);
      window.removeEventListener("scroll", updateSelectionPosition, true);
    };
  }, [updateSelectionPosition]);

  const applyCommand = (cmd: string) => {
    document.execCommand(cmd, false);
    onFormatApplied();
    updateSelectionPosition();
  };

  const applyInlineCode = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

    const range = sel.getRangeAt(0);
    const parentTag = range.commonAncestorContainer.parentElement;

    if (parentTag && parentTag.tagName === "CODE") {
      // Unwrap existing code tag
      const textNode = document.createTextNode(parentTag.textContent || "");
      parentTag.replaceWith(textNode);
    } else {
      const selectedText = range.toString();
      const codeEl = document.createElement("code");
      codeEl.textContent = selectedText;
      range.deleteContents();
      range.insertNode(codeEl);
    }

    // Trigger input event on the active editable block so state syncs
    const active = document.activeElement;
    if (active && active.classList.contains("notez-editable")) {
      active.dispatchEvent(new Event("input", { bubbles: true }));
    }
    onFormatApplied();
  };

  if (!coords) return null;

  return (
    <div
      style={{ top: coords.top, left: coords.left, borderRadius: 12 }}
      onMouseDown={(e) => e.preventDefault()}
      className="notez-popover fixed z-50 flex items-center gap-0.5 px-1.5 py-1"
    >
      <button
        type="button"
        onClick={() => applyCommand("bold")}
        title="Bold (⌘B)"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => applyCommand("italic")}
        title="Italic (⌘I)"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => applyCommand("underline")}
        title="Underline (⌘U)"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Underline className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => applyCommand("strikeThrough")}
        title="Strikethrough"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Strikethrough className="h-3.5 w-3.5" />
      </button>
      <div className="mx-0.5 h-4 w-px bg-[var(--border-subtle)]" />
      <button
        type="button"
        onClick={applyInlineCode}
        title="Inline Code"
        className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Code className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
