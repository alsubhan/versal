import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Activity, 
  HardDrive, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Trash2,
  TrendingUp,
  TrendingDown,
  Zap
} from 'lucide-react';
import { performanceMonitor } from '@/lib/performance';

interface PerformanceMetrics {
  [key: string]: {
    average: number;
    count: number;
    min: number;
    max: number;
  };
}

interface MemoryUsage {
  used: number;
  total: number;
  percentage: number;
}

interface PerformanceDashboardProps {
  isVisible: boolean;
  onClose: () => void;
}

export function PerformanceDashboard({ isVisible, onClose }: PerformanceDashboardProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({});
  const [memoryUsage, setMemoryUsage] = useState<MemoryUsage>({ used: 0, total: 0, percentage: 0 });
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const updateMetrics = () => {
    setMetrics(performanceMonitor.getMetrics());
    setMemoryUsage(performanceMonitor.getMemoryUsage());
    setLastUpdate(new Date());
  };

  useEffect(() => {
    if (!isVisible) return;
    
    // Update metrics every 2 seconds
    const interval = setInterval(updateMetrics, 2000);
    updateMetrics(); // Initial update

    return () => clearInterval(interval);
  }, [isVisible]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1) return '< 1ms';
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getMemoryStatus = (percentage: number) => {
    if (percentage < 50) return { color: 'text-green-600', bg: 'bg-green-100', status: 'Good' };
    if (percentage < 80) return { color: 'text-yellow-600', bg: 'bg-yellow-100', status: 'Warning' };
    return { color: 'text-red-600', bg: 'bg-red-100', status: 'Critical' };
  };

  const getPerformanceStatus = (avgMs: number) => {
    if (avgMs < 100) return { color: 'text-green-600', bg: 'bg-green-100', status: 'Fast' };
    if (avgMs < 1000) return { color: 'text-yellow-600', bg: 'bg-yellow-100', status: 'Slow' };
    return { color: 'text-red-600', bg: 'bg-red-100', status: 'Very Slow' };
  };

  const sortedMetrics = Object.entries(metrics).sort(([, a], [, b]) => b.average - a.average);

  const totalOperations = Object.values(metrics).reduce((sum, metric) => sum + metric.count, 0);
  const averageResponseTime = totalOperations > 0 
    ? Object.values(metrics).reduce((sum, metric) => sum + (metric.average * metric.count), 0) / totalOperations
    : 0;

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-4 z-50 bg-background/95 backdrop-blur-sm border rounded-lg shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Performance Dashboard</h2>
          <Badge variant="outline" className="text-xs">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={updateMetrics}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              performanceMonitor.clearMetrics();
              updateMetrics();
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            size="sm"
          >
            Close
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-h-[calc(100vh-8rem)] overflow-y-auto">
        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{memoryUsage.percentage.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                {formatBytes(memoryUsage.used)} / {formatBytes(memoryUsage.total)}
              </p>
              <Progress value={memoryUsage.percentage} className="mt-2" />
              <Badge 
                variant="outline" 
                className={`mt-2 ${getMemoryStatus(memoryUsage.percentage).bg} ${getMemoryStatus(memoryUsage.percentage).color}`}
              >
                {getMemoryStatus(memoryUsage.percentage).status}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Operations</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOperations}</div>
              <p className="text-xs text-muted-foreground">
                Across {Object.keys(metrics).length} operations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(averageResponseTime)}</div>
              <p className="text-xs text-muted-foreground">
                Across all operations
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Slow Operations</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Object.values(metrics).filter(m => m.average > 1000).length}
              </div>
              <p className="text-xs text-muted-foreground">
                {'>'} 1 second
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Metrics */}
        <Tabs defaultValue="operations" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="operations">Operations</TabsTrigger>
            <TabsTrigger value="memory">Memory</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="operations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Operation Performance</CardTitle>
                <CardDescription>
                  Detailed performance metrics for all tracked operations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operation</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Average</TableHead>
                      <TableHead>Min</TableHead>
                      <TableHead>Max</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMetrics.map(([name, metric]) => {
                      const status = getPerformanceStatus(metric.average);
                      return (
                        <TableRow key={name}>
                          <TableCell className="font-mono text-sm">{name}</TableCell>
                          <TableCell>{metric.count}</TableCell>
                          <TableCell>{formatDuration(metric.average)}</TableCell>
                          <TableCell>{formatDuration(metric.min)}</TableCell>
                          <TableCell>{formatDuration(metric.max)}</TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`${status.bg} ${status.color}`}
                            >
                              {status.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {sortedMetrics.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          No operations tracked yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="memory" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Memory Analysis</CardTitle>
                <CardDescription>
                  Detailed memory usage breakdown
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Used Memory</span>
                      <span className="font-mono">{formatBytes(memoryUsage.used)}</span>
                    </div>
                    <Progress value={memoryUsage.percentage} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Memory</span>
                      <span className="font-mono">{formatBytes(memoryUsage.total)}</span>
                    </div>
                    <Progress value={100} />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {formatBytes(memoryUsage.total - memoryUsage.used)}
                    </div>
                    <div className="text-sm text-muted-foreground">Available</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {memoryUsage.percentage.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Usage</div>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {memoryUsage.percentage > 80 ? '⚠️' : '✅'}
                    </div>
                    <div className="text-sm text-muted-foreground">Status</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Performance Alerts</CardTitle>
                <CardDescription>
                  Issues that need attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {memoryUsage.percentage > 80 && (
                    <div className="flex items-center gap-3 p-3 border border-red-200 bg-red-50 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                      <div>
                        <div className="font-medium text-red-800">High Memory Usage</div>
                        <div className="text-sm text-red-600">
                          Memory usage is at {memoryUsage.percentage.toFixed(1)}%. Consider optimizing memory usage.
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {Object.entries(metrics).filter(([, metric]) => metric.average > 1000).map(([name, metric]) => (
                    <div key={name} className="flex items-center gap-3 p-3 border border-yellow-200 bg-yellow-50 rounded-lg">
                      <Clock className="h-5 w-5 text-yellow-600" />
                      <div>
                        <div className="font-medium text-yellow-800">Slow Operation: {name}</div>
                        <div className="text-sm text-yellow-600">
                          Average time: {formatDuration(metric.average)} (called {metric.count} times)
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {Object.entries(metrics).filter(([, metric]) => metric.average > 1000).length === 0 && 
                   memoryUsage.percentage <= 80 && (
                    <div className="flex items-center gap-3 p-3 border border-green-200 bg-green-50 rounded-lg">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <div>
                        <div className="font-medium text-green-800">All Systems Normal</div>
                        <div className="text-sm text-green-600">
                          No performance issues detected
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 