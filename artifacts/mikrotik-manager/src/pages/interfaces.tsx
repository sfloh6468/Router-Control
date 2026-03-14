import React from "react";
import { Network, RefreshCw } from "lucide-react";
import { useMikrotikInterfaces } from "@/hooks/use-mikrotik";
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

export default function InterfacesPage() {
  const { data: interfaces, isLoading, refetch, isFetching } = useMikrotikInterfaces();

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
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="flex-1 min-h-0 bg-card/60 backdrop-blur-xl border-border/50 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card/95 backdrop-blur z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-12">R</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>MAC Address</TableHead>
                <TableHead>MTU</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Comment</TableHead>
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
              ) : interfaces?.map((iface, i) => (
                <motion.tr
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={iface.id || i}
                  className="group"
                >
                  <TableCell>
                    <span className={`text-xs font-bold ${iface.running === 'true' ? 'text-success' : 'text-muted-foreground/30'}`}>
                      R
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {iface.name}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">{iface.type}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {iface.macAddress || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {iface.mtu}
                  </TableCell>
                  <TableCell>
                    {iface.disabled === 'true' ? (
                      <Badge variant="destructive">Disabled</Badge>
                    ) : (
                      <Badge variant={iface.running === 'true' ? "success" : "secondary"}>
                        {iface.running === 'true' ? 'Running' : 'Ready'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs italic max-w-[200px] truncate">
                    {iface.comment || ''}
                  </TableCell>
                </motion.tr>
              ))}
              {interfaces?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
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
