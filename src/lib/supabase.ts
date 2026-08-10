// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// The Supabase client now strictly relies on our validated env object.
// If the variables are missing, the app will fail fast at startup before reaching this point.
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);