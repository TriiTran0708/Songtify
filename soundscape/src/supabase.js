import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Kiểm tra cấu hình
export const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseUrl !== "https://your-project-url.supabase.co" && 
  supabaseAnonKey && 
  supabaseAnonKey !== "your-anon-key";

if (!isSupabaseConfigured) {
  console.warn('Supabase chưa được cấu hình. Vui lòng nhập VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong panel Secrets.');
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://abcdefghijklm.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder'
);
