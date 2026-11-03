"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUp,
  BookOpen,
  Check,
  Compass,
  Copy,
  FileText,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  Mic,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { AiScope, AssistantHistoryItem, AssistantResult, ProviderStatus, WorkspaceDocument } from "@/types/workspace";
import { plainTextFromHtml } from "@/lib/markdown";
import { formatRelativeTime } from "@/lib/format";
import { newId } from "@/lib/ids";
import { NoteZMark } from "./Brand";
import { collectTasks } from "./WorkspaceTasks";

interface Props {
  documents: WorkspaceDocument[];
  currentDoc: WorkspaceDocument | null;
  provider: ProviderStatus;
  runs: AssistantHistoryItem[];
  defaultScope: AiScope;
  initialPrompt: string;
  onRunsChange: (updater: (prev: AssistantHistoryItem[]) => AssistantHistoryItem[]) => void;
  onOpen: (id: string) => void;
  onCreate: (result: AssistantResult) => void;
  onAppend: (result: AssistantResult) => void;
  onVoice: () => void;
  onSettings: () => void;
  onNotice: (message: string) => void;
}

const SUGGESTIONS: Array<{ icon: LucideIcon; title: string; detail: string; prompt: string; scope: AiScope }> = [
  {
    icon: ListChecks,
    title: "Pull out my open tasks",
    detail: "Everything unfinished across your notes, grouped by page.",
    prompt: "List my open tasks across all notes, grouped by note, and suggest what to tackle first.",
    scope: "workspace",
  },
  {
    icon: FileText,
    title: "Summarize this note",
    detail: "Key points and decisions in a few lines.",
    prompt: "Summarize this note with the key points and any decisions that were made.",
    scope: "current",
  },
  {
    icon: Compass,
    title: "Plan my week",
    detail: "Priorities drawn from your notes and tasks.",
    prompt: "Using my notes and open tasks, draft a simple plan for this week with clear priorities.",
    scope: "workspace",
  },
  {
    icon: Pencil,
    title: "Draft something new",
    detail: "Start a fresh outline from a rough idea.",
    prompt: "Help me draft a clear first version of a note about: ",
    scope: "none",
  },
];

const SCOPES: Array<{ id: AiScope; label: string }> = [
  { id: "none", label: "No notes" },
  { id: "current", label: "This note" },
  { id: "workspace", label: "All notes" },
];

function AnswerText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim());
  return (
    <div className="nz2-answer">
      {paragraphs.map((para, i) => {
        const lines = para.split("\n").filter((l) => l.trim());
        const listRe = /^\s*([-•*]|\d+[.)])\s+/;
        if (lines.length && lines.every((l) => listRe.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{l.replace(listRe, "")}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{para}</p>;
      })}
    </div>
  );
}

function Exchange({
  run,
  currentDoc,
  onOpen,
  onCreate,
  onAppend,
  onNotice,
}: {
  run: AssistantHistoryItem;
  currentDoc: WorkspaceDocument | null;
  onOpen: (id: string) => void;
  onCreate: (result: AssistantResult) => void;
  onAppend: (result: AssistantResult) => void;
  onNotice: (message: string) => void;
}) {
  const result: AssistantResult = { answer: run.answer, title: run.title, blocks: run.blocks, sources: run.sources };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(run.answer);
      onNotice("Answer copied");
    } catch {
      onNotice("Clipboard is unavailable");
    }
  };
  return (
    <>
      <div className="nz2-msg-user">
        <div className="nz2-bubble">{run.prompt}</div>
      </div>
      <div className="nz2-msg-ai">
        <span className="nz2-msg-avatar">
          <NoteZMark size={22} />
        </span>
        <div className="nz2-msg-body">
          <div className="nz2-msg-meta">
            <strong>NoteZ AI</strong>
            <span>
              {run.provider === "gemini" ? "Gemini" : "Basic mode"} · {formatRelativeTime(run.createdAt)}
            </span>
          </div>
          <AnswerText text={run.answer} />
          {run.sources.length > 0 && (
            <div className="nz2-sources">
              <span>Based on</span>
              {run.sources.map((s) => (
                <button key={s.id} type="button" className="nz2-source" onClick={() => onOpen(s.id)}>
                  <FileText size={13} /> {s.title}
                </button>
              ))}
            </div>
          )}
          {run.blocks.length > 0 && (
            <div className="nz2-draft">
              <div className="nz2-draft-head">
                <FileText size={15} />
                <strong>{run.title || "Suggested draft"}</strong>
                <span>{run.blocks.length} blocks</span>
              </div>
              <ul className="nz2-draft-list">
                {run.blocks.slice(0, 6).map((b, i) => (
                  <li key={i} className={b.type.startsWith("heading") ? "is-heading" : ""}>
                    {b.type === "todo" ? "☐ " : ""}
                    {plainTextFromHtml(b.content)}
                  </li>
                ))}
                {run.blocks.length > 6 && <li className="is-more">+{run.blocks.length - 6} more</li>}
              </ul>
              <p className="nz2-draft-note">Nothing changes until you choose one of these.</p>
              <div className="nz2-draft-actions">
                <button type="button" className="nz2-btn nz2-btn-primary nz2-btn-sm" onClick={() => onCreate(result)}>
                  <Plus size={14} /> Create as new note
                </button>
                <button
                  type="button"
                  className="nz2-btn nz2-btn-soft nz2-btn-sm"
                  disabled={!currentDoc}
                  onClick={() => onAppend(result)}
                >
                  Add to current note
                </button>
              </div>
            </div>
          )}
          <div className="nz2-msg-tools">
            <button type="button" onClick={copy}>
              <Copy size={13} /> Copy answer
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function WorkspaceAI({
  documents,
  currentDoc,
  provider,
  runs,
  defaultScope,
  initialPrompt,
  onRunsChange,
  onOpen,
  onCreate,
  onAppend,
  onVoice,
  onSettings,
  onNotice,
}: Props) {
  const [threadId, setThreadId] = useState<string>(() => newId());
  const [scope, setScope] = useState<AiScope>(defaultScope);
  const [prompt, setPrompt] = useState(initialPrompt);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const effectiveScope: AiScope = scope === "current" && !currentDoc ? "workspace" : scope;

  useEffect(() => {
    if (initialPrompt) setPrompt(initialPrompt);
  }, [initialPrompt]);

  const threads = useMemo(() => {
    const map = new Map<string, AssistantHistoryItem[]>();
    for (const run of runs) {
      const key = run.threadId || run.id;
      map.set(key, [...(map.get(key) ?? []), run]);
    }
    return Array.from(map.entries())
      .map(([id, items]) => {
        const ordered = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        return {
          id,
          items: ordered,
          title: ordered[0]?.prompt ?? "Conversation",
          updatedAt: ordered[ordered.length - 1]?.createdAt ?? "",
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [runs]);

  const current = threads.find((t) => t.id === threadId)?.items ?? [];
  const visibleThreads = threads.filter((t) => !search.trim() || t.title.toLowerCase().includes(search.trim().toLowerCase()));
  const openTaskCount = useMemo(() => collectTasks(documents).filter((t) => !t.checked).length, [documents]);
  const noteCount = documents.filter((d) => !d.isArchived).length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [current.length, pending]);

  async function send(text?: string, nextScope?: AiScope) {
    const content = (text ?? prompt).trim();
    if (content.length < 3 || pending) return;
    const useScope = nextScope ?? effectiveScope;
    const resolvedScope: AiScope = useScope === "current" && !currentDoc ? "workspace" : useScope;
    setPending(content);
    setPrompt("");
    setError("");
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: content,
          scope: resolvedScope,
          documentId: currentDoc?.id ?? null,
          threadId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      onRunsChange((prev) => [data.run as AssistantHistoryItem, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPrompt(content);
    } finally {
      setPending(null);
    }
  }

  function runSuggestion(item: (typeof SUGGESTIONS)[number]) {
    setScope(item.scope);
    if (item.prompt.endsWith(": ")) {
      setPrompt(item.prompt);
      return;
    }
    void send(item.prompt, item.scope);
  }

  function newChat() {
    setThreadId(newId());
    setPrompt("");
    setError("");
  }

  async function removeThread(id: string) {
    if (!window.confirm("Delete this conversation? This can't be undone.")) return;
    const res = await fetch(`/api/assistant/threads/${id}`, { method: "DELETE" });
    if (res.ok) {
      onRunsChange((prev) => prev.filter((r) => (r.threadId || r.id) !== id));
      if (threadId === id) setThreadId(newId());
      onNotice("Conversation deleted");
    } else {
      onNotice("Couldn't delete this conversation");
    }
  }

  const hasMessages = current.length > 0 || Boolean(pending);

  return (
    <div className="nz2-ai">
      <aside className="nz2-ai-threads" aria-label="Conversations">
        <div className="nz2-threads-head">
          <strong>Conversations</strong>
          <button type="button" className="nz2-btn nz2-btn-primary nz2-btn-sm" onClick={newChat}>
            <Plus size={14} /> New
          </button>
        </div>
        <label className="nz2-search-field">
          <Search size={14} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search chats" />
        </label>
        <div className="nz2-thread-list">
          {visibleThreads.length === 0 && <p className="nz2-empty-small">{threads.length ? "No matches." : "No conversations yet."}</p>}
          {visibleThreads.map((t) => (
            <div key={t.id} className={`nz2-thread-item ${t.id === threadId ? "is-active" : ""}`}>
              <button
                type="button"
                className="nz2-thread-main"
                onClick={() => {
                  setThreadId(t.id);
                  setError("");
                }}
              >
                <span className="nz2-thread-title">{t.title}</span>
                <small>
                  {formatRelativeTime(t.updatedAt)} · {t.items.length} {t.items.length === 1 ? "message" : "messages"}
                </small>
              </button>
              <button type="button" className="nz2-thread-del" aria-label="Delete conversation" onClick={() => void removeThread(t.id)}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="nz2-ai-chat">
        <div className="nz2-ai-scroll" ref={scrollRef}>
          <div className="nz2-ai-inner">
            {!hasMessages ? (
              <div className="nz2-ai-welcome">
                <span className="nz2-ai-orb">
                  <Sparkles size={22} />
                </span>
                <h1 className="nz2-title">What would you like to work out?</h1>
                <p className="nz2-sub">
                  Ask about your notes, pull out tasks, or draft something new. NoteZ AI only uses what you share with it.
                </p>
                <div className="nz2-suggest-grid">
                  {SUGGESTIONS.map((item) => (
                    <button key={item.title} type="button" className="nz2-suggest" onClick={() => runSuggestion(item)}>
                      <span className="nz2-suggest-icon">
                        <item.icon size={18} />
                      </span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {current.map((run) => (
                  <Exchange
                    key={run.id}
                    run={run}
                    currentDoc={currentDoc}
                    onOpen={onOpen}
                    onCreate={onCreate}
                    onAppend={onAppend}
                    onNotice={onNotice}
                  />
                ))}
                {pending && (
                  <>
                    <div className="nz2-msg-user">
                      <div className="nz2-bubble">{pending}</div>
                    </div>
                    <div className="nz2-msg-ai">
                      <span className="nz2-msg-avatar">
                        <NoteZMark size={22} />
                      </span>
                      <div className="nz2-thinking" aria-label="Thinking">
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
            {error && (
              <div className="nz-error" role="alert">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="nz2-composer-wrap">
          <div className="nz2-composer">
            <textarea
              value={prompt}
              rows={2}
              placeholder="Ask about your notes, or describe what you want to draft…"
              aria-label="Message NoteZ AI"
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="nz2-composer-bar">
              <div className="nz2-seg nz2-seg-sm" role="radiogroup" aria-label="Context">
                {SCOPES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={effectiveScope === s.id}
                    className={effectiveScope === s.id ? "is-on" : ""}
                    disabled={s.id === "current" && !currentDoc}
                    onClick={() => setScope(s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <span className="nz2-kbd-hint">⌘ Enter to send</span>
              <button
                type="button"
                className="nz2-send"
                disabled={!prompt.trim() || Boolean(pending)}
                onClick={() => void send()}
                aria-label="Send"
              >
                {pending ? <LoaderCircle size={16} className="nz-spin" /> : <ArrowUp size={17} />}
              </button>
            </div>
          </div>
          <p className="nz2-composer-note">
            <LockKeyhole size={12} /> Selected notes are shared with the model for this reply only. Nothing changes without your approval.
          </p>
        </div>
      </section>

      <aside className="nz2-ai-insp" aria-label="Context and settings">
        <div className="nz2-insp-card">
          <div className="nz2-insp-title">
            <BookOpen size={15} /> What NoteZ AI can see
          </div>
          <ul className="nz2-insp-list">
            <li>
              <Check size={13} />
              {effectiveScope === "none"
                ? "No notes for this message"
                : effectiveScope === "current"
                  ? `“${currentDoc?.title || "Untitled"}”`
                  : `Your ${noteCount} notes (the most relevant are chosen)`}
            </li>
            <li>
              <Check size={13} />
              {openTaskCount} open {openTaskCount === 1 ? "task" : "tasks"} when you ask about them
            </li>
            <li>
              <Check size={13} />
              Voice transcripts you save
            </li>
          </ul>
        </div>
        <div className="nz2-insp-card">
          <div className="nz2-insp-title">
            <Sparkles size={15} /> Model
          </div>
          <p className="nz2-insp-text">
            {provider.configured ? `Gemini · ${provider.model}` : "Basic mode. Add GEMINI_API_KEY on the server to unlock generated answers."}
          </p>
          <button type="button" className="nz2-link" onClick={onSettings}>
            Manage in Settings
          </button>
        </div>
        <div className="nz2-insp-card">
          <div className="nz2-insp-title">
            <Mic size={15} /> Ideas sound better out loud
          </div>
          <p className="nz2-insp-text">Record a meeting and get a summary, decisions, and action items.</p>
          <button type="button" className="nz2-btn nz2-btn-soft nz2-btn-sm" onClick={onVoice}>
            Open voice notes
          </button>
        </div>
      </aside>
    </div>
  );
}
