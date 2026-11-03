"use client";

import React, { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  Bot,
  Check,
  Database,
  Download,
  KeyRound,
  LoaderCircle,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Pencil,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  TriangleAlert,
  User,
  Lightbulb,
  Type,
} from "lucide-react";
import { ACCENTS, type AccentName, type AiScope, type EditorFont, type EditorWidth, type Density, type ThemePreference, type ProviderStatus, type WorkspaceSettings, type WorkspaceUser } from "@/types/workspace";

type Section = "profile" | "appearance" | "editor" | "ai" | "search" | "voice" | "data" | "danger";

const SECTIONS: Array<{ id: Section; label: string; icon: LucideIcon }> = [
  { id: "profile", label: "Profile", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "editor", label: "Editor", icon: Pencil },
  { id: "ai", label: "AI & privacy", icon: Bot },
  { id: "search", label: "Search & memory", icon: Database },
  { id: "voice", label: "Voice", icon: AudioLines },
  { id: "data", label: "Data & security", icon: Database },
  { id: "danger", label: "Danger zone", icon: TriangleAlert },
];

const ACCENT_META: Record<AccentName, { label: string; color: string }> = {
  indigo: { label: "Indigo", color: "#6d5ce7" },
  rose: { label: "Rose", color: "#d8466f" },
  teal: { label: "Teal", color: "#0f8f83" },
  amber: { label: "Amber", color: "#c77a0a" },
};

const LANGUAGES: Array<{ id: string; label: string }> = [
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "es-ES", label: "Español" },
  { id: "fr-FR", label: "Français" },
  { id: "de-DE", label: "Deutsch" },
  { id: "pt-BR", label: "Português (Brasil)" },
  { id: "hi-IN", label: "हिन्दी" },
  { id: "ja-JP", label: "日本語" },
];

interface Props {
  user: WorkspaceUser;
  provider: ProviderStatus;
  onUser: (user: WorkspaceUser) => void;
  onSignOut: () => void;
  onNotice: (message: string) => void;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`nz2-toggle ${checked ? "is-on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ id: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div className="nz2-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? "is-on" : ""} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ title, detail, children }: { title: string; detail?: string; children: React.ReactNode }) {
  return (
    <div className="nz2-set-row">
      <div>
        <strong>{title}</strong>
        {detail && <p>{detail}</p>}
      </div>
      <div className="nz2-set-control">{children}</div>
    </div>
  );
}

export function WorkspaceSettingsPage({ user, provider, onUser, onSignOut, onNotice }: Props) {
  const [section, setSection] = useState<Section>("appearance");
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [providerInfo, setProviderInfo] = useState(provider);
  const [checking, setChecking] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [searchInfo, setSearchInfo] = useState<{
    postgres: { connected: boolean; chunks: number };
    qdrant: { configured: boolean; connected: boolean };
    embeddings: { provider: string; model: string; dimension: number };
    breakdown: { notes: number; voice: number; ai: number };
  } | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const s: WorkspaceSettings = user.settings;

  async function loadSearchInfo() {
    try {
      const res = await fetch("/api/search/status");
      if (res.ok) setSearchInfo(await res.json());
    } catch {
      // Leave previous values in place
    }
  }

  async function reindex() {
    setSearchBusy(true);
    try {
      const res = await fetch("/api/search/reindex", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Reindex failed.");
      onNotice(`Reindexed ${data.indexed.notes} notes, ${data.indexed.voice} voice notes, ${data.indexed.ai} AI answers`);
      await loadSearchInfo();
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "Reindex failed.");
    } finally {
      setSearchBusy(false);
    }
  }

  async function save(body: { name?: string; settings?: Partial<WorkspaceSettings> }, message = "Saved") {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save your changes.");
      onUser(data.user as WorkspaceUser);
      onNotice(message);
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "Couldn't save your changes.");
    } finally {
      setSaving(false);
    }
  }

  const setSetting = (patch: Partial<WorkspaceSettings>) => void save({ settings: patch }, "Preferences updated");

  useEffect(() => {
    if (section === "search") void loadSearchInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  async function checkConnection() {
    setChecking(true);
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      if (data.provider) setProviderInfo(data.provider);
      onNotice(data.provider?.configured ? "Gemini is connected" : "Gemini isn't configured on the server");
    } catch {
      onNotice("Couldn't reach the server");
    } finally {
      setChecking(false);
    }
  }

  async function exportData() {
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `notez-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      onNotice("Export downloaded");
    } catch {
      onNotice("Export failed. Try again.");
    }
  }

  async function signOutEverywhere() {
    if (!window.confirm("Sign out on every device? You'll need to sign in again.")) return;
    await fetch("/api/settings/sessions", { method: "POST" }).catch(() => {});
    onSignOut();
  }

  async function deleteAccount() {
    if (confirmText !== "DELETE") return;
    const res = await fetch("/api/settings", { method: "DELETE" });
    if (res.ok) onSignOut();
    else onNotice("Couldn't delete your account. Try again.");
  }

  return (
    <div className="nz2-page nz2-settings-page">
      <header className="nz2-page-head">
        <div>
          <span className="nz2-eyebrow">Your preferences</span>
          <h1 className="nz2-title">Settings</h1>
          <p className="nz2-sub">Shape how NoteZ looks, writes, listens, and protects your notes.</p>
        </div>
      </header>

      <div className="nz2-settings">
        <nav className="nz2-settings-nav" aria-label="Settings sections">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`${section === id ? "is-on" : ""} ${id === "danger" ? "is-danger" : ""}`} onClick={() => setSection(id)} aria-current={section === id ? "true" : undefined}>
              <Icon size={16} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="nz2-settings-body">
          {section === "profile" && (
            <section className="nz2-set-section">
              <div className="nz2-set-head">
                <h2>Profile</h2>
                <p>How your name appears across NoteZ.</p>
              </div>
              <div className="nz2-profile-card">
                <span className="nz2-avatar nz2-avatar-lg">{user.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}</span>
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.isDemo ? "Demo workspace · temporary" : user.email}</small>
                </div>
              </div>
              <div className="nz2-set-group">
                <label className="nz2-field">
                  <span>Display name</span>
                  <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="nz2-field">
                  <span>Email</span>
                  <input value={user.isDemo ? "Demo workspace" : user.email} disabled />
                </label>
                <div className="nz2-set-actions">
                  <button type="button" className="nz2-btn nz2-btn-primary" disabled={saving || name.trim().length < 2 || name.trim() === user.name} onClick={() => void save({ name: name.trim() }, "Profile updated")}>
                    {saving ? <LoaderCircle size={14} className="nz-spin" /> : <Check size={14} />} Save profile
                  </button>
                </div>
              </div>
            </section>
          )}

          {section === "appearance" && (
            <section className="nz2-set-section">
              <div className="nz2-set-head">
                <h2>Appearance</h2>
                <p>Choose a theme and accent. Changes apply instantly.</p>
              </div>
              <div className="nz2-set-group">
                <span className="nz2-group-title">Theme</span>
                <div className="nz2-theme-cards">
                  {([
                    { id: "light", label: "Light", icon: Sun },
                    { id: "dark", label: "Dark", icon: Moon },
                    { id: "system", label: "System", icon: Monitor },
                  ] as Array<{ id: ThemePreference; label: string; icon: LucideIcon }>).map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" className={`nz2-theme-card ${s.theme === id ? "is-on" : ""}`} onClick={() => setSetting({ theme: id })} aria-pressed={s.theme === id}>
                      <span className={`nz2-theme-preview is-${id}`}>
                        <i />
                        <i />
                        <i />
                      </span>
                      <span className="nz2-theme-label">
                        <Icon size={14} /> {label}
                        {s.theme === id && <Check size={14} className="nz2-theme-check" />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="nz2-set-group">
                <Row title="Accent color" detail="Used for buttons, highlights, and selection.">
                  <div className="nz2-swatches">
                    {ACCENTS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        className={`nz2-swatch ${s.accent === a ? "is-on" : ""}`}
                        style={{ background: ACCENT_META[a].color }}
                        aria-label={ACCENT_META[a].label}
                        title={ACCENT_META[a].label}
                        onClick={() => setSetting({ accent: a })}
                      >
                        {s.accent === a && <Check size={13} />}
                      </button>
                    ))}
                  </div>
                </Row>
                <Row title="Density" detail="Compact fits more into each view.">
                  <Segmented<Density>
                    label="Density"
                    value={s.density}
                    options={[
                      { id: "comfortable", label: "Comfortable" },
                      { id: "compact", label: "Compact" },
                    ]}
                    onChange={(v) => setSetting({ density: v })}
                  />
                </Row>
                <Row title="Show tips" detail="Helpful reminders on the home page.">
                  <Toggle label="Show tips" checked={s.showTips} onChange={(v) => setSetting({ showTips: v })} />
                </Row>
              </div>
            </section>
          )}

          {section === "editor" && (
            <section className="nz2-set-section">
              <div className="nz2-set-head">
                <h2>Editor</h2>
                <p>How notes are laid out and written.</p>
              </div>
              <div className="nz2-set-group">
                <span className="nz2-group-title">Reading font</span>
                <div className="nz2-font-cards">
                  {([
                    { id: "sans", label: "Sans", cls: "is-sans", sample: "Aa" },
                    { id: "serif", label: "Serif", cls: "is-serif", sample: "Aa" },
                    { id: "mono", label: "Mono", cls: "is-mono", sample: "Aa" },
                  ] as Array<{ id: EditorFont; label: string; cls: string; sample: string }>).map((f) => (
                    <button key={f.id} type="button" className={`nz2-font-card ${s.editorFont === f.id ? "is-on" : ""}`} onClick={() => setSetting({ editorFont: f.id })} aria-pressed={s.editorFont === f.id}>
                      <span className={`nz2-font-sample ${f.cls}`}>{f.sample}</span>
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="nz2-set-group">
                <Row title="Page width" detail="Comfortable keeps long lines easy to read.">
                  <Segmented<EditorWidth>
                    label="Page width"
                    value={s.editorWidth}
                    options={[
                      { id: "comfortable", label: "Comfortable" },
                      { id: "wide", label: "Wide" },
                      { id: "full", label: "Full" },
                    ]}
                    onChange={(v) => setSetting({ editorWidth: v })}
                  />
                </Row>
                <Row title="Spell check" detail="Underline possible spelling mistakes while you write.">
                  <Toggle label="Spell check" checked={s.spellcheck} onChange={(v) => setSetting({ spellcheck: v })} />
                </Row>
              </div>
            </section>
          )}

          {section === "ai" && (
            <section className="nz2-set-section">
              <div className="nz2-set-head">
                <h2>AI & privacy</h2>
                <p>Control what NoteZ AI can see, and how it's connected.</p>
              </div>
              <div className="nz2-status-card">
                <span className={`nz2-status-orb ${providerInfo.configured ? "is-on" : ""}`}>
                  <Sparkles size={18} />
                </span>
                <div>
                  <strong>{providerInfo.configured ? "Gemini is connected" : "Basic mode"}</strong>
                  <p>
                    {providerInfo.configured
                      ? `Generating answers and transcribing with ${providerInfo.model}.`
                      : "NoteZ can search your notes and list tasks. Add GEMINI_API_KEY on the server to enable generated answers and voice structuring."}
                  </p>
                </div>
                <button type="button" className="nz2-btn nz2-btn-soft nz2-btn-sm" onClick={() => void checkConnection()} disabled={checking}>
                  {checking ? <LoaderCircle size={14} className="nz-spin" /> : <RefreshCw size={14} />} Check connection
                </button>
              </div>
              <div className="nz2-set-group">
                <Row title="Default context" detail="Which notes AI reads when you start a new chat.">
                  <Segmented<AiScope>
                    label="Default AI context"
                    value={s.defaultAiScope}
                    options={[
                      { id: "none", label: "None" },
                      { id: "current", label: "Current note" },
                      { id: "workspace", label: "All notes" },
                    ]}
                    onChange={(v) => setSetting({ defaultAiScope: v })}
                  />
                </Row>
              </div>
              <ul className="nz2-privacy-list">
                <li>
                  <ShieldCheck size={16} />
                  <span>
                    <strong>You choose the context.</strong> Only the notes you select are shared with the model, and only for that reply.
                  </span>
                </li>
                <li>
                  <Check size={16} />
                  <span>
                    <strong>You approve every change.</strong> AI drafts are previews. They're added to a note only when you pick an action.
                  </span>
                </li>
                <li>
                  <KeyRound size={16} />
                  <span>
                    <strong>Keys stay on the server.</strong> Your Gemini key is never sent to the browser.
                  </span>
                </li>
              </ul>
            </section>
          )}

          {section === "search" && (
            <section className="nz2-set-section">
              <div className="nz2-set-head">
                <h2>Search & memory</h2>
                <p>How NoteZ finds things across everything you've written, recorded, and asked.</p>
              </div>
              <div className="nz2-status-card">
                <span className={`nz2-status-orb ${searchInfo?.postgres.connected ? "is-on" : ""}`}>
                  <Database size={18} />
                </span>
                <div>
                  <strong>Postgres index · {searchInfo?.postgres.chunks ?? 0} passages</strong>
                  <p>
                    {searchInfo
                      ? `${searchInfo.breakdown.notes} from notes · ${searchInfo.breakdown.voice} from voice transcripts · ${searchInfo.breakdown.ai} from AI answers`
                      : "Reading index status…"}
                  </p>
                </div>
                <button type="button" className="nz2-btn nz2-btn-soft nz2-btn-sm" onClick={() => void reindex()} disabled={searchBusy}>
                  {searchBusy ? <LoaderCircle size={14} className="nz-spin" /> : <RefreshCw size={14} />} Rebuild index
                </button>
              </div>
              <div className="nz2-set-group">
                <Row title="Vector database" detail="Qdrant is used for semantic search when configured; the Postgres index is always available as a fallback.">
                  <span className={`nz2-chip ${searchInfo?.qdrant.connected ? "is-good" : ""}`}>
                    <span className={`nz2-dot ${searchInfo?.qdrant.connected ? "is-on" : ""}`} />
                    {searchInfo?.qdrant.connected ? "Qdrant connected" : searchInfo?.qdrant.configured ? "Qdrant unreachable" : "Qdrant not configured"}
                  </span>
                </Row>
                <Row title="Embeddings" detail="Set GEMINI_API_KEY to use gemini-embedding-001. Without it, NoteZ uses a local 384-dimension projection.">
                  <span className="nz2-chip">
                    {searchInfo ? `${searchInfo.embeddings.provider} · ${searchInfo.embeddings.dimension}d` : "…"}
                  </span>
                </Row>
                <Row title="In-note search" detail="Press ⌘F in any note for instant keyword search within that note.">
                  <span className="nz2-chip">Keyword · SQL</span>
                </Row>
              </div>
              <div className="nz2-callout">
                <Shield size={16} />
                <span>Search only ever returns your own content. Other accounts, and NoteZ's own code and configuration, are never included in your index.</span>
              </div>
            </section>
          )}

          {section === "voice" && (
            <section className="nz2-set-section">
              <div className="nz2-set-head">
                <h2>Voice</h2>
                <p>Recording language and how transcripts are organized.</p>
              </div>
              <div className="nz2-set-group">
                <Row title="Language" detail="Helps transcription and dictation recognize your speech.">
                  <select
                    className="nz2-select"
                    value={s.voiceLanguage}
                    onChange={(e) => setSetting({ voiceLanguage: e.target.value })}
                    aria-label="Voice language"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </Row>
                <Row title="Speaker labels" detail="Show who is speaking. Labels are estimates from the audio.">
                  <Toggle label="Speaker labels" checked={s.speakerLabels} onChange={(v) => setSetting({ speakerLabels: v })} />
                </Row>
                <Row title="Structure automatically" detail="Generate meeting notes as soon as a recording finishes.">
                  <Toggle label="Structure automatically" checked={s.autoStructureVoice} onChange={(v) => setSetting({ autoStructureVoice: v })} />
                </Row>
              </div>
              <div className="nz2-callout">
                <Lightbulb size={16} />
                <span>Recordings are split into 40-second segments and sent for transcription as you speak. Audio is not stored; only the transcript is saved.</span>
              </div>
            </section>
          )}

          {section === "data" && (
            <section className="nz2-set-section">
              <div className="nz2-set-head">
                <h2>Data & security</h2>
                <p>Take your data with you, or protect your account.</p>
              </div>
              <div className="nz2-set-group">
                <Row title="Export everything" detail="Download notes, voice transcripts, and AI conversations as JSON.">
                  <button type="button" className="nz2-btn nz2-btn-soft" onClick={() => void exportData()}>
                    <Download size={14} /> Export data
                  </button>
                </Row>
                <Row title="Sign out everywhere" detail="Ends every active session, including this one.">
                  <button type="button" className="nz2-btn nz2-btn-ghost" onClick={() => void signOutEverywhere()}>
                    <Shield size={14} /> Sign out all devices
                  </button>
                </Row>
                <Row title="Sign out" detail="End this session on this device.">
                  <button type="button" className="nz2-btn nz2-btn-ghost" onClick={onSignOut}>
                    <LogOut size={14} /> Sign out
                  </button>
                </Row>
              </div>
            </section>
          )}

          {section === "danger" && (
            <section className="nz2-set-section">
              <div className="nz2-set-head">
                <h2>Danger zone</h2>
                <p>These actions are permanent. Export your data first if you want to keep it.</p>
              </div>
              <div className="nz2-danger">
                <div>
                  <strong>Delete account</strong>
                  <p>Permanently removes your notes, voice recordings, AI conversations, and settings.</p>
                </div>
                <label className="nz2-field">
                  <span>
                    Type <code>DELETE</code> to confirm
                  </span>
                  <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
                </label>
                <button type="button" className="nz2-btn nz2-btn-danger" disabled={confirmText !== "DELETE"} onClick={() => void deleteAccount()}>
                  <Trash2 size={14} /> Delete my account
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
