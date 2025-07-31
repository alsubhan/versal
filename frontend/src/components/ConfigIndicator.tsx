import { useState, useEffect, useMemo } from 'react';
import { getConfigInfo } from '@/lib/supabase-config';

export function ConfigIndicator() {
  const [configInfo, setConfigInfo] = useState<any>(null);

  useEffect(() => {
    // Get initial config info
    setConfigInfo(getConfigInfo());

    // Update config info every 30 seconds instead of every 2 seconds
    const interval = setInterval(() => {
      setConfigInfo(getConfigInfo());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, []);

  // Memoize the indicator style to prevent unnecessary recalculations
  const indicatorStyle = useMemo(() => {
    if (!configInfo) return null;

    const getIndicatorStyle = (source: string) => {
      switch (source) {
        case 'backend':
          return {
            color: 'bg-green-500',
            pulse: 'animate-pulse',
            icon: '🟢'
          };
        case 'fallback':
          return {
            color: 'bg-gray-500',
            pulse: 'animate-pulse',
            icon: '⚪'
          };
        default:
          return {
            color: 'bg-red-500',
            pulse: '',
            icon: '🔴'
          };
      }
    };

    return getIndicatorStyle(configInfo.source);
  }, [configInfo]);

  // Memoize the tooltip text
  const tooltipText = useMemo(() => {
    if (!configInfo) return '';

    const getTooltipText = (source: string) => {
      switch (source) {
        case 'backend':
          return '✅ Using Backend Configuration';
        case 'fallback':
          return '⚠️ Using Fallback Configuration';
        default:
          return '❌ Unknown Configuration';
      }
    };

    return getTooltipText(configInfo.source);
  }, [configInfo]);

  if (!configInfo || !indicatorStyle) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div 
        className={`w-4 h-4 rounded-full ${indicatorStyle.color} ${indicatorStyle.pulse} shadow-lg cursor-help transition-all duration-300 hover:scale-110`}
        title={tooltipText}
      />
    </div>
  );
} 