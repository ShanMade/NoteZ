"use client";

import React, { useMemo } from "react";
import { ArrowRight, AudioLines, CheckCircle2, Circle, FilePlus2, ListChecks, Mic, Sparkles, Clock3 } from "lucide-react";
import type { AssistantHistoryItem, VoiceNote, WorkspaceDocument, WorkspaceUser } from "@/types/workspace";
import { plainTextFromHtml } from "@/lib/markdown";
import { formatRelativeTime } from "@/lib/format";
import { DocumentIcon } from "./Brand";
import { collectTasks } from "./WorkspaceTasks";

export function documentPreview(doc: WorkspaceDocument): string {
  return doc.blocks.map((b) => plainTextFromHtml(b.content)).find(Boolean) || "A fresh page, ready for your thoughts.";
}

interface Props {
  user: WorkspaceUser;
  documents: WorkspaceDocument[];
  voiceNotes: VoiceNote[];
  runs: AssistantHistoryItem[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onNotes: () => void;
  onAI: () => void;
  onVoice: () => void;
  onTasks: () => void;
  onToggleTask: (docId: string, blockId: string, checked: boolean) => void;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function WorkspaceHome({
  user,
  documents,
  voiceNotes,
  runs,
  onCreate,
  onOpen,
  onNotes,
  onAI,
  onVoice,
  onTasks,
  onToggleTask,
}: Props) {
  const active = useMemo(
    () => documents.filter((d) => !d.isArchived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [documents]
  );
  const openTasks = useMemo(() => collectTasks(documents).filter((t) => !t.checked), [documents]);
  const threadCount = useMemo(() => new Set(runs.map((r) => r.threadId || r.id)).size, [runs]);
  const today = new Date().toDateString();
  const editedToday = active.filter((d) => new Date(d.updatedAt).toDateString() === today).length;
  const latest = active[0];
  const firstName = user.name.split(" ")[0] || "there";

  const summary = [
    openTasks.length ? `${openTasks.length} open ${openTasks.length === 1 ? "task" : "tasks"}` : "No open tasks",
    editedToday ? `${editedToday} ${editedToday === 1 ? "note" : "notes"} edited today` : "A clear day ahead",
  ].join(" · ");

  return (
    <div className="nz2-page nz2-home">
      <header className="nz2-hero">
        <div>
          <span className="nz2-eyebrow">
            <Clock3 size={13} /> {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </span>
          <h1 className="nz2-title">
            {greeting()}, {firstName}
          </h1>
          <p className="nz2-sub">{summary}.</p>
        </div>
        <div className="nz2-stats" aria-label="Workspace summary">
          <button type="button" onClick={onNotes}>
            <strong>{active.length}</strong>
            <span>Notes</span>
          </button>
          <button type="button" onClick={onTasks}>
            <strong>{openTasks.length}</strong>
            <span>Open tasks</span>
          </button>
          <button type="button" onClick={onVoice}>
            <strong>{voiceNotes.length}</strong>
            <span>Voice notes</span>
          </button>
          <button type="button" onClick={onAI}>
            <strong>{threadCount}</strong>
            <span>AI chats</span>
          </button>
        </div>
      </header>

      <div className="nz2-quick">
        <button type="button" className="nz2-quick-card" onClick={onCreate}>
          <span className="nz2-quick-icon tone-indigo">
            <FilePlus2 size={19} />
          </span>
          <strong>New note</strong>
          <small>Start with a blank page</small>
        </button>
        <button type="button" className="nz2-quick-card" onClick={onVoice}>
          <span className="nz2-quick-icon tone-rose">
            <Mic size={19} />
          </span>
          <strong>Voice note</strong>
          <small>Record, then structure it</small>
        </button>
        <button type="button" className="nz2-quick-card" onClick={onAI}>
          <span className="nz2-quick-icon tone-teal">
            <Sparkles size={19} />
          </span>
          <strong>Ask NoteZ AI</strong>
          <small>Search notes and draft</small>
        </button>
        <button type="button" className="nz2-quick-card" onClick={onTasks}>
          <span className="nz2-quick-icon tone-amber">
            <ListChecks size={19} />
          </span>
          <strong>Review tasks</strong>
          <small>{openTasks.length} open right now</small>
        </button>
      </div>

      <div className="nz2-home-grid">
        <div className="nz2-col-main">
          {latest ? (
            <section className="nz2-continue">
              <div className="nz2-continue-copy">
                <span className="nz2-eyebrow">Pick up where you left off</span>
                <h2>
                  <DocumentIcon icon={latest.icon} size={22} /> {latest.title || "Untitled"}
                </h2>
                <p>{documentPreview(latest)}</p>
                <div className="nz2-continue-meta">
                  <span>Edited {formatRelativeTime(latest.updatedAt)}</span>
                  {latest.tags.slice(0, 3).map((t) => (
                    <span key={t} className="nz2-tag">
                      #{t}
                    </span>
                  ))}
                </div>
                <button type="button" className="nz2-btn nz2-btn-primary" onClick={() => onOpen(latest.id)}>
                  Continue writing <ArrowRight size={15} />
                </button>
              </div>
              <div className="nz2-continue-art" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
            </section>
          ) : (
            <section className="nz2-empty">
              <span className="nz2-empty-icon">
                <FilePlus2 size={22} />
              </span>
              <h3>Your first page starts here</h3>
              <p>Every great idea begins with a single line.</p>
              <button type="button" className="nz2-btn nz2-btn-primary" onClick={onCreate}>
                Create a page
              </button>
            </section>
          )}

          <div className="nz2-section-row">
            <h2 className="nz2-section-title">Recent notes</h2>
            <button type="button" className="nz2-link" onClick={onNotes}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="nz2-note-grid">
            {active.slice(1, 7).map((doc) => (
              <button key={doc.id} type="button" className="nz2-note-card" onClick={() => onOpen(doc.id)}>
                <span className="nz2-note-card-icon">
                  <DocumentIcon icon={doc.icon} size={17} />
                </span>
                <strong>{doc.title || "Untitled"}</strong>
                <p>{documentPreview(doc)}</p>
                <small>{formatRelativeTime(doc.updatedAt)}</small>
              </button>
            ))}
            {active.length <= 1 && <p className="nz2-empty-small">More notes will appear here as you write.</p>}
          </div>
        </div>

        <aside className="nz2-col-side">
          <section className="nz2-widget">
            <div className="nz2-widget-head">
              <h3>
                <ListChecks size={16} /> Open tasks
              </h3>
              <button type="button" className="nz2-link" onClick={onTasks}>
                All
              </button>
            </div>
            {openTasks.length ? (
              <ul className="nz2-widget-list">
                {openTasks.slice(0, 6).map((task) => (
                  <li key={task.blockId}>
                    <button
                      type="button"
                      className="nz2-check"
                      aria-label="Mark as done"
                      onClick={() => onToggleTask(task.docId, task.blockId, true)}
                    >
                      {task.checked ? <CheckCircle2 size={17} /> : <Circle size={17} />}
                    </button>
                    <span>
                      {task.text}
                      <small>{task.docTitle}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nz2-empty-small">All clear. Enjoy the quiet.</p>
            )}
          </section>

          <section className="nz2-widget">
            <div className="nz2-widget-head">
              <h3>
                <Sparkles size={16} /> Recent AI chats
              </h3>
              <button type="button" className="nz2-link" onClick={onAI}>
                Open
              </button>
            </div>
            {runs.length ? (
              <ul className="nz2-widget-list">
                {runs.slice(0, 3).map((run) => (
                  <li key={run.id}>
                    <span className="nz2-widget-dot tone-teal">
                      <Sparkles size={13} />
                    </span>
                    <span>
                      {run.prompt.length > 70 ? `${run.prompt.slice(0, 70)}…` : run.prompt}
                      <small>{formatRelativeTime(run.createdAt)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nz2-empty-small">Ask a question and your conversations will live here.</p>
            )}
          </section>

          <section className="nz2-widget">
            <div className="nz2-widget-head">
              <h3>
                <AudioLines size={16} /> Voice notes
              </h3>
              <button type="button" className="nz2-link" onClick={onVoice}>
                Open
              </button>
            </div>
            {voiceNotes.length ? (
              <ul className="nz2-widget-list">
                {voiceNotes.slice(0, 3).map((note) => (
                  <li key={note.id}>
                    <span className="nz2-widget-dot tone-rose">
                      <AudioLines size={13} />
                    </span>
                    <span>
                      {note.title}
                      <small>
                        {note.structured ? "Structured" : "Transcript"} · {formatRelativeTime(note.createdAt)}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nz2-empty-small">Record a meeting or memo to see it here.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
