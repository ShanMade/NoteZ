"use client";

import React, { useMemo } from "react";
import {
  ArrowRight,
  AudioLines,
  Check,
  Circle,
  FilePlus2,
  ListChecks,
  Lock,
  Mic,
  Plus,
  Sparkles,
  Star,
} from "lucide-react";
import type { AssistantHistoryItem, VoiceNote, WorkspaceDocument, WorkspaceUser } from "@/types/workspace";
import { plainTextFromHtml } from "@/lib/markdown";
import { formatRelativeTime } from "@/lib/format";
import { DocumentIcon } from "./Brand";
import { collectTasks } from "./WorkspaceTasks";

export function documentPreview(doc: WorkspaceDocument): string {
  return doc.blocks.map((block) => plainTextFromHtml(block.content)).find((text) => text.trim()) || "Empty page";
}

interface Props {
  user: WorkspaceUser;
  documents: WorkspaceDocument[];
  voiceNotes: VoiceNote[];
  runs: AssistantHistoryItem[];
  onCreate: () => void;
  onOpen: (id: string, openWithAiSidebar?: boolean) => void;
  onNotes: () => void;
  onAI: (prompt?: string) => void;
  onVoice: () => void;
  onTasks: () => void;
  onToggleTask: (docId: string, blockId: string, checked: boolean) => void;
}

function greeting(): string {
  const hour = new Date().getHours();
  return hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
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
    () => documents.filter((doc) => !doc.isArchived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [documents]
  );
  const favorites = useMemo(() => active.filter((doc) => doc.isFavorite).slice(0, 4), [active]);
  const tasks = useMemo(() => collectTasks(documents).filter((task) => !task.checked), [documents]);
  const name = user.name.trim().split(/\s+/)[0] || "there";
  const date = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const recent = active.slice(0, 7);

  return (
    <div className="ed-page ed-home">
      <header className="ed-home-head">
        <div>
          <span className="ed-eyebrow">{date}</span>
          <h1>{greeting()}, {name}</h1>
          <p>{active.length ? `${active.length} ${active.length === 1 ? "page" : "pages"} in your workspace.` : "Your workspace is ready for its first page."}</p>
        </div>
        <div className="ed-home-head-actions">
          <button type="button" className="ed-btn ed-btn-ghost" onClick={onVoice} title="Record a voice note">
            <Mic size={15} /> <span>Record</span>
          </button>
          <button type="button" className="ed-btn ed-btn-primary" onClick={onCreate}>
            <Plus /> <span>New page</span>
          </button>
        </div>
      </header>

      <div className="ed-home-body">
        <section className="ed-panel" aria-labelledby="ed-recent-title">
          <div className="ed-panel-head">
            <h2 id="ed-recent-title">Recently edited</h2>
            <button type="button" className="ed-link" onClick={onNotes}>
              All notes <ArrowRight size={13} />
            </button>
          </div>

          {recent.length ? (
            <ul className="ed-notelist">
              {recent.map((doc) => (
                <li key={doc.id} className="ed-noterow">
                  <button type="button" className="ed-noterow-main" onClick={() => onOpen(doc.id)}>
                    <span className="ed-noterow-icon">
                      <DocumentIcon icon={doc.icon} size={16} />
                    </span>
                    <span className="ed-noterow-copy">
                      <strong>
                        {doc.title || "Untitled"}
                        {doc.isConfidential && <Lock size={10} className="ed-lock" aria-label="Confidential" />}
                        {doc.isFavorite && <Star size={10} className="ed-star" fill="currentColor" aria-label="Favorite" />}
                      </strong>
                      <small>{documentPreview(doc)}</small>
                    </span>
                    <span className="ed-noterow-meta">{formatRelativeTime(doc.updatedAt)}</span>
                  </button>
                  <button
                    type="button"
                    className="ed-noterow-ai"
                    title={`Ask AI about ${doc.title || "Untitled"}`}
                    aria-label={`Ask AI about ${doc.title || "Untitled"}`}
                    onClick={() => onOpen(doc.id, true)}
                  >
                    <Sparkles size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="ed-empty">
              <FilePlus2 size={20} />
              <strong>No pages yet</strong>
              <p>Create a page to start writing. Everything saves automatically.</p>
              <button type="button" className="ed-btn ed-btn-primary ed-btn-sm" onClick={onCreate}>
                <Plus /> New page
              </button>
            </div>
          )}
        </section>

        <aside className="ed-home-aside">
          {favorites.length > 0 && (
            <section className="ed-panel" aria-labelledby="ed-fav-title">
              <div className="ed-panel-head">
                <h2 id="ed-fav-title">Favorites</h2>
              </div>
              <ul className="ed-minilist">
                {favorites.map((doc) => (
                  <li key={doc.id}>
                    <button type="button" onClick={() => onOpen(doc.id)}>
                      <DocumentIcon icon={doc.icon} size={14} />
                      <span>{doc.title || "Untitled"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="ed-panel" aria-labelledby="ed-task-title">
            <div className="ed-panel-head">
              <h2 id="ed-task-title">Open tasks</h2>
              <button type="button" className="ed-link" onClick={onTasks}>
                View all
              </button>
            </div>
            {tasks.length ? (
              <ul className="ed-tasklist">
                {tasks.slice(0, 5).map((task) => (
                  <li key={task.blockId}>
                    <button
                      type="button"
                      className="ed-taskcheck"
                      aria-label={`Complete ${task.text}`}
                      onClick={() => onToggleTask(task.docId, task.blockId, true)}
                    >
                      <Circle size={15} />
                    </button>
                    <button type="button" className="ed-taskcopy" onClick={() => onOpen(task.docId)}>
                      <strong>{task.text}</strong>
                      <small>{task.docTitle}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ed-quiet">
                <span className="ed-quiet-check"><Check size={13} /></span>
                Nothing outstanding.
              </p>
            )}
          </section>

          <section className="ed-panel">
            <div className="ed-panel-head">
              <h2>Shortcuts</h2>
            </div>
            <ul className="ed-shortcutlist">
              <li>
                <button type="button" onClick={() => onAI()}>
                  <Sparkles size={14} /> <span>Ask ByNote AI</span> <ListChecks size={12} className="ed-shortcut-tail" />
                </button>
              </li>
              <li>
                <button type="button" onClick={onVoice}>
                  <AudioLines size={14} /> <span>Voice notes</span>
                  {voiceNotes.length > 0 && <em>{voiceNotes.length}</em>}
                </button>
              </li>
              <li>
                <button type="button" onClick={onTasks}>
                  <ListChecks size={14} /> <span>Tasks</span>
                  {tasks.length > 0 && <em>{tasks.length}</em>}
                </button>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
