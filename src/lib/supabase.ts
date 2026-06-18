import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Fail loud in dev: the app cannot work without these.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill them in.',
  );
}

export const supabase = createClient(url ?? '', anonKey ?? '', {
  realtime: { params: { eventsPerSecond: 10 } },
});

// Public URL for a Storage object in the `designs` bucket.
export const designPhotoUrl = (path: string | null): string | null =>
  path ? supabase.storage.from('designs').getPublicUrl(path).data.publicUrl : null;
