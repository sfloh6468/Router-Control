import React, { useState, useRef, useEffect } from "react";
import { TerminalSquare, Send, XCircle } from "lucide-react";
import { useMikrotikCommand } from "@/hooks/use-mikrotik";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

interface HistoryEntry {
  type: 'input' | 'output' | 'error';
  content: string;
}

export default function TerminalPage() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([
    { type: 'output', content: 'Connected to RouterOS API.' },
    { type: 'output', content: 'Type a command and press Enter.' }
  ]);
  const endOfHistoryRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const commandMutation = useMikrotikCommand();

  const scrollToBottom = () => {
    endOfHistoryRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || commandMutation.isPending) return;

    const cmd = input.trim();
    setInput("");
    setHistory(prev => [...prev, { type: 'input', content: cmd }]);

    try {
      const res = await commandMutation.mutateAsync(cmd);
      setHistory(prev => [...prev, { 
        type: res.success ? 'output' : 'error', 
        content: res.output || (res.success ? '[Command executed successfully with no output]' : 'Unknown error')
      }]);
    } catch (err: any) {
      setHistory(prev => [...prev, { type: 'error', content: err.message || "Failed to execute command" }]);
    }
    
    // Maintain focus on input
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <TerminalSquare className="h-8 w-8 text-primary" />
            Terminal
          </h1>
          <p className="text-muted-foreground mt-1">Execute raw RouterOS commands</p>
        </div>
        <button 
          onClick={() => setHistory([])}
          className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-2 px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
        >
          <XCircle className="h-4 w-4" /> Clear
        </button>
      </div>

      <Card className="flex-1 min-h-0 bg-black/60 backdrop-blur-xl border-border/50 flex flex-col overflow-hidden shadow-2xl relative group">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        
        {/* Output Area */}
        <div 
          className="flex-1 overflow-auto p-4 font-mono text-sm"
          onClick={() => inputRef.current?.focus()}
        >
          {history.map((entry, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              key={i} 
              className={`mb-2 whitespace-pre-wrap leading-relaxed ${
                entry.type === 'input' ? 'text-primary' : 
                entry.type === 'error' ? 'text-destructive' : 'text-slate-300'
              }`}
            >
              {entry.type === 'input' && <span className="text-muted-foreground select-none mr-2">[{useRouterContext?.()?.credentials?.username}@MikroTik] {'>'}</span>}
              {entry.content}
            </motion.div>
          ))}
          {commandMutation.isPending && (
            <div className="text-muted-foreground animate-pulse mt-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full" />
              Executing...
            </div>
          )}
          <div ref={endOfHistoryRef} />
        </div>

        {/* Input Area */}
        <form 
          onSubmit={handleSubmit}
          className="shrink-0 p-4 border-t border-border/50 bg-black/40 flex items-center gap-3 relative z-10"
        >
          <span className="text-primary font-bold select-none">{'>_'}</span>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={commandMutation.isPending}
            className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:ring-0"
            placeholder="e.g., /ip address print"
            autoFocus
            autoComplete="off"
            spellCheck="false"
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
    </div>
  );
}

// Ensure useRouterContext is available for the prompt text in terminal
import { useRouterContext } from "@/lib/router-context";
