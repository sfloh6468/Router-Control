import React, { useState } from "react";
import { Laptop, RefreshCw, Trash2, Pin } from "lucide-react";
import { useMikrotikDhcpLeases, useRemoveDhcpLease, useMakeDhcpLeaseStatic } from "@/hooks/use-mikrotik";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function DhcpLeasesPage() {
  const { data: leases, isLoading, refetch, isFetching } = useMikrotikDhcpLeases();
  const removeLease = useRemoveDhcpLease();
  const makeStatic = useMakeDhcpLeaseStatic();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleRemove = (id: string) => {
    removeLease.mutate(id, {
      onSuccess: () => { toast.success("Lease removed"); setDeleteId(null); },
      onError: (e) => toast.error(e.message),
    });
  };

  const handleMakeStatic = (id: string) => {
    makeStatic.mutate(id, {
      onSuccess: () => toast.success("Lease made static"),
      onError: (e) => toast.error(e.message),
    });
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Laptop className="h-8 w-8 text-primary" />
            DHCP Leases
          </h1>
          <p className="text-muted-foreground mt-1">Active client leases on the network</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="flex-1 min-h-0 bg-card/60 backdrop-blur-xl border-border/50 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card/95 backdrop-blur z-10 shadow-sm">
              <TableRow>
                <TableHead>IP Address</TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>Hostname</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7} className="h-16">
                      <div className="animate-pulse h-4 bg-muted/50 rounded w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : leases?.map((lease, i) => (
                <motion.tr
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={lease.id || i}
                >
                  <TableCell className="font-mono font-semibold text-primary">{lease.address}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{lease.macAddress}</TableCell>
                  <TableCell className="font-medium">
                    {lease.hostname || <span className="text-muted-foreground italic">Unknown</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{lease.server}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={lease.status === "bound" ? "success" : "secondary"} className="capitalize">
                      {lease.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {lease.expiresAfter || <span className="italic text-muted-foreground/50">static</span>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {lease.status === "bound" && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon" variant="ghost" className="h-7 w-7"
                              disabled={makeStatic.isPending}
                              onClick={() => handleMakeStatic(lease.id!)}
                            >
                              <Pin className="h-3.5 w-3.5 text-primary" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Make static</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive"
                            onClick={() => setDeleteId(lease.id!)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove lease</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
              {leases?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No active DHCP leases.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove DHCP Lease</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the lease from the router. The client may reconnect and get a new lease.
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
