import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

// 1. Your normal, shared client for public/authenticated users
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 2. Your Admin Bypass client (Created only once as a singleton!)
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  serviceRoleKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.dummy_key', 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storageKey: 'admin-bypass-session', // <-- Prevents the GoTrueClient warning
    }
  }
);