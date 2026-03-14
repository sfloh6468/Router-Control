import React, { createContext, useContext, useState, ReactNode } from "react";
import type { RouterCredentials } from "@workspace/api-client-react";

interface RouterContextType {
  credentials: RouterCredentials | null;
  setCredentials: (creds: RouterCredentials | null) => void;
  isConnected: boolean;
}

const RouterContext = createContext<RouterContextType | undefined>(undefined);

export function RouterProvider({ children }: { children: ReactNode }) {
  const [credentials, setCredentials] = useState<RouterCredentials | null>(null);

  return (
    <RouterContext.Provider 
      value={{ 
        credentials, 
        setCredentials, 
        isConnected: !!credentials 
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
