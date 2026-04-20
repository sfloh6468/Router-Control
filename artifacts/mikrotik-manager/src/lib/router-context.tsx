import React, { createContext, useContext, useState, ReactNode } from "react";
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
