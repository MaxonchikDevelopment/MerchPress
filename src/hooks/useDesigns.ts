import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Design } from '../types/db';

// Designs for one event. `designs` includes hidden ones (order cards and stats still
// resolve them); `activeDesigns` is what pickers offer. Returns a reload fn so admin
// edits show up immediately.
export function useDesigns(eventId: string | null) {
  const [designs, setDesigns] = useState<Design[]>([]);

  const reload = useCallback(async () => {
    if (!eventId) {
      setDesigns([]);
      return;
    }
    const { data } = await supabase
      .from('designs')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    setDesigns((data as Design[]) ?? []);
  }, [eventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeDesigns = useMemo(() => designs.filter((d) => d.is_active), [designs]);

  return { designs, activeDesigns, reload };
}
