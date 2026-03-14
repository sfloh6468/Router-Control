import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Activity, 
  Network, 
  Server, 
  ShieldCheck, 
  Wifi, 
  TerminalSquare, 
  LogOut,
  Laptop,
  Download,
  Loader2
} from "lucide-react";
import { useRouterContext } from "@/lib/router-context";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: Activity },
  { name: "Interfaces", href: "/interfaces", icon: Network },
  { name: "IP Addresses", href: "/ip-addresses", icon: Server },
  { name: "Firewall", href: "/firewall", icon: ShieldCheck },
  { name: "DHCP Leases", href: "/dhcp", icon: Laptop },
  { name: "Wireless", href: "/wireless", icon: Wifi },
  { name: "Terminal", href: "/terminal", icon: TerminalSquare },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isConnected, credentials, setCredentials } = useRouterContext();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!credentials) return;
    setExporting(true);
    try {
      const res = await fetch("/api/mikrotik/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const text = await res.text();
      const blob = new Blob([text], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `mikrotik-${credentials.host}-${date}.rsc`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Config downloaded successfully");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (!isConnected) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-border/50 bg-card/50 backdrop-blur-xl z-10 shadow-2xl relative">
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 relative">
            <div className="absolute inset-0 rounded-xl glow-effect opacity-50" />
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">MikroTik</h1>
            <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              {credentials?.host}
            </p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group overflow-hidden",
                  isActive 
                    ? "text-primary-foreground bg-primary/10 border border-primary/20" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="active-nav"
                    className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-lg -z-10"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <item.icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 mt-auto border-t border-border/50 space-y-1">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? "Exporting…" : "Download Config"}
          </button>
          <button
            onClick={() => setCredentials(null)}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
        <div className="flex-1 overflow-auto p-6 md:p-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="max-w-6xl mx-auto h-full"
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
