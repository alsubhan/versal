import { getConfigInfo } from './supabase-config';

// Make debug functions available globally
declare global {
  interface Window {
    checkSupabaseConfig: () => void;
    getSupabaseConfigInfo: () => any;
  }
}

export function setupDebugTools() {
  // Add debug functions to window object
  window.checkSupabaseConfig = () => {
    const info = getConfigInfo();
    console.log('🔍 Supabase Configuration Status:', info);
    
    if (info.source === 'backend') {
      console.log('✅ Using BACKEND configuration - Dynamic config is working!');
    } else if (info.source === 'fallback') {
      console.log('⚠️ Using FALLBACK configuration - Backend might be unavailable');
    } else {
      console.log('❓ Unknown configuration source');
    }
  };

  window.getSupabaseConfigInfo = () => {
    return getConfigInfo();
  };

  console.log('🔧 Debug tools loaded! Use these commands:');
  console.log('  - checkSupabaseConfig() - Check configuration status');
  console.log('  - getSupabaseConfigInfo() - Get detailed config info');
} 