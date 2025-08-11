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
      try {
        setLoading(true);
        const data = await getPublicSystemSettings();
        
        // Convert array of settings to object
        const settingsObj: SystemSettings = {
          roundingMethod: 'no_rounding',
          roundingPrecision: '0.01',
          taxRate: '10.0',
          defaultCurrency: 'INR'
        };
        
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
              // For other settings, use the key as is
              settingsObj[setting.key] = setting.value;
            }
          }
        });

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
        } catch {
          // ignore if not authenticated
        }
        
        setSettings(settingsObj);
      } catch (err) {
        setError('Failed to load system settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return { settings, loading, error };
} 