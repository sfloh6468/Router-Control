import React, { useState } from "react";
import { Server, RefreshCw, Plus, Trash2, Power } from "lucide-react";
import {
  useMikrotikIpAddresses,
  useMikrotikInterfaces,
  useAddIpAddress,
  useRemoveIpAddress,
  useToggleIpAddress,
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

export default function IpAddressesPage() {
  const { data: addresses, isLoading, refetch, isFetching } = useMikrotikIpAddresses();
  const { data: interfaces } = useMikrotikInterfaces();
  const addAddress = useAddIpAddress();
  const removeAddress = useRemoveIpAddress();
  const toggleAddress = useToggleIpAddress();

  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({ address: "", interface: "", comment: "" });

  const handleAdd = () => {
    if (!form.address || !form.interface) {
      toast.error("Address and interface are required");
      return;
    }
    addAddress.mutate(
      { address: form.address, interface: form.interface, comment: form.comment || undefined },
      {
        onSuccess: () => { toast.success("IP address added"); setAddOpen(false); setForm({ address: "", interface: "", comment: "" }); },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleRemove = (id: string) => {
    removeAddress.mutate(id, {
      onSuccess: () => { toast.success("IP address removed"); setDeleteId(null); },
      onError: (e) => toast.error(e.message),
    });
  };

  const handleToggle = (id: string, disabled: string | null) => {
    const willDisable = disabled !== "true";
    toggleAddress.mutate(
      { id, disabled: willDisable },
      {
        onSuccess: () => toast.success(willDisable ? "Address disabled" : "Address enabled"),
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Server className="h-8 w-8 text-primary" />
            IP Addresses
          </h1>
          <p className="text-muted-foreground mt-1">Configured local IP addresses</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Address
          </Button>
        </div>
      </div>

      <Card className="flex-1 min-h-0 bg-card/60 backdrop-blur-xl border-border/50 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card/95 backdrop-blur z-10 shadow-sm">
              <TableRow>
                <TableHead>Address</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Interface</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="h-16">
                      <div className="animate-pulse h-4 bg-muted/50 rounded w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : addresses?.map((ip, i) => (
                <motion.tr
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={ip.id || i}
                  className={ip.disabled === "true" ? "opacity-50" : ""}
                >
                  <TableCell className="font-mono font-semibold text-primary">{ip.address}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{ip.network}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{ip.interface}</Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    {ip.disabled === "true" && <Badge variant="destructive">Disabled</Badge>}
                    {ip.dynamic === "true" && <Badge variant="secondary">Dynamic</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs italic">{ip.comment || ""}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {ip.dynamic !== "true" && (
                        <>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon" variant="ghost" className="h-7 w-7"
                                disabled={toggleAddress.isPending}
                                onClick={() => handleToggle(ip.id!, ip.disabled ?? null)}
                              >
                                <Power className={`h-3.5 w-3.5 ${ip.disabled === "true" ? "text-muted-foreground" : "text-success"}`} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{ip.disabled === "true" ? "Enable" : "Disable"}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive"
                                onClick={() => setDeleteId(ip.id!)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Remove</TooltipContent>
                          </Tooltip>
                        </>
                      )}
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
              {addresses?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No IP addresses configured.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add Address Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add IP Address</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="addr-address">Address (CIDR)</Label>
              <Input
                id="addr-address"
                placeholder="192.168.1.1/24"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-iface">Interface</Label>
              <Select value={form.interface} onValueChange={(v) => setForm((f) => ({ ...f, interface: v }))}>
                <SelectTrigger id="addr-iface">
                  <SelectValue placeholder="Select interface…" />
                </SelectTrigger>
                <SelectContent>
                  {interfaces?.map((iface) => (
                    <SelectItem key={iface.id} value={iface.name!}>{iface.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="addr-comment">Comment (optional)</Label>
              <Input
                id="addr-comment"
                placeholder="e.g. LAN interface"
                value={form.comment}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addAddress.isPending}>
              {addAddress.isPending ? "Adding…" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove IP Address</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the IP address from the router. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => deleteId && handleRemove(deleteId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
