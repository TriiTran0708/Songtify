interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
