"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import type { ProviderStatus, WorkspaceDocument, WorkspaceUser } from "@/types/workspace";
import { LoginScreen, type AuthSuccessPayload } from "./LoginScreen";
import { WorkspaceApp } from "./WorkspaceApp";

const TOKEN_STORAGE_KEY = "notez_session_token";
const BYPASS_STORAGE_KEY = "notez_bypass_active";

interface NoteZClientRootProps {
  initialUser: WorkspaceUser | null;
  initialDocuments: WorkspaceDocument[];
  initialPageId: string | null;
  provider: ProviderStatus;
  demoFallbackUser: WorkspaceUser;
  demoFallbackDocuments: WorkspaceDocument[];
}

export function NoteZClientRoot({
  initialUser,
  initialDocuments,
  initialPageId,
  provider: initialProvider,
  demoFallbackUser,
  demoFallbackDocuments,
}: NoteZClientRootProps) {
  const [user, setUser] = useState<WorkspaceUser | null>(initialUser);
  const [documents, setDocuments] = useState<WorkspaceDocument[]>(initialDocuments);
  const [provider, setProvider] = useState<ProviderStatus>(initialProvider);

  const tokenRef = useRef<string | null>(null);
  const bypassRef = useRef<boolean>(false);

  // Install same-origin /api/* header injector so iframe environments that block cookies still authenticate
  useEffect(() => {
    try {
      tokenRef.current = localStorage.getItem(TOKEN_STORAGE_KEY);
      bypassRef.current = localStorage.getItem(BYPASS_STORAGE_KEY) === "1";
    } catch {
      // Ignore storage restrictions
    }

    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlString =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      const isApiCall =
        urlString.startsWith("/api/") ||
        (typeof window !== "undefined" &&
          urlString.startsWith(`${window.location.origin}/api/`));

      if (isApiCall) {
        const headers = new Headers(init?.headers);
        if (tokenRef.current && !headers.has("x-notez-session")) {
          headers.set("x-notez-session", tokenRef.current);
        }
        if (bypassRef.current && !headers.has("x-notez-bypass")) {
          headers.set("x-notez-bypass", "1");
        }
        return originalFetch(input, { ...init, headers });
      }

      return originalFetch(input, init);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Restore session on reload if cookies were blocked in an embedded preview iframe
  useEffect(() => {
    if (initialUser) return;
    let storedToken: string | null = null;
    let storedBypass = false;
    try {
      storedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      storedBypass = localStorage.getItem(BYPASS_STORAGE_KEY) === "1";
    } catch {
      return;
    }

    if (!storedToken && !storedBypass) return;

    tokenRef.current = storedToken;
    bypassRef.current = storedBypass;

    if (storedBypass) {
      setUser(demoFallbackUser);
      setDocuments(demoFallbackDocuments);
    }

    void fetch("/api/auth")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          if (Array.isArray(data.documents)) {
            setDocuments(data.documents);
          }
          if (data.provider) {
            setProvider(data.provider);
          }
        }
      })
      .catch(() => {
        // Keep demo fallback if network fails
      });
  }, [initialUser, demoFallbackUser, demoFallbackDocuments]);

  const handleAuthenticated = useCallback((payload: AuthSuccessPayload) => {
    if (payload.token) {
      tokenRef.current = payload.token;
      try {
        localStorage.setItem(TOKEN_STORAGE_KEY, payload.token);
      } catch {
        // Ignore storage error
      }
    }
    if (payload.bypass) {
      bypassRef.current = true;
      try {
        localStorage.setItem(BYPASS_STORAGE_KEY, "1");
      } catch {
        // Ignore storage error
      }
    }
    setUser(payload.user);
    setDocuments(payload.documents);
    if (payload.provider) {
      setProvider(payload.provider);
    }
  }, []);

  const handleInstantBypass = useCallback(() => {
    bypassRef.current = true;
    try {
      localStorage.setItem(BYPASS_STORAGE_KEY, "1");
    } catch {
      // Ignore storage error
    }
    // Enter workspace immediately with preloaded demo workspace from PostgreSQL
    setUser(demoFallbackUser);
    setDocuments(demoFallbackDocuments);

    // Also create a persistent session token in the background
    void fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-notez-bypass": "1" },
      body: JSON.stringify({ action: "bypass" }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.token) {
          tokenRef.current = data.token;
          try {
            localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
          } catch {
            // Ignore
          }
        }
        if (data?.user) setUser(data.user);
        if (Array.isArray(data?.documents) && data.documents.length > 0) {
          setDocuments(data.documents);
        }
      })
      .catch(() => {
        // Already inside workspace via demoFallbackUser
      });
  }, [demoFallbackUser, demoFallbackDocuments]);

  const handleSignedOut = useCallback(() => {
    tokenRef.current = null;
    bypassRef.current = false;
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(BYPASS_STORAGE_KEY);
    } catch {
      // Ignore storage error
    }
    setUser(null);
  }, []);

  if (!user) {
    return (
      <LoginScreen
        onAuthenticated={handleAuthenticated}
        onInstantBypass={handleInstantBypass}
      />
    );
  }

  return (
    <WorkspaceApp
      key={user.id}
      initialUser={user}
      initialDocuments={documents}
      initialPageId={initialPageId}
      provider={provider}
      onSignedOut={handleSignedOut}
    />
  );
}
