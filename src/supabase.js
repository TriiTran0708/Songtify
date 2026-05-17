import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Your provided project details (used as safe fallbacks when env vars aren't set)
const defaultSupabaseUrl = 'https://gffvrxtynvdjqfwxwxvj.supabase.co';
const defaultSupabaseAnonKey = 'sb_publishable_EAq2tFpFtTDTIh3zxYDOaQ_4RsYJyGj';

// Kiểm tra cấu hình: prefer real env vars, fall back to the defaults above
export const isSupabaseConfigured =
  supabaseUrl &&
  supabaseUrl !== '' &&
  supabaseUrl !== 'https://gffvrxtynvdjqfwxwxvj.supabase.co' &&
  supabaseAnonKey &&
  supabaseAnonKey !== '' &&
  supabaseAnonKey !== 'your-anon-key';

if (!isSupabaseConfigured) {
  console.warn('Supabase chưa được cấu hình qua VITE_ env vars — đang dùng cấu hình tạm thời từ mã nguồn. Để cấu hình chính xác, thêm VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY vào .env.local (không commit vào git).');
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : defaultSupabaseUrl,
  isSupabaseConfigured ? supabaseAnonKey : defaultSupabaseAnonKey
);
