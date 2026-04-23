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
  Loader2,
  User as UserIcon,
  Shield,
  Cable,
  AlertOctagon,
  Plug,
} from "lucide-react";
import { useClerk, useUser, Show } from "@clerk/react";
import { useRouterContext } from "@/lib/router-context";
import { useMe } from "@/hooks/use-admin";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChatSidebar } from "@/components/chat-sidebar";

const mikrotikNav = [
  { name: "Dashboard", href: "/dashboard", icon: Activity },
  { name: "Interfaces", href: "/interfaces", icon: Network },
  { name: "IP Addresses", href: "/ip-addresses", icon: Server },
  { name: "Firewall", href: "/firewall", icon: ShieldCheck },
  { name: "DHCP Leases", href: "/dhcp", icon: Laptop },
  { name: "Wireless", href: "/wireless", icon: Wifi },
  { name: "Terminal", href: "/terminal", icon: TerminalSquare },
];

const oltNav = [
  { name: "Dashboard", href: "/dashboard", icon: Activity },
  { name: "ONUs", href: "/onts", icon: Cable },
  { name: "Service Ports", href: "/service-ports", icon: Plug },
  { name: "Alarms", href: "/alarms", icon: AlertOctagon },
  { name: "Terminal", href: "/terminal", icon: TerminalSquare },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { isConnected, credentials, meta, setCredentials, vendor } = useRouterContext();
  const isOlt = vendor === "huawei-olt";
  const navItems = isOlt ? oltNav : mikrotikNav;
  const vendorLabel = isOlt ? "Huawei OLT" : "MikroTik";
  const { user } = useUser();
  const { signOut } = useClerk();
  const [exporting, setExporting] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const me = useMe();
  const isSuper = me.data?.isSuper === true;

  const handleExport = async () => {
    if (!credentials || isOlt) return;
    setExporting(true);
    try {
      const res = await fetch(`${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/mikrotik/export`, {
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
      a.download = `mikrotik-${meta.identity ?? credentials.host}-${date}.rsc`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Config downloaded successfully");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const userChip = (
    <Show when="signed-in">
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border shadow-sm text-xs">
        {isSuper && (
          <Link href="/admin" className="flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium" title="Manage users">
            <Shield className="h-3.5 w-3.5" />
            <span>Admin</span>
          </Link>
        )}
        <UserIcon className="h-3.5 w-3.5 text-primary" />
        <span className="text-muted-foreground truncate max-w-[160px]">
          {user?.primaryEmailAddress?.emailAddress ?? user?.username ?? "Signed in"}
        </span>
        <button
          onClick={() => signOut()}
          className="text-muted-foreground hover:text-destructive transition-colors"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </Show>
  );

  if (!isConnected) {
    return (
      <div className="flex h-screen bg-background text-foreground overflow-hidden relative">
        <main className="flex-1 flex flex-col min-w-0 relative">
          {userChip}
          {children}
        </main>
        <ChatSidebar open={chatOpen} onOpenChange={setChatOpen} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden relative">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-border bg-card z-10 shadow-sm relative shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center border border-primary/30 relative">
            <div className="absolute inset-0 rounded-xl glow-effect opacity-50" />
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-lg leading-tight tracking-tight">{vendorLabel}</h1>
            <p
              className="text-xs text-muted-foreground font-mono flex items-center gap-1.5 truncate"
              title={meta.identity ? `${meta.identity} (${credentials?.host})` : credentials?.host}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
              <span className="truncate">{meta.identity ?? credentials?.host}</span>
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
                    ? "text-primary bg-primary/10 border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
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
          {isSuper && (
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                location === "/admin"
                  ? "text-amber-700 bg-amber-50 border border-amber-200"
                  : "text-muted-foreground hover:text-amber-700 hover:bg-amber-50",
              )}
            >
              <Shield className="h-4 w-4" />
              Users & Roles
            </Link>
          )}
        </nav>

        <div className="p-3 border-t border-border space-y-1">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
            <div className="h-6 w-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <UserIcon className="h-3 w-3 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-foreground/80">
                {user?.primaryEmailAddress?.emailAddress ?? user?.username ?? "Signed in"}
              </div>
              {me.data && (
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {me.data.role.replace("_", " ")}
                </div>
              )}
            </div>
          </div>
          {!isOlt && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Exporting…" : "Download Config"}
            </button>
          )}
          <button
            onClick={() => setCredentials(null)}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Disconnect Device
          </button>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-background to-background relative">
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

      {/* Right chat sidebar */}
      <ChatSidebar open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}
