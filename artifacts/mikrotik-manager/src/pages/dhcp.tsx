import React from "react";
import { Laptop, RefreshCw } from "lucide-react";
import { useMikrotikDhcpLeases } from "@/hooks/use-mikrotik";
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

export default function DhcpLeasesPage() {
  const { data: leases, isLoading, refetch, isFetching } = useMikrotikDhcpLeases();

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
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="h-16">
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
                  <TableCell className="font-mono font-semibold text-primary">
                    {lease.address}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {lease.macAddress}
                  </TableCell>
                  <TableCell className="font-medium">
                    {lease.hostname || <span className="text-muted-foreground italic">Unknown</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{lease.server}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={lease.status === 'bound' ? 'success' : 'secondary'} className="capitalize">
                      {lease.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {lease.expiresAfter || '-'}
                  </TableCell>
                </motion.tr>
              ))}
              {leases?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No active DHCP leases.
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
