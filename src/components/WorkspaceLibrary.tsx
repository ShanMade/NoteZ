"use client";

import React, { useMemo, useState } from "react";
import { ArrowDownUp, ArrowRight, FileText, LayoutGrid, List, LockKeyhole, Plus, RotateCcw, Search, Sparkles, Star, Trash2, X } from "lucide-react";
import type { WorkspaceDocument } from "@/types/workspace";
import type { WorkspaceView } from "./WorkspaceSidebar";
import { plainTextFromHtml } from "@/lib/markdown";
import { DocumentIcon } from "./Brand";
import { documentPreview } from "./WorkspaceHome";
import { formatRelativeTime } from "@/lib/format";

interface Props {
  view: WorkspaceView;
  documents: WorkspaceDocument[];
  onCreate: () => void;
  onOpen: (id: string) => void;
  onFavorite: (id: string, favorite: boolean) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

export function WorkspaceLibrary({ view, documents, onCreate, onOpen, onFavorite, onRestore, onDelete }: Props) {
  const [query, setQuery] = useState("");
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const isTrash = view === "trash";
  const isFavorites = view === "favorites";
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return documents
      .filter((doc) => isTrash ? doc.isArchived : !doc.isArchived && (!isFavorites || doc.isFavorite))
      .filter((doc) => !search || `${doc.title} ${(doc.tags || []).join(" ")} ${doc.blocks.map((block) => plainTextFromHtml(block.content)).join(" ")}`.toLocaleLowerCase().includes(search))
      .sort((a, b) => sort === "name" ? (a.title || "Untitled").localeCompare(b.title || "Untitled") : b.updatedAt.localeCompare(a.updatedAt));
  }, [documents, isTrash, isFavorites, query, sort]);
  const heading = isTrash ? "Trash" : isFavorites ? "Favorites" : "All notes";

  return (
    <div className="nz3-library">
      <header className="nz3-library-header"><div><div className="nz3-kicker"><span className="nz3-kicker-dot" /> {isTrash ? "YOUR WORKSPACE" : "YOUR LIBRARY"}</div><h1>{heading}<span>.</span></h1><p>{isTrash ? "Pages you remove stay here until you delete them." : isFavorites ? "The pages you want to keep close." : "A little home for everything on your mind."}</p></div>{!isTrash && <button type="button" className="nz3-primary-btn" onClick={onCreate}><Plus size={16} /> New note</button>}</header>

      <section className="nz3-library-surface">
        <div className="nz3-library-toolbar"><label className="nz3-library-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your notes..." aria-label="Search your notes" />{query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>}</label><div className="nz3-library-controls"><label className="nz3-sort-control"><ArrowDownUp size={14} /><select value={sort} onChange={(event) => setSort(event.target.value as "recent" | "name")} aria-label="Sort notes"><option value="recent">Last edited</option><option value="name">Name</option></select></label><div className="nz3-layout-toggle" aria-label="Library layout"><button type="button" className={layout === "list" ? "is-active" : ""} aria-label="List view" aria-pressed={layout === "list"} onClick={() => setLayout("list")}><List size={16} /></button><button type="button" className={layout === "grid" ? "is-active" : ""} aria-label="Grid view" aria-pressed={layout === "grid"} onClick={() => setLayout("grid")}><LayoutGrid size={16} /></button></div></div></div>
        <div className="nz3-library-summary"><strong>{filtered.length} {filtered.length === 1 ? "page" : "pages"}</strong><span>{query.trim() ? `Matching “${query.trim()}”` : sort === "recent" ? "Recently edited first" : "Sorted by name"}</span></div>
        {filtered.length === 0 ? <div className="nz3-library-empty"><span><FileText size={22} /></span><h2>{query.trim() ? "No matching notes" : isTrash ? "Nothing in the trash" : isFavorites ? "Your favorites live here" : "A fresh start"}</h2><p>{query.trim() ? "Try another keyword or clear your search." : isTrash ? "Deleted pages will appear here until you remove them permanently." : isFavorites ? "Star any note to find it here later." : "Create a page and see where your ideas take you."}</p>{query.trim() ? <button type="button" className="nz3-secondary-btn" onClick={() => setQuery("")}>Clear search</button> : !isTrash && <button type="button" className="nz3-secondary-btn" onClick={onCreate}><Plus size={15} /> Create a note</button>}</div> : layout === "list" ? <div className="nz3-library-list"><div className="nz3-library-list-head"><span>NAME</span><span>LAST EDITED</span><span>DETAILS</span><span /></div><ul>{filtered.map((doc, index) => <li key={doc.id} className="nz3-library-row"><button type="button" className="nz3-library-note" onClick={() => isTrash ? onRestore(doc.id) : onOpen(doc.id)}><span className={`nz3-note-icon nz3-note-tone-${index % 3}`}><DocumentIcon icon={doc.icon} size={17} /></span><span><strong>{doc.title || "Untitled"}</strong><small>{documentPreview(doc)}</small></span></button><span className="nz3-library-date">{formatRelativeTime(doc.updatedAt)}</span><span className="nz3-library-details">{doc.isConfidential ? <><LockKeyhole size={13} /> Private</> : doc.isAiGenerated ? <><Sparkles size={13} /> AI note</> : doc.tags?.[0] ? `#${doc.tags[0]}` : "Note"}</span><div className="nz3-library-row-actions">{isTrash ? <><button type="button" aria-label={`Restore ${doc.title || "Untitled"}`} title="Restore" onClick={() => onRestore(doc.id)}><RotateCcw size={16} /></button><button type="button" aria-label={`Delete ${doc.title || "Untitled"} permanently`} title="Delete permanently" onClick={() => onDelete(doc.id)}><Trash2 size={16} /></button></> : <><button type="button" aria-label={`${doc.isFavorite ? "Remove" : "Add"} ${doc.title || "Untitled"} ${doc.isFavorite ? "from" : "to"} favorites`} title={doc.isFavorite ? "Remove from favorites" : "Add to favorites"} onClick={() => onFavorite(doc.id, !doc.isFavorite)}><Star size={16} fill={doc.isFavorite ? "currentColor" : "none"} className={doc.isFavorite ? "nz3-favorite-star" : ""} /></button><button type="button" aria-label={`Open ${doc.title || "Untitled"}`} onClick={() => onOpen(doc.id)}><ArrowRight size={16} /></button></>}</div></li>)}</ul></div> : <div className="nz3-library-grid">{filtered.map((doc, index) => <article key={doc.id} className="nz3-library-card"><div className="nz3-library-card-top"><span className={`nz3-note-icon nz3-note-tone-${index % 3}`}><DocumentIcon icon={doc.icon} size={18} /></span>{doc.isConfidential && <span className="nz3-library-private"><LockKeyhole size={12} /> Private</span>}</div><button type="button" className="nz3-library-card-content" onClick={() => isTrash ? onRestore(doc.id) : onOpen(doc.id)}><strong>{doc.title || "Untitled"}</strong><span>{documentPreview(doc)}</span></button><div className="nz3-library-card-footer"><span>{formatRelativeTime(doc.updatedAt)}</span><div>{isTrash ? <><button type="button" onClick={() => onRestore(doc.id)} aria-label={`Restore ${doc.title || "Untitled"}`}><RotateCcw size={16} /></button><button type="button" onClick={() => onDelete(doc.id)} aria-label={`Delete ${doc.title || "Untitled"} permanently`}><Trash2 size={16} /></button></> : <button type="button" onClick={() => onFavorite(doc.id, !doc.isFavorite)} aria-label={`${doc.isFavorite ? "Remove from" : "Add to"} favorites`}><Star size={16} fill={doc.isFavorite ? "currentColor" : "none"} className={doc.isFavorite ? "nz3-favorite-star" : ""} /></button>}</div></div></article>)}</div>}
      </section>
    </div>
  );
}
