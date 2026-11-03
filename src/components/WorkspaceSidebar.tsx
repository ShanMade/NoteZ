"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  ChevronDown,
  ChevronRight,
  FileText,
  House,
  ListChecks,
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
import { DocumentIcon, NoteZLogo, NoteZMark } from "./Brand";

export type WorkspaceView =
  | "home"
  | "notes"
  | "favorites"
  | "tasks"
  | "ai"
  | "voice"
  | "trash"
  | "document"
  | "settings";

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
  onDocument: (id: string) => void;
  onCreate: () => void;
  onCreateChild: (parentId: string) => void;
  onSearch: () => void;
  onSettings: () => void;
  onSignOut: () => void;
}

const SECTIONS_KEY = "notez-sidebar-sections";
type SectionKey = "pinned" | "pages";

function NavItem({
  icon: Icon,
  label,
  active,
  badge,
  collapsed,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: number;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`nz2-nav-item ${active ? "is-active" : ""}`}
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={17} strokeWidth={1.8} />
      {!collapsed && <span className="nz2-label">{label}</span>}
      {!collapsed && badge !== undefined && badge > 0 && <em className="nz2-badge">{badge}</em>}
    </button>
  );
}

function Section({
  title,
  open,
  onToggle,
  action,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="nz2-section">
      <div className="nz2-section-head">
        <button type="button" className="nz2-section-toggle" onClick={onToggle} aria-expanded={open}>
          <ChevronDown size={13} className={open ? "" : "is-closed"} />
          <span>{title}</span>
        </button>
        {action}
      </div>
      {open && <div className="nz2-section-body">{children}</div>}
    </section>
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
  aiConnected,
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
  const [sections, setSections] = useState<Record<SectionKey, boolean>>({ pinned: true, pages: true });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SECTIONS_KEY);
      if (saved) setSections((prev) => ({ ...prev, ...JSON.parse(saved) }));
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(sections));
    } catch {
      // Ignore storage errors
    }
  }, [sections]);

  const active = useMemo(() => documents.filter((d) => !d.isArchived), [documents]);
  const trashCount = documents.length - active.length;
  const pinned = useMemo(() => active.filter((d) => d.isFavorite).slice(0, 6), [active]);

  const childrenOf = useMemo(() => {
    const ids = new Set(active.map((d) => d.id));
    const map = new Map<string | null, WorkspaceDocument[]>();
    for (const doc of active) {
      const key = doc.parentId && ids.has(doc.parentId) ? doc.parentId : null;
      map.set(key, [...(map.get(key) ?? []), doc]);
    }
    return map;
  }, [active]);

  const roots = childrenOf.get(null) ?? [];

  // Reveal the ancestors of the open note so it is always visible in the tree.
  useEffect(() => {
    if (!activeId) return;
    const byId = new Map(active.map((d) => [d.id, d]));
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
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [userMenu]);

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const renderTree = (doc: WorkspaceDocument, depth: number): React.ReactNode => {
    const kids = childrenOf.get(doc.id) ?? [];
    const isOpen = Boolean(expanded[doc.id]);
    const isActive = view === "document" && activeId === doc.id;
    return (
      <li key={doc.id} className="nz2-tree-item">
        <div className={`nz2-tree-row ${isActive ? "is-active" : ""}`} style={{ paddingLeft: 6 + depth * 14 }}>
          <button
            type="button"
            className={`nz2-tree-toggle ${kids.length ? "has-children" : ""}`}
            onClick={() => setExpanded((prev) => ({ ...prev, [doc.id]: !prev[doc.id] }))}
            disabled={!kids.length}
            aria-label={isOpen ? "Collapse" : "Expand"}
            aria-expanded={isOpen}
          >
            <ChevronRight size={13} className={isOpen ? "is-open" : ""} />
          </button>
          <button type="button" className="nz2-tree-title" onClick={() => onDocument(doc.id)}>
            <DocumentIcon icon={doc.icon} size={14} />
            <span>{doc.title || "Untitled"}</span>
          </button>
          <button
            type="button"
            className="nz2-tree-add"
            title="Add subpage"
            aria-label={`Add subpage to ${doc.title || "Untitled"}`}
            onClick={() => {
              setExpanded((prev) => ({ ...prev, [doc.id]: true }));
              onCreateChild(doc.id);
            }}
          >
            <Plus size={13} />
          </button>
        </div>
        {kids.length > 0 && isOpen && <ul className="nz2-tree-children">{kids.map((k) => renderTree(k, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <>
      {mobileOpen && <button type="button" className="nz2-scrim" onClick={onCloseMobile} aria-label="Close navigation" />}
      <aside
        className={`nz2-side ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-open" : ""}`}
        aria-label="Workspace sidebar"
      >
        <div className="nz2-side-head">
          {collapsed ? <NoteZMark size={28} /> : <NoteZLogo />}
          {!collapsed && (
            <>
              <button type="button" className="nz2-icon-btn nz2-collapse-btn" onClick={onToggleCollapse} aria-label="Collapse sidebar" title="Collapse sidebar (⌘\)">
                <PanelLeftClose size={17} />
              </button>
              <button type="button" className="nz2-icon-btn nz2-close-btn" onClick={onCloseMobile} aria-label="Close navigation">
                <X size={18} />
              </button>
            </>
          )}
        </div>
        {collapsed && (
          <button type="button" className="nz2-icon-btn nz2-expand-btn" onClick={onToggleCollapse} aria-label="Expand sidebar" title="Expand sidebar (⌘\)">
            <PanelLeft size={17} />
          </button>
        )}

        <div className="nz2-side-actions">
          <button type="button" className="nz2-search-trigger" onClick={onSearch} title="Search (⌘K)">
            <Search size={15} />
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <button type="button" className="nz2-new-btn" onClick={onCreate} title="New page (⌘N)" aria-label="New page">
            <Plus size={17} />
          </button>
        </div>

        <nav className="nz2-nav" aria-label="Primary">
          <NavItem icon={House} label="Home" active={view === "home"} collapsed={collapsed} onClick={() => onView("home")} />
          <NavItem icon={FileText} label="All notes" active={view === "notes"} badge={active.length} collapsed={collapsed} onClick={() => onView("notes")} />
          <NavItem icon={Star} label="Favorites" active={view === "favorites"} collapsed={collapsed} onClick={() => onView("favorites")} />
          <NavItem icon={ListChecks} label="Tasks" active={view === "tasks"} badge={openTasks} collapsed={collapsed} onClick={() => onView("tasks")} />
        </nav>

        <nav className="nz2-nav nz2-nav-tools" aria-label="Tools">
          {!collapsed && <div className="nz2-group-label">Intelligence</div>}
          <NavItem icon={Sparkles} label="NoteZ AI" active={view === "ai"} collapsed={collapsed} onClick={() => onView("ai")} />
          <NavItem icon={AudioLines} label="Voice notes" active={view === "voice"} badge={voiceCount} collapsed={collapsed} onClick={() => onView("voice")} />
        </nav>

        {!collapsed && (
          <div className="nz2-side-scroll">
            {pinned.length > 0 && (
              <Section title="Pinned" open={sections.pinned} onToggle={() => setSections((s) => ({ ...s, pinned: !s.pinned }))}>
                <ul className="nz2-pinned">
                  {pinned.map((doc) => (
                    <li key={doc.id}>
                      <button
                        type="button"
                        className={`nz2-pin-item ${view === "document" && activeId === doc.id ? "is-active" : ""}`}
                        onClick={() => onDocument(doc.id)}
                      >
                        <DocumentIcon icon={doc.icon} size={14} />
                        <span>{doc.title || "Untitled"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section
              title="Pages"
              open={sections.pages}
              onToggle={() => setSections((s) => ({ ...s, pages: !s.pages }))}
              action={
                <button type="button" className="nz2-section-add" onClick={onCreate} aria-label="New page" title="New page">
                  <Plus size={14} />
                </button>
              }
            >
              {roots.length ? (
                <ul className="nz2-tree">{roots.map((doc) => renderTree(doc, 0))}</ul>
              ) : (
                <p className="nz2-side-empty">Pages you create will appear here.</p>
              )}
            </Section>
          </div>
        )}

        <div className="nz2-side-foot">
          <NavItem icon={Trash2} label="Trash" active={view === "trash"} badge={trashCount} collapsed={collapsed} onClick={() => onView("trash")} />
          {!collapsed && (
            <div className="nz2-ai-status">
              <span className={`nz2-dot ${aiConnected ? "is-on" : ""}`} />
              <span>{aiConnected ? "Gemini connected" : "Basic mode"}</span>
            </div>
          )}
          <div className="nz2-user" ref={menuRef}>
            <button
              type="button"
              className="nz2-user-btn"
              onClick={() => setUserMenu((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={userMenu}
              title={user.name}
            >
              <span className="nz2-avatar">{initials}</span>
              {!collapsed && (
                <span className="nz2-user-meta">
                  <strong>{user.name}</strong>
                  <small>{user.isDemo ? "Demo workspace" : user.email}</small>
                </span>
              )}
              {!collapsed && <ChevronDown size={14} />}
            </button>
            {userMenu && (
              <div className="nz2-user-menu" role="menu">
                <div className="nz2-menu-head">
                  <strong>{user.name}</strong>
                  <small>{user.isDemo ? "Demo workspace" : user.email}</small>
                </div>
                <button type="button" role="menuitem" onClick={() => { setUserMenu(false); onSettings(); }}>
                  <Settings size={15} /> Settings
                </button>
                <button type="button" role="menuitem" className="is-danger" onClick={() => { setUserMenu(false); onSignOut(); }}>
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
