import React from "react";
import { Server, RefreshCw } from "lucide-react";
import { useMikrotikIpAddresses } from "@/hooks/use-mikrotik";
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

export default function IpAddressesPage() {
  const { data: addresses, isLoading, refetch, isFetching } = useMikrotikIpAddresses();

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
                <TableHead>Address</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Interface</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5} className="h-16">
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
                >
                  <TableCell className="font-mono font-semibold text-primary">
                    {ip.address}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {ip.network}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{ip.interface}</Badge>
                  </TableCell>
                  <TableCell className="space-x-2">
                    {ip.disabled === 'true' && <Badge variant="destructive">Disabled</Badge>}
                    {ip.dynamic === 'true' && <Badge variant="secondary">Dynamic</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs italic">
                    {ip.comment || ''}
                  </TableCell>
                </motion.tr>
              ))}
              {addresses?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No IP addresses configured.
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
