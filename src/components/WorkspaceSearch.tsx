"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  AudioLines,
  Check,
  CornerDownLeft,
  Database,
  FileText,
  LoaderCircle,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { WorkspaceDocument } from "@/types/workspace";
import { formatRelativeTime } from "@/lib/format";
import { DocumentIcon } from "./Brand";

type HitType = "note" | "voice" | "ai";
type Filter = "all" | HitType;
type Scope = "all" | "note";

interface ApiHit {
  id: string;
  sourceType: HitType;
  sourceId: string;
  documentId: string | null;
  title: string;
  snippet: string;
  chunkIndex: number;
  score: number;
  keywordScore: number;
  backend: "qdrant" | "postgres";
  updatedAt: string;
  targetId: string | null;
  documentTitle: string | null;
  documentIcon: string | null;
}

interface Props {
  documents: WorkspaceDocument[];
  currentDoc: WorkspaceDocument | null;
  onClose: () => void;
  onOpen: (id: string) => void;
  onCreate: () => void;
  onAI: () => void;
  onVoice: () => void;
}

const FILTERS: Array<{ id: Filter; label: string; icon: typeof FileText }> = [
  { id: "all", label: "Everything", icon: Search },
  { id: "note", label: "Notes", icon: FileText },
  { id: "voice", label: "Voice", icon: AudioLines },
  { id: "ai", label: "AI answers", icon: Sparkles },
];

export function WorkspaceSearch({ documents, currentDoc, onClose, onOpen, onCreate, onAI, onVoice }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [scope, setScope] = useState<Scope>("all");
  const [hits, setHits] = useState<ApiHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState<{ backend?: string; embedding?: string; elapsedMs?: number; mode?: string } | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!currentDoc && scope === "note") setScope("all");
  }, [currentDoc, scope]);

  const runSearch = useCallback(
    async (text: string, nextFilter: Filter, nextScope: Scope) => {
      if (text.trim().length < 2) {
        setHits([]);
        setMeta(null);
        setLoading(false);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ q: text.trim(), limit: "24" });
        if (nextScope === "note" && currentDoc) {
          params.set("scope", "note");
          params.set("documentId", currentDoc.id);
        }
        if (nextFilter !== "all") params.set("types", nextFilter);
        const res = await fetch(`/api/search?${params.toString()}`, { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Search is unavailable right now.");
        setHits((data.hits ?? []) as ApiHit[]);
        setMeta({ backend: data.backend, embedding: data.embedding, elapsedMs: data.elapsedMs, mode: data.mode });
        setSelected(0);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Search failed.");
        setHits([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [currentDoc]
  );

  useEffect(() => {
    const timer = setTimeout(() => void runSearch(query, filter, scope), 220);
    return () => clearTimeout(timer);
  }, [query, filter, scope, runSearch]);

  const shortcuts = useMemo(
    () => [
      { label: "Create a new page", icon: Plus, run: onCreate },
      { label: "Ask NoteZ AI", icon: Sparkles, run: onAI },
      { label: "Open voice studio", icon: AudioLines, run: onVoice },
    ],
    [onCreate, onAI, onVoice]
  );

  const shownActions = query.trim().length < 2 ? shortcuts : [];
  const total = hits.length + shownActions.length;

  function openHit(hit: ApiHit) {
    if (hit.sourceType === "voice") {
      onVoice();
    } else if (hit.sourceType === "ai") {
      onAI();
    } else if (hit.targetId) {
      onOpen(hit.targetId);
    }
    onClose();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (total) setSelected((v) => (v + 1) % total);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (total) setSelected((v) => (v - 1 + total) % total);
    } else if (event.key === "Enter" && total) {
      event.preventDefault();
      if (selected < hits.length) openHit(hits[selected]);
      else shownActions[selected - hits.length]?.run();
    }
  }

  const backendLabel =
    meta?.mode === "keyword"
      ? "Keyword · Postgres"
      : meta?.backend === "qdrant"
        ? "Semantic · Qdrant"
        : meta?.backend === "postgres"
          ? "Semantic · Postgres index"
          : "";

  return (
    <div className="nz3-search-overlay" onMouseDown={onClose}>
      <div
        className="nz3-search"
        role="dialog"
        aria-modal="true"
        aria-label="Search workspace"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="nz3-search-top">
          <Search size={18} className="nz3-search-glyph" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={scope === "note" ? `Search in “${currentDoc?.title || "this note"}”…` : "Search notes, voice notes, and AI answers…"}
            aria-label="Search query"
          />
          {loading && <LoaderCircle size={16} className="nz-spin nz3-search-spin" />}
          <button type="button" className="nz3-key" onClick={onClose} aria-label="Close search">
            ESC
          </button>
        </div>

        <div className="nz3-search-scopes">
          <div className="nz3-chip-row" role="tablist" aria-label="Result type">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={`nz3-chip ${filter === f.id ? "is-on" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                <f.icon size={13} />
                {f.label}
              </button>
            ))}
          </div>
          {currentDoc && (
            <div className="nz3-scope-toggle" role="group" aria-label="Search scope">
              <button type="button" className={scope === "all" ? "is-on" : ""} onClick={() => setScope("all")}>
                Whole workspace
              </button>
              <button type="button" className={scope === "note" ? "is-on" : ""} onClick={() => setScope("note")}>
                This note
              </button>
            </div>
          )}
        </div>

        <div className="nz3-search-results">
          {query.trim().length >= 2 && (
            <div className="nz3-results-head">
              <span>
                {loading && !hits.length
                  ? "Searching…"
                  : `${hits.length} ${hits.length === 1 ? "result" : "results"}`}
                {scope === "note" ? " in this note" : ""}
              </span>
              {backendLabel && (
                <span className="nz3-backend">
                  <Database size={11} /> {backendLabel}
                  {typeof meta?.elapsedMs === "number" ? ` · ${meta.elapsedMs}ms` : ""}
                </span>
              )}
            </div>
          )}

          {error && <div className="nz3-search-error">{error}</div>}

          {hits.map((hit, index) => (
            <button
              key={`${hit.id}-${hit.sourceType}`}
              type="button"
              className={`nz3-hit ${selected === index ? "is-selected" : ""}`}
              onMouseEnter={() => setSelected(index)}
              onClick={() => openHit(hit)}
            >
              <span className={`nz3-hit-icon is-${hit.sourceType}`}>
                {hit.sourceType === "note" ? (
                  <DocumentIcon icon={hit.documentIcon || "file"} size={16} />
                ) : hit.sourceType === "voice" ? (
                  <AudioLines size={16} />
                ) : (
                  <Sparkles size={16} />
                )}
              </span>
              <span className="nz3-hit-body">
                <span className="nz3-hit-title">
                  {hit.sourceType === "note" ? hit.title : hit.title || hit.documentTitle || "Untitled"}
                  <em className={`nz3-tag is-${hit.sourceType}`}>
                    {hit.sourceType === "note" ? "Note" : hit.sourceType === "voice" ? "Voice" : "AI"}
                  </em>
                  {hit.score >= 0.55 && <em className="nz3-tag is-strong">Strong match</em>}
                </span>
                <span className="nz3-hit-snippet">{hit.snippet || "No preview available."}</span>
                <span className="nz3-hit-meta">
                  {hit.sourceType !== "note" && hit.documentTitle ? `${hit.documentTitle} · ` : ""}
                  {formatRelativeTime(hit.updatedAt)}
                </span>
              </span>
              {selected === index && <CornerDownLeft size={14} className="nz3-hit-enter" />}
            </button>
          ))}

          {!loading && !error && query.trim().length >= 2 && hits.length === 0 && (
            <div className="nz3-search-empty">
              <span>
                <Search size={20} />
              </span>
              <strong>No matches for “{query.trim()}”</strong>
              <p>
                Semantic search looks for meaning as well as words. Try a different phrase, or widen the filters.
              </p>
            </div>
          )}

          {query.trim().length < 2 && shownActions.length > 0 && (
            <>
              <div className="nz3-results-head">
                <span>Quick actions</span>
              </div>
              {shownActions.map((action, i) => (
                <button
                  key={action.label}
                  type="button"
                  className={`nz3-hit ${selected === i ? "is-selected" : ""}`}
                  onMouseEnter={() => setSelected(i)}
                  onClick={() => {
                    action.run();
                    onClose();
                  }}
                >
                  <span className="nz3-hit-icon is-action">
                    <action.icon size={16} />
                  </span>
                  <span className="nz3-hit-body">
                    <span className="nz3-hit-title">{action.label}</span>
                  </span>
                  <ArrowUpRight size={14} />
                </button>
              ))}
              <div className="nz3-search-hint">
                <Sparkles size={12} /> Ask in plain language — “what did we decide about launch dates?” works too.
              </div>
            </>
          )}
        </div>

        <div className="nz3-search-foot">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> navigate
          </span>
          <span>
            <kbd>↵</kbd> open
          </span>
          <span>
            <kbd>esc</kbd> close
          </span>
          <span className="nz3-foot-right">
            <Check size={11} /> Only your own content is searched
          </span>
        </div>
      </div>
    </div>
  );
}

export function MobileTabBar({
  view,
  onView,
  onSearch,
  onMore,
  onCreate,
}: {
  view: string;
  onView: (view: "home" | "notes" | "ai" | "voice") => void;
  onSearch: () => void;
  onMore: () => void;
  onCreate: () => void;
}) {
  const tabs: Array<{ id: "home" | "notes" | "ai" | "voice"; label: string; icon: typeof FileText }> = [
    { id: "home", label: "Home", icon: ArrowUpRight },
    { id: "notes", label: "Notes", icon: FileText },
    { id: "ai", label: "AI", icon: Sparkles },
    { id: "voice", label: "Voice", icon: AudioLines },
  ];
  void onCreate;
  return (
    <nav className="nz3-tabbar" aria-label="Primary">
      {tabs.slice(0, 2).map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={view === tab.id ? "is-on" : ""}
          onClick={() => onView(tab.id)}
          aria-current={view === tab.id ? "page" : undefined}
        >
          {tab.id === "home" ? <HouseIcon /> : <tab.icon size={19} />}
          <span>{tab.label}</span>
        </button>
      ))}
      <button type="button" className="nz3-tab-search" onClick={onSearch} aria-label="Search">
        <Search size={20} />
      </button>
      {tabs.slice(2).map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={view === tab.id ? "is-on" : ""}
          onClick={() => onView(tab.id)}
          aria-current={view === tab.id ? "page" : undefined}
        >
          <tab.icon size={19} />
          <span>{tab.label}</span>
        </button>
      ))}
      <button type="button" onClick={onMore} aria-label="More">
        <MoreIcon />
        <span>More</span>
      </button>
    </nav>
  );
}

function HouseIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}
