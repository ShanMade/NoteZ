"use client";

import React, { useRef, useState } from "react";
import { AlertTriangle, LoaderCircle, X } from "lucide-react";
import { useOverlayFocus } from "@/hooks/useOverlayFocus";

interface Props {
  title: string;
  description: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export function ConfirmationDialog({ title, description, confirmLabel = "Delete permanently", onCancel, onConfirm }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useOverlayFocus(true, containerRef, () => { if (!busy) onCancel(); }, cancelRef);

  const confirm = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try { await onConfirm(); onCancel(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Something went wrong. Please try again."); }
    finally { setBusy(false); }
  };

  return <div className="nz3-overlay nz3-confirm-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <div ref={containerRef} className="nz3-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="nz3-confirm-title" aria-describedby="nz3-confirm-description" tabIndex={-1}>
      <div className="nz3-confirm-top"><span><AlertTriangle size={20} /></span><button type="button" onClick={onCancel} disabled={busy} aria-label="Close dialog"><X size={18} /></button></div>
      <h2 id="nz3-confirm-title">{title}</h2>
      <p id="nz3-confirm-description">{description}</p>
      {error && <div className="nz3-confirm-error" role="alert">{error}</div>}
      <div className="nz3-confirm-actions"><button ref={cancelRef} type="button" className="nz3-secondary-btn" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="nz3-danger-btn" disabled={busy} onClick={() => void confirm()}>{busy && <LoaderCircle size={15} className="nz-spin" />}{confirmLabel}</button></div>
    </div>
  </div>;
}
