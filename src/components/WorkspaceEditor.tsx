"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Clock3,
  Copy,
  Download,
  Eye,
  FilePlus2,
  Image as ImageIcon,
  Link2,
  ListTree,
  Maximize2,
  MoreHorizontal,
  Pencil,
  PanelRight,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Search,
  X,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import type { WorkspaceDocument, WorkspaceSettings } from "@/types/workspace";
import type { BlockProps, BlockType, NoteBlock, NotePage } from "@/types/notez";
import { plainTextFromHtml, serializePageToMarkdown } from "@/lib/markdown";
import { formatRelativeTime } from "@/lib/format";
import { newId } from "@/lib/ids";
import { BlockItem } from "./BlockItem";
import { SlashCommandMenu } from "./SlashCommandMenu";
import { InlineFormatToolbar } from "./InlineFormatToolbar";
import { DocumentIcon } from "./Brand";

const ICONS = ["file", "book", "calendar", "compass", "lightbulb", "folder", "sparkles", "clipboard", "briefcase", "rocket"];
const COVERS: Array<{ id: string; label: string }> = [
  { id: "lavender", label: "Lavender" },
  { id: "peach", label: "Peach" },
  { id: "mint", label: "Mint" },
  { id: "sky", label: "Sky" },
  { id: "ink", label: "Ink" },
];

interface Props {
  doc: WorkspaceDocument;
  documents: WorkspaceDocument[];
  settings: Pick<WorkspaceSettings, "editorWidth" | "editorFont" | "spellcheck">;
  saveState: "saved" | "saving" | "error";
  onChange: (patch: Partial<WorkspaceDocument>) => void;
  onArchive: () => void;
  onDuplicate: () => void;
  onCreateChild: () => void;
  onOpen: (id: string) => void;
  onAI: () => void;
  onNotice: (message: string) => void;
}

function ReadBlock({ block }: { block: NoteBlock }) {
  const text = plainTextFromHtml(block.content);
  switch (block.type) {
    case "heading1":
      return <h1>{text}</h1>;
    case "heading2":
      return <h2>{text}</h2>;
    case "heading3":
      return <h3>{text}</h3>;
    case "bullet":
      return <p className="nz-read-list"><span>•</span>{text}</p>;
    case "numbered":
      return <p className="nz-read-list"><span>›</span>{text}</p>;
    case "todo":
      return (
        <p className="nz-read-list">
          {block.props.checked ? <span className="nz2-read-check is-done">✓</span> : <span className="nz2-read-check">○</span>}
          <span className={block.props.checked ? "nz-read-done" : ""}>{text}</span>
        </p>
      );
    case "callout":
      return <div className="nz-read-callout"><Sparkles size={17} /><span>{text}</span></div>;
    case "quote":
      return <blockquote>{text}</blockquote>;
    case "divider":
      return <hr />;
    case "code":
      return <pre><code>{text}</code></pre>;
    case "toggle":
      return (
        <details open={block.props.expanded !== false}>
          <summary>{text}</summary>
          <p>{block.props.details}</p>
        </details>
      );
    case "table":
      return (
        <div className="nz-read-table">
          <table>
            <thead>
              <tr>{(block.props.columns ?? []).map((c) => <th key={c.id}>{c.name}</th>)}</tr>
            </thead>
            <tbody>
              {(block.props.rows ?? []).map((r) => (
                <tr key={r.id}>{(block.props.columns ?? []).map((c) => <td key={c.id}>{r.cells[c.id] || "—"}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    default:
      return <p>{text || "\u00a0"}</p>;
  }
}

export function WorkspaceEditor({
  doc,
  documents,
  settings,
  saveState,
  onChange,
  onArchive,
  onDuplicate,
  onCreateChild,
  onOpen,
  onAI,
  onNotice,
}: Props) {
  const [readOnly, setReadOnly] = useState(false);
  const [focus, setFocus] = useState(false);
  const [outline, setOutline] = useState(true);
  const [menu, setMenu] = useState<null | "more" | "icon" | "cover">(null);
  const [slash, setSlash] = useState<{ id: string; query: string; rect: { top: number; left: number; bottom: number } } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState("");
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIndex, setFindIndex] = useState(0);
  const focusMap = useRef(new Map<string, HTMLElement>());
  const blocksRef = useRef(doc.blocks);

  useEffect(() => {
    blocksRef.current = doc.blocks;
  }, [doc.blocks]);

  useEffect(() => {
    setReadOnly(false);
    setMenu(null);
    setSlash(null);
    setFocus(false);
  }, [doc.id]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest("[data-pop-root]")) setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ".") {
        event.preventDefault();
        setFocus((v) => !v);
      } else if (event.key === "Escape" && focus) {
        setFocus(false);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFindOpen(true);
      } else if (event.key === "Escape" && findOpen) {
        setFindOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, findOpen]);

  const crumbs = useMemo(() => {
    const byId = new Map(documents.map((d) => [d.id, d]));
    const chain: WorkspaceDocument[] = [];
    const seen = new Set<string>();
    let cur: WorkspaceDocument | undefined = doc;
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      chain.unshift(cur);
      cur = cur.parentId ? byId.get(cur.parentId) : undefined;
    }
    return chain;
  }, [documents, doc]);

  const subpages = useMemo(
    () => documents.filter((d) => d.parentId === doc.id && !d.isArchived),
    [documents, doc.id]
  );

  const registerFocusable = useCallback((id: string, el: HTMLElement | null) => {
    if (el) focusMap.current.set(id, el);
    else focusMap.current.delete(id);
  }, []);

  const focusBlock = useCallback((id: string, end = true) => {
    requestAnimationFrame(() => {
      const el = focusMap.current.get(id);
      if (!el) return;
      el.focus();
      if (el instanceof HTMLTextAreaElement) {
        const p = end ? el.value.length : 0;
        el.setSelectionRange(p, p);
      } else if (el.isContentEditable) {
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(!end);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    });
  }, []);

  const commit = (updater: (blocks: NoteBlock[]) => NoteBlock[]) => {
    const next = updater(blocksRef.current).map((b, position) => ({ ...b, position }));
    blocksRef.current = next;
    onChange({ blocks: next });
  };

  const makeBlock = (type: BlockType = "paragraph", props: BlockProps = {}): NoteBlock => ({
    id: newId(),
    pageId: doc.id,
    type,
    content: "",
    props,
    position: 0,
  });

  const insertAfter = (afterId: string, type?: BlockType): string => {
    const id = newId();
    commit((prev) => {
      const index = prev.findIndex((b) => b.id === afterId);
      const current = prev[index];
      const inherited: BlockType =
        type ?? (current && ["bullet", "numbered", "todo"].includes(current.type) ? current.type : "paragraph");
      const block: NoteBlock = {
        id,
        pageId: doc.id,
        type: inherited,
        content: "",
        props: inherited === "todo" ? { checked: false } : {},
        position: index + 1,
      };
      const next = [...prev];
      next.splice(index + 1, 0, block);
      return next;
    });
    focusBlock(id, false);
    return id;
  };

  const addBlock = () => {
    const block = makeBlock();
    commit((prev) => [...prev, block]);
    focusBlock(block.id, false);
  };

  const handleSlashSelect = (type: BlockType) => {
    if (!slash) return;
    const target = slash.id;
    setSlash(null);
    const props: BlockProps =
      type === "todo"
        ? { checked: false }
        : type === "callout"
          ? { icon: "💡", tone: "indigo" }
          : type === "toggle"
            ? { expanded: true, details: "" }
            : type === "code"
              ? { language: "typescript" }
              : type === "table"
                ? {
                    columns: [
                      { id: "c1", name: "Name", type: "text" },
                      { id: "c2", name: "Status", type: "status" },
                      { id: "c3", name: "Tag", type: "tag" },
                    ],
                    rows: [{ id: "r1", cells: { c1: "New item", c2: "Planned", c3: "" } }],
                  }
                : {};
    let follow: string | null = null;
    commit((prev) =>
      prev.flatMap((b) => {
        if (b.id !== target) return [b];
        const next: NoteBlock = {
          ...b,
          type,
          props,
          content: /^\/[a-zA-Z0-9]*$/.test(plainTextFromHtml(b.content)) ? "" : b.content,
        };
        if (type === "divider" || type === "table") {
          const blank = makeBlock();
          follow = blank.id;
          return [next, blank];
        }
        return [next];
      })
    );
    focusBlock(follow || target, false);
  };

  const headings = useMemo(
    () => doc.blocks.filter((b) => ["heading1", "heading2", "heading3"].includes(b.type) && plainTextFromHtml(b.content)),
    [doc.blocks]
  );
  const wordCount = useMemo(
    () => doc.blocks.map((b) => plainTextFromHtml(b.content)).join(" ").trim().split(/\s+/).filter(Boolean).length,
    [doc.blocks]
  );
  const numbering = useMemo(() => {
    let count = 0;
    return doc.blocks.map((b) => (b.type === "numbered" ? ++count : (count = 0)));
  }, [doc.blocks]);

  const findMatches = useMemo(() => {
    const q = findQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return doc.blocks
      .filter((b) => plainTextFromHtml(b.content).toLowerCase().includes(q))
      .map((b) => b.id);
  }, [doc.blocks, findQuery]);

  const jumpToMatch = (index: number) => {
    if (!findMatches.length) return;
    const bounded = ((index % findMatches.length) + findMatches.length) % findMatches.length;
    setFindIndex(bounded);
    document.getElementById(`block-${findMatches[bounded]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const exportMarkdown = () => {
    const page: NotePage = {
      id: doc.id,
      parentId: doc.parentId,
      title: doc.title,
      icon: "",
      coverImage: null,
      fontStyle: "sans",
      fullWidth: false,
      isFavorite: doc.isFavorite,
      isArchived: doc.isArchived,
      isAiGenerated: doc.isAiGenerated,
      sourceRunId: null,
      position: 0,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
    const file = new Blob([serializePageToMarkdown(page, doc.blocks)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(doc.title || "note").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "note"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setMenu(null);
    onNotice("Markdown downloaded");
  };

  const copyLink = async () => {
    setMenu(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("page", doc.id);
      await navigator.clipboard.writeText(url.toString());
      onNotice("Link copied");
    } catch {
      onNotice("Couldn't copy the link");
    }
  };

  const addTag = () => {
    const tag = tagDraft.trim().replace(/^#/, "").slice(0, 24);
    setTagDraft("");
    if (!tag || doc.tags.includes(tag) || doc.tags.length >= 8) return;
    onChange({ tags: [...doc.tags, tag] });
  };

  const minutes = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div className={`nz2-editor ${focus ? "is-focus" : ""}`} data-font={settings.editorFont}>
      <div className="nz2-editor-bar">
        <nav className="nz2-crumbs" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <React.Fragment key={c.id}>
              {i > 0 && <ChevronRight size={13} className="nz2-crumb-sep" />}
              <button
                type="button"
                className="nz2-crumb-link"
                onClick={() => onOpen(c.id)}
                disabled={c.id === doc.id}
              >
                <DocumentIcon icon={c.icon} size={13} />
                <span>{c.title || "Untitled"}</span>
              </button>
            </React.Fragment>
          ))}
        </nav>

        <div className="nz2-editor-tools">
          <span className={`nz2-save is-${saveState}`}>
            <i />
            {saveState === "saving" ? "Saving…" : saveState === "error" ? "Not saved" : "Saved"}
          </span>
          <div className="nz2-seg" role="group" aria-label="View mode">
            <button type="button" className={!readOnly ? "is-on" : ""} onClick={() => setReadOnly(false)}>
              <Pencil size={13} /> Edit
            </button>
            <button type="button" className={readOnly ? "is-on" : ""} onClick={() => setReadOnly(true)}>
              <Eye size={13} /> Read
            </button>
          </div>
          <button
            type="button"
            className={`nz2-icon-btn ${focus ? "is-on" : ""}`}
            title="Focus mode (⌘.)"
            aria-pressed={focus}
            onClick={() => setFocus((v) => !v)}
          >
            <Maximize2 size={16} />
          </button>
          <button
            type="button"
            className={`nz2-icon-btn ${outline ? "is-on" : ""}`}
            title={outline ? "Hide outline" : "Show outline"}
            aria-pressed={outline}
            onClick={() => setOutline((v) => !v)}
          >
            <PanelRight size={16} />
          </button>
          <button type="button" className="nz2-btn nz2-btn-soft nz2-btn-sm" onClick={onAI}>
            <Sparkles size={14} /> Ask AI
          </button>
          <button
            type="button"
            className={`nz2-icon-btn ${doc.isFavorite ? "is-fav" : ""}`}
            title={doc.isFavorite ? "Remove from favorites" : "Add to favorites"}
            onClick={() => onChange({ isFavorite: !doc.isFavorite })}
          >
            <Star size={16} fill={doc.isFavorite ? "currentColor" : "none"} />
          </button>
          <div className="nz2-pop-wrap" data-pop-root>
            <button
              type="button"
              className="nz2-icon-btn"
              aria-haspopup="menu"
              aria-expanded={menu === "more"}
              title="More"
              onClick={() => setMenu(menu === "more" ? null : "more")}
            >
              <MoreHorizontal size={17} />
            </button>
            {menu === "more" && (
              <div className="nz2-popover nz2-popover-right" role="menu">
                <button type="button" role="menuitem" onClick={() => { setMenu(null); onCreateChild(); }}>
                  <FilePlus2 size={15} /> Add subpage
                </button>
                <button type="button" role="menuitem" onClick={() => { setMenu(null); onDuplicate(); }}>
                  <Copy size={15} /> Duplicate
                </button>
                <button type="button" role="menuitem" onClick={copyLink}>
                  <Link2 size={15} /> Copy link
                </button>
                <button type="button" role="menuitem" onClick={exportMarkdown}>
                  <Download size={15} /> Export Markdown
                </button>
                <div className="nz2-menu-sep" />
                <button type="button" role="menuitem" className="is-danger" onClick={() => { setMenu(null); onArchive(); }}>
                  <Trash2 size={15} /> Move to trash
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {findOpen && (
        <div className="nz3-find" role="search">
          <Search size={14} />
          <input
            autoFocus
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value);
              setFindIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                jumpToMatch(e.shiftKey ? findIndex - 1 : findIndex + 1);
              } else if (e.key === "Escape") {
                setFindOpen(false);
              }
            }}
            placeholder="Find words in this note…"
            aria-label="Find in note"
          />
          <span className="nz3-find-count">
            {findQuery.trim().length < 2
              ? "Type to search"
              : findMatches.length
                ? `${findIndex + 1} of ${findMatches.length}`
                : "No matches"}
          </span>
          <button type="button" className="nz2-icon-btn" onClick={() => jumpToMatch(findIndex - 1)} aria-label="Previous match" disabled={!findMatches.length}>
            <ArrowUp size={15} />
          </button>
          <button type="button" className="nz2-icon-btn" onClick={() => jumpToMatch(findIndex + 1)} aria-label="Next match" disabled={!findMatches.length}>
            <ArrowDown size={15} />
          </button>
          <button type="button" className="nz2-icon-btn" onClick={() => setFindOpen(false)} aria-label="Close find">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="nz2-editor-body">
        <div className="nz2-doc-scroll">
          <article className={`nz2-doc nz2-width-${settings.editorWidth}`} spellCheck={settings.spellcheck}>
            {doc.cover && (
              <div className={`nz2-cover nz2-cover-${doc.cover}`} aria-hidden="true">
                <span className="nz2-cover-ring" />
              </div>
            )}

            <div className={`nz2-doc-head ${doc.cover ? "has-cover" : ""}`}>
              <div className="nz2-pop-wrap" data-pop-root>
                <button
                  type="button"
                  className="nz2-doc-icon"
                  aria-label="Change icon"
                  onClick={() => setMenu(menu === "icon" ? null : "icon")}
                >
                  <DocumentIcon icon={doc.icon} size={28} />
                </button>
                {menu === "icon" && (
                  <div className="nz2-popover nz2-icon-pop" role="menu">
                    <div className="nz2-pop-label">Choose an icon</div>
                    <div className="nz2-icon-grid">
                      {ICONS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          aria-label={icon}
                          className={doc.icon === icon ? "is-on" : ""}
                          onClick={() => { onChange({ icon }); setMenu(null); }}
                        >
                          <DocumentIcon icon={icon} size={18} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <textarea
                className="nz2-doc-title"
                rows={1}
                value={doc.title}
                readOnly={readOnly}
                placeholder="Untitled"
                aria-label="Note title"
                onChange={(e) => {
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  onChange({ title: e.target.value });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const first = blocksRef.current[0];
                    if (first) focusBlock(first.id, false);
                  }
                }}
              />

              <div className="nz2-doc-meta">
                <span className="nz2-meta-item">
                  <Clock3 size={13} /> Edited {formatRelativeTime(doc.updatedAt)}
                </span>
                <span className="nz2-meta-item">{wordCount} words</span>
                <span className="nz2-meta-item">{minutes} min read</span>
                <div className="nz2-pop-wrap" data-pop-root>
                  <button type="button" className="nz2-meta-btn" onClick={() => setMenu(menu === "cover" ? null : "cover")}>
                    <ImageIcon size={13} /> {doc.cover ? "Change cover" : "Add cover"}
                  </button>
                  {menu === "cover" && (
                    <div className="nz2-popover nz2-cover-pop" role="menu">
                      <div className="nz2-pop-label">Page cover</div>
                      <div className="nz2-cover-grid">
                        {COVERS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            aria-label={c.label}
                            title={c.label}
                            className={`nz2-cover-swatch nz2-cover-${c.id} ${doc.cover === c.id ? "is-on" : ""}`}
                            onClick={() => { onChange({ cover: c.id }); setMenu(null); }}
                          />
                        ))}
                      </div>
                      {doc.cover && (
                        <button type="button" className="nz2-popover-action" onClick={() => { onChange({ cover: null }); setMenu(null); }}>
                          Remove cover
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="nz2-tags">
                {doc.tags.map((tag) => (
                  <span key={tag} className="nz2-tag">
                    #{tag}
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label={`Remove ${tag}`}
                        onClick={() => onChange({ tags: doc.tags.filter((t) => t !== tag) })}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </span>
                ))}
                {!readOnly && (
                  <input
                    className="nz2-tag-input"
                    placeholder={doc.tags.length ? "Add tag" : "Add tags to organize this note"}
                    value={tagDraft}
                    maxLength={24}
                    onChange={(e) => setTagDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addTag();
                      } else if (e.key === "Backspace" && !tagDraft && doc.tags.length) {
                        onChange({ tags: doc.tags.slice(0, -1) });
                      }
                    }}
                    onBlur={addTag}
                  />
                )}
              </div>
            </div>

            <div className="nz2-divider" />

            {readOnly ? (
              <div className="nz-read-content">
                {doc.blocks.map((block) => (
                  <div key={block.id} id={`block-${block.id}`}>
                    <ReadBlock block={block} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="nz2-blocks">
                {doc.blocks.map((block, index) => (
                  <BlockItem
                    key={block.id}
                    block={block}
                    index={index}
                    totalBlocks={doc.blocks.length}
                    numberedOrder={numbering[index]}
                    isSlashActiveOnThisBlock={slash?.id === block.id}
                    registerFocusable={registerFocusable}
                    onChangeBlock={(id, patch) => commit((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))}
                    onEnterKey={(id) => { insertAfter(id); }}
                    onBackspaceEmpty={(id) => {
                      const all = blocksRef.current;
                      if (all.length <= 1) return;
                      const i = all.findIndex((b) => b.id === id);
                      const target = all[i - 1] || all[i + 1];
                      commit((prev) => prev.filter((b) => b.id !== id));
                      if (target) focusBlock(target.id);
                    }}
                    onFocusAdjacent={(id, direction) => {
                      const all = blocksRef.current;
                      const i = all.findIndex((b) => b.id === id);
                      const target = all[i + (direction === "up" ? -1 : 1)];
                      if (target) focusBlock(target.id, direction === "up");
                    }}
                    onInsertBelowAndSlash={(id, rect) => {
                      const current = blocksRef.current.find((b) => b.id === id);
                      const target =
                        current && current.type === "paragraph" && !plainTextFromHtml(current.content)
                          ? id
                          : insertAfter(id, "paragraph");
                      setSlash({ id: target, query: "", rect });
                      focusBlock(target, false);
                    }}
                    onSlashTyping={(id, query, rect) => {
                      if (query === null) setSlash((prev) => (prev?.id === id ? null : prev));
                      else if (rect) setSlash({ id, query, rect });
                    }}
                    onDuplicateBlock={(id) => {
                      const cloneId = newId();
                      commit((prev) => {
                        const i = prev.findIndex((b) => b.id === id);
                        if (i < 0) return prev;
                        const copy = [...prev];
                        copy.splice(i + 1, 0, { ...prev[i], id: cloneId, props: JSON.parse(JSON.stringify(prev[i].props)) });
                        return copy;
                      });
                      focusBlock(cloneId);
                    }}
                    onDeleteBlock={(id) =>
                      commit((prev) => {
                        const next = prev.filter((b) => b.id !== id);
                        return next.length ? next : [makeBlock()];
                      })
                    }
                    onMoveBlockOffset={(id, delta) =>
                      commit((prev) => {
                        const i = prev.findIndex((b) => b.id === id);
                        if (i < 0 || i + delta < 0 || i + delta >= prev.length) return prev;
                        const copy = [...prev];
                        const [item] = copy.splice(i, 1);
                        copy.splice(i + delta, 0, item);
                        return copy;
                      })
                    }
                    onDragStartBlock={setDragging}
                    onDropOnBlock={(target, position) => {
                      if (!dragging || target === dragging) return;
                      commit((prev) => {
                        const copy = [...prev];
                        const i = copy.findIndex((b) => b.id === dragging);
                        if (i < 0) return prev;
                        const [item] = copy.splice(i, 1);
                        const j = copy.findIndex((b) => b.id === target);
                        copy.splice(j + (position === "after" ? 1 : 0), 0, item);
                        return copy;
                      });
                      setDragging(null);
                    }}
                    draggingBlockId={dragging}
                  />
                ))}
                <button type="button" className="nz2-add-block" onClick={addBlock}>
                  <Plus size={15} /> Add a block <span>or type /</span>
                </button>
              </div>
            )}
          </article>
        </div>

        {outline && !focus && (
          <aside className="nz2-outline" aria-label="Outline">
            <div className="nz2-outline-head">
              <ListTree size={15} /> On this page
            </div>
            {headings.length ? (
              <nav className="nz2-outline-list">
                {headings.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className={h.type === "heading1" ? "" : h.type === "heading3" ? "is-sub2" : "is-sub"}
                    onClick={() => document.getElementById(`block-${h.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  >
                    {plainTextFromHtml(h.content)}
                  </button>
                ))}
              </nav>
            ) : (
              <p className="nz2-outline-empty">Add headings to build an outline.</p>
            )}

            <div className="nz2-outline-head nz2-outline-head-row">
              <span>Subpages</span>
              <button type="button" className="nz2-mini-btn" onClick={onCreateChild} aria-label="Add subpage">
                <Plus size={13} />
              </button>
            </div>
            {subpages.length ? (
              subpages.map((c) => (
                <button key={c.id} type="button" className="nz2-subpage" onClick={() => onOpen(c.id)}>
                  <DocumentIcon icon={c.icon} size={14} />
                  <span>{c.title || "Untitled"}</span>
                </button>
              ))
            ) : (
              <p className="nz2-outline-empty">No subpages yet.</p>
            )}

            <dl className="nz2-outline-stats">
              <div>
                <dt>Words</dt>
                <dd>{wordCount}</dd>
              </div>
              <div>
                <dt>Blocks</dt>
                <dd>{doc.blocks.length}</dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatRelativeTime(doc.updatedAt)}</dd>
              </div>
            </dl>

            <button type="button" className="nz2-outline-ai" onClick={onAI}>
              <Sparkles size={15} />
              <span>Ask AI about this note</span>
              <ChevronRight size={15} />
            </button>
          </aside>
        )}
      </div>

      {!readOnly && <InlineFormatToolbar onFormatApplied={() => {}} />}
      {slash && (
        <SlashCommandMenu
          query={slash.query}
          anchorRect={slash.rect}
          onSelect={handleSlashSelect}
          onClose={() => setSlash(null)}
        />
      )}
    </div>
  );
}
