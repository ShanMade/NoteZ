"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, AudioLines, CornerDownLeft, FileSearch, Plus, Search, Sparkles, X } from "lucide-react";
import type { WorkspaceDocument } from "@/types/workspace";
import { plainTextFromHtml } from "@/lib/markdown";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";
import { DocumentIcon } from "./Brand";

interface Props {
  documents: WorkspaceDocument[];
  onClose: () => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onAI: () => void;
  onVoice: () => void;
}

type SearchEntry =
  | { kind: "note"; id: string; document: WorkspaceDocument; snippet: string }
  | { kind: "action"; id: string; label: string; description: string; icon: typeof Plus; run: () => void };

function noteExcerpt(doc: WorkspaceDocument, query: string): string {
  const texts = doc.blocks.map((block) => plainTextFromHtml(block.content)).filter(Boolean);
  const needle = query.trim().toLocaleLowerCase();
  const match = needle ? texts.find((text) => text.toLocaleLowerCase().includes(needle)) : undefined;
  const text = match || texts[0] || "An empty page, ready for your ideas.";
  if (!needle || !match) return text.length > 105 ? `${text.slice(0, 105).trimEnd()}…` : text;
  const index = text.toLocaleLowerCase().indexOf(needle);
  const start = Math.max(0, index - 42);
  const end = Math.min(text.length, index + needle.length + 65);
  return `${start ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const index = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (index < 0) return <>{text}</>;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + needle.length)}</mark>{text.slice(index + needle.length)}</>;
}

export function WorkspaceSearch({ documents, onClose, onOpen, onCreate, onAI, onVoice }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useOverlayFocus(true, dialogRef, onClose, inputRef);

  const { notes, actions, entries } = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const notes: SearchEntry[] = documents
      .filter((doc) => !doc.isArchived)
      .map((document) => {
        const title = (document.title || "Untitled").toLocaleLowerCase();
        const tags = (document.tags || []).join(" ").toLocaleLowerCase();
        const content = document.blocks.map((block) => plainTextFromHtml(block.content)).join(" ").toLocaleLowerCase();
        const matches = !needle || title.includes(needle) || tags.includes(needle) || content.includes(needle);
        const relevance = !needle ? 0 : title.startsWith(needle) ? 3 : title.includes(needle) ? 2 : 1;
        return { document, matches, relevance };
      })
      .filter((entry) => entry.matches)
      .sort((a, b) => b.relevance - a.relevance || b.document.updatedAt.localeCompare(a.document.updatedAt))
      .slice(0, 8)
      .map(({ document }) => ({ kind: "note", id: document.id, document, snippet: noteExcerpt(document, query) }));

    const allActions: SearchEntry[] = [
      { kind: "action", id: "new", label: "Create a new note", description: "Start with a blank page", icon: Plus, run: onCreate },
      { kind: "action", id: "ai", label: "Ask ByNote AI", description: "Think, write, and explore your notes", icon: Sparkles, run: onAI },
      { kind: "action", id: "voice", label: "Open voice studio", description: "Capture a thought or conversation", icon: AudioLines, run: onVoice },
    ];
    const actions = allActions.filter((entry) => entry.kind === "action" && (!needle || `${entry.label} ${entry.description}`.toLocaleLowerCase().includes(needle)));
    return { notes, actions, entries: [...notes, ...actions] };
  }, [documents, query, onCreate, onAI, onVoice]);

  useEffect(() => { setSelected(0); }, [query]);
  useEffect(() => {
    const active = dialogRef.current?.querySelector<HTMLElement>(`[data-search-index="${selected}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const run = (entry: SearchEntry | undefined) => {
    if (!entry) return;
    onClose();
    if (entry.kind === "note") onOpen(entry.document.id);
    else entry.run();
  };

  const renderEntry = (entry: SearchEntry, index: number) => {
    const active = index === selected;
    return (
      <button
        key={`${entry.kind}-${entry.id}`}
        type="button"
        id={`notez-search-result-${index}`}
        data-search-index={index}
        role="option"
        aria-selected={active}
        className={`nz3-search-item ${active ? "is-selected" : ""}`}
        onMouseEnter={() => setSelected(index)}
        onClick={() => run(entry)}
      >
        <span className={`nz3-search-item-icon ${entry.kind === "action" ? "is-action" : ""}`}>
          {entry.kind === "note" ? <DocumentIcon icon={entry.document.icon} size={17} /> : <entry.icon size={17} />}
        </span>
        <span className="nz3-search-item-copy">
          <strong><Highlight text={entry.kind === "note" ? entry.document.title || "Untitled" : entry.label} query={query} /></strong>
          <small><Highlight text={entry.kind === "note" ? entry.snippet : entry.description} query={query} /></small>
        </span>
        {entry.kind === "note" && <span className="nz3-search-item-kind">Page</span>}
        {active && <CornerDownLeft size={15} className="nz3-search-enter" />}
      </button>
    );
  };

  return (
    <div className="nz3-overlay nz3-search-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        className="nz3-search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nz3-search-title"
        aria-describedby="nz3-search-description"
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); if (entries.length) setSelected((selected + 1) % entries.length); }
          else if (event.key === "ArrowUp") { event.preventDefault(); if (entries.length) setSelected((selected - 1 + entries.length) % entries.length); }
          else if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); run(entries[selected]); }
        }}
      >
        <span className="nz-visually-hidden" id="nz3-search-title">Search your workspace</span>
        <span className="nz-visually-hidden" id="nz3-search-description">Search pages or choose a quick action. Use the arrow keys to navigate.</span>
        <div className="nz3-search-topline"><span><Sparkles size={13} /> QUICK FIND</span><button type="button" onClick={onClose} aria-label="Close search"><X size={17} /></button></div>
        <div className="nz3-search-input-wrap">
          <Search size={21} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes and actions..."
            aria-label="Search notes and actions"
            aria-autocomplete="list"
            aria-controls="nz3-search-list"
            aria-activedescendant={entries.length ? `notez-search-result-${selected}` : undefined}
          />
          <kbd>ESC</kbd>
        </div>
        <div className="nz3-search-results" id="nz3-search-list" role="listbox" aria-label="Search results">
          {notes.length > 0 && <><div className="nz3-search-label"><span>{query.trim() ? "MATCHING NOTES" : "RECENT NOTES"}</span><span>{notes.length}</span></div>{notes.map((entry, index) => renderEntry(entry, index))}</>}
          {actions.length > 0 && <><div className="nz3-search-label"><span>QUICK ACTIONS</span></div>{actions.map((entry, index) => renderEntry(entry, notes.length + index))}</>}
          {entries.length === 0 && <div className="nz3-search-empty"><span><FileSearch size={22} /></span><strong>No results for “{query}”</strong><p>Try another word, a note title, or a tag.</p><button type="button" onClick={() => setQuery("")}>Clear search <ArrowRight size={14} /></button></div>}
        </div>
        <div className="nz3-search-footer"><span><kbd><ArrowUp size={11} /></kbd><kbd><ArrowDown size={11} /></kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span className="nz3-search-footer-note">Searches titles, content and tags</span></div>
      </div>
    </div>
  );
}
