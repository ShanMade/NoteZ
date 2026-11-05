"use client";

import React from "react";
import { House, FileText, Sparkles, AudioLines, Search } from "lucide-react";
import type { WorkspaceView } from "./WorkspaceSidebar";

interface Props {
  currentView: WorkspaceView;
  onNavigate: (view: WorkspaceView) => void;
  onOpenSearch: () => void;
  onOpenMobileSidebar: () => void;
  activeNoteId: string | null;
}

export function MobileNavBar({ currentView, onNavigate, onOpenSearch }: Props) {
  const notesActive = currentView === "notes" || currentView === "document" || currentView === "favorites";
  return (
    <nav className="nz3-mobile-nav" aria-label="Mobile navigation">
      <button type="button" className={currentView === "home" ? "is-active" : ""} onClick={() => onNavigate("home")} aria-current={currentView === "home" ? "page" : undefined}>
        <House size={19} /><span>Home</span>
      </button>
      <button type="button" className={notesActive ? "is-active" : ""} onClick={() => onNavigate("notes")} aria-current={notesActive ? "page" : undefined}>
        <FileText size={19} /><span>Notes</span>
      </button>
      <button type="button" className="nz3-mobile-search" onClick={onOpenSearch} aria-label="Search workspace">
        <span className="nz3-mobile-search-icon"><Search size={18} /></span><span>Search</span>
      </button>
      <button type="button" className={currentView === "ai" ? "is-active" : ""} onClick={() => onNavigate("ai")} aria-current={currentView === "ai" ? "page" : undefined}>
        <Sparkles size={19} /><span>AI</span>
      </button>
      <button type="button" className={currentView === "voice" ? "is-active" : ""} onClick={() => onNavigate("voice")} aria-current={currentView === "voice" ? "page" : undefined}>
        <AudioLines size={19} /><span>Voice</span>
      </button>
    </nav>
  );
}
