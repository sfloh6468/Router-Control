import React, { useState, useRef, useEffect, useCallback } from "react";
import { TerminalSquare, Send, XCircle, ChevronUp, ChevronDown } from "lucide-react";
import { useMikrotikCommand } from "@/hooks/use-mikrotik";
import { useRouterContext } from "@/lib/router-context";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

interface HistoryEntry {
  type: 'input' | 'output' | 'error';
  content: string;
}

const COMMAND_SUGGESTIONS = [
  // Read
  "/ip address print",
  "/ip route print",
  "/interface print",
  "/ip firewall filter print",
  "/ip dhcp-server lease print",
  "/system resource print",
  "/system identity print",
  "/ip neighbor print",
  "/log print",
  "/ip dns print",
  // Write examples
  "/ip address add address=192.168.10.1/24 interface=ether2",
  "/ip address remove 0",
  "/ip address disable 0",
  "/ip address enable 0",
  "/interface disable ether2",
  "/interface enable ether2",
  "/ip firewall filter add chain=input action=drop src-address=1.2.3.4",
  "/ip firewall filter disable 0",
  "/ip firewall filter remove 0",
  "/system identity set name=MyRouter",
  "/ip dns set servers=8.8.8.8,8.8.4.4",
  "/ip route add dst-address=0.0.0.0/0 gateway=192.168.1.1",
];

export default function TerminalPage() {
  const { credentials } = useRouterContext();
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([
    { type: 'output', content: 'Connected to RouterOS API Terminal.' },
    { type: 'output', content: 'Commands use RouterOS format: /ip address print' },
  ]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [cmdHistoryIdx, setCmdHistoryIdx] = useState(-1);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const endOfHistoryRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandMutation = useMikrotikCommand();

  useEffect(() => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || commandMutation.isPending) return;

    const cmd = input.trim();
    setInput("");
    setCmdHistoryIdx(-1);
    setCmdHistory(prev => [cmd, ...prev.slice(0, 49)]);
    setHistory(prev => [...prev, { type: 'input', content: cmd }]);

    if (cmd === "clear" || cmd === "cls") {
      setHistory([]);
      inputRef.current?.focus();
      return;
    }

    try {
      const res = await commandMutation.mutateAsync(cmd);
      setHistory(prev => [...prev, {
        type: res.success ? 'output' : 'error',
        content: res.output || (res.success ? '[No output]' : 'Unknown error')
      }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to execute command";
      setHistory(prev => [...prev, { type: 'error', content: msg }]);
    }

    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIdx = Math.min(cmdHistoryIdx + 1, cmdHistory.length - 1);
      setCmdHistoryIdx(newIdx);
      setInput(cmdHistory[newIdx] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const newIdx = Math.max(cmdHistoryIdx - 1, -1);
      setCmdHistoryIdx(newIdx);
      setInput(newIdx === -1 ? "" : cmdHistory[newIdx]);
    } else if (e.key === "Tab") {
      e.preventDefault();
      setShowSuggestions(v => !v);
    }
  };

  const prompt = `[${credentials?.username ?? "user"}@MikroTik]`;

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <TerminalSquare className="h-8 w-8 text-primary" />
            Terminal
          </h1>
          <p className="text-muted-foreground mt-1">Execute RouterOS API commands</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSuggestions(v => !v)}
            className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-2 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
          >
            {showSuggestions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Examples
          </button>
          <button
            onClick={() => setHistory([])}
            className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-2 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
          >
            <XCircle className="h-4 w-4" /> Clear
          </button>
        </div>
      </div>

      {showSuggestions && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-3 gap-2"
        >
          {COMMAND_SUGGESTIONS.map((cmd) => (
            <button
              key={cmd}
              onClick={() => {
                setInput(cmd);
                setShowSuggestions(false);
                inputRef.current?.focus();
              }}
              className="text-left px-3 py-2 rounded-lg bg-white/5 hover:bg-primary/10 border border-border/30 hover:border-primary/30 font-mono text-xs text-muted-foreground hover:text-primary transition-all"
            >
              {cmd}
            </button>
          ))}
        </motion.div>
      )}

      <Card className="flex-1 min-h-0 bg-black/60 backdrop-blur-xl border-border/50 flex flex-col overflow-hidden shadow-2xl relative group">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

        <div
          className="flex-1 overflow-auto p-4 font-mono text-sm"
          onClick={() => inputRef.current?.focus()}
        >
          {history.map((entry, i) => (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              key={i}
              className={`mb-2 whitespace-pre-wrap leading-relaxed ${
                entry.type === 'input' ? 'text-primary' :
                entry.type === 'error' ? 'text-destructive' : 'text-slate-300'
              }`}
            >
              {entry.type === 'input' && (
                <span className="text-muted-foreground select-none mr-2">{prompt} {'>'}</span>
              )}
              {entry.content}
            </motion.div>
          ))}
          {commandMutation.isPending && (
            <div className="text-muted-foreground animate-pulse mt-2 flex items-center gap-2">
              <span className="inline-block w-2 h-2 bg-primary rounded-full animate-bounce" />
              Executing...
            </div>
          )}
          <div ref={endOfHistoryRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="shrink-0 p-4 border-t border-border/50 bg-black/40 flex items-center gap-3 relative z-10"
        >
          <span className="text-primary font-bold select-none font-mono text-sm">{prompt} &gt;</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={commandMutation.isPending}
            className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-0"
            placeholder="e.g., /ip address print"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            disabled={!input.trim() || commandMutation.isPending}
            className="p-2 rounded-md bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </Card>

      <p className="text-xs text-muted-foreground text-center shrink-0">
        Use ↑ / ↓ arrows to navigate command history · Tab to toggle examples
      </p>
    </div>
  );
}
