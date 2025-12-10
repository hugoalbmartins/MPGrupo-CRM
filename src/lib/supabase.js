import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const customFetch = async (url, options = {}) => {
  const originalResponse = await fetch(url, options);

  const clonedResponse = originalResponse.clone();
  const bodyText = await clonedResponse.text();

  return new Response(bodyText, {
    status: originalResponse.status,
    statusText: originalResponse.statusText,
    headers: originalResponse.headers
  });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    fetch: customFetch
  }
});
