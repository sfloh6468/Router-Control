import React, { useState } from "react";
import { ShieldCheck, RefreshCw, Plus, Trash2, Power } from "lucide-react";
import {
  useMikrotikFirewallRules,
  useMikrotikInterfaces,
  useAddFirewallRule,
  useRemoveFirewallRule,
  useToggleFirewallRule,
} from "@/hooks/use-mikrotik";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { toast } from "sonner";

const CHAINS = ["forward", "input", "output"];
const ACTIONS = ["accept", "drop", "reject", "passthrough", "tarpit", "log", "fasttrack-connection", "mark-connection", "mark-packet", "mark-routing", "return", "jump"];
const PROTOCOLS = ["tcp", "udp", "icmp", "icmpv6", "ospf", "igmp", "gre", "ipsec-esp", "ipsec-ah"];

type FormState = {
  chain: string; action: string; protocol: string;
  srcAddress: string; dstAddress: string; dstPort: string;
  inInterface: string; comment: string;
};
const emptyForm = (): FormState => ({
  chain: "forward", action: "accept", protocol: "",
  srcAddress: "", dstAddress: "", dstPort: "",
  inInterface: "", comment: "",
});

export default function FirewallPage() {
  const { data: rules, isLoading, refetch, isFetching } = useMikrotikFirewallRules();
  const { data: interfaces } = useMikrotikInterfaces();
  const addRule = useAddFirewallRule();
  const removeRule = useRemoveFirewallRule();
  const toggleRule = useToggleFirewallRule();

  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const set = (k: keyof FormState) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleAdd = () => {
    if (!form.chain || !form.action) { toast.error("Chain and action are required"); return; }
    addRule.mutate(
      {
        chain: form.chain,
        action: form.action,
        protocol: form.protocol || undefined,
        srcAddress: form.srcAddress || undefined,
        dstAddress: form.dstAddress || undefined,
        dstPort: form.dstPort || undefined,
        inInterface: form.inInterface || undefined,
        comment: form.comment || undefined,
      },
      {
        onSuccess: () => { toast.success("Firewall rule added"); setAddOpen(false); setForm(emptyForm()); },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleRemove = (id: string) => {
    removeRule.mutate(id, {
      onSuccess: () => { toast.success("Rule removed"); setDeleteId(null); },
      onError: (e) => toast.error(e.message),
    });
  };

  const handleToggle = (id: string, disabled: string | null) => {
    const willDisable = disabled !== "true";
    toggleRule.mutate(
      { id, disabled: willDisable },
      {
        onSuccess: () => toast.success(willDisable ? "Rule disabled" : "Rule enabled"),
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const getActionBadge = (action: string | null | undefined) => {
    switch (action) {
      case "accept": return <Badge variant="success">Accept</Badge>;
      case "drop": return <Badge variant="destructive">Drop</Badge>;
      case "reject": return <Badge variant="destructive">Reject</Badge>;
      case "fasttrack-connection": return <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-none">Fasttrack</Badge>;
      default: return <Badge variant="secondary" className="capitalize">{action || "unknown"}</Badge>;
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            Firewall Rules
          </h1>
          <p className="text-muted-foreground mt-1">Filter rules configuration</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </div>
      </div>

      <Card className="flex-1 min-h-0 bg-card/60 backdrop-blur-xl border-border/50 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card/95 backdrop-blur z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Chain</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Src Address</TableHead>
                <TableHead>Dst Address</TableHead>
                <TableHead>Dst Port</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9} className="h-16">
                      <div className="animate-pulse h-4 bg-muted/50 rounded w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rules?.map((rule, i) => (
                <motion.tr
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  key={rule.id || i}
                  className={rule.disabled === "true" ? "opacity-40" : ""}
                >
                  <TableCell className="text-muted-foreground text-xs">{i}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs uppercase tracking-wider">{rule.chain}</span>
                  </TableCell>
                  <TableCell>{getActionBadge(rule.action)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{rule.protocol || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{rule.srcAddress || "any"}</TableCell>
                  <TableCell className="font-mono text-xs">{rule.dstAddress || "any"}</TableCell>
                  <TableCell className="font-mono text-xs text-primary">{rule.dstPort || "-"}</TableCell>
                  <TableCell className="text-muted-foreground text-xs italic max-w-[140px] truncate">{rule.comment || ""}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            disabled={toggleRule.isPending}
                            onClick={() => handleToggle(rule.id!, rule.disabled ?? null)}
                          >
                            <Power className={`h-3.5 w-3.5 ${rule.disabled === "true" ? "text-muted-foreground" : "text-success"}`} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{rule.disabled === "true" ? "Enable rule" : "Disable rule"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive"
                            onClick={() => setDeleteId(rule.id!)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete rule</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
              {rules?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    No firewall rules found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add Rule Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Firewall Rule</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Chain *</Label>
              <Select value={form.chain} onValueChange={set("chain")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CHAINS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Action *</Label>
              <Select value={form.action} onValueChange={set("action")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Protocol</Label>
              <Select value={form.protocol || "_any"} onValueChange={(v) => set("protocol")(v === "_any" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_any">any</SelectItem>
                  {PROTOCOLS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>In Interface</Label>
              <Select value={form.inInterface || "_any"} onValueChange={(v) => set("inInterface")(v === "_any" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_any">any</SelectItem>
                  {interfaces?.map((i) => <SelectItem key={i.id} value={i.name!}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source Address</Label>
              <Input placeholder="e.g. 192.168.1.0/24" value={form.srcAddress} onChange={(e) => set("srcAddress")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Destination Address</Label>
              <Input placeholder="e.g. 0.0.0.0/0" value={form.dstAddress} onChange={(e) => set("dstAddress")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Destination Port</Label>
              <Input placeholder="e.g. 80 or 80-443" value={form.dstPort} onChange={(e) => set("dstPort")(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Comment</Label>
              <Input placeholder="optional" value={form.comment} onChange={(e) => set("comment")(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addRule.isPending}>
              {addRule.isPending ? "Adding…" : "Add Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Firewall Rule</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the rule from the router. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteId && handleRemove(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
