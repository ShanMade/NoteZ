"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUp, AudioLines, Check, ChevronDown, Copy, Database, FilePlus2, FileText, ListChecks,
  LoaderCircle, LockKeyhole, Plus, Search, Sparkles, Tag, Type, Wand2, X,
} from "lucide-react";
import type { AiScope, AiToolName, AiToolProposal, AssistantHistoryItem, ProviderStatus, WorkspaceDocument } from "@/types/workspace";
import { plainTextFromHtml } from "@/lib/markdown";
import { formatRelativeTime } from "@/lib/format";
import { newId } from "@/lib/ids";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";
import { AssistantText } from "./AssistantText";
import { NoteZMark } from "./Brand";

interface Props {
  doc: WorkspaceDocument;
  documents: WorkspaceDocument[];
  provider: ProviderStatus;
  runs: AssistantHistoryItem[];
  initialPrompt?: string;
  onRunsChange: (updater: (prev: AssistantHistoryItem[]) => AssistantHistoryItem[]) => void;
  onApplyProposal: (proposal: AiToolProposal) => Promise<void>;
  onBeforeAsk: () => Promise<void>;
  onOpenDocument: (id: string) => void;
  onTriggerInNoteSearch?: (keyword: string) => void;
  onClose: () => void;
  onNotice: (message: string) => void;
}

const TOOLS: Array<{ tool: AiToolName; label: string; prompt: string; scope: AiScope; icon: LucideIcon }> = [
  { tool: "summarize_note", label: "Summarize", prompt: "Summarize this note into an executive summary callout and key takeaways.", scope: "current", icon: FileText },
  { tool: "modify_note", label: "Improve writing", prompt: "Modify and polish this note with clearer structure, headings, and refined phrasing.", scope: "current", icon: Wand2 },
  { tool: "rename_note", label: "Suggest a title", prompt: "Suggest a sharper, clearer title and icon for this note based on its content.", scope: "current", icon: Type },
  { tool: "reproduce_note", label: "Create a variation", prompt: "Reproduce this note into a structured executive brief and action plan as a new page.", scope: "current", icon: Copy },
  { tool: "extract_tasks", label: "Find action items", prompt: "Extract all action items and next steps from this note into a checklist.", scope: "current", icon: ListChecks },
  { tool: "organize_note", label: "Suggest tags", prompt: "Suggest smart tags, an icon, and cover styling to organize this note.", scope: "current", icon: Tag },
  { tool: "qdrant_semantic_search", label: "Find related notes", prompt: "Search my workspace for notes and ideas related to this note.", scope: "workspace", icon: Database },
  { tool: "sql_keyword_search", label: "Find in note", prompt: "", scope: "current", icon: Search },
];

export function NoteAISidebar({ doc, documents, provider, runs, initialPrompt = "", onRunsChange, onApplyProposal, onBeforeAsk, onOpenDocument, onTriggerInNoteSearch, onClose, onNotice }: Props) {
  const [threadId, setThreadId] = useState(() => runs.find((run) => run.documentId === doc.id)?.threadId || newId());
  const [scope, setScope] = useState<AiScope>("current");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showAllTools, setShowAllTools] = useState(false);
  const [isOverlay, setIsOverlay] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Record<string, boolean>>({});
  const [dismissedIds, setDismissedIds] = useState<Record<string, boolean>>({});
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  useOverlayFocus(isOverlay, panelRef, onClose, closeRef);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1100px)");
    const update = () => setIsOverlay(media.matches);
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => { if (initialPrompt) setPrompt(initialPrompt); }, [initialPrompt]);

  const threadMessages = useMemo(
    () => runs.filter((run) => run.threadId === threadId).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [runs, threadId]
  );
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [threadMessages.length, pending]);

  async function sendRequest(customPrompt?: string, customTool?: AiToolName, customScope?: AiScope) {
    const content = (customPrompt ?? prompt).trim();
    if (content.length < 2 || pending) return;
    setPending(content); setError("");
    if (!customPrompt) setPrompt("");
    try {
      await onBeforeAsk();
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: content, scope: customScope ?? scope, documentId: doc.id, threadId, tool: customTool }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't complete your request.");
      if (data.run) onRunsChange((previous) => [data.run as AssistantHistoryItem, ...previous]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Something went wrong. Please try again.");
      if (!customPrompt) setPrompt(content);
    } finally { setPending(null); }
  }

  async function confirmProposal(proposal: AiToolProposal) {
    setApplyingId(proposal.id); setError("");
    try { await onApplyProposal(proposal); setAppliedIds((previous) => ({ ...previous, [proposal.id]: true })); }
    catch (applyError) { setError(applyError instanceof Error ? applyError.message : "Couldn't apply those changes."); }
    finally { setApplyingId(null); }
  }

  const availableNotes = documents.filter((item) => !item.isArchived && !item.isConfidential).length;
  const shownTools = showAllTools ? TOOLS : TOOLS.slice(0, 3);
  return (
    <>
      {isOverlay && <button type="button" className="nz3-copilot-backdrop" aria-label="Close AI assistant" tabIndex={-1} onClick={onClose} />}
      <aside ref={panelRef} className="nz2-note-ai-sidebar nz3-copilot" aria-label="NoteZ AI assistant" role={isOverlay ? "dialog" : undefined} aria-modal={isOverlay ? true : undefined} tabIndex={isOverlay ? -1 : undefined}>
        <div className="nz3-copilot-handle" aria-hidden="true" />
        <header className="nz3-copilot-header">
          <span className="nz3-copilot-brand"><Sparkles size={17} /></span>
          <div className="nz3-copilot-heading"><strong>NoteZ AI</strong><span>Working with <b>{doc.title || "Untitled"}</b></span></div>
          <button type="button" className="nz3-copilot-icon-btn" title="New conversation" aria-label="New conversation" onClick={() => { setThreadId(newId()); setPrompt(""); setError(""); }}><Plus size={17} /></button>
          <button ref={closeRef} type="button" className="nz3-copilot-icon-btn" title="Close AI assistant" aria-label="Close AI sidebar" onClick={onClose}><X size={18} /></button>
        </header>

        <div className="nz3-copilot-tools">
          <div className="nz3-copilot-section-title"><span>QUICK ACTIONS</span><button type="button" onClick={() => setShowAllTools((value) => !value)} aria-expanded={showAllTools}>{showAllTools ? "Show less" : "More actions"} <ChevronDown size={13} className={showAllTools ? "is-open" : ""} /></button></div>
          <div className="nz3-copilot-tool-grid">
            {shownTools.map((item) => <button key={item.tool} type="button" disabled={Boolean(pending)} onClick={() => { if (item.tool === "sql_keyword_search" && onTriggerInNoteSearch) { onTriggerInNoteSearch(""); if (isOverlay) onClose(); return; } setScope(item.scope); void sendRequest(item.prompt, item.tool, item.scope); }}><item.icon size={15} /><span>{item.label}</span></button>)}
          </div>
        </div>

        <div className="nz3-copilot-stream" ref={scrollRef}>
          {threadMessages.length === 0 && !pending ? <div className="nz3-copilot-empty"><span className="nz3-copilot-empty-icon"><Sparkles size={20} /></span><h2>What can we work on?</h2><p>Summarize, refine, or find ideas in your notes. You can review every change before it’s applied.</p><span className="nz3-copilot-context"><FileText size={13} /> This note <ChevronDown size={12} /></span></div> : threadMessages.map((run) => {
            const proposals = run.proposals?.length ? run.proposals : run.blocks?.length ? [{ id: `legacy-${run.id}`, tool: "append_blocks" as const, label: "Add suggested blocks", description: `Add ${run.blocks.length} blocks to “${doc.title || "Untitled"}”.`, targetDocumentId: doc.id, targetDocumentTitle: doc.title || "Untitled", proposedTitle: run.title, proposedBlocks: run.blocks, applyMode: "append_blocks" as const }] : [];
            return <div key={run.id} className="nz3-copilot-exchange">
              <div className="nz3-copilot-user">{run.prompt}</div>
              <div className="nz3-copilot-response"><div className="nz3-copilot-response-head"><NoteZMark size={24} /><strong>NoteZ AI</strong><span>{formatRelativeTime(run.createdAt)}</span></div>
                <AssistantText text={run.answer} />
                {run.sources?.length > 0 && <div className="nz3-copilot-sources"><span>SOURCES</span>{run.sources.map((source) => source.entityType === "voice" ? <span key={source.id} className="nz3-source-chip"><AudioSourceIcon />{source.title}</span> : <button key={source.id} type="button" className="nz3-source-chip" onClick={() => onOpenDocument(source.id)}><FileText size={12} />{source.title}</button>)}</div>}
                {run.toolCalls && run.toolCalls.length > 0 && <details className="nz3-tool-details"><summary><Database size={13} /> View activity <ChevronDown size={13} /></summary><ul>{run.toolCalls.map((call) => <li key={call.id}><strong>{call.label}</strong><span>{call.detail}</span></li>)}</ul></details>}
                {proposals.map((proposal) => {
                  if (dismissedIds[proposal.id]) return null;
                  const applied = Boolean(appliedIds[proposal.id]);
                  const applying = applyingId === proposal.id;
                  return <div key={proposal.id} className={`nz3-proposal ${applied ? "is-applied" : ""}`}>
                    <div className="nz3-proposal-head"><span><Sparkles size={14} /> {proposal.label}</span><small>{applied ? "APPLIED" : "REVIEW CHANGES"}</small></div>
                    <p>{proposal.description}</p>
                    {proposal.tool === "rename_note" && proposal.proposedTitle && <div className="nz3-proposal-diff"><div><small>BEFORE</small><span>{proposal.previousTitle || doc.title || "Untitled"}</span></div><div><small>AFTER</small><strong>{proposal.proposedTitle}</strong></div></div>}
                    {proposal.proposedTags && proposal.proposedTags.length > 0 && <div className="nz3-proposal-tags">{proposal.proposedTags.map((tag) => <span key={tag}>#{tag}</span>)}</div>}
                    {proposal.proposedBlocks && proposal.proposedBlocks.length > 0 && <ul className="nz3-proposal-preview">{proposal.proposedBlocks.slice(0, 4).map((block, index) => <li key={index} className={block.type.startsWith("heading") ? "is-heading" : ""}>{block.type === "todo" ? "☐ " : block.type === "bullet" ? "• " : ""}{plainTextFromHtml(block.content)}</li>)}{proposal.proposedBlocks.length > 4 && <li className="is-more">+ {proposal.proposedBlocks.length - 4} more blocks</li>}</ul>}
                    {applied ? <div className="nz3-proposal-applied"><Check size={15} /> Changes applied</div> : <div className="nz3-proposal-actions"><button type="button" className="nz3-primary-btn nz3-btn-small" disabled={applying} onClick={() => void confirmProposal(proposal)}>{applying ? <LoaderCircle size={14} className="nz-spin" /> : <Check size={14} />} Apply changes</button>{proposal.proposedBlocks && proposal.proposedBlocks.length > 0 && proposal.applyMode !== "create_new_note" && <button type="button" className="nz3-secondary-btn nz3-btn-small" disabled={applying} onClick={() => void confirmProposal({ ...proposal, applyMode: "create_new_note", proposedTitle: proposal.proposedTitle || `${doc.title || "Note"} (AI variation)` })}><FilePlus2 size={14} /> New note</button>}<button type="button" className="nz3-proposal-dismiss" disabled={applying} onClick={() => setDismissedIds((previous) => ({ ...previous, [proposal.id]: true }))}>Dismiss</button></div>}
                  </div>;
                })}
              </div>
            </div>;
          })}
          {pending && <div className="nz3-copilot-exchange"><div className="nz3-copilot-user">{pending}</div><div className="nz3-copilot-thinking" role="status"><LoaderCircle size={15} className="nz-spin" /> Thinking about your note...</div></div>}
          {error && <div className="nz3-copilot-error" role="alert">{error}</div>}
        </div>

        <div className="nz3-copilot-footer">
          <div className="nz3-copilot-composer"><textarea value={prompt} rows={2} placeholder="Ask anything about this note..." aria-label="Ask AI about this note" onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendRequest(); } }} /><div className="nz3-copilot-composer-bottom"><label className="nz3-copilot-scope"><FileText size={13} /><select value={scope} onChange={(event) => setScope(event.target.value as AiScope)} aria-label="AI context"><option value="current">This note</option><option value="workspace">All notes ({availableNotes})</option></select><ChevronDown size={12} /></label><button type="button" className="nz3-copilot-send" disabled={!prompt.trim() || Boolean(pending)} onClick={() => void sendRequest()} aria-label="Send to AI">{pending ? <LoaderCircle size={15} className="nz-spin" /> : <ArrowUp size={16} />}</button></div></div>
          <div className="nz3-copilot-reassurance"><LockKeyhole size={12} /> Suggested changes need your approval <span>·</span> {provider.configured ? "AI connected" : "Basic mode"}</div>
        </div>
      </aside>
    </>
  );
}

function AudioSourceIcon() {
  return <AudioLines size={12} aria-hidden="true" />;
}
