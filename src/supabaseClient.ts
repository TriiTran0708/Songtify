import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if keys are actual values and not placeholders from .env.example
export const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseUrl !== "https://your-project-url.supabase.co" && 
  supabaseAnonKey && 
  supabaseAnonKey !== "your-anon-key";

if (!isSupabaseConfigured) {
  console.warn('Supabase credentials missing or invalid placeholders used. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Secrets panel.');
}

// Even if not configured, we initialize with a safe object to avoid null errors, 
// but we'll guard calls using isSupabaseConfigured.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://abcdefghijklm.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder'
);
