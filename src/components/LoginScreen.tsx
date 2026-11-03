"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  Sparkles,
  AudioLines,
  FileText,
  ShieldCheck,
  LoaderCircle,
  Layers3,
  Zap,
} from "lucide-react";
import type { ProviderStatus, WorkspaceDocument, WorkspaceUser } from "@/types/workspace";
import { NoteZLogo, NoteZMark } from "./Brand";

export interface AuthSuccessPayload {
  user: WorkspaceUser;
  documents: WorkspaceDocument[];
  provider?: ProviderStatus;
  token?: string;
  bypass?: boolean;
}

interface LoginScreenProps {
  onAuthenticated?: (payload: AuthSuccessPayload) => void;
  onInstantBypass?: () => void;
}

export function LoginScreen({ onAuthenticated, onInstantBypass }: LoginScreenProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState<"form" | "demo" | "bypass" | null>(null);
  const [error, setError] = useState("");

  async function submit(action: "login" | "register" | "demo" | "bypass") {
    setError("");
    setBusy(action === "demo" ? "demo" : action === "bypass" ? "bypass" : "form");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, name, email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if ((action === "demo" || action === "bypass") && onInstantBypass) {
          onInstantBypass();
          return;
        }
        setError(data.error || "Could not sign in. Please try again.");
        return;
      }

      if (data.user && onAuthenticated) {
        onAuthenticated({
          user: data.user,
          documents: Array.isArray(data.documents) ? data.documents : [],
          provider: data.provider,
          token: typeof data.token === "string" ? data.token : undefined,
          bypass: action === "bypass" || action === "demo",
        });
        return;
      }

      router.refresh();
    } catch {
      if ((action === "demo" || action === "bypass") && onInstantBypass) {
        onInstantBypass();
        return;
      }
      setError("Could not connect. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function handleInstantBypass() {
    if (onInstantBypass) {
      onInstantBypass();
      return;
    }
    void submit("bypass");
  }

  return (
    <main className="nz-auth-shell">
      <section className="nz-auth-left">
        <div className="nz-auth-top">
          <NoteZLogo />
          <button
            type="button"
            onClick={handleInstantBypass}
            className="nz-auth-skip-top"
            title="Bypass login and open workspace immediately"
          >
            <Zap size={13} />
            <span>Skip login</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="nz-auth-center">
          <div className="nz-auth-overline">
            <span /> A LITTLE MORE CLARITY, EVERY DAY
          </div>
          <h1>
            {mode === "login" ? (
              <>
                Welcome back<span className="nz-auth-period">.</span>
              </>
            ) : (
              <>
                A fresh start<span className="nz-auth-period">.</span>
              </>
            )}
          </h1>
          <p className="nz-auth-description">
            {mode === "login"
              ? "Your ideas are right where you left them."
              : "Make a little space for everything on your mind."}
          </p>

          <div className="nz-auth-quick-actions">
            <button
              type="button"
              className="nz-auth-demo"
              onClick={() => void submit("demo")}
              disabled={busy !== null}
            >
              {busy === "demo" ? (
                <LoaderCircle size={17} className="nz-spin" />
              ) : (
                <>
                  <Sparkles size={17} />
                  <span>Explore a demo workspace</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <button
              type="button"
              className="nz-auth-bypass-btn"
              onClick={handleInstantBypass}
              disabled={busy !== null}
            >
              {busy === "bypass" ? (
                <LoaderCircle size={16} className="nz-spin" />
              ) : (
                <>
                  <Zap size={16} />
                  <span>Skip login — Enter workspace now</span>
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </div>

          <div className="nz-auth-divider">
            <span /> <small>OR SIGN IN WITH EMAIL</small> <span />
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit(mode);
            }}
            className="nz-auth-form"
          >
            {mode === "register" && (
              <label className="nz-field">
                <span>Your name</span>
                <div className="nz-input">
                  <span className="nz-input-icon">
                    <Layers3 size={17} />
                  </span>
                  <input
                    required
                    autoComplete="name"
                    placeholder="Alex Morgan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </label>
            )}
            <label className="nz-field">
              <span>Email address</span>
              <div className="nz-input">
                <span className="nz-input-icon">
                  <Mail size={17} />
                </span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </label>
            <label className="nz-field">
              <span>Password</span>
              <div className="nz-input">
                <span className="nz-input-icon">
                  <LockKeyhole size={17} />
                </span>
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  minLength={mode === "register" ? 8 : undefined}
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                  placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="nz-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            {error && (
              <p className="nz-auth-error" role="alert">
                {error}
              </p>
            )}
            <button className="nz-auth-submit" type="submit" disabled={busy !== null}>
              {busy === "form" ? (
                <LoaderCircle size={17} className="nz-spin" />
              ) : (
                <>
                  {mode === "login" ? "Sign in to NoteZ" : "Create your account"}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          <p className="nz-auth-switch">
            {mode === "login" ? "New to NoteZ?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>

        <div className="nz-auth-footer">
          <span>© {new Date().getFullYear()} NoteZ</span>
          <span>
            <ShieldCheck size={14} /> A quieter place for your ideas
          </span>
        </div>
      </section>

      <section className="nz-auth-showcase" aria-label="Introducing NoteZ">
        <div className="nz-showcase-inner">
          <div className="nz-showcase-top">
            <span>
              <span className="nz-showcase-spark">
                <Sparkles size={14} />
              </span>{" "}
              A WORKSPACE THAT THINKS WITH YOU
            </span>
            <span>01 / 03</span>
          </div>
          <div className="nz-showcase-art">
            <img src="/images/notez-abstract.png" alt="Abstract lavender glass sculpture" />
            <div className="nz-float-card nz-float-one">
              <div className="nz-float-icon">
                <AudioLines size={17} />
              </div>
              <div>
                <strong>Voice to notes</strong>
                <small>Every idea, captured</small>
              </div>
              <Check size={15} className="nz-float-check" />
            </div>
            <div className="nz-float-card nz-float-two">
              <div className="nz-float-icon nz-float-icon-peach">
                <Sparkles size={17} />
              </div>
              <div>
                <strong>Made for clarity</strong>
                <small>All your thoughts, together</small>
              </div>
            </div>
          </div>
          <div className="nz-showcase-copy">
            <div className="nz-showcase-kicker">
              <span /> THE ALL-IN-ONE THINKING SPACE
            </div>
            <h2>
              Make room for
              <br />
              <em>your best ideas.</em>
            </h2>
            <p>
              From quick thoughts to your next big project, everything comes together beautifully
              in NoteZ.
            </p>
            <div className="nz-showcase-features">
              <span>
                <FileText size={15} /> Notes that flow
              </span>
              <i />
              <span>
                <AudioLines size={15} /> Voice to note
              </span>
              <i />
              <span>
                <Sparkles size={15} /> AI by your side
              </span>
            </div>
          </div>
          <div className="nz-showcase-bottom">
            <div className="nz-dots">
              <span className="active" />
              <span />
              <span />
            </div>
            <div className="nz-showcase-signature">
              <NoteZMark size={19} /> MADE FOR CURIOUS MINDS
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
