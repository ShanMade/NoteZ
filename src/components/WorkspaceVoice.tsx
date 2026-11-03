"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AudioLines,
  Check,
  Copy,
  Download,
  FileText,
  Keyboard,
  LoaderCircle,
  Mic,
  RotateCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  CircleAlert,
} from "lucide-react";
import type { ProviderStatus, VoiceNote, VoiceSegment, WorkspaceSettings } from "@/types/workspace";
import { formatRelativeTime } from "@/lib/format";
import { newId } from "@/lib/ids";

type Chunk = { blob: Blob; index: number; start: number; duration: number };
type ChunkStatus = "queued" | "sending" | "done" | "failed";
interface ChunkView {
  index: number;
  start: number;
  status: ChunkStatus;
}
type SpeechResult = { isFinal: boolean; 0?: { transcript?: string } };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechObj = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type SpeechCtor = new () => SpeechObj;
type SpeechWindow = Window & { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };

const SEGMENT_SECONDS = 40;
const TONES = ["violet", "sky", "amber", "mint"] as const;

function fmt(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}
function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as SpeechWindow;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
function labelFor(speaker: string, map: Record<string, string>): string {
  return map[speaker]?.trim() || speaker;
}
function toneFor(speaker: string): (typeof TONES)[number] {
  const n = Number(speaker.match(/(\d+)/)?.[1] ?? 1);
  return TONES[(Math.max(1, n) - 1) % TONES.length];
}

interface Props {
  provider: ProviderStatus;
  settings: Pick<WorkspaceSettings, "voiceLanguage" | "speakerLabels" | "autoStructureVoice">;
  notes: VoiceNote[];
  onNotesChange: (updater: (prev: VoiceNote[]) => VoiceNote[]) => void;
  onCreateNote: (note: VoiceNote) => void;
  onAskAI: (prompt: string) => void;
  onSettings: () => void;
  onNotice: (message: string) => void;
  onBusyChange: (busy: boolean) => void;
}

export function WorkspaceVoice({
  provider,
  settings,
  notes,
  onNotesChange,
  onCreateNote,
  onAskAI,
  onSettings,
  onNotice,
  onBusyChange,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "recording" | "processing">("idle");
  const [seconds, setSeconds] = useState(0);
  const [chunks, setChunks] = useState<ChunkView[]>([]);
  const [error, setError] = useState("");
  const [liveText, setLiveText] = useState("");
  const [query, setQuery] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualText, setManualText] = useState("");
  const [structuring, setStructuring] = useState(false);
  const [renaming, setRenaming] = useState<{ speaker: string; value: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [titleDraft, setTitleDraft] = useState<string | null>(null);

  const activeRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<SpeechObj | null>(null);
  const segmentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const elapsedRef = useRef(0);
  const chunkIndex = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const failedChunks = useRef<Chunk[]>([]);
  const voiceIdRef = useRef("");
  const browserFinal = useRef("");
  const liveRef = useRef("");
  const browserFinalized = useRef(false);
  const unmountedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const notesRef = useRef(notes);
  notesRef.current = notes;

  const selected = useMemo(() => notes.find((n) => n.id === selectedId) ?? null, [notes, selectedId]);
  const filtered = useMemo(
    () =>
      notes.filter(
        (n) => !query.trim() || n.title.toLowerCase().includes(query.trim().toLowerCase()) || n.transcript.toLowerCase().includes(query.trim().toLowerCase())
      ),
    [notes, query]
  );
  const speakers = useMemo(() => Array.from(new Set((selected?.segments ?? []).map((s) => s.speaker))), [selected]);

  const upsert = (note: VoiceNote) => {
    if (unmountedRef.current) return;
    onNotesChange((prev) => [note, ...prev.filter((n) => n.id !== note.id)]);
  };

  const refresh = async () => {
    try {
      const res = await fetch("/api/voice");
      if (res.ok && !unmountedRef.current) {
        const data = await res.json();
        onNotesChange(() => data.notes ?? []);
      }
    } catch {
      // Keep the current list
    }
  };

  useEffect(() => {
    unmountedRef.current = false;
    void refresh();
    return () => {
      const wasActive = activeRef.current;
      const wasBrowser = Boolean(recognitionRef.current);
      unmountedRef.current = true;
      activeRef.current = false;
      if (wasActive) elapsedRef.current = Math.max(elapsedRef.current, Math.round((Date.now() - startedAt.current) / 1000));
      if (segmentTimer.current) clearTimeout(segmentTimer.current);
      if (tickerRef.current) clearInterval(tickerRef.current);
      if (wasActive && wasBrowser && voiceIdRef.current) {
        browserFinalized.current = true;
        void fetch(`/api/voice/${voiceIdRef.current}`, {
          method: "PATCH",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ready", transcript: liveRef.current, durationSeconds: elapsedRef.current }),
        });
      }
      try {
        recognitionRef.current?.stop();
      } catch {
        // ignore
      }
      try {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      } catch {
        // ignore
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
      onBusyChange(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onBusyChange(phase !== "idle");
  }, [phase, onBusyChange]);

  useEffect(() => {
    if (!selectedId && notes.length) setSelectedId(notes[0].id);
  }, [notes, selectedId]);

  useEffect(() => {
    setRenaming(null);
    setTitleDraft(null);
  }, [selectedId]);

  const startClock = () => {
    startedAt.current = Date.now();
    elapsedRef.current = 0;
    setSeconds(0);
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = setInterval(() => {
      const t = Math.floor((Date.now() - startedAt.current) / 1000);
      elapsedRef.current = t;
      setSeconds(t);
    }, 1000);
  };
  const stopClock = () => {
    elapsedRef.current = Math.max(elapsedRef.current, Math.round((Date.now() - startedAt.current) / 1000));
    setSeconds(elapsedRef.current);
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
  };

  const startMeter = (stream: MediaStream) => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const bars = barRefs.current;
        const step = Math.max(1, Math.floor(data.length / Math.max(1, bars.length)));
        bars.forEach((el, i) => {
          if (!el) return;
          const v = data[i * step] / 255;
          el.style.height = `${4 + Math.round(v * 36)}px`;
        });
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Metering is optional; recording continues without it
    }
  };
  const stopMeter = () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    barRefs.current.forEach((el) => {
      if (el) el.style.height = "4px";
    });
  };

  const setChunkStatus = (index: number, status: ChunkStatus) =>
    setChunks((prev) => prev.map((c) => (c.index === index ? { ...c, status } : c)));

  const sendChunk = async (id: string, chunk: Chunk) => {
    setChunkStatus(chunk.index, "sending");
    const data = new FormData();
    data.append("audio", new File([chunk.blob], `chunk-${chunk.index}.webm`, { type: chunk.blob.type || "audio/webm" }));
    data.append("index", String(chunk.index));
    data.append("start", String(chunk.start));
    data.append("duration", String(Math.min(45, Math.max(0.1, chunk.duration))));
    const res = await fetch(`/api/voice/${id}/chunks`, { method: "POST", body: data });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || "Could not transcribe a chunk.");
    if (payload.note) upsert(payload.note);
    setChunkStatus(chunk.index, "done");
  };

  const enqueueChunk = (id: string, chunk: Chunk) => {
    setChunks((prev) => [...prev.filter((c) => c.index !== chunk.index), { index: chunk.index, start: chunk.start, status: "queued" }]);
    queueRef.current = queueRef.current.then(async () => {
      try {
        await sendChunk(id, chunk);
      } catch (err) {
        failedChunks.current.push(chunk);
        setChunkStatus(chunk.index, "failed");
        if (!unmountedRef.current) setError(err instanceof Error ? err.message : "A chunk could not be transcribed.");
      }
    });
  };

  const finishGemini = async (id: string) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopMeter();
    await queueRef.current;
    if (failedChunks.current.length === 0) {
      try {
        const res = await fetch(`/api/voice/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "ready", durationSeconds: elapsedRef.current }),
        });
        const data = await res.json();
        if (res.ok) {
          upsert(data.note);
          if (settings.autoStructureVoice && data.note.transcript) await structure(id, true);
        }
      } catch {
        if (!unmountedRef.current) setError("Recording saved, but its final status could not be updated.");
      }
    }
    if (!unmountedRef.current) {
      setPhase("idle");
      void refresh();
    }
  };

  const beginSegment = (stream: MediaStream, id: string) => {
    if (!activeRef.current) return;
    const options =
      typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? { mimeType: "audio/webm;codecs=opus" }
        : undefined;
    const recorder = new MediaRecorder(stream, options);
    recorderRef.current = recorder;
    const pieces: Blob[] = [];
    const index = chunkIndex.current++;
    const segmentStarted = Date.now();
    const start = Math.max(0, (segmentStarted - startedAt.current) / 1000);
    recorder.ondataavailable = (e) => {
      if (e.data.size) pieces.push(e.data);
    };
    recorder.onstop = () => {
      if (segmentTimer.current) clearTimeout(segmentTimer.current);
      const duration = Math.max(0.1, (Date.now() - segmentStarted) / 1000);
      const blob = new Blob(pieces, { type: recorder.mimeType || "audio/webm" });
      if (blob.size) enqueueChunk(id, { blob, index, start, duration });
      if (activeRef.current) {
        try {
          beginSegment(stream, id);
        } catch {
          activeRef.current = false;
          setError("Recording couldn't continue. Captured chunks are still being saved.");
          stopClock();
          setPhase("processing");
          void finishGemini(id);
        }
      } else {
        void finishGemini(id);
      }
    };
    recorder.start();
    segmentTimer.current = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, SEGMENT_SECONDS * 1000);
  };

  const startGemini = async () => {
    if (!provider.configured) {
      onSettings();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("This browser can't record audio. Try device dictation or paste a transcript.");
      return;
    }
    setError("");
    failedChunks.current = [];
    queueRef.current = Promise.resolve();
    chunkIndex.current = 0;
    setChunks([]);
    setLiveText("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "gemini",
          title: `Meeting · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error(data.error || "Could not start a voice note.");
      }
      voiceIdRef.current = data.note.id;
      upsert(data.note);
      setSelectedId(data.note.id);
      activeRef.current = true;
      setPhase("recording");
      startClock();
      startMeter(stream);
      beginSegment(stream, data.note.id);
    } catch (err) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setError(err instanceof Error ? err.message : "Microphone access was unavailable.");
      setPhase("idle");
    }
  };

  const finishBrowser = async (id: string) => {
    if (browserFinalized.current) return;
    browserFinalized.current = true;
    try {
      const res = await fetch(`/api/voice/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ready", transcript: liveRef.current, durationSeconds: elapsedRef.current }),
      });
      const data = await res.json();
      if (res.ok) upsert(data.note);
    } catch {
      setError("Couldn't save the transcript.");
    } finally {
      if (!unmountedRef.current) {
        setPhase("idle");
        void refresh();
      }
    }
  };

  const startDictation = async () => {
    const Constructor = speechCtor();
    if (!Constructor) {
      setError("Device dictation isn't supported in this browser. Paste a transcript or connect Gemini.");
      return;
    }
    setError("");
    browserFinalized.current = false;
    browserFinal.current = "";
    liveRef.current = "";
    setLiveText("");
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "browser",
          title: `Dictation · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start dictation.");
      voiceIdRef.current = data.note.id;
      upsert(data.note);
      setSelectedId(data.note.id);
      const recognition = new Constructor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = settings.voiceLanguage;
      recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const r = event.results[i];
          const text = r[0]?.transcript || "";
          if (r.isFinal) browserFinal.current = `${browserFinal.current} ${text}`.trim();
          else interim += ` ${text}`;
        }
        liveRef.current = `${browserFinal.current} ${interim}`.trim();
        setLiveText(liveRef.current);
      };
      recognition.onerror = (event) => setError(`Dictation stopped: ${event.error || "microphone unavailable"}.`);
      recognition.onend = () => {
        if (activeRef.current) {
          activeRef.current = false;
          stopClock();
          setPhase("processing");
        }
        recognitionRef.current = null;
        void finishBrowser(data.note.id);
      };
      recognitionRef.current = recognition;
      activeRef.current = true;
      setPhase("recording");
      startClock();
      recognition.start();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start dictation.");
      setPhase("idle");
    }
  };

  const stopRecording = () => {
    if (!activeRef.current) return;
    activeRef.current = false;
    stopClock();
    stopMeter();
    setPhase("processing");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        recognitionRef.current = null;
        void finishBrowser(voiceIdRef.current);
      }
    } else if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    } else {
      void finishGemini(voiceIdRef.current);
    }
  };

  const retryFailed = async () => {
    if (!voiceIdRef.current || !failedChunks.current.length) return;
    setError("");
    setPhase("processing");
    const retry = [...failedChunks.current];
    failedChunks.current = [];
    for (const chunk of retry) enqueueChunk(voiceIdRef.current, chunk);
    await finishGemini(voiceIdRef.current);
  };

  const patchNote = async (id: string, body: Record<string, unknown>): Promise<VoiceNote | null> => {
    const res = await fetch(`/api/voice/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      onNotice(data.error || "Couldn't save changes.");
      return null;
    }
    upsert(data.note);
    return data.note as VoiceNote;
  };

  async function structure(id: string, silent = false) {
    setStructuring(true);
    try {
      const res = await fetch(`/api/voice/${id}/notes`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't generate notes.");
      upsert(data.note);
      if (!silent) {
        onNotice(data.provider === "gemini" ? "Meeting notes generated with Gemini" : "Notes generated with basic extraction");
      }
    } catch (err) {
      onNotice(err instanceof Error ? err.message : "Couldn't generate notes.");
    } finally {
      setStructuring(false);
    }
  }

  const saveSpeaker = async () => {
    if (!selected || !renaming) return;
    const next: Record<string, string> = { ...(selected.speakerMap ?? {}) };
    const value = renaming.value.trim().slice(0, 40);
    if (value) next[renaming.speaker] = value;
    else delete next[renaming.speaker];
    setRenaming(null);
    await patchNote(selected.id, { speakerMap: next });
  };

  const saveTitle = async () => {
    if (!selected || titleDraft === null) return;
    const value = titleDraft.trim();
    setTitleDraft(null);
    if (value && value !== selected.title) await patchNote(selected.id, { title: value });
  };

  const deleteSelected = async () => {
    if (!selected) return;
    if (!window.confirm("Delete this voice note and its transcript? This can't be undone.")) return;
    const res = await fetch(`/api/voice/${selected.id}`, { method: "DELETE" });
    if (res.ok) {
      onNotesChange((prev) => prev.filter((n) => n.id !== selected.id));
      setSelectedId(null);
      onNotice("Voice note deleted");
    }
  };

  const transcriptLines = (note: VoiceNote): string[] => {
    if (!note.segments.length) return [note.transcript];
    return note.segments.map(
      (s) =>
        `[${fmt(s.startSeconds)}] ${settings.speakerLabels ? `${labelFor(s.speaker, note.speakerMap)}: ` : ""}${s.text}`
    );
  };

  const exportText = () => {
    if (!selected) return;
    const body = `${selected.title}\n${new Date(selected.createdAt).toLocaleString()}\n\n${transcriptLines(selected).join("\n")}\n`;
    const url = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "voice-note"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    onNotice("Transcript downloaded");
  };

  const copyTranscript = async () => {
    if (!selected?.transcript && !selected?.segments.length) return;
    try {
      await navigator.clipboard.writeText(transcriptLines(selected!).join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      onNotice("Clipboard is unavailable");
    }
  };

  const refineWithAI = () => {
    if (!selected) return;
    onAskAI(
      `Turn this voice transcript into a clear, well-structured meeting note. Keep only what was said, keep speaker names where helpful, and list decisions and action items with owners.\n\n${transcriptLines(selected).join("\n").slice(0, 5000)}`
    );
  };

  const isRecording = phase === "recording";
  const isBusy = phase !== "idle" || structuring;
  const doneCount = chunks.filter((c) => c.status === "done").length;
  const failedCount = chunks.filter((c) => c.status === "failed").length;

  return (
    <div className="nz2-page nz2-voice">
      <header className="nz2-page-head">
        <div>
          <span className="nz2-eyebrow">
            <AudioLines size={13} /> Voice studio
          </span>
          <h1 className="nz2-title">Capture the conversation</h1>
          <p className="nz2-sub">Record meetings and memos, see who said what, then turn them into notes you can act on.</p>
        </div>
        <button type="button" className="nz2-provider-pill" onClick={onSettings}>
          <span className={`nz2-dot ${provider.configured ? "is-on" : ""}`} />
          {provider.configured ? `Gemini · ${provider.model}` : "Device dictation"}
        </button>
      </header>

      <div className="nz2-voice-layout">
        <aside className="nz2-voice-list" aria-label="Voice notes">
          <label className="nz2-search-field">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search recordings" />
          </label>
          <div className="nz2-voice-items">
            {filtered.length === 0 && <p className="nz2-empty-small">{notes.length ? "No recordings match." : "Your recordings will appear here."}</p>}
            {filtered.map((note) => (
              <button
                key={note.id}
                type="button"
                className={`nz2-voice-item ${selectedId === note.id ? "is-active" : ""}`}
                onClick={() => {
                  if (phase === "idle") setSelectedId(note.id);
                }}
                disabled={phase !== "idle" && selectedId !== note.id}
              >
                <span className="nz2-voice-item-icon">
                  <AudioLines size={15} />
                </span>
                <span className="nz2-voice-item-copy">
                  <strong>{note.title}</strong>
                  <small>
                    {fmt(note.durationSeconds)} · {formatRelativeTime(note.createdAt)}
                    {note.structured ? " · Notes ready" : ""}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="nz2-voice-main">
          <section className={`nz2-recorder ${isRecording ? "is-recording" : ""}`}>
            <div className="nz2-recorder-top">
              <span className="nz2-recorder-state">
                <i />
                {isRecording ? "Recording" : phase === "processing" ? "Processing" : "Ready"}
              </span>
              <span className="nz2-timer">{fmt(seconds)}</span>
            </div>
            <div className="nz2-recorder-body">
              <div className="nz2-record-col">
                {isRecording ? (
                  <button type="button" className="nz2-rec-btn is-stop" onClick={stopRecording} aria-label="Stop recording">
                    <Square size={20} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="nz2-rec-btn"
                    disabled={isBusy}
                    onClick={() => void (provider.configured ? startGemini() : startDictation())}
                    aria-label={provider.configured ? "Start recording" : "Start dictation"}
                  >
                    {phase === "processing" ? <LoaderCircle size={22} className="nz-spin" /> : <Mic size={22} />}
                  </button>
                )}
                <span className="nz2-rec-caption">
                  {isRecording
                    ? provider.configured
                      ? "Audio goes to Gemini in 40-second parts"
                      : "Listening on this device"
                    : provider.configured
                      ? "Start recording"
                      : "Start device dictation"}
                </span>
              </div>

              <div className="nz2-meter" aria-hidden="true">
                {Array.from({ length: 28 }).map((_, i) => (
                  <span key={i} ref={(el) => { barRefs.current[i] = el; }} />
                ))}
              </div>
            </div>

            {provider.configured && (
              <div className="nz2-chunks" aria-label="Recording segments">
                {chunks.length === 0 ? (
                  <span className="nz2-chunks-empty">Each 40-second segment is transcribed as it's captured.</span>
                ) : (
                  chunks.map((c) => (
                    <span key={c.index} className={`nz2-chunk is-${c.status}`} title={`${fmt(c.start)} · ${c.status}`}>
                      {fmt(c.start)}
                      <i>
                        {c.status === "done" ? <Check size={11} /> : c.status === "failed" ? <CircleAlert size={11} /> : null}
                      </i>
                    </span>
                  ))
                )}
                {chunks.length > 0 && (
                  <small>
                    {doneCount}/{chunks.length} done{failedCount ? ` · ${failedCount} failed` : ""}
                  </small>
                )}
              </div>
            )}

            {liveText && phase !== "idle" && !provider.configured && <p className="nz2-live">{liveText}</p>}

            <div className="nz2-recorder-foot">
              <button type="button" className="nz2-btn nz2-btn-ghost nz2-btn-sm" onClick={() => setManualOpen(!manualOpen)} disabled={isBusy}>
                <Keyboard size={14} /> Paste a transcript
              </button>
              <span className="nz2-privacy">
                <ShieldCheck size={13} />
                {provider.configured ? "Speaker labels are estimates · Audio isn't stored" : "Single-speaker dictation · No AI key needed"}
              </span>
              <span className="nz2-lang">
                {settings.voiceLanguage}
                <button type="button" onClick={onSettings} aria-label="Change language in settings">
                  <Settings size={12} />
                </button>
              </span>
            </div>
          </section>

          {manualOpen && (
            <section className="nz2-manual">
              <h3>Paste a transcript</h3>
              <p>Bring in notes from another recorder or type them up.</p>
              <textarea rows={5} value={manualText} onChange={(e) => setManualText(e.target.value)} placeholder="Paste your transcript…" />
              <div className="nz2-manual-actions">
                <button
                  type="button"
                  className="nz2-btn nz2-btn-primary nz2-btn-sm"
                  disabled={isBusy || manualText.trim().length < 3}
                  onClick={async () => {
                    setError("");
                    setPhase("processing");
                    try {
                      const res = await fetch("/api/voice", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ source: "manual", title: `Transcript · ${new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" })}` }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error);
                      const saved = await patchNote(data.note.id, { status: "ready", transcript: manualText });
                      if (saved) {
                        setSelectedId(saved.id);
                        setManualOpen(false);
                        setManualText("");
                        onNotice("Transcript saved");
                      }
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Couldn't save the transcript.");
                    } finally {
                      setPhase("idle");
                    }
                  }}
                >
                  Save transcript
                </button>
                <button type="button" className="nz2-btn nz2-btn-ghost nz2-btn-sm" onClick={() => setManualOpen(false)}>
                  Cancel
                </button>
              </div>
            </section>
          )}

          {error && (
            <div className="nz-error" role="alert">
              <span>{error}</span>
              {failedChunks.current.length > 0 && (
                <button type="button" className="nz2-link" onClick={() => void retryFailed()}>
                  <RotateCw size={13} /> Retry {failedChunks.current.length} {failedChunks.current.length === 1 ? "segment" : "segments"}
                </button>
              )}
            </div>
          )}

          {selected ? (
            <section className="nz2-note-panel">
              <div className="nz2-note-head">
                <div className="nz2-note-title">
                  {titleDraft === null ? (
                    <h2 onDoubleClick={() => setTitleDraft(selected.title)} title="Double-click to rename">
                      {selected.title}
                    </h2>
                  ) : (
                    <input
                      autoFocus
                      value={titleDraft}
                      maxLength={120}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={() => void saveTitle()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setTitleDraft(null);
                      }}
                      aria-label="Recording title"
                    />
                  )}
                  <small>
                    {new Date(selected.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {fmt(selected.durationSeconds)} ·{" "}
                    {selected.source === "gemini" ? "Gemini transcript" : selected.source === "browser" ? "Dictation" : "Pasted text"}
                  </small>
                </div>
                <div className="nz2-note-actions">
                  <button
                    type="button"
                    className="nz2-btn nz2-btn-primary nz2-btn-sm"
                    disabled={isBusy || (!selected.transcript && !selected.segments.length)}
                    onClick={() => void structure(selected.id)}
                  >
                    {structuring ? <LoaderCircle size={14} className="nz-spin" /> : <Sparkles size={14} />}
                    {selected.structured ? "Regenerate notes" : "Generate meeting notes"}
                  </button>
                  <button type="button" className="nz2-btn nz2-btn-soft nz2-btn-sm" disabled={!selected.transcript && !selected.segments.length} onClick={() => onCreateNote(selected)}>
                    <FileText size={14} /> Create note
                  </button>
                  <button type="button" className="nz2-icon-btn" onClick={copyTranscript} title="Copy transcript" aria-label="Copy transcript">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  <button type="button" className="nz2-icon-btn" onClick={exportText} title="Download transcript" aria-label="Download transcript">
                    <Download size={16} />
                  </button>
                  <button type="button" className="nz2-icon-btn is-danger" onClick={() => void deleteSelected()} title="Delete recording" aria-label="Delete recording">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {selected.structured ? (
                <div className="nz2-structured">
                  <div className="nz2-s-card nz2-s-wide nz2-s-summary">
                    <h4>Summary</h4>
                    <p>{selected.structured.summary || "No summary available."}</p>
                    <button type="button" className="nz2-link" onClick={refineWithAI}>
                      <Sparkles size={13} /> Refine with NoteZ AI
                    </button>
                  </div>
                  <div className="nz2-s-card">
                    <h4>Key points</h4>
                    {selected.structured.keyPoints.length ? (
                      <ul>{selected.structured.keyPoints.map((k, i) => <li key={i}>{k}</li>)}</ul>
                    ) : (
                      <p className="nz2-muted">None noted.</p>
                    )}
                  </div>
                  <div className="nz2-s-card">
                    <h4>Decisions</h4>
                    {selected.structured.decisions.length ? (
                      <ul>{selected.structured.decisions.map((k, i) => <li key={i}>{k}</li>)}</ul>
                    ) : (
                      <p className="nz2-muted">None noted.</p>
                    )}
                  </div>
                  <div className="nz2-s-card nz2-s-wide">
                    <h4>Action items</h4>
                    {selected.structured.actionItems.length ? (
                      selected.structured.actionItems.map((a, i) => (
                        <div key={i} className="nz2-action-row">
                          <span className="nz2-action-dot" />
                          <span>{a.task}</span>
                          <em className={a.owner === "Unassigned" ? "is-open" : ""}>{a.owner}</em>
                        </div>
                      ))
                    ) : (
                      <p className="nz2-muted">No action items were stated.</p>
                    )}
                  </div>
                  <div className="nz2-s-card">
                    <h4>Open questions</h4>
                    {selected.structured.openQuestions.length ? (
                      <ul>{selected.structured.openQuestions.map((k, i) => <li key={i}>{k}</li>)}</ul>
                    ) : (
                      <p className="nz2-muted">None noted.</p>
                    )}
                  </div>
                </div>
              ) : (
                selected.transcript && (
                  <div className="nz2-structure-prompt">
                    <span>
                      <Sparkles size={16} />
                    </span>
                    <div>
                      <strong>Turn this into meeting notes</strong>
                      <p>Get a summary, decisions, and action items with owners.</p>
                    </div>
                  </div>
                )
              )}

              <div className="nz2-transcript-head">
                <h3>Transcript</h3>
                {settings.speakerLabels && speakers.length > 0 && <small>Click a speaker to rename them everywhere</small>}
              </div>
              <div className="nz2-transcript">
                {selected.segments.length ? (
                  selected.segments.map((segment: VoiceSegment, i) => {
                    const tone = toneFor(segment.speaker);
                    const label = labelFor(segment.speaker, selected.speakerMap);
                    const isRenaming = renaming?.speaker === segment.speaker;
                    return (
                      <div key={`${segment.chunkIndex}-${i}`} className="nz2-line">
                        <span className="nz2-time">{fmt(segment.startSeconds)}</span>
                        <div className="nz2-line-body">
                          {settings.speakerLabels && (
                            <div className="nz2-line-speaker">
                              {isRenaming ? (
                                <input
                                  autoFocus
                                  className="nz2-speaker-input"
                                  value={renaming.value}
                                  maxLength={40}
                                  onChange={(e) => setRenaming({ speaker: segment.speaker, value: e.target.value })}
                                  onBlur={() => void saveSpeaker()}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                    if (e.key === "Escape") setRenaming(null);
                                  }}
                                  aria-label={`Name for ${segment.speaker}`}
                                />
                              ) : (
                                <button
                                  type="button"
                                  className={`nz2-speaker tone-${tone}`}
                                  onClick={() => setRenaming({ speaker: segment.speaker, value: label === segment.speaker ? "" : label })}
                                  title="Rename speaker"
                                >
                                  {label}
                                </button>
                              )}
                            </div>
                          )}
                          <p>{segment.text}</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="nz2-muted nz2-pre">{selected.transcript || "No speech was captured in this recording."}</p>
                )}
              </div>
              <p className="nz2-disclaimer">Speaker labels are estimates from the audio and may vary between segments. Check names before sharing.</p>
            </section>
          ) : (
            <section className="nz2-empty">
              <span className="nz2-empty-icon">
                <Mic size={22} />
              </span>
              <h3>{notes.length ? "Select a recording" : "Record your first conversation"}</h3>
              <p>
                {provider.configured
                  ? "Press the record button. Segments are transcribed as you speak, with speakers labeled."
                  : "Press the button to dictate on this device, or paste a transcript. Add a Gemini key on the server for speaker-labeled recordings."}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
