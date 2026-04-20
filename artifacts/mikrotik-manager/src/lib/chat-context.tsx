import React, { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import type { RouterCredentials } from "@workspace/api-client-react";

export type ChatAttachment = {
  kind: "image" | "text";
  name: string;
  mediaType: string;
  data: string; // base64 for image, raw text for text
};

export type ToolCall = {
  id: string;
  command: string;
  status: "running" | "ok" | "error";
  output?: string;
  error?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  attachments?: ChatAttachment[];
  toolCalls?: ToolCall[];
  createdAt: number;
};

interface ChatContextType {
  messages: ChatMessage[];
  isStreaming: boolean;
  send: (text: string, attachments: ChatAttachment[], credentials: RouterCredentials | null) => Promise<void>;
  reset: () => void;
  cancel: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const apiBase = (() => {
  // BASE_URL ends with "/", so e.g. "/" or "/mikrotik-manager/"
  const b = import.meta.env.BASE_URL.replace(/\/$/, "");
  return b; // "" for root, or "/mikrotik-manager"
})();

function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const send = useCallback(
    async (text: string, attachments: ChatAttachment[], credentials: RouterCredentials | null) => {
      if (!text.trim() && attachments.length === 0) return;

      const userMsg: ChatMessage = {
        id: uid("u"),
        role: "user",
        text,
        attachments,
        createdAt: Date.now(),
      };
      const assistantMsg: ChatMessage = {
        id: uid("a"),
        role: "assistant",
        text: "",
        toolCalls: [],
        createdAt: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsStreaming(true);

      // Build wire-format messages for the API. Image attachments become image
      // content blocks; text attachments become inline-quoted text appended to the user msg.
      const wireMessages = [...messages, userMsg].map((m) => {
        if (m.role !== "user") {
          return { role: "assistant", content: m.text };
        }
        const blocks: any[] = [];
        for (const a of m.attachments ?? []) {
          if (a.kind === "image") {
            blocks.push({
              type: "image",
              source: { type: "base64", media_type: a.mediaType, data: a.data },
            });
          }
        }
        const textParts: string[] = [];
        if (m.text) textParts.push(m.text);
        for (const a of m.attachments ?? []) {
          if (a.kind === "text") {
            textParts.push(`\n\n--- Attached file: ${a.name} ---\n${a.data}\n--- end ${a.name} ---`);
          }
        }
        if (textParts.length > 0) blocks.push({ type: "text", text: textParts.join("") });
        return { role: "user", content: blocks.length === 1 && blocks[0].type === "text" ? blocks[0].text : blocks };
      });

      const ac = new AbortController();
      abortRef.current = ac;

      try {
        const res = await fetch(`${apiBase}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: wireMessages, credentials }),
          signal: ac.signal,
        });

        if (!res.ok || !res.body) {
          const err = await res.text().catch(() => "stream failed");
          throw new Error(err || `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Parse SSE blocks (separated by \n\n)
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";

          for (const block of blocks) {
            if (!block.trim() || block.startsWith(":")) continue;
            const lines = block.split("\n");
            let event = "message";
            let dataStr = "";
            for (const line of lines) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
            }
            if (!dataStr) continue;
            let data: any;
            try {
              data = JSON.parse(dataStr);
            } catch {
              continue;
            }

            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (!last || last.role !== "assistant") return next;
              const updated = { ...last, toolCalls: [...(last.toolCalls ?? [])] };
              switch (event) {
                case "text":
                  updated.text = (updated.text ?? "") + (data.text ?? "");
                  break;
                case "tool_use":
                  updated.toolCalls.push({
                    id: data.id,
                    command: data.input?.command ?? "(unknown)",
                    status: "running",
                  });
                  break;
                case "tool_result": {
                  const idx = updated.toolCalls.findIndex((t) => t.id === data.id);
                  if (idx >= 0) {
                    updated.toolCalls[idx] = {
                      ...updated.toolCalls[idx],
                      status: data.ok ? "ok" : "error",
                      output: data.ok ? data.output : undefined,
                      error: data.ok ? undefined : data.error,
                    };
                  }
                  break;
                }
                case "error":
                  updated.text = (updated.text ?? "") + `\n\n⚠️ ${data.error}`;
                  break;
              }
              next[next.length - 1] = updated;
              return next;
            });
          }
        }
      } catch (err) {
        if ((err as any)?.name === "AbortError") {
          // user cancelled
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && last.role === "assistant") {
              next[next.length - 1] = { ...last, text: (last.text ?? "") + `\n\n⚠️ ${msg}` };
            }
            return next;
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages],
  );

  return (
    <ChatContext.Provider value={{ messages, isStreaming, send, reset, cancel }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
