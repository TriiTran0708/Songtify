import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Your provided project details (used as safe fallbacks when env vars aren't set)
const defaultSupabaseUrl = 'https://gffvrxtynvdjqfwxwxvj.supabase.co';
const defaultSupabaseAnonKey = 'sb_publishable_EAq2tFpFtTDTIh3zxYDOaQ_4RsYJyGj';

// Check configured state: true if real env variables are supplied, otherwise false so we use defaults
export const isSupabaseConfigured = !!(supabaseUrl && supabaseUrl !== '' && supabaseAnonKey && supabaseAnonKey !== '');

if (!isSupabaseConfigured) {
  console.warn('Supabase chưa được cấu hình qua VITE_ env vars — đang dùng cấu hình tạm thời từ mã nguồn.');
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : defaultSupabaseUrl,
  isSupabaseConfigured ? supabaseAnonKey : defaultSupabaseAnonKey
);
