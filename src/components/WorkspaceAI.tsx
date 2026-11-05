"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUp,
  AudioLines,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Database,
  FilePlus2,
  FileText,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  MessageSquare,
  Mic,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Type,
  Wand2,
  X,
} from "lucide-react";
import type {
  AiScope,
  AiToolName,
  AiToolProposal,
  AssistantHistoryItem,
  AssistantResult,
  ProviderStatus,
  WorkspaceDocument,
} from "@/types/workspace";
import { plainTextFromHtml } from "@/lib/markdown";
import { formatRelativeTime } from "@/lib/format";
import { newId } from "@/lib/ids";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";
import { AssistantText } from "./AssistantText";
import { ConfirmationDialog } from "./ConfirmationDialog";
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
  onApplyProposal: (proposal: AiToolProposal) => Promise<void>;
  onVoice: () => void;
  onSettings: () => void;
  onNotice: (message: string) => void;
}

const SUGGESTIONS: Array<{
  icon: LucideIcon;
  title: string;
  detail: string;
  prompt: string;
  scope: AiScope;
  tool: AiToolName;
}> = [
  {
    icon: Database,
    title: "Find related ideas",
    detail: "Explore relevant notes and conversations in your workspace.",
    prompt: "Search my workspace for notes and ideas related to this.",
    scope: "workspace",
    tool: "qdrant_semantic_search",
  },
  {
    icon: Wand2,
    title: "Improve this writing",
    detail: "Polish the phrasing and structure of the active note.",
    prompt: "Modify and polish this note with clearer structure, headings, and stronger phrasing.",
    scope: "current",
    tool: "modify_note",
  },
  {
    icon: FileText,
    title: "Summarize",
    detail: "Key points and decisions, in a few lines.",
    prompt: "Summarize this note into a concise overview and key takeaways.",
    scope: "current",
    tool: "summarize_note",
  },
  {
    icon: Type,
    title: "Suggest a title",
    detail: "A sharper name for the current page.",
    prompt: "Suggest a sharper, clearer title for this note based on its content.",
    scope: "current",
    tool: "rename_note",
  },
  {
    icon: Copy,
    title: "Create a variation",
    detail: "Turn the note into a new brief or outline.",
    prompt: "Reproduce this note into a structured brief with an action plan.",
    scope: "current",
    tool: "reproduce_note",
  },
  {
    icon: ListChecks,
    title: "Extract action items",
    detail: "Pull every unfinished commitment into one checklist.",
    prompt: "Extract all open tasks and action items across my notes into a checklist.",
    scope: "workspace",
    tool: "extract_tasks",
  },
];

const SCOPES: Array<{ id: AiScope; label: string; short: string }> = [
  { id: "none", label: "No notes", short: "None" },
  { id: "current", label: "Active note", short: "Note" },
  { id: "workspace", label: "All notes", short: "All" },
];

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
  onApplyProposal,
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
  const [appliedIds, setAppliedIds] = useState<Record<string, boolean>>({});
  const [dismissedIds, setDismissedIds] = useState<Record<string, boolean>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLElement>(null);
  const historyCloseRef = useRef<HTMLButtonElement>(null);
  useOverlayFocus(historyOpen, historyRef, () => setHistoryOpen(false), historyCloseRef);

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
  const visibleThreads = threads.filter(
    (t) => !search.trim() || t.title.toLowerCase().includes(search.trim().toLowerCase())
  );
  const openTaskCount = useMemo(
    () => collectTasks(documents).filter((t) => !t.checked).length,
    [documents]
  );
  const noteCount = documents.filter((d) => !d.isArchived && !d.isConfidential).length;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [current.length, pending]);

  async function send(text?: string, nextScope?: AiScope, explicitTool?: AiToolName) {
    const content = (text ?? prompt).trim();
    if (content.length < 2 || pending) return;
    const resolvedScope: AiScope =
      (nextScope ?? effectiveScope) === "current" && !currentDoc ? "workspace" : nextScope ?? effectiveScope;
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
          tool: explicitTool,
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

  async function confirmProposal(proposal: AiToolProposal) {
    setApplyingId(proposal.id);
    setError("");
    try {
      await onApplyProposal(proposal);
      setAppliedIds((prev) => ({ ...prev, [proposal.id]: true }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Couldn't apply those changes.");
    } finally {
      setApplyingId(null);
    }
  }

  function newChat() {
    setThreadId(newId());
    setPrompt("");
    setError("");
    setHistoryOpen(false);
  }

  async function removeThread(id: string) {
    const res = await fetch(`/api/assistant/threads/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Couldn't delete this conversation. Please try again.");
    onRunsChange((prev) => prev.filter((r) => (r.threadId || r.id) !== id));
    if (threadId === id) setThreadId(newId());
    onNotice("Conversation deleted");
  }

  const hasMessages = current.length > 0 || Boolean(pending);

  return (
    <div className="nz2-ai">
      {historyOpen && (
        <button
          type="button"
          className="nz3-ai-history-backdrop"
          onClick={() => setHistoryOpen(false)}
          aria-label="Close conversation history"
          tabIndex={-1}
        />
      )}

      <aside
        ref={historyRef}
        className={`nz2-ai-threads ${historyOpen ? "is-mobile-open" : ""}`}
        aria-label="Conversations"
        role={historyOpen ? "dialog" : undefined}
        aria-modal={historyOpen ? true : undefined}
        tabIndex={historyOpen ? -1 : undefined}
      >
        <div className="nz2-threads-head">
          <strong>Conversations</strong>
          <span className="nz3-thread-head-actions">
            <button type="button" className="ed-btn ed-btn-primary ed-btn-sm" onClick={newChat}>
              <Plus size={13} /> New
            </button>
            <button
              ref={historyCloseRef}
              type="button"
              className="nz3-ai-history-close"
              onClick={() => setHistoryOpen(false)}
              aria-label="Close conversation history"
            >
              <X size={17} />
            </button>
          </span>
        </div>
        <label className="ed-treefilter nz2-thread-filter">
          <Search size={11} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter conversations"
            aria-label="Filter conversations"
          />
        </label>
        <div className="nz2-thread-list">
          {visibleThreads.length === 0 && (
            <p className="ed-side-empty">
              {threads.length ? "No conversations match." : "Your conversations will appear here."}
            </p>
          )}
          {visibleThreads.map((t) => (
            <div key={t.id} className={`nz2-thread-item ${t.id === threadId ? "is-active" : ""}`}>
              <button
                type="button"
                className="nz2-thread-main"
                onClick={() => {
                  setThreadId(t.id);
                  setError("");
                  setHistoryOpen(false);
                }}
              >
                <span className="nz2-thread-title">{t.title}</span>
                <small>
                  {formatRelativeTime(t.updatedAt)} · {t.items.length}{" "}
                  {t.items.length === 1 ? "turn" : "turns"}
                </small>
              </button>
              <button
                type="button"
                className="nz2-thread-del"
                aria-label="Delete conversation"
                onClick={() => setDeleteThreadId(t.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="nz2-ai-chat">
        {/* Actions only — the workspace context strip already names this view */}
        <div className="nz3-ai-mobile-toolbar">
          <button type="button" onClick={() => setHistoryOpen(true)}>
            <MessageSquare size={15} /> History
          </button>
          <button type="button" onClick={newChat} className="nz2-ai-newchat">
            <Plus size={15} /> New chat
          </button>
        </div>

          <div className="nz2-ai-scroll" ref={scrollRef}>
          <div className={`nz2-ai-inner ${!hasMessages ? "is-empty" : ""}`}>
            {!hasMessages ? (
              <div className="nz2-ai-welcome">
                <span className="nz2-ai-orb">
                  <Sparkles size={22} />
                </span>
                <h1 className="nz2-title">What would you like to work on?</h1>
                <p className="nz2-sub">
                  Ask a question, find something in your notes, or shape an idea. Nothing changes
                  until you approve it.
                </p>

                <div className="nz2-suggest-scroll">
                  {(showAllSuggestions ? SUGGESTIONS : SUGGESTIONS.slice(0, 4)).map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      className="nz2-suggest-card"
                      disabled={item.scope === "current" && !currentDoc}
                      title={item.scope === "current" && !currentDoc ? "Open a note to use this" : undefined}
                      onClick={() => {
                        setScope(item.scope);
                        void send(item.prompt, item.scope, item.tool);
                      }}
                    >
                      <span className="nz2-suggest-icon">
                        <item.icon size={17} />
                      </span>
                      <strong>{item.title}</strong>
                      <small>{item.detail}</small>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="nz3-more-ideas"
                  onClick={() => setShowAllSuggestions((value) => !value)}
                >
                  {showAllSuggestions ? "Show less" : "More ideas"} <ChevronRight size={13} />
                </button>
              </div>
            ) : (
              current.map((run) => {
                const proposals: AiToolProposal[] =
                  run.proposals && run.proposals.length > 0
                    ? run.proposals
                    : run.blocks.length > 0
                      ? [
                          {
                            id: `legacy-${run.id}`,
                            tool: (currentDoc ? "append_blocks" : "create_note") as AiToolProposal["tool"],
                            label: currentDoc ? "Add to note" : "Create note",
                            description: currentDoc
                              ? `Add ${run.blocks.length} blocks to “${currentDoc.title || "Untitled"}”.`
                              : `Create “${run.title || "AI note"}” with ${run.blocks.length} blocks.`,
                            targetDocumentId: currentDoc?.id ?? null,
                            targetDocumentTitle: currentDoc?.title ?? run.title,
                            proposedTitle: run.title,
                            proposedBlocks: run.blocks,
                            applyMode: (currentDoc ? "append_blocks" : "create_new_note") as AiToolProposal["applyMode"],
                          },
                        ]
                      : [];

                return (
                  <React.Fragment key={run.id}>
                    <div className="nz2-msg-user">
                      <div className="nz2-bubble">{run.prompt}</div>
                    </div>
                    <div className="nz2-msg-ai">
                      <span className="nz2-msg-avatar">
                        <NoteZMark size={22} />
                      </span>
                      <div className="nz2-msg-body">
                        <div className="nz2-msg-meta">
                          <strong>ByNote AI</strong>
                          <span>
                            {run.provider === "gemini" ? "Gemini" : "Tool engine"} ·{" "}
                            {formatRelativeTime(run.createdAt)}
                          </span>
                        </div>

                        {run.toolCalls && run.toolCalls.length > 0 && (
                          <details className="nz3-tool-details">
                            <summary>
                              <Database size={13} /> Used {run.toolCalls.length}{" "}
                              {run.toolCalls.length === 1 ? "tool" : "tools"}
                              <ChevronDown size={13} />
                            </summary>
                            <ul>
                              {run.toolCalls.map((call) => (
                                <li key={call.id}>
                                  <strong>{call.label}</strong>
                                  <span>{call.detail}</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}

                        <AssistantText text={run.answer} className="nz2-answer" />

                        {run.sources.length > 0 && (
                          <div className="nz2-sources">
                            <span>Sources</span>
                            {run.sources.map((s) =>
                              s.entityType === "voice" ? (
                                <span key={s.id} className="nz2-source">
                                  <AudioLines size={13} /> {s.title}
                                </span>
                              ) : (
                                <button
                                  key={s.id}
                                  type="button"
                                  className="nz2-source"
                                  onClick={() => onOpen(s.id)}
                                >
                                  <FileText size={13} /> {s.title}
                                  {s.similarityScore && (
                                    <em className="nz2-source-score">{s.similarityScore}%</em>
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        )}

                        {proposals.map((prop) => {
                          if (dismissedIds[prop.id]) return null;
                          const applied = Boolean(appliedIds[prop.id]);
                          const applying = applyingId === prop.id;
                          return (
                            <div
                              key={prop.id}
                              className={`nz3-proposal ${applied ? "is-applied" : ""}`}
                            >
                              <div className="nz3-proposal-head">
                                <span>
                                  <Sparkles size={13} /> {prop.label}
                                </span>
                                <small>{applied ? "APPLIED" : "REVIEW"}</small>
                              </div>
                              <p>{prop.description}</p>
                              {prop.tool === "rename_note" && prop.proposedTitle && (
                                <div className="nz3-proposal-diff">
                                  <div>
                                    <small>BEFORE</small>
                                    <span>{prop.previousTitle || currentDoc?.title || "Untitled"}</span>
                                  </div>
                                  <div>
                                    <small>AFTER</small>
                                    <strong>{prop.proposedTitle}</strong>
                                  </div>
                                </div>
                              )}
                              {prop.proposedTags && prop.proposedTags.length > 0 && (
                                <div className="nz3-proposal-tags">
                                  {prop.proposedTags.map((tag) => (
                                    <span key={tag}>#{tag}</span>
                                  ))}
                                </div>
                              )}
                              {prop.proposedBlocks && prop.proposedBlocks.length > 0 && (
                                <ul className="nz3-proposal-preview">
                                  {prop.proposedBlocks.slice(0, 4).map((block, index) => (
                                    <li
                                      key={index}
                                      className={block.type.startsWith("heading") ? "is-heading" : ""}
                                    >
                                      {block.type === "todo" ? "☐ " : block.type === "bullet" ? "• " : ""}
                                      {plainTextFromHtml(block.content)}
                                    </li>
                                  ))}
                                  {prop.proposedBlocks.length > 4 && (
                                    <li className="is-more">+ {prop.proposedBlocks.length - 4} more</li>
                                  )}
                                </ul>
                              )}
                              {applied ? (
                                <div className="nz3-proposal-applied">
                                  <Check size={14} /> Changes applied
                                </div>
                              ) : (
                                <div className="nz3-proposal-actions">
                                  <button
                                    type="button"
                                    className="ed-btn ed-btn-primary ed-btn-sm"
                                    disabled={applying}
                                    onClick={() => void confirmProposal(prop)}
                                  >
                                    {applying ? (
                                      <LoaderCircle size={13} className="nz-spin" />
                                    ) : (
                                      <Check size={13} />
                                    )}
                                    Apply
                                  </button>
                                  {prop.proposedBlocks &&
                                    prop.proposedBlocks.length > 0 &&
                                    prop.applyMode !== "create_new_note" && (
                                      <button
                                        type="button"
                                        className="ed-btn ed-btn-ghost ed-btn-sm"
                                        disabled={applying}
                                        onClick={() =>
                                          void confirmProposal({
                                            ...prop,
                                            applyMode: "create_new_note",
                                            proposedTitle:
                                              prop.proposedTitle ||
                                              `${currentDoc?.title || "Note"} (AI variation)`,
                                          })
                                        }
                                      >
                                        <FilePlus2 size={13} /> New note
                                      </button>
                                    )}
                                  <button
                                    type="button"
                                    className="nz3-proposal-dismiss"
                                    disabled={applying}
                                    onClick={() =>
                                      setDismissedIds((prev) => ({ ...prev, [prop.id]: true }))
                                    }
                                  >
                                    Dismiss
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}

            {pending && (
              <>
                <div className="nz2-msg-user">
                  <div className="nz2-bubble">{pending}</div>
                </div>
                <div className="nz2-msg-ai">
                  <span className="nz2-msg-avatar">
                    <NoteZMark size={22} />
                  </span>
                  <div className="nz3-copilot-thinking" role="status">
                    <LoaderCircle size={15} className="nz-spin" /> Thinking…
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="nz-error" role="alert">
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        <div className="nz2-composer-wrap">
          <div className="nz2-composer">
            <textarea
              value={prompt}
              rows={3}
              placeholder="Ask a question, or describe what you want to do…"
              aria-label="Message ByNote AI"
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
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
                    title={s.label}
                    onClick={() => setScope(s.id)}
                  >
                    <span className="nz2-scope-short">{s.short}</span>
                    <span className="nz2-scope-long">{s.label}</span>
                  </button>
                ))}
              </div>
              <span className="nz2-kbd-hint">↵ to send</span>
              <button
                type="button"
                className="nz2-send"
                disabled={!prompt.trim() || Boolean(pending)}
                onClick={() => void send()}
                aria-label="Send message"
              >
                {pending ? <LoaderCircle size={16} className="nz-spin" /> : <ArrowUp size={17} />}
              </button>
            </div>
          </div>
          <p className="nz2-composer-note">
            <LockKeyhole size={11} /> Only the notes you choose are sent to the model.
          </p>
        </div>
      </section>

      <aside className="nz2-ai-insp" aria-label="AI context">
        <div className="nz2-insp-card">
          <div className="nz2-insp-title">
            <Sparkles size={14} /> What it can use
          </div>
          <ul className="nz2-insp-list">
            <li>
              <Check size={13} />
              {effectiveScope === "none"
                ? "No notes for this request"
                : effectiveScope === "current"
                  ? `“${currentDoc?.title || "Untitled"}”`
                  : `${noteCount} non-confidential notes`}
            </li>
            <li>
              <Check size={13} />
              {openTaskCount} open {openTaskCount === 1 ? "task" : "tasks"} when asked
            </li>
            <li>
              <Check size={13} />
              Voice transcripts you saved
            </li>
          </ul>
        </div>
        <div className="nz2-insp-card">
          <div className="nz2-insp-title">
            <Database size={14} /> Engine
          </div>
          <p className="nz2-insp-text">
            {provider.configured
              ? `Gemini · ${provider.model}`
              : "Basic mode. Add GEMINI_API_KEY on the server for generated answers."}
          </p>
          <button type="button" className="ed-link" onClick={onSettings}>
            Manage in Settings <ChevronRight size={12} />
          </button>
        </div>
        <div className="nz2-insp-card">
          <div className="nz2-insp-title">
            <Mic size={14} /> Voice notes
          </div>
          <p className="nz2-insp-text">
            Record a conversation and turn it into a note you can act on.
          </p>
          <button type="button" className="ed-btn ed-btn-ghost ed-btn-sm" onClick={onVoice}>
            Open voice studio
          </button>
        </div>
      </aside>
    </div>
  );
}
