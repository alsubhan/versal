import React from 'react';

// Performance monitoring utility
class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  private timers: Map<string, number> = new Map();

  // Start timing an operation
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  // End timing an operation and record the duration
  endTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`Timer '${name}' was not started`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(name);

    // Store the metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);

    // Log slow operations
    if (duration > 1000) {
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
    }

    return duration;
  }

  // Get average duration for an operation
  getAverageDuration(name: string): number {
    const durations = this.metrics.get(name);
    if (!durations || durations.length === 0) return 0;

    const sum = durations.reduce((acc, duration) => acc + duration, 0);
    return sum / durations.length;
  }

  // Get all metrics
  getMetrics(): Record<string, { average: number; count: number; min: number; max: number }> {
    const result: Record<string, { average: number; count: number; min: number; max: number }> = {};

    for (const [name, durations] of this.metrics.entries()) {
      const sum = durations.reduce((acc, duration) => acc + duration, 0);
      const min = Math.min(...durations);
      const max = Math.max(...durations);

      result[name] = {
        average: sum / durations.length,
        count: durations.length,
        min,
        max,
      };
    }

    return result;
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics.clear();
    this.timers.clear();
  }

  // Monitor memory usage
  getMemoryUsage(): { used: number; total: number; percentage: number } {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        percentage: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100,
      };
    }
    return { used: 0, total: 0, percentage: 0 };
  }

  // Check for memory leaks
  checkMemoryLeak(): void {
    const memory = this.getMemoryUsage();
    if (memory.percentage > 80) {
      console.warn(`High memory usage detected: ${memory.percentage.toFixed(2)}%`);
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// React Query performance monitoring
export const queryPerformanceMonitor = {
  onQueryStart: (queryKey: string[]) => {
    const key = queryKey.join('-');
    performanceMonitor.startTimer(`query-${key}`);
  },

  onQueryEnd: (queryKey: string[], duration: number) => {
    const key = queryKey.join('-');
    performanceMonitor.endTimer(`query-${key}`);
    
    if (duration > 2000) {
      console.warn(`Slow query detected: ${key} took ${duration.toFixed(2)}ms`);
    }
  },
};

// Component render performance monitoring
export const componentPerformanceMonitor = {
  onRenderStart: (componentName: string) => {
    performanceMonitor.startTimer(`render-${componentName}`);
  },

  onRenderEnd: (componentName: string) => {
    performanceMonitor.endTimer(`render-${componentName}`);
  },
};

// API call performance monitoring
export const apiPerformanceMonitor = {
  onApiCallStart: (endpoint: string) => {
    performanceMonitor.startTimer(`api-${endpoint}`);
  },

  onApiCallEnd: (endpoint: string) => {
    performanceMonitor.endTimer(`api-${endpoint}`);
  },
};

// Utility to wrap async functions with performance monitoring
export function withPerformanceMonitoring<T extends any[], R>(
  name: string,
  fn: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    performanceMonitor.startTimer(name);
    try {
      const result = await fn(...args);
      return result;
    } finally {
      performanceMonitor.endTimer(name);
    }
  };
}

// Utility to monitor React component renders
export function withRenderMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  return (props: P) => {
    componentPerformanceMonitor.onRenderStart(componentName);
    
    React.useEffect(() => {
      componentPerformanceMonitor.onRenderEnd(componentName);
    });

    return React.createElement(Component, props);
  };
}

// Export performance metrics for debugging
export function logPerformanceMetrics(): void {
  const metrics = performanceMonitor.getMetrics();
  const memory = performanceMonitor.getMemoryUsage();
  
  console.group('Performance Metrics');
  console.table(metrics);
  console.log('Memory Usage:', memory);
  console.groupEnd();
}

// Auto-log metrics every 5 minutes in development
if (import.meta.env.DEV) {
  setInterval(() => {
    logPerformanceMetrics();
    performanceMonitor.checkMemoryLeak();
  }, 5 * 60 * 1000);
} 