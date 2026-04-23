import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { RouterCredentials } from "@workspace/api-client-react";
import { useRouterContext } from "@/lib/router-context";

export type ChatAttachment = {
  kind: "image" | "text" | "pdf";
  name: string;
  mediaType: string;
  // base64 for image/pdf, raw text for text. Optional because reloaded history
  // from the server only carries metadata, not the original payload.
  data?: string;
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
  const [conversationId, setConversationId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { meta } = useRouterContext();
  const profileId = meta.profileId ?? null;

  // When the user switches routers, load the most recent conversation for
  // that router's profile so chat history persists across reconnects.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (profileId == null) {
        setMessages([]);
        setConversationId(null);
        return;
      }
      try {
        const r = await fetch(`${apiBase}/api/conversations?profileId=${profileId}`);
        if (!r.ok) return;
        const j = await r.json() as { conversations: Array<{ id: number }> };
        const latest = j.conversations[0];
        if (!latest) {
          if (!cancelled) {
            setMessages([]);
            setConversationId(null);
          }
          return;
        }
        const r2 = await fetch(`${apiBase}/api/conversations/${latest.id}`);
        if (!r2.ok) return;
        const j2 = await r2.json() as {
          conversation: { id: number };
          messages: Array<{ id: number; role: string; text: string; attachments: ChatAttachment[] | null; toolCalls: ToolCall[] | null; createdAt: string }>;
        };
        if (cancelled) return;
        setConversationId(j2.conversation.id);
        setMessages(j2.messages.map((m) => ({
          id: `db_${m.id}`,
          role: m.role as "user" | "assistant",
          text: m.text,
          attachments: m.attachments ?? undefined,
          toolCalls: m.toolCalls ?? undefined,
          createdAt: new Date(m.createdAt).getTime(),
        })));
      } catch {
        // ignore
      }
    }
    load();
    return () => { cancelled = true; };
  }, [profileId]);

  const reset = useCallback(async () => {
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
    // Start a fresh conversation row on next send
    setConversationId(null);
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
          // Persisted history only stores attachment metadata, not the bytes.
          // Skip image/pdf blocks where we don't have the actual base64 data so
          // we don't send malformed content to Claude on a continued turn.
          if (a.kind === "image" && a.data) {
            blocks.push({
              type: "image",
              source: { type: "base64", media_type: a.mediaType, data: a.data },
            });
          } else if (a.kind === "pdf" && a.data) {
            blocks.push({
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: a.data },
              title: a.name,
            });
          }
        }
        const textParts: string[] = [];
        if (m.text) textParts.push(m.text);
        for (const a of m.attachments ?? []) {
          if (a.kind === "text" && a.data) {
            textParts.push(`\n\n--- Attached file: ${a.name} ---\n${a.data}\n--- end ${a.name} ---`);
          } else if (!a.data) {
            // Reference-only mention so Claude knows an attachment existed.
            textParts.push(`\n\n[previously attached ${a.kind}: ${a.name}]`);
          }
        }
        if (textParts.length > 0) blocks.push({ type: "text", text: textParts.join("") });
        return { role: "user", content: blocks.length === 1 && blocks[0].type === "text" ? blocks[0].text : blocks };
      });

      const ac = new AbortController();
      abortRef.current = ac;

      // Persistence-friendly metadata about the latest user turn
      const latestUserAttachments = (attachments ?? []).map((a) => ({
        kind: a.kind, name: a.name, mediaType: a.mediaType,
      }));

      try {
        const res = await fetch(`${apiBase}/api/chat/stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: wireMessages,
            credentials,
            conversationId,
            routerProfileId: profileId,
            routerIdentity: meta.identity ?? null,
            latestUserText: text,
            latestUserAttachments,
          }),
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
                case "conversation":
                  if (typeof data.conversationId === "number") {
                    setConversationId(data.conversationId);
                  }
                  return next;
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
    [messages, conversationId, profileId, meta.identity],
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
