import { useState, useEffect } from 'react';
import { getPublicSystemSettings, getSystemSettings } from '@/lib/api';

interface SystemSettings {
  roundingMethod: string;
  roundingPrecision: string;
  taxRate: string;
  defaultCurrency: string;
  [key: string]: any;
}

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>({
    roundingMethod: 'no_rounding',
    roundingPrecision: '0.01',
    taxRate: '10.0',
    defaultCurrency: 'INR'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        setLoading(true);
        // Try fetching public settings with timeout
        const data = await getPublicSystemSettings(controller.signal);
        
        // Convert array of settings to object
        const settingsObj: SystemSettings = {
          roundingMethod: 'no_rounding',
          roundingPrecision: '0.01',
          taxRate: '10.0',
          defaultCurrency: 'INR'
        };
        
        if (Array.isArray(data)) {
          data.forEach((setting: any) => {
            if (setting.key && setting.value !== undefined) {
              // Map snake_case keys to camelCase
              if (setting.key === 'rounding_method') {
                settingsObj.roundingMethod = setting.value;
              } else if (setting.key === 'rounding_precision') {
                settingsObj.roundingPrecision = setting.value;
              } else if (setting.key === 'tax_rate') {
                settingsObj.taxRate = setting.value;
              } else if (setting.key === 'default_currency') {
                settingsObj.defaultCurrency = setting.value;
              } else {
                settingsObj[setting.key] = setting.value;
              }
            }
          });
        }

        // Attempt to fetch private settings (requires auth); merge for keys like invoice_format_template
        try {
          const privateData = await getSystemSettings();
          if (Array.isArray(privateData)) {
            privateData.forEach((setting: any) => {
              if (setting.key && setting.value !== undefined) {
                if (setting.key === 'rounding_method') {
                  settingsObj.roundingMethod = setting.value;
                } else if (setting.key === 'rounding_precision') {
                  settingsObj.roundingPrecision = setting.value;
                } else if (setting.key === 'tax_rate') {
                  settingsObj.taxRate = setting.value;
                } else if (setting.key === 'default_currency') {
                  settingsObj.defaultCurrency = setting.value;
                } else {
                  settingsObj[setting.key] = setting.value;
                }
              }
            });
          }
        } catch (privateErr) {
          console.warn('Could not fetch private system settings, using defaults/public:', privateErr);
        }
        
        setSettings(settingsObj);
        setError(null);
      } catch (err: any) {
        console.error('System settings fetch error:', err);
        if (err.name === 'AbortError') {
          setError('System settings request timed out');
        } else {
          setError('Failed to load system settings');
        }
        // Don't stay in loading forever; use default state if fetch fails
      } finally {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, loading, error };
} 