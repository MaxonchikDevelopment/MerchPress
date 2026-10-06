/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected by vite.config.ts `define`: first 7 characters of the commit, or "dev".
declare const __BUILD_ID__: string;
// Injected by vite.config.ts `define`: the "version" field of package.json, or "" if unreadable.
declare const __APP_VERSION__: string;
