import React from "react";
import { Activity, Cpu, HardDrive, Clock, Box, RefreshCw } from "lucide-react";
import { useMikrotikSystem } from "@/hooks/use-mikrotik";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import { motion } from "framer-motion";

export default function DashboardPage() {
  const { data: sys, isLoading, error, refetch, isFetching } = useMikrotikSystem();

  if (error) {
    return (
      <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive">
        <h3 className="font-bold mb-2">Error loading dashboard</h3>
        <p>{error.message}</p>
      </div>
    );
  }

  const memoryUsed = sys?.totalMemory && sys?.freeMemory 
    ? parseInt(sys.totalMemory) - parseInt(sys.freeMemory) 
    : 0;
    
  const memoryTotal = sys?.totalMemory ? parseInt(sys.totalMemory) : 1;
  const memoryPercent = (memoryUsed / memoryTotal) * 100;
  
  const hddUsed = sys?.totalHddSpace && sys?.freeHddSpace 
    ? parseInt(sys.totalHddSpace) - parseInt(sys.freeHddSpace) 
    : 0;
  const hddTotal = sys?.totalHddSpace ? parseInt(sys.totalHddSpace) : 1;
  const hddPercent = (hddUsed / hddTotal) * 100;

  const cpuLoad = sys?.cpuLoad ? parseInt(sys.cpuLoad) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">System resource overview</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()} 
          disabled={isFetching}
          className="bg-card/50 backdrop-blur-sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="animate-pulse bg-card/40">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      ) : sys ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard 
              title="Uptime" 
              value={sys.uptime || "N/A"} 
              icon={<Clock className="h-5 w-5 text-primary" />} 
              delay={0.1}
            />
            <StatCard 
              title="Version" 
              value={sys.version || "N/A"} 
              subtitle={sys.architecture}
              icon={<Box className="h-5 w-5 text-primary" />} 
              delay={0.2}
            />
            <StatCard 
              title="Board" 
              value={sys.boardName || "N/A"} 
              subtitle={sys.platform}
              icon={<HardDrive className="h-5 w-5 text-primary" />} 
              delay={0.3}
            />
            <StatCard 
              title="CPU Info" 
              value={`${sys.cpuCount} Cores`} 
              subtitle={`${sys.cpuFrequency} MHz`}
              icon={<Cpu className="h-5 w-5 text-primary" />} 
              delay={0.4}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="lg:col-span-1"
            >
              <Card className="h-full bg-card/60 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5 text-primary" /> CPU Load
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-6">
                  <div className="relative h-40 w-40 flex items-center justify-center">
                    <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" className="text-secondary" />
                      <circle 
                        cx="50" cy="50" r="45" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="8" 
                        strokeDasharray="283" 
                        strokeDashoffset={283 - (283 * cpuLoad) / 100}
                        className={cpuLoad > 80 ? "text-destructive" : cpuLoad > 50 ? "text-amber-500" : "text-success"}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-4xl font-bold font-mono">{cpuLoad}%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="lg:col-span-2"
            >
              <Card className="h-full bg-card/60 backdrop-blur-xl border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-primary" /> Storage & Memory
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="font-medium">RAM Usage</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formatBytes(memoryUsed)} / {formatBytes(sys.totalMemory)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-lg">{memoryPercent.toFixed(1)}%</span>
                    </div>
                    <Progress 
                      value={memoryPercent} 
                      className="h-3" 
                      indicatorClassName={memoryPercent > 85 ? "bg-destructive" : memoryPercent > 70 ? "bg-amber-500" : "bg-primary"}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="font-medium">Disk Usage</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {formatBytes(hddUsed)} / {formatBytes(sys.totalHddSpace)}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-lg">{hddPercent.toFixed(1)}%</span>
                    </div>
                    <Progress 
                      value={hddPercent} 
                      className="h-3" 
                      indicatorClassName={hddPercent > 85 ? "bg-destructive" : hddPercent > 70 ? "bg-amber-500" : "bg-primary"}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, delay }: { title: string, value: string, subtitle?: string | null, icon: React.ReactNode, delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Card className="bg-card/60 backdrop-blur-xl border-border/50 hover:border-primary/30 transition-colors group">
        <CardContent className="p-6">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              {subtitle && <p className="text-xs text-muted-foreground font-mono">{subtitle}</p>}
            </div>
            <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              {icon}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
