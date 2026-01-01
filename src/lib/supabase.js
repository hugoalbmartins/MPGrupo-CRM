import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase environment variables.');
  console.warn('VITE_SUPABASE_URL:', supabaseUrl ? 'configured' : 'missing');
  console.warn('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'configured' : 'missing');
}

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    storageKey: 'supabase.auth.token',
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web'
    }
  }
}) : null;

if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
      console.log('Token refreshed successfully');
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
    }
  });
}
