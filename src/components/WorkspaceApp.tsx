"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, ChevronRight, LoaderCircle, Menu, Plus, Search, Sparkles } from "lucide-react";
import type {
  AssistantHistoryItem,
  AssistantResult,
  ProviderStatus,
  VoiceNote,
  WorkspaceDocument,
  WorkspaceUser,
} from "@/types/workspace";
import type { NoteBlock } from "@/types/notez";
import { escapeHtml } from "@/lib/text";
import { newId } from "@/lib/ids";
import { WorkspaceSidebar, type WorkspaceView } from "./WorkspaceSidebar";
import { WorkspaceHome } from "./WorkspaceHome";
import { WorkspaceTasks, collectTasks } from "./WorkspaceTasks";
import { WorkspaceLibrary } from "./WorkspaceLibrary";
import { WorkspaceEditor } from "./WorkspaceEditor";
import { WorkspaceAI } from "./WorkspaceAI";
import { WorkspaceVoice } from "./WorkspaceVoice";
import { WorkspaceSettingsPage } from "./WorkspaceSettingsPage";
import { WorkspaceSearch, MobileTabBar } from "./WorkspaceSearch";
import { DocumentIcon } from "./Brand";

interface Props {
  initialUser: WorkspaceUser;
  initialDocuments: WorkspaceDocument[];
  initialPageId: string | null;
  provider: ProviderStatus;
  onSignedOut?: () => void;
}

const RAIL_KEY = "notez-rail-collapsed";

const VIEW_LABELS: Record<WorkspaceView, string> = {
  home: "Home",
  notes: "All notes",
  favorites: "Favorites",
  tasks: "Tasks",
  ai: "NoteZ AI",
  voice: "Voice studio",
  trash: "Trash",
  document: "Note",
  settings: "Settings",
};

export function WorkspaceApp({ initialUser, initialDocuments, initialPageId, provider, onSignedOut }: Props) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [documents, setDocuments] = useState(initialDocuments);
  const [view, setView] = useState<WorkspaceView>(
    initialPageId && initialDocuments.some((d) => d.id === initialPageId && !d.isArchived) ? "document" : "home"
  );
  const [activeId, setActiveId] = useState<string | null>(initialPageId);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [toast, setToast] = useState("");
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);
  const [runs, setRuns] = useState<AssistantHistoryItem[]>([]);

  const docsRef = useRef(initialDocuments);
  const creatingRef = useRef(false);
  const flushRef = useRef<(id: string | null) => Promise<void>>(() => Promise.resolve());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queues = useRef(new Map<string, Promise<void>>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const currentDoc = useMemo(
    () => documents.find((d) => d.id === activeId && !d.isArchived) || null,
    [documents, activeId]
  );
  const openTaskCount = useMemo(() => collectTasks(documents).filter((t) => !t.checked).length, [documents]);
  const aiConnected = provider.configured;

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }, []);

  // Restore sidebar preference and load voice/AI history once.
  useEffect(() => {
    try {
      setRailCollapsed(localStorage.getItem(RAIL_KEY) === "1");
    } catch {
      // Ignore storage errors
    }
    let cancelled = false;
    Promise.all([
      fetch("/api/voice").then((r) => (r.ok ? r.json() : { notes: [] })),
      fetch("/api/assistant").then((r) => (r.ok ? r.json() : { history: [] })),
    ])
      .then(([voice, assistant]) => {
        if (cancelled) return;
        setVoiceNotes(voice.notes ?? []);
        setRuns(assistant.history ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(RAIL_KEY, railCollapsed ? "1" : "0");
    } catch {
      // Ignore storage errors
    }
  }, [railCollapsed]);

  // Apply theme, accent, and density from settings.
  useEffect(() => {
    const settings = user.settings;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && media.matches);
      root.classList.toggle("dark", dark);
      try {
        localStorage.setItem("notez-theme", dark ? "dark" : "light");
      } catch {
        // Ignore storage errors
      }
    };
    apply();
    root.dataset.accent = settings.accent;
    root.dataset.density = settings.density;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [user.settings]);

  // Global shortcuts: ⌘K search, ⌘/ AI, ⌘\ sidebar, ⌘, settings, ⌘N new page.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setSearchOpen((v) => !v);
      } else if (key === "/" || event.code === "Slash") {
        event.preventDefault();
        openAI();
      } else if (key === "\\") {
        event.preventDefault();
        setRailCollapsed((v) => !v);
      } else if (key === ",") {
        event.preventDefault();
        navigate("settings");
      } else if (key === "n" && !event.shiftKey) {
        event.preventDefault();
        void createDocument();
      }
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (voiceBusy) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", beforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, voiceBusy, activeId]);

  const persist = useCallback(
    (id: string) => {
      const doc = docsRef.current.find((d) => d.id === id);
      if (!doc) return Promise.resolve();
      const previous = queues.current.get(id) || Promise.resolve();
      const task = previous
        .catch(() => {})
        .then(async () => {
          const res = await fetch(`/api/documents/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: doc.title,
              icon: doc.icon,
              cover: doc.cover,
              tags: doc.tags,
              blocks: doc.blocks,
              isFavorite: doc.isFavorite,
              isArchived: doc.isArchived,
              parentId: doc.parentId,
            }),
          });
          if (!res.ok) throw new Error("Save failed");
          const data = await res.json();
          docsRef.current = docsRef.current.map((d) => (d.id === id ? { ...d, updatedAt: data.document.updatedAt } : d));
          setDocuments([...docsRef.current]);
          if (!timers.current.has(id)) setSaveState("saved");
        })
        .catch(() => {
          setSaveState("error");
          notify("Couldn't save your changes. Keep editing to retry.");
        });
      queues.current.set(id, task);
      return task;
    },
    [notify]
  );

  const flush = useCallback(
    (id: string | null) => {
      if (!id) return Promise.resolve();
      const timer = timers.current.get(id);
      if (timer) {
        clearTimeout(timer);
        timers.current.delete(id);
        return persist(id);
      }
      return queues.current.get(id) || Promise.resolve();
    },
    [persist]
  );
  flushRef.current = flush;

  const update = useCallback(
    (id: string, patch: Partial<WorkspaceDocument>) => {
      docsRef.current = docsRef.current.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d));
      setDocuments([...docsRef.current]);
      setSaveState("saving");
      const previous = timers.current.get(id);
      if (previous) clearTimeout(previous);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          void persist(id);
        }, 550)
      );
    },
    [persist]
  );

  // Save pending edits when the tab is hidden or the page unloads.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        for (const [id, timer] of timers.current) {
          clearTimeout(timer);
          timers.current.delete(id);
          void persist(id);
        }
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      for (const [id, timer] of timers.current) {
        clearTimeout(timer);
        timers.current.delete(id);
        void persist(id);
      }
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [persist]);

  const canLeaveVoice = () =>
    view !== "voice" ||
    !voiceBusy ||
    window.confirm("Leave voice studio? Recording will stop, and audio still being processed may be lost.");

  const navigate = (next: WorkspaceView) => {
    if (next !== "voice" && !canLeaveVoice()) return;
    setMobileNavOpen(false);
    setSearchOpen(false);
    const finish = () => {
      setView(next);
      mainRef.current?.scrollTo({ top: 0 });
      if (next !== "document") window.history.replaceState(null, "", "/");
    };
    void flush(activeId).then(finish);
  };

  const openDocument = (id: string, skipGuard = false) => {
    if (!skipGuard && !canLeaveVoice()) return;
    if (activeId !== id) void flush(activeId);
    setActiveId(id);
    setView("document");
    setMobileNavOpen(false);
    setSearchOpen(false);
    setSaveState("saved");
    mainRef.current?.scrollTo({ top: 0 });
    const url = new URL(window.location.href);
    url.searchParams.set("page", id);
    window.history.replaceState(null, "", url);
  };

  const createDocument = async (options: {
    title?: string;
    icon?: string;
    cover?: string | null;
    blocks?: Array<Partial<NoteBlock>>;
    parentId?: string | null;
    isAiGenerated?: boolean;
  } = {}): Promise<WorkspaceDocument | null> => {
    if (!canLeaveVoice() || creatingRef.current) return null;
    creatingRef.current = true;
    setCreatingPage(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create a note.");
      const doc = data.document as WorkspaceDocument;
      docsRef.current = [doc, ...docsRef.current];
      setDocuments([...docsRef.current]);
      openDocument(doc.id, true);
      notify("New page created");
      return doc;
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not create a note.");
      return null;
    } finally {
      creatingRef.current = false;
      setCreatingPage(false);
    }
  };

  const archive = (id: string) => {
    update(id, { isArchived: true });
    if (activeId === id) {
      setActiveId(null);
      setView("notes");
      window.history.replaceState(null, "", "/");
    }
    notify("Moved to trash");
  };

  const restore = (id: string) => {
    update(id, { isArchived: false });
    notify("Page restored");
  };

  const remove = async (id: string) => {
    if (!window.confirm("Permanently delete this page? This can't be undone.")) return;
    try {
      await flush(id);
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      docsRef.current = docsRef.current
        .filter((d) => d.id !== id)
        .map((d) => (d.parentId === id ? { ...d, parentId: null } : d));
      setDocuments([...docsRef.current]);
      if (activeId === id) {
        setActiveId(null);
        setView("notes");
      }
      notify("Page permanently deleted");
    } catch {
      notify("Couldn't delete this page");
    }
  };

  const duplicate = async (doc: WorkspaceDocument) => {
    await createDocument({
      title: `${doc.title || "Untitled"} (copy)`,
      icon: doc.icon,
      cover: doc.cover,
      blocks: doc.blocks,
      parentId: doc.parentId,
      isAiGenerated: doc.isAiGenerated,
    });
  };

  const toggleTask = (docId: string, blockId: string, checked: boolean) => {
    const doc = docsRef.current.find((d) => d.id === docId);
    if (!doc) return;
    update(docId, {
      blocks: doc.blocks.map((b) => (b.id === blockId ? { ...b, props: { ...b.props, checked } } : b)),
    });
  };

  const openAI = (prompt = "") => {
    if (view === "voice" && !canLeaveVoice()) return;
    setAiPrompt(prompt);
    setSearchOpen(false);
    setMobileNavOpen(false);
    void flushRef.current(activeId).then(() => {
      setView("ai");
      window.history.replaceState(null, "", "/");
    });
  };

  const createAiNote = async (result: AssistantResult) => {
    const doc = await createDocument({
      title: result.title || "AI draft",
      icon: "sparkles",
      cover: "lavender",
      blocks: result.blocks,
      isAiGenerated: true,
    });
    if (doc) notify("AI draft created. Edit it anytime.");
  };

  const appendAi = (result: AssistantResult) => {
    if (!currentDoc) {
      notify("Open a note before adding content.");
      return;
    }
    const added: NoteBlock[] = result.blocks.map((b, i) => ({
      id: newId(),
      pageId: currentDoc.id,
      type: b.type,
      content: b.content,
      props: b.props || {},
      position: currentDoc.blocks.length + i,
    }));
    update(currentDoc.id, { blocks: [...currentDoc.blocks, ...added] });
    openDocument(currentDoc.id, true);
    notify("Suggested blocks added to your note");
  };

  const createVoiceNote = async (voice: VoiceNote) => {
    const map = voice.speakerMap ?? {};
    const label = (speaker: string) => map[speaker]?.trim() || speaker;
    const blocks: Array<Partial<NoteBlock>> = [];

    if (voice.structured) {
      const s = voice.structured;
      blocks.push({
        type: "callout",
        content: escapeHtml(s.summary || "Meeting summary"),
        props: { icon: "🎙️", tone: "indigo" },
      });
      if (s.keyPoints.length) {
        blocks.push({ type: "heading2", content: "Key points", props: {} });
        for (const k of s.keyPoints) blocks.push({ type: "bullet", content: escapeHtml(k), props: {} });
      }
      if (s.decisions.length) {
        blocks.push({ type: "heading2", content: "Decisions", props: {} });
        for (const d of s.decisions) blocks.push({ type: "quote", content: escapeHtml(d), props: {} });
      }
      if (s.actionItems.length) {
        blocks.push({ type: "heading2", content: "Action items", props: {} });
        for (const a of s.actionItems) {
          const owner = a.owner && a.owner !== "Unassigned" ? ` — ${a.owner}` : "";
          blocks.push({ type: "todo", content: escapeHtml(`${a.task}${owner}`), props: { checked: false } });
        }
      }
      if (s.openQuestions.length) {
        blocks.push({ type: "heading2", content: "Open questions", props: {} });
        for (const q of s.openQuestions) blocks.push({ type: "bullet", content: escapeHtml(q), props: {} });
      }
    }

    blocks.push({ type: "heading2", content: "Transcript", props: {} });
    if (voice.segments.length) {
      for (const seg of voice.segments) {
        blocks.push({
          type: "paragraph",
          content: escapeHtml(`${label(seg.speaker)}: ${seg.text}`),
          props: {},
        });
      }
    } else if (voice.transcript) {
      blocks.push({ type: "paragraph", content: escapeHtml(voice.transcript), props: {} });
    }

    const doc = await createDocument({ title: voice.title, icon: "clipboard", cover: "sky", blocks });
    if (doc) {
      const res = await fetch(`/api/voice/${voice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setVoiceNotes((prev) => [data.note, ...prev.filter((n) => n.id !== data.note.id)]);
      }
      notify("Voice note added as a new page");
    }
  };

  const logout = async () => {
    if (view === "voice" && voiceBusy) {
      notify("Finish your recording before signing out.");
      return;
    }
    await Promise.all(Array.from(timers.current.keys()).map((id) => flush(id)));
    await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    if (onSignedOut) onSignedOut();
    else router.refresh();
  };

  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const crumbLabel = view === "document" ? currentDoc?.title || "Untitled" : VIEW_LABELS[view];
  const libraryViews: WorkspaceView[] = ["notes", "favorites", "trash"];

  return (
    <div className="nz2-app" data-density={user.settings.density}>
      <WorkspaceSidebar
        user={user}
        documents={documents}
        view={view}
        activeId={activeId}
        collapsed={railCollapsed}
        mobileOpen={mobileNavOpen}
        openTasks={openTaskCount}
        voiceCount={voiceNotes.length}
        aiConnected={aiConnected}
        onToggleCollapse={() => setRailCollapsed((v) => !v)}
        onCloseMobile={() => setMobileNavOpen(false)}
        onView={navigate}
        onDocument={openDocument}
        onCreate={() => void createDocument()}
        onCreateChild={(parentId) => void createDocument({ parentId })}
        onSearch={() => setSearchOpen(true)}
        onSettings={() => navigate("settings")}
        onSignOut={() => void logout()}
      />

      <div className="nz2-main">
        <header className="nz2-topbar">
          <div className="nz2-topbar-left">
            <button
              type="button"
              className="nz2-icon-btn nz2-menu-btn"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={19} />
            </button>
            <nav className="nz2-crumb" aria-label="Current location">
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>
                {view === "document" && currentDoc ? <DocumentIcon icon={currentDoc.icon} size={14} /> : null}
                {crumbLabel}
              </strong>
            </nav>
          </div>
          <div className="nz2-topbar-right">
            <button type="button" className="nz2-search-pill" onClick={() => setSearchOpen(true)}>
              <Search size={15} />
              <span>Search notes, tasks, and more</span>
              <kbd>⌘K</kbd>
            </button>
            <button type="button" className="nz2-btn nz2-btn-ghost nz2-btn-sm" onClick={() => openAI()} title="Ask NoteZ AI (⌘/)">
              <Sparkles size={15} /> <span>Ask AI</span>
            </button>
            <button type="button" className="nz2-btn nz2-btn-primary nz2-btn-sm" onClick={() => void createDocument()} title="New page (⌘N)">
              <Plus size={15} /> <span>New</span>
            </button>
            <button
              type="button"
              className="nz2-avatar nz2-avatar-btn"
              onClick={() => navigate("settings")}
              title="Settings"
              aria-label="Settings"
            >
              {initials}
            </button>
          </div>
        </header>

        {creatingPage && (
          <div className="nz2-overlay" role="status">
            <span>
              <LoaderCircle size={16} className="nz-spin" /> Creating your page…
            </span>
          </div>
        )}

        <main ref={mainRef} className="nz2-scroll">
          {view === "home" && (
            <WorkspaceHome
              user={user}
              documents={documents}
              voiceNotes={voiceNotes}
              runs={runs}
              onCreate={() => void createDocument()}
              onOpen={openDocument}
              onNotes={() => navigate("notes")}
              onAI={() => openAI()}
              onVoice={() => navigate("voice")}
              onTasks={() => navigate("tasks")}
              onToggleTask={toggleTask}
            />
          )}

          {view === "tasks" && <WorkspaceTasks documents={documents} onToggle={toggleTask} onOpen={openDocument} />}

          {libraryViews.includes(view) && (
            <WorkspaceLibrary
              view={view}
              documents={documents}
              onCreate={() => void createDocument()}
              onOpen={openDocument}
              onFavorite={(id, favorite) => update(id, { isFavorite: favorite })}
              onRestore={restore}
              onDelete={(id) => void remove(id)}
            />
          )}

          {view === "document" && currentDoc && (
            <WorkspaceEditor
              key={currentDoc.id}
              doc={currentDoc}
              documents={documents}
              settings={user.settings}
              saveState={saveState}
              onChange={(patch) => update(currentDoc.id, patch)}
              onArchive={() => archive(currentDoc.id)}
              onDuplicate={() => void duplicate(currentDoc)}
              onCreateChild={() => void createDocument({ parentId: currentDoc.id })}
              onOpen={openDocument}
              onAI={() => openAI()}
              onNotice={notify}
            />
          )}

          {view === "ai" && (
            <WorkspaceAI
              documents={documents}
              currentDoc={currentDoc}
              provider={provider}
              runs={runs}
              defaultScope={user.settings.defaultAiScope}
              initialPrompt={aiPrompt}
              onRunsChange={setRuns}
              onOpen={openDocument}
              onCreate={(result) => void createAiNote(result)}
              onAppend={appendAi}
              onVoice={() => navigate("voice")}
              onSettings={() => navigate("settings")}
              onNotice={notify}
            />
          )}

          {view === "voice" && (
            <WorkspaceVoice
              provider={provider}
              settings={user.settings}
              notes={voiceNotes}
              onNotesChange={setVoiceNotes}
              onBusyChange={setVoiceBusy}
              onCreateNote={(note) => void createVoiceNote(note)}
              onAskAI={(prompt) => openAI(prompt)}
              onSettings={() => navigate("settings")}
              onNotice={notify}
            />
          )}

          {view === "settings" && (
            <WorkspaceSettingsPage
              user={user}
              provider={provider}
              onUser={setUser}
              onSignOut={() => void logout()}
              onNotice={notify}
            />
          )}
        </main>
      </div>

      {searchOpen && (
        <WorkspaceSearch
          documents={documents}
          currentDoc={currentDoc}
          onClose={() => setSearchOpen(false)}
          onOpen={openDocument}
          onCreate={() => void createDocument()}
          onAI={() => openAI()}
          onVoice={() => navigate("voice")}
        />
      )}

      <MobileTabBar
        view={view}
        onView={(target) => navigate(target)}
        onSearch={() => setSearchOpen(true)}
        onMore={() => setMobileNavOpen(true)}
        onCreate={() => void createDocument()}
      />

      {toast && (
        <div className="nz-toast" role="status">
          {saveState === "error" ? <AlertCircle size={16} /> : <Check size={16} />}
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
