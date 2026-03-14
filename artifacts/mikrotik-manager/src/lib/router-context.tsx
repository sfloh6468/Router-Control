import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import type { RouterCredentials } from "@workspace/api-client-react";

const STORAGE_KEY = "mikrotik_credentials";

interface RouterContextType {
  credentials: RouterCredentials | null;
  setCredentials: (creds: RouterCredentials | null) => void;
  isConnected: boolean;
  disconnect: () => void;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

function loadCredentials(): RouterCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as RouterCredentials;
  } catch {
    return null;
  }
}

function saveCredentials(creds: RouterCredentials | null) {
  if (creds) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentialsState] = useState<RouterCredentials | null>(() => loadCredentials());

  const setCredentials = (creds: RouterCredentials | null) => {
    setCredentialsState(creds);
    saveCredentials(creds);
  };

  const disconnect = () => {
    setCredentials(null);
  };

  return (
    <RouterContext.Provider 
      value={{ 
        credentials, 
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
  const context = useContext(RouterContext);
  if (context === undefined) {
    throw new Error("useRouterContext must be used within a RouterProvider");
  }
  return context;
}
