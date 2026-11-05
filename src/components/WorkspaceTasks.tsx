"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, Circle, ListChecks, Search } from "lucide-react";
import type { WorkspaceDocument } from "@/types/workspace";
import { plainTextFromHtml } from "@/lib/markdown";
import { DocumentIcon } from "./Brand";

export interface TaskItem {
  docId: string;
  docTitle: string;
  docIcon: string;
  blockId: string;
  text: string;
  checked: boolean;
}

/** Every to-do block across active notes. Shared by the sidebar, home, and tasks view. */
export function collectTasks(documents: WorkspaceDocument[]): TaskItem[] {
  const out: TaskItem[] = [];
  for (const doc of documents) {
    if (doc.isArchived) continue;
    for (const block of doc.blocks ?? []) {
      if (block.type !== "todo") continue;
      const text = plainTextFromHtml(block.content).trim();
      if (!text) continue;
      out.push({
        docId: doc.id,
        docTitle: doc.title || "Untitled",
        docIcon: doc.icon,
        blockId: block.id,
        text,
        checked: Boolean(block.props?.checked),
      });
    }
  }
  return out;
}

interface Props {
  documents: WorkspaceDocument[];
  onToggle: (docId: string, blockId: string, checked: boolean) => void;
  onOpen: (id: string) => void;
}

export function WorkspaceTasks({ documents, onToggle, onOpen }: Props) {
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  const [query, setQuery] = useState("");
  const tasks = useMemo(() => collectTasks(documents), [documents]);

  const counts = {
    open: tasks.filter((t) => !t.checked).length,
    done: tasks.filter((t) => t.checked).length,
    all: tasks.length,
  };

  const shown = tasks
    .filter((t) => (filter === "all" ? true : filter === "open" ? !t.checked : t.checked))
    .filter((t) => !query.trim() || t.text.toLowerCase().includes(query.trim().toLowerCase()));

  const groups = useMemo(() => {
    const map = new Map<string, { docId: string; docTitle: string; docIcon: string; items: TaskItem[] }>();
    for (const task of shown) {
      const group = map.get(task.docId) ?? { docId: task.docId, docTitle: task.docTitle, docIcon: task.docIcon, items: [] };
      group.items.push(task);
      map.set(task.docId, group);
    }
    return Array.from(map.values());
  }, [shown]);

  return (
    <div className="nz2-page">
      <header className="nz2-page-head">
        <div>
          <span className="nz2-eyebrow">Across your notes</span>
          <h1 className="nz2-title">Tasks</h1>
          <p className="nz2-sub">Every checklist item from your pages, in one calm list.</p>
        </div>
      </header>

      <div className="nz2-toolbar">
        <div className="nz2-tabs" role="tablist" aria-label="Filter tasks">
          {(["open", "done", "all"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={filter === key ? "is-on" : ""}
              onClick={() => setFilter(key)}
            >
              {key === "open" ? "Open" : key === "done" ? "Done" : "All"}
              <span>{counts[key]}</span>
            </button>
          ))}
        </div>
        <label className="nz2-search-field">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter tasks" />
        </label>
      </div>

      {groups.length === 0 ? (
        <div className="nz2-empty">
          <span className="nz2-empty-icon">
            <ListChecks size={22} />
          </span>
          <h3>{filter === "open" ? "Nothing left on your list" : "No tasks here yet"}</h3>
          <p>Add a to-do block to any note, or ask ByNote AI to pull tasks out of a meeting.</p>
        </div>
      ) : (
        <div className="nz2-task-groups">
          {groups.map((group) => (
            <section key={group.docId} className="nz2-task-group">
              <button type="button" className="nz2-task-group-head" onClick={() => onOpen(group.docId)}>
                <DocumentIcon icon={group.docIcon} size={16} />
                <span>{group.docTitle}</span>
                <em>
                  {group.items.filter((t) => !t.checked).length} open
                </em>
              </button>
              <ul>
                {group.items.map((task) => (
                  <li key={task.blockId} className={task.checked ? "is-done" : ""}>
                    <button
                      type="button"
                      className="nz2-check"
                      aria-label={task.checked ? "Mark as not done" : "Mark as done"}
                      onClick={() => onToggle(task.docId, task.blockId, !task.checked)}
                    >
                      {task.checked ? <CheckCircle2 size={19} /> : <Circle size={19} />}
                    </button>
                    <span className="nz2-task-text">{task.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
