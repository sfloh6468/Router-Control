import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import type { RouterCredentials } from "@workspace/api-client-react";

const STORAGE_KEY = "mikrotik_credentials";
const META_KEY = "mikrotik_router_meta";

export type RouterMeta = {
  identity: string | null;
  routerOs?: string | null;
  routerBoard?: string | null;
  profileId?: number | null;
};

interface RouterContextType {
  credentials: RouterCredentials | null;
  meta: RouterMeta;
  setConnection: (creds: RouterCredentials, meta: RouterMeta) => void;
  setCredentials: (creds: RouterCredentials | null) => void;
  isConnected: boolean;
  disconnect: () => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

function loadCredentials(): RouterCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RouterCredentials) : null;
  } catch {
    return null;
  }
}
function loadMeta(): RouterMeta {
  try {
    const raw = localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as RouterMeta) : { identity: null };
  } catch {
    return { identity: null };
  }
}

function persist(creds: RouterCredentials | null, meta: RouterMeta) {
  if (creds) localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  else localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentialsState] = useState<RouterCredentials | null>(() => loadCredentials());
  const [meta, setMetaState] = useState<RouterMeta>(() => loadMeta());

  const setConnection = (creds: RouterCredentials, m: RouterMeta) => {
    setCredentialsState(creds);
    setMetaState(m);
    persist(creds, m);
  };

  const setCredentials = (creds: RouterCredentials | null) => {
    setCredentialsState(creds);
    if (!creds) {
      const cleared = { identity: null };
      setMetaState(cleared);
      persist(null, cleared);
    } else {
      persist(creds, meta);
    }
  };

  const disconnect = () => setCredentials(null);

  // Auto-refresh router identity on mount if we have credentials but identity is missing
  // (e.g. localStorage was populated before identity-fetch was reliable, or fetch failed earlier).
  const refreshTriedRef = useRef(false);
  useEffect(() => {
    if (refreshTriedRef.current) return;
    if (!credentials) return;
    if (meta.identity) return;
    refreshTriedRef.current = true;
    const apiBase = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
    (async () => {
      try {
        const r = await fetch(`${apiBase}/api/mikrotik/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });
        if (!r.ok) return;
        const j = (await r.json()) as {
          success?: boolean;
          identity?: string | null;
          routerOs?: string | null;
          routerBoard?: string | null;
        };
        if (!j.success) return;
        const updated: RouterMeta = {
          ...meta,
          identity: j.identity ?? null,
          routerOs: j.routerOs ?? meta.routerOs ?? null,
          routerBoard: j.routerBoard ?? meta.routerBoard ?? null,
        };
        setMetaState(updated);
        persist(credentials, updated);
      } catch {
        // non-fatal — header will keep showing host
      }
    })();
  }, [credentials, meta]);

  return (
    <RouterContext.Provider
      value={{
        credentials,
        meta,
        setConnection,
        setCredentials,
        isConnected: !!credentials,
        disconnect,
      }}
    >
      {children}
    </RouterContext.Provider>
  );
}

export function useRouterContext() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error("useRouterContext must be used within a RouterProvider");
  return ctx;
}
