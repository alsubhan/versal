import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;
let configSource: 'backend' | 'fallback' | null = null;

export async function getSupabaseClient() {
  if (supabaseClient) {
    console.log(`🔗 Using cached Supabase client (source: ${configSource})`);
    return supabaseClient;
  }

  try {
    console.log('🔄 Attempting to fetch Supabase configuration from backend...');
    
    // Fetch configuration from backend
    const response = await fetch('/api/config/supabase');
    console.log('📡 Backend response status:', response.status);
    console.log('📡 Backend response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }
    
    const config = await response.json();
    console.log('📦 Raw config response:', config);
    
    // Validate the response structure
    if (!config.url || !config.publishable_key) {
      throw new Error('Invalid config structure: missing url or publishable_key');
    }
    
    console.log('✅ Successfully fetched Supabase configuration from backend:', {
      url: config.url,
      publishable_key: config.publishable_key.substring(0, 20) + '...'
    });
    
    // Create Supabase client with fetched configuration
    supabaseClient = createClient<Database>(config.url, config.publishable_key, {
      auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
      }
    });
    
    configSource = 'backend';
    console.log('🎯 Supabase client created using BACKEND configuration');
    
    // Store the source in localStorage for debugging
    localStorage.setItem('supabase_config_source', 'backend');
    
    return supabaseClient;
  } catch (error) {
    console.error('❌ Failed to fetch Supabase configuration from backend:', error);
    console.log('🔄 Falling back to hardcoded configuration...');
    
    // Use fallback configuration
    const fallbackClient = getFallbackSupabaseClient();
    supabaseClient = fallbackClient;
    configSource = 'fallback';
    
    console.log('🎯 Supabase client created using FALLBACK configuration');
    
    // Store the source in localStorage for debugging
    localStorage.setItem('supabase_config_source', 'fallback');
    
    return fallbackClient;
  }
}

// Fallback configuration (for development or if backend is not available)
const FALLBACK_CONFIG = {
  url: "https://bmyaefeddtcbnmpzvxmf.supabase.co",
  publishable_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJteWFlZmVkZHRjYm5tcHp2eG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1MTMzODcsImV4cCI6MjA2OTA4OTM4N30.4f-TJKsR-4ZPlBxdGD8QZ3Gsb1z8OPRlWK26Eq8T4_c"
};

export function getFallbackSupabaseClient() {
  console.log('🔄 Creating Supabase client with FALLBACK configuration');
  return createClient<Database>(FALLBACK_CONFIG.url, FALLBACK_CONFIG.publishable_key, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

// Utility function to check which configuration is being used
export function getConfigSource(): 'backend' | 'fallback' | null {
  return configSource;
}

// Utility function to get configuration info for debugging
export function getConfigInfo() {
  const source = localStorage.getItem('supabase_config_source') || 'unknown';
  return {
    source,
    currentConfigSource: configSource,
    hasClient: !!supabaseClient
  };
} 