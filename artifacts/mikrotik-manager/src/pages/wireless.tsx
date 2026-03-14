import React from "react";
import { Wifi, RefreshCw, SignalHigh, SignalMedium, SignalLow, Signal } from "lucide-react";
import { useMikrotikWirelessClients } from "@/hooks/use-mikrotik";
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

export default function WirelessClientsPage() {
  const { data: clients, isLoading, refetch, isFetching } = useMikrotikWirelessClients();

  const getSignalIcon = (signal: string | null | undefined) => {
    if (!signal) return <Signal className="h-4 w-4 text-muted-foreground" />;
    const dbm = parseInt(signal.split('@')[0]);
    if (dbm > -60) return <SignalHigh className="h-4 w-4 text-success" />;
    if (dbm > -75) return <SignalMedium className="h-4 w-4 text-amber-500" />;
    return <SignalLow className="h-4 w-4 text-destructive" />;
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Wifi className="h-8 w-8 text-primary" />
            Wireless Clients
          </h1>
          <p className="text-muted-foreground mt-1">Connected WiFi devices</p>
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
                <TableHead>MAC Address</TableHead>
                <TableHead>Interface</TableHead>
                <TableHead>Signal</TableHead>
                <TableHead>Tx Rate</TableHead>
                <TableHead>Rx Rate</TableHead>
                <TableHead>Uptime</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6} className="h-16">
                      <div className="animate-pulse h-4 bg-muted/50 rounded w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : clients?.map((client, i) => (
                <motion.tr
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={client.id || i}
                >
                  <TableCell className="font-mono font-semibold text-foreground">
                    {client.macAddress}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                      {client.interface}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      {getSignalIcon(client.signalStrength)}
                      {client.signalStrength}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {client.txRate || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {client.rxRate || '-'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {client.uptime}
                  </TableCell>
                </motion.tr>
              ))}
              {clients?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    No wireless clients connected.
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
