"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  ChevronDown,
  ChevronRight,
  FilePlus2,
  FileText,
  House,
  ListChecks,
  Lock,
  LogOut,
  PanelLeft,
  PanelLeftClose,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import type { WorkspaceDocument, WorkspaceUser } from "@/types/workspace";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";
import { DocumentIcon, NoteZLogo, NoteZMark } from "./Brand";

export type WorkspaceView = "home" | "notes" | "favorites" | "tasks" | "ai" | "voice" | "trash" | "document" | "settings";

interface Props {
  user: WorkspaceUser;
  documents: WorkspaceDocument[];
  view: WorkspaceView;
  activeId: string | null;
  collapsed: boolean;
  mobileOpen: boolean;
  openTasks: number;
  voiceCount: number;
  aiConnected: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
  onView: (view: WorkspaceView) => void;
  onDocument: (id: string, openWithAiSidebar?: boolean) => void;
  onCreate: () => void;
  onCreateChild: (parentId: string) => void;
  onSearch: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}

const SECTIONS_KEY = "notez-sidebar-sections";
type SectionKey = "pages";

function NavItem({
  icon: Icon,
  label,
  active,
  count,
  rail,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  count?: number;
  rail: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`ed-navitem ${active ? "is-active" : ""}`}
      onClick={onClick}
      title={rail ? label : undefined}
      aria-label={rail ? label : undefined}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={16} strokeWidth={1.75} className="ed-navicon" />
      {!rail && <span className="ed-navlabel">{label}</span>}
      {!rail && count !== undefined && count > 0 && <span className="ed-navcount">{count}</span>}
    </button>
  );
}

export function WorkspaceSidebar({
  user,
  documents,
  view,
  activeId,
  collapsed,
  mobileOpen,
  openTasks,
  voiceCount,
  onToggleCollapse,
  onCloseMobile,
  onView,
  onDocument,
  onCreate,
  onCreateChild,
  onSearch,
  onSettings,
  onSignOut,
}: Props) {
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ pages: true });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [treeFilter, setTreeFilter] = useState("");
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const rail = collapsed && !mobileOpen;
  useOverlayFocus(mobileOpen, sidebarRef, onCloseMobile, closeRef);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SECTIONS_KEY);
      if (saved) setSections((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {
      /* optional preference */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
    } catch {
      /* optional preference */
    }
  }, [sections]);

  const active = useMemo(() => documents.filter((doc) => !doc.isArchived), [documents]);
  const trashCount = documents.length - active.length;
  const favoriteCount = active.filter((doc) => doc.isFavorite).length;

  const filteredActive = useMemo(() => {
    const query = treeFilter.trim().toLocaleLowerCase();
    if (!query) return active;
    return active.filter(
      (doc) =>
        (doc.title || "Untitled").toLocaleLowerCase().includes(query) ||
        (doc.tags || []).some((tag) => tag.toLocaleLowerCase().includes(query))
    );
  }, [active, treeFilter]);

  const childrenOf = useMemo(() => {
    const ids = new Set(filteredActive.map((doc) => doc.id));
    const map = new Map<string | null, WorkspaceDocument[]>();
    for (const doc of filteredActive) {
      const key = doc.parentId && ids.has(doc.parentId) ? doc.parentId : null;
      map.set(key, [...(map.get(key) || []), doc]);
    }
    return map;
  }, [filteredActive]);

  // Reveal the open page's ancestors.
  useEffect(() => {
    if (!activeId) return;
    const byId = new Map(active.map((doc) => [doc.id, doc]));
    const seen = new Set<string>();
    const next: Record<string, boolean> = {};
    let cursor = byId.get(activeId)?.parentId ?? null;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      next[cursor] = true;
      cursor = byId.get(cursor)?.parentId ?? null;
    }
    if (Object.keys(next).length) setExpanded((prev) => ({ ...prev, ...next }));
  }, [activeId, active]);

  useEffect(() => {
    if (!userMenu) return;
    const onDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setUserMenu(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenu(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [userMenu]);

  const initials = user.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const roots = childrenOf.get(null) || [];

  const renderTree = (doc: WorkspaceDocument, depth: number): React.ReactNode => {
    const kids = childrenOf.get(doc.id) || [];
    const isOpen = Boolean(expanded[doc.id]) || Boolean(treeFilter.trim());
    const isActive = view === "document" && activeId === doc.id;
    return (
      <li key={doc.id}>
        <div
          className={`ed-treerow ${isActive ? "is-active" : ""}`}
          style={{ paddingLeft: 4 + Math.min(depth, 5) * 12 }}
        >
          <button
            type="button"
            className={`ed-treetoggle ${kids.length ? "has-children" : ""}`}
            onClick={() => setExpanded((prev) => ({ ...prev, [doc.id]: !prev[doc.id] }))}
            disabled={!kids.length}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${doc.title || "Untitled"}`}
            aria-expanded={kids.length ? isOpen : undefined}
          >
            <ChevronRight size={11} className={isOpen ? "is-open" : ""} />
          </button>
          <button type="button" className="ed-treetitle" onClick={() => onDocument(doc.id)}>
            <DocumentIcon icon={doc.icon} size={13} />
            <span>{doc.title || "Untitled"}</span>
            {doc.isConfidential && <Lock size={9} className="ed-treelock" aria-label="Confidential" />}
            {doc.isFavorite && <Star size={9} className="ed-treestar" fill="currentColor" aria-label="Favorite" />}
          </button>
          <div className="ed-treeactions">
            <button
              type="button"
              title="Open with AI"
              aria-label={`Ask AI about ${doc.title || "Untitled"}`}
              onClick={() => onDocument(doc.id, true)}
            >
              <Sparkles size={11} />
            </button>
            <button
              type="button"
              title="Add subpage"
              aria-label={`Add subpage to ${doc.title || "Untitled"}`}
              onClick={() => {
                setExpanded((prev) => ({ ...prev, [doc.id]: true }));
                onCreateChild(doc.id);
              }}
            >
              <Plus size={11} />
            </button>
          </div>
        </div>
        {kids.length > 0 && isOpen && (
          <ul className="ed-tree">{kids.map((child) => renderTree(child, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="ed-scrim"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          tabIndex={-1}
        />
      )}
      <aside
        ref={sidebarRef}
        className={`ed-side ${rail ? "is-rail" : ""} ${mobileOpen ? "is-open" : ""}`}
        aria-label="Workspace sidebar"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        tabIndex={mobileOpen ? -1 : undefined}
      >
        <div className="ed-side-top">
          {rail ? (
            <NoteZMark size={25} />
          ) : (
            <>
              <NoteZLogo />
              {mobileOpen ? (
                <button
                  ref={closeRef}
                  type="button"
                  className="ed-iconbtn"
                  onClick={onCloseMobile}
                  aria-label="Close sidebar"
                >
                  <X size={17} />
                </button>
              ) : (
                <button
                  type="button"
                  className="ed-iconbtn"
                  onClick={onToggleCollapse}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar (⌘\)"
                >
                  <PanelLeftClose size={15} />
                </button>
              )}
            </>
          )}
        </div>

        {rail && (
          <button
            type="button"
            className="ed-iconbtn ed-railexpand"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            title="Expand sidebar (⌘\)"
          >
            <PanelLeft size={15} />
          </button>
        )}

        {!rail && (
          <div className="ed-side-lead">
            <button
              type="button"
              className="ed-sidebtn"
              onClick={onSearch}
              title="Search (⌘K)"
            >
              <Search size={14} />
              <span>Search</span>
              <kbd>⌘K</kbd>
            </button>
            <button
              type="button"
              className="ed-sidebtn ed-sidebtn-new"
              onClick={onCreate}
              title="New page (⌘N)"
            >
              <Plus size={14} />
              <span>New page</span>
            </button>
          </div>
        )}

        <div className="ed-side-scroll">
          <div className="ed-navgroup">
            <NavItem icon={House} label="Home" active={view === "home"} rail={rail} onClick={() => onView("home")} />
            <NavItem icon={FileText} label="All notes" active={view === "notes"} count={active.length} rail={rail} onClick={() => onView("notes")} />
            <NavItem icon={ListChecks} label="Tasks" active={view === "tasks"} count={openTasks} rail={rail} onClick={() => onView("tasks")} />
            <NavItem icon={Star} label="Favorites" active={view === "favorites"} count={favoriteCount} rail={rail} onClick={() => onView("favorites")} />
            <NavItem icon={Sparkles} label="ByNote AI" active={view === "ai"} rail={rail} onClick={() => onView("ai")} />
            <NavItem icon={AudioLines} label="Voice notes" active={view === "voice"} count={voiceCount} rail={rail} onClick={() => onView("voice")} />
          </div>

          {!rail && (
            <section className="ed-group ed-pages">
              <div className="ed-group-head">
                <button
                  type="button"
                  className="ed-group-toggle"
                  onClick={() => setSections((s) => ({ ...s, pages: !s.pages }))}
                  aria-expanded={sections.pages}
                >
                  <ChevronDown size={11} className={sections.pages ? "" : "is-closed"} />
                  <span>Pages</span>
                </button>
                <button
                  type="button"
                  className="ed-group-add"
                  onClick={onCreate}
                  aria-label="New page"
                  title="New page"
                >
                  <FilePlus2 size={12} />
                </button>
              </div>

              {sections.pages && (
                <>
                  {active.length > 5 && (
                    <div className="ed-treefilter">
                      <Search size={11} />
                      <input
                        value={treeFilter}
                        onChange={(event) => setTreeFilter(event.target.value)}
                        placeholder="Filter"
                        aria-label="Filter pages"
                      />
                      {treeFilter && (
                        <button type="button" onClick={() => setTreeFilter("")} aria-label="Clear filter">
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  )}
                  {roots.length ? (
                    <ul className="ed-tree">{roots.map((doc) => renderTree(doc, 0))}</ul>
                  ) : (
                    <p className="ed-side-empty">
                      {treeFilter ? "No matching pages." : "Pages you create appear here."}
                    </p>
                  )}
                </>
              )}
            </section>
          )}
        </div>

        <div className="ed-side-foot">
          <NavItem icon={Trash2} label="Trash" active={view === "trash"} count={trashCount} rail={rail} onClick={() => onView("trash")} />

          <div className="ed-account" ref={menuRef}>
            <button
              type="button"
              className="ed-account-btn"
              onClick={() => setUserMenu((value) => !value)}
              aria-haspopup="menu"
              aria-expanded={userMenu}
              aria-label={`Account menu for ${user.name}`}
            >
              <span className="ed-avatar">{initials}</span>
              {!rail && (
                <span className="ed-account-copy">
                  <strong>{user.name}</strong>
                  <small>{user.isDemo ? "Demo workspace" : user.email}</small>
                </span>
              )}
              {!rail && <ChevronDown size={12} />}
            </button>
            {userMenu && (
              <div className="ed-menu ed-menu-up" role="menu">
                <div className="ed-menu-head">
                  <strong>{user.name}</strong>
                  <small>{user.isDemo ? "Demo workspace" : user.email}</small>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setUserMenu(false);
                    onSettings();
                  }}
                >
                  <Settings size={14} /> Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={() => {
                    setUserMenu(false);
                    onSignOut();
                  }}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
