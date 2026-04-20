import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Send,
  Paperclip,
  X,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Square,
  RefreshCw,
  Image as ImageIcon,
  FileText,
  CheckCircle2,
  XCircle,
  Terminal,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useChat, type ChatAttachment, type ChatMessage } from "@/lib/chat-context";
import { useRouterContext } from "@/lib/router-context";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Show me the system identity and uptime",
  "List all interfaces and their status",
  "Diagnose why my BGP session is down",
  "Audit my firewall input chain for security issues",
];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result as string;
      // strip data:...;base64, prefix
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsText(file);
  });
}

export function ChatSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { messages, isStreaming, send, reset, cancel } = useChat();
  const { credentials, meta } = useRouterContext();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: ChatAttachment[] = [];
    for (const f of Array.from(files)) {
      try {
        if (f.type.startsWith("image/")) {
          const data = await readFileAsBase64(f);
          next.push({ kind: "image", name: f.name, mediaType: f.type, data });
        } else {
          // Treat as text (config exports, logs, .rsc, .txt, .json, etc.)
          const data = await readFileAsText(f);
          next.push({
            kind: "text",
            name: f.name,
            mediaType: f.type || "text/plain",
            data: data.slice(0, 200000), // hard cap per file
          });
        }
      } catch {
        // ignore
      }
    }
    setAttachments((prev) => [...prev, ...next]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeAttachment = (i: number) =>
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isStreaming) return;
    const text = input;
    const atts = attachments;
    setInput("");
    setAttachments([]);
    await send(text, atts, credentials);
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Collapsed handle */}
      {!open && (
        <button
          onClick={() => onOpenChange(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-primary/15 hover:bg-primary/25 border border-primary/30 border-r-0 text-primary px-2 py-3 rounded-l-lg backdrop-blur-xl shadow-2xl transition-colors"
          aria-label="Open assistant"
        >
          <div className="flex flex-col items-center gap-1.5">
            <Sparkles className="h-4 w-4" />
            <span className="text-[10px] font-mono uppercase tracking-wider [writing-mode:vertical-rl] rotate-180">
              Assistant
            </span>
          </div>
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col border-l border-border bg-card shadow-xl transition-all duration-300 ease-out overflow-hidden",
          open ? "w-[420px]" : "w-0",
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold text-sm leading-tight truncate">AI Assistant</h2>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider truncate" title={credentials ? `${meta.identity ?? credentials.host}` : "no router"}>
                {credentials
                  ? `live · ${meta.identity ?? credentials.host}`
                  : "no router connected"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={reset}
                title="New conversation"
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => onOpenChange(false)}
              title="Collapse"
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {isEmpty ? (
            <div className="text-center pt-8 space-y-4">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Ask me anything about your router</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  I can read live config, diagnose issues, and propose fixes. Upload a config
                  export, screenshot, or log and I'll analyse it.
                </p>
              </div>
              <div className="space-y-2 pt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="w-full text-left text-xs px-3 py-2.5 rounded-lg bg-muted hover:bg-accent border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => <MessageBubble key={m.id} m={m} />)
          )}
          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>thinking…</span>
            </div>
          )}
        </div>

        {/* Composer */}
        <form onSubmit={handleSubmit} className="border-t border-border p-3 space-y-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attachments.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-xs"
                >
                  {a.kind === "image" ? (
                    <ImageIcon className="h-3 w-3 text-primary" />
                  ) : (
                    <FileText className="h-3 w-3 text-primary" />
                  )}
                  <span className="max-w-[140px] truncate" title={a.name}>{a.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                credentials
                  ? "Describe what you want to do, diagnose, or fix…"
                  : "Connect to a router first, then ask me anything…"
              }
              rows={3}
              className="w-full resize-none rounded-lg bg-background border border-input focus:border-primary/60 focus:outline-none text-sm p-3 pr-20 text-foreground placeholder:text-muted-foreground/70"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,text/*,.rsc,.log,.conf,.txt,.json"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                title="Attach file or image"
                className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              {isStreaming ? (
                <button
                  type="button"
                  onClick={cancel}
                  title="Stop"
                  className="p-1.5 rounded text-destructive hover:bg-destructive/10"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() && attachments.length === 0}
                  title="Send"
                  className="p-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60 px-1">
            Shift+Enter for newline · changes to your router require explicit approval
          </p>
        </form>
      </aside>
    </>
  );
}

function MessageBubble({ m }: { m: ChatMessage }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-xl rounded-tr-sm bg-primary/10 border border-primary/30 px-3 py-2 text-sm space-y-2 text-foreground">
          {m.text && <div className="whitespace-pre-wrap break-words">{m.text}</div>}
          {m.attachments && m.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {m.attachments.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-background/80 border border-border text-[11px]"
                >
                  {a.kind === "image" ? (
                    <ImageIcon className="h-3 w-3" />
                  ) : (
                    <FileText className="h-3 w-3" />
                  )}
                  <span className="truncate max-w-[140px]">{a.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {(m.toolCalls ?? []).map((tc) => (
        <ToolCallCard key={tc.id} tc={tc} />
      ))}
      {m.text && (
        <div className="prose prose-sm max-w-none text-sm leading-relaxed text-foreground
                        prose-p:my-2 prose-headings:mt-3 prose-headings:mb-1.5
                        prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:border prose-pre:border-slate-700
                        prose-pre:p-2.5 prose-pre:text-[11px] prose-pre:my-2
                        prose-code:text-cyan-700 prose-code:bg-cyan-50 prose-code:px-1
                        prose-code:rounded prose-code:before:content-none prose-code:after:content-none
                        prose-li:my-0.5 prose-ul:my-2 prose-ol:my-2
                        prose-strong:text-foreground prose-a:text-primary
                        prose-table:my-2 prose-table:text-[11px] prose-table:border-collapse
                        prose-th:bg-slate-100 prose-th:border prose-th:border-slate-300 prose-th:px-2 prose-th:py-1 prose-th:text-left prose-th:font-semibold
                        prose-td:border prose-td:border-slate-300 prose-td:px-2 prose-td:py-1 prose-td:align-top">
          <div className="overflow-x-auto">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function ToolCallCard({ tc }: { tc: { id: string; command: string; status: string; output?: string; error?: string } }) {
  const [expanded, setExpanded] = useState(false);
  const icon =
    tc.status === "running" ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
    ) : tc.status === "ok" ? (
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
    ) : (
      <XCircle className="h-3.5 w-3.5 text-destructive" />
    );

  return (
    <div className="rounded-lg border border-border bg-muted/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left hover:bg-accent"
      >
        <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {icon}
        <code className="text-[11px] font-mono text-cyan-700 truncate flex-1">{tc.command}</code>
        <ChevronRight
          className={cn(
            "h-3 w-3 text-muted-foreground transition-transform shrink-0",
            expanded && "rotate-90",
          )}
        />
      </button>
      {expanded && (tc.output || tc.error) && (
        <pre className="text-[10.5px] leading-snug font-mono text-slate-100 bg-slate-900 p-2.5 overflow-x-auto max-h-64 border-t border-slate-700">
          {tc.error ?? tc.output}
        </pre>
      )}
    </div>
  );
}
