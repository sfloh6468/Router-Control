import React from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Activity, Shield, Router as RouterIcon, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouterContext } from "@/lib/router-context";
import { useMikrotikConnect } from "@/hooks/use-mikrotik";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const connectionSchema = z.object({
  host: z.string().min(1, "IP/Hostname is required"),
  port: z.coerce.number().optional().default(8729),
  username: z.string().min(1, "Username is required"),
  password: z.string()
});

type ConnectionFormValues = z.infer<typeof connectionSchema>;

export default function ConnectionPage() {
  const [, setLocation] = useLocation();
  const { setCredentials } = useRouterContext();
  const connectMutation = useMikrotikConnect();
  
  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      host: "",
      port: 8729,
      username: "admin",
      password: ""
    }
  });

  const onSubmit = async (data: ConnectionFormValues) => {
    try {
      const result = await connectMutation.mutateAsync(data);
      if (result.success) {
        setCredentials(data);
        setLocation("/dashboard");
      } else {
        // Handle explicit logic failure from API
        form.setError("root", { message: result.message || "Connection failed" });
      }
    } catch (err: any) {
      form.setError("root", { message: err.message || "Failed to connect to router" });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-background">
      {/* Background image & overlay */}
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
          <h1 className="text-2xl font-bold tracking-tight text-white">MikroTik Access</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Enter your router credentials to establish a secure management session.
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hostname / IP</label>
                <div className="relative">
                  <RouterIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    {...form.register("host")} 
                    className="pl-9 bg-black/20 border-white/10 text-white focus:border-primary/50" 
                    placeholder="192.168.88.1"
                  />
                </div>
                {form.formState.errors.host && <p className="text-destructive text-xs">{form.formState.errors.host.message}</p>}
              </div>
              <div className="col-span-1 space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Port</label>
                <Input 
                  {...form.register("port")} 
                  className="bg-black/20 border-white/10 text-white font-mono text-center focus:border-primary/50" 
                  placeholder="8729"
                />
              </div>
            </div>

            {/* Port reference guide */}
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs space-y-1.5">
              <div className="flex items-center gap-1.5 text-blue-400 font-medium">
                <Info className="h-3.5 w-3.5 shrink-0" />
                Port Reference (MikroTik IP Services)
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-muted-foreground">
                <span><span className="font-mono text-white/80">8729</span> — API-SSL <span className="text-green-400">★ Recommended</span></span>
                <span><span className="font-mono text-white/80">8728</span> — API (no TLS)</span>
              </div>
              <div className="text-yellow-400/80 flex items-start gap-1.5 mt-1">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                If you get a timeout, your router firewall may be blocking port 8729 externally. Add a firewall rule: <span className="font-mono">/ip firewall filter add chain=input protocol=tcp dst-port=8729 action=accept</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Username</label>
              <div className="relative">
                <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  {...form.register("username")} 
                  className="pl-9 bg-black/20 border-white/10 text-white focus:border-primary/50" 
                  placeholder="admin"
                />
              </div>
              {form.formState.errors.username && <p className="text-destructive text-xs">{form.formState.errors.username.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</label>
              <Input 
                type="password"
                {...form.register("password")} 
                className="bg-black/20 border-white/10 text-white focus:border-primary/50" 
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
            disabled={connectMutation.isPending}
          >
            {connectMutation.isPending ? (
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
