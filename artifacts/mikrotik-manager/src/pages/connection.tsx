import React from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Activity, Shield, Router as RouterIcon, CheckCircle2, Info, AlertTriangle, Network } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouterContext, type Vendor } from "@/lib/router-context";
import type { RouterCredentials } from "@workspace/api-client-react";
import { useMikrotikConnect } from "@/hooks/use-mikrotik";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const TRANSPORTS = [
  { value: "api-ssl", label: "API-SSL  (8729)", port: 8729, hint: "MikroTik binary API over TLS — recommended", recommended: true },
  { value: "api",     label: "API  (8728)",     port: 8728, hint: "MikroTik binary API, no TLS" },
  { value: "rest-tls", label: "REST / Webfig HTTPS  (443)", port: 443, hint: "Webfig REST API over HTTPS — works through most firewalls (RouterOS 7.1+)" },
  { value: "ssh",     label: "SSH  (22)",       port: 22,  hint: "SSH — terminal & AI chat only; dashboards not available" },
] as const;

const VENDORS: { value: Vendor; label: string; hint: string }[] = [
  { value: "mikrotik",   label: "MikroTik",   hint: "RouterOS device — uses API/API-SSL/REST/SSH transports." },
  { value: "huawei-olt", label: "Huawei OLT", hint: "Huawei SmartAX EA5800-family OLT (e.g. EA5801E) — SSH only on port 22." },
];

const connectionSchema = z.object({
  vendor: z.enum(["mikrotik", "huawei-olt"]).default("mikrotik"),
  host: z.string().min(1, "IP/Hostname is required"),
  port: z.coerce.number().optional().default(8729),
  username: z.string().min(1, "Username is required"),
  password: z.string(),
  transport: z.enum(["api", "api-ssl", "rest-tls", "ssh"]).default("api-ssl"),
});

type ConnectionFormValues = z.infer<typeof connectionSchema>;

export default function ConnectionPage() {
  const [, setLocation] = useLocation();
  const { setConnection } = useRouterContext();
  const connectMutation = useMikrotikConnect();
  const apiBase = import.meta.env.BASE_URL.replace(/\/$/, "");

  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      vendor: "mikrotik",
      host: "",
      port: 8729,
      username: "admin",
      password: "",
      transport: "api-ssl",
    }
  });

  const vendor = form.watch("vendor");
  const isOlt = vendor === "huawei-olt";

  const transport = form.watch("transport");
  const transportInfo = TRANSPORTS.find((t) => t.value === transport) ?? TRANSPORTS[0];
  const vendorInfo = VENDORS.find((v) => v.value === vendor) ?? VENDORS[0];

  // When the user picks a different transport, snap the port to that
  // transport's default — they can still override it manually after.
  React.useEffect(() => {
    const t = TRANSPORTS.find((x) => x.value === transport);
    if (t) form.setValue("port", t.port);
  }, [transport]);

  // When the user switches vendor: huawei-olt forces SSH/22; mikrotik resets
  // to api-ssl/8729 unless they've already changed transport.
  React.useEffect(() => {
    if (vendor === "huawei-olt") {
      form.setValue("transport", "ssh");
      form.setValue("port", 22);
    } else {
      form.setValue("transport", "api-ssl");
      form.setValue("port", 8729);
    }
  }, [vendor]);

  const onSubmit = async (data: ConnectionFormValues) => {
    try {
      let result: {
        success: boolean;
        message?: string;
        identity?: string | null;
        routerOs?: string | null;
        routerBoard?: string | null;
      };

      // Huawei OLT is SSH-only; the port must be 22 regardless of what's
      // in the (defaulted) port input — we hard-enforce it here so a stale
      // value never leaks through.
      const effectivePort = data.vendor === "huawei-olt" ? 22 : data.port;

      if (data.vendor === "huawei-olt") {
        // OLT: hit /api/olt/connect directly with SSH creds (no transport field).
        const r = await fetch(`${apiBase}/api/olt/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            host: data.host,
            port: effectivePort,
            username: data.username,
            password: data.password,
          }),
        });
        const j = await r.json();
        result = {
          success: !!j.success,
          message: j.error ?? j.message,
          identity: j.identity ?? null,
          routerOs: j.routerOs ?? null,
          routerBoard: j.routerBoard ?? null,
        };
      } else {
        result = await connectMutation.mutateAsync(data) as typeof result;
      }

      if (result.success) {
        // The shared RouterCredentials type carries a `transport` field that
        // only applies to MikroTik. We build the object from the same shape
        // and assert via the typed RouterCredentials, which keeps callers
        // type-safe end-to-end.
        const credsForContext: RouterCredentials = {
          host: data.host,
          port: effectivePort,
          username: data.username,
          password: data.password,
          ...(data.vendor === "mikrotik" ? { transport: data.transport } : {}),
        } as RouterCredentials;

        // Upsert profile so chat history persists across reconnects.
        let profileId: number | null = null;
        try {
          const r = await fetch(`${apiBase}/api/profiles/upsert`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              host: data.host,
              port: effectivePort,
              username: data.username,
              vendor: data.vendor,
              identity: result.identity ?? null,
              routerOs: result.routerOs ?? null,
              routerBoard: result.routerBoard ?? null,
            }),
          });
          if (r.ok) {
            const pj = await r.json();
            profileId = pj.profile?.id ?? null;
          }
        } catch {
          // profile persistence is non-fatal
        }
        setConnection(credsForContext, {
          identity: result.identity ?? null,
          vendor: data.vendor,
          routerOs: result.routerOs ?? null,
          routerBoard: result.routerBoard ?? null,
          profileId,
        });
        setLocation("/dashboard");
      } else {
        form.setError("root", { message: result.message || "Connection failed" });
      }
    } catch (err: any) {
      form.setError("root", { message: err.message || "Failed to connect" });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      <div className="absolute inset-0 z-0">
        <img
          src={`${import.meta.env.BASE_URL}images/network-bg.png`}
          alt="Network Background"
          className="w-full h-full object-cover opacity-20"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md p-8 glass-panel rounded-2xl"
      >
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="h-16 w-16 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/30 mb-4 relative">
            <div className="absolute inset-0 rounded-2xl glow-effect opacity-50" />
            <Activity className="h-8 w-8 text-primary relative z-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Network Device Manager</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Connect to a MikroTik router or Huawei SmartAX OLT to start a managed session.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            {/* Vendor selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Device Vendor</label>
              <div className="grid grid-cols-2 gap-2">
                {VENDORS.map((v) => {
                  const active = vendor === v.value;
                  return (
                    <button
                      type="button"
                      key={v.value}
                      onClick={() => form.setValue("vendor", v.value)}
                      className={
                        "flex items-center justify-center gap-2 h-11 rounded-md text-sm font-medium border transition-colors " +
                        (active
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-background border-input text-muted-foreground hover:text-foreground hover:border-primary/30")
                      }
                    >
                      <Network className="h-4 w-4" />
                      {v.label}
                    </button>
                  );
                })}
              </div>
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs flex items-start gap-1.5 text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-700" />
                <span>{vendorInfo.hint}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hostname / IP</label>
                <div className="relative">
                  <RouterIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    {...form.register("host")}
                    className="pl-9 bg-background border-input text-foreground focus:border-primary/50"
                    placeholder={isOlt ? "10.0.0.1" : "192.168.88.1"}
                  />
                </div>
                {form.formState.errors.host && <p className="text-destructive text-xs">{form.formState.errors.host.message}</p>}
              </div>
              <div className="col-span-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Port</label>
                <Input
                  {...form.register("port")}
                  disabled={isOlt}
                  className="bg-background border-input text-foreground font-mono text-center focus:border-primary/50 disabled:opacity-60"
                  placeholder={isOlt ? "22" : "8729"}
                  title={isOlt ? "Huawei OLT is SSH-only on port 22 (locked)" : undefined}
                />
              </div>
            </div>

            {/* Transport selector — only for MikroTik */}
            {!isOlt && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Transport</label>
                <select
                  {...form.register("transport")}
                  className="w-full h-10 px-3 rounded-md bg-background border border-input text-foreground text-sm focus:border-primary/50 focus:outline-none"
                >
                  {TRANSPORTS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}{"recommended" in t && t.recommended ? "  ★" : ""}
                    </option>
                  ))}
                </select>
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs flex items-start gap-1.5 text-muted-foreground">
                  <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-700" />
                  <span>{transportInfo.hint}</span>
                </div>
                {transport === "ssh" && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs flex items-start gap-1.5 text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>SSH lets you reach the router when API ports are blocked, but the dashboard pages (Interfaces / Firewall / DHCP / Wireless) are unavailable over SSH. The Terminal page and the AI assistant work fully.</span>
                  </div>
                )}
                {transport === "rest-tls" && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs flex items-start gap-1.5 text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>REST/Webfig requires RouterOS 7.1 or newer with the <span className="font-mono">www</span> (or <span className="font-mono">www-ssl</span>) service enabled. Self-signed certificates are accepted automatically.</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Username</label>
              <div className="relative">
                <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  {...form.register("username")}
                  className="pl-9 bg-background border-input text-foreground focus:border-primary/50"
                  placeholder={isOlt ? "root" : "admin"}
                />
              </div>
              {form.formState.errors.username && <p className="text-destructive text-xs">{form.formState.errors.username.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</label>
              <Input
                type="password"
                {...form.register("password")}
                className="bg-background border-input text-foreground focus:border-primary/50"
                placeholder="••••••••"
              />
            </div>
          </div>

          {form.formState.errors.root && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive flex items-start gap-2">
              <Shield className="h-4 w-4 mt-0.5 shrink-0" />
              <p>{form.formState.errors.root.message}</p>
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-base font-semibold mt-6 relative overflow-hidden group"
            disabled={connectMutation.isPending || form.formState.isSubmitting}
          >
            {(connectMutation.isPending || form.formState.isSubmitting) ? (
              <span className="flex items-center gap-2">
                <Activity className="h-5 w-5 animate-spin" />
                Connecting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 group-hover:scale-110 transition-transform" />
                Establish Connection
              </span>
            )}
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
