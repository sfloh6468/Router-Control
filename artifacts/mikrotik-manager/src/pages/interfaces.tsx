import React, { useState } from "react";
import { Network, RefreshCw, Power, MessageSquare, Check, X } from "lucide-react";
import { useMikrotikInterfaces, useToggleInterface, useSetInterfaceComment } from "@/hooks/use-mikrotik";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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

export default function InterfacesPage() {
  const { data: interfaces, isLoading, refetch, isFetching } = useMikrotikInterfaces();
  const toggleInterface = useToggleInterface();
  const setComment = useSetInterfaceComment();
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentVal, setCommentVal] = useState("");

  const handleToggle = (id: string, currentDisabled: string | null) => {
    const willDisable = (currentDisabled ?? null) !== "true";
    toggleInterface.mutate(
      { id, disabled: willDisable },
      {
        onSuccess: () => toast.success(willDisable ? "Interface disabled" : "Interface enabled"),
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const startEditComment = (id: string, current: string | null) => {
    setEditingComment(id);
    setCommentVal(current ?? "");
  };

  const saveComment = (id: string) => {
    setComment.mutate(
      { id, comment: commentVal },
      {
        onSuccess: () => { toast.success("Comment updated"); setEditingComment(null); },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Network className="h-8 w-8 text-primary" />
            Interfaces
          </h1>
          <p className="text-muted-foreground mt-1">Manage physical and virtual network interfaces</p>
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
                <TableHead className="w-10">R</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>MTU</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="h-16">
                      <div className="animate-pulse h-4 bg-muted/50 rounded w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : interfaces?.map((iface, i) => (
                <motion.tr
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={iface.id || i}
                  className="group"
                >
                  <TableCell>
                    <span className={`text-xs font-bold ${iface.running === "true" ? "text-success" : "text-muted-foreground/30"}`}>R</span>
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">{iface.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">{iface.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{iface.macAddress || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{iface.mtu}</TableCell>
                  <TableCell>
                    {iface.disabled === "true" ? (
                      <Badge variant="destructive">Disabled</Badge>
                    ) : (
                      <Badge variant={iface.running === "true" ? "success" : "secondary"}>
                        {iface.running === "true" ? "Running" : "Ready"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    {editingComment === iface.id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          className="h-7 text-xs py-0"
                          value={commentVal}
                          onChange={(e) => setCommentVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") saveComment(iface.id!); if (e.key === "Escape") setEditingComment(null); }}
                          autoFocus
                        />
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => saveComment(iface.id!)}>
                          <Check className="h-3 w-3 text-success" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingComment(null)}>
                          <X className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <span
                        className="text-muted-foreground text-xs italic cursor-pointer hover:text-foreground transition-colors truncate block"
                        onClick={() => startEditComment(iface.id!, iface.comment ?? null)}
                        title="Click to edit comment"
                      >
                        {iface.comment || <span className="opacity-40">add comment…</span>}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant={iface.disabled === "true" ? "outline" : "ghost"}
                          className="h-7 w-7"
                          disabled={toggleInterface.isPending}
                          onClick={() => handleToggle(iface.id!, iface.disabled ?? null)}
                        >
                          <Power className={`h-3.5 w-3.5 ${iface.disabled === "true" ? "text-muted-foreground" : "text-success"}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {iface.disabled === "true" ? "Enable interface" : "Disable interface"}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                </motion.tr>
              ))}
              {interfaces?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No interfaces found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
