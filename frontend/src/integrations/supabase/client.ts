// This file now uses dynamic configuration from the backend
// The hardcoded values are kept as fallback for development
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Fallback configuration (for development or if backend is not available)
const FALLBACK_CONFIG = {
  url: "https://bmyaefeddtcbnmpzvxmf.supabase.co",
  publishable_key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJteWFlZmVkZHRjYm5tcHp2eG1mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM1MTMzODcsImV4cCI6MjA2OTA4OTM4N30.4f-TJKsR-4ZPlBxdGD8QZ3Gsb1z8OPRlWK26Eq8T4_c"
};

// Create fallback client (for backward compatibility)
export const supabase = createClient<Database>(FALLBACK_CONFIG.url, FALLBACK_CONFIG.publishable_key, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Note: For new code, use the dynamic configuration from @/lib/supabase-config
// import { getSupabaseClient } from '@/lib/supabase-config';