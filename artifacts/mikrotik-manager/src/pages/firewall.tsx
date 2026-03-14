import React from "react";
import { ShieldCheck, RefreshCw } from "lucide-react";
import { useMikrotikFirewallRules } from "@/hooks/use-mikrotik";
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
import { motion } from "framer-motion";

export default function FirewallPage() {
  const { data: rules, isLoading, refetch, isFetching } = useMikrotikFirewallRules();

  const getActionBadge = (action: string | null | undefined) => {
    switch (action) {
      case 'accept': return <Badge variant="success">Accept</Badge>;
      case 'drop': return <Badge variant="destructive">Drop</Badge>;
      case 'reject': return <Badge variant="destructive">Reject</Badge>;
      case 'fasttrack-connection': return <Badge className="bg-blue-500 hover:bg-blue-600 text-white border-none">Fasttrack</Badge>;
      default: return <Badge variant="secondary" className="capitalize">{action || 'unknown'}</Badge>;
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
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="flex-1 min-h-0 bg-card/60 backdrop-blur-xl border-border/50 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card/95 backdrop-blur z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Chain</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Protocol</TableHead>
                <TableHead>Src Address</TableHead>
                <TableHead>Dst Address</TableHead>
                <TableHead>Dst Port</TableHead>
                <TableHead>Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="h-16">
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
                  className={rule.disabled === 'true' ? 'opacity-50' : ''}
                >
                  <TableCell className="text-muted-foreground text-xs">{i}</TableCell>
                  <TableCell>
                    <span className="font-mono text-xs uppercase tracking-wider">{rule.chain}</span>
                  </TableCell>
                  <TableCell>{getActionBadge(rule.action)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {rule.protocol || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {rule.srcAddress || 'any'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {rule.dstAddress || 'any'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-primary">
                    {rule.dstPort || '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs italic max-w-[200px] truncate">
                    {rule.comment || ''}
                  </TableCell>
                </motion.tr>
              ))}
              {rules?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No firewall rules found.
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
