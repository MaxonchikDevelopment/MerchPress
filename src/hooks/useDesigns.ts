import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Design } from '../types/db';

// Designs for one event. Returns a reload fn so admin edits show up immediately.
export function useDesigns(eventId: string | null) {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!eventId) {
      setDesigns([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('designs')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    setDesigns((data as Design[]) ?? []);
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { designs, loading, reload };
}
