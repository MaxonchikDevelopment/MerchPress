import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Design } from '../types/db';

// Designs for one event. `designs` includes hidden ones (order cards and stats still
// resolve them); `activeDesigns` is what pickers offer. Returns a reload fn so admin
// edits show up immediately. A failed read keeps the previous list and sets `error`.
export function useDesigns(eventId: string | null) {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    if (!eventId) {
      setDesigns([]);
      setError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: readErr } = await supabase
      .from('designs')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    if (readErr || !data) {
      setError(true);
    } else {
      setDesigns(data as Design[]);
      setError(false);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const activeDesigns = useMemo(() => designs.filter((d) => d.is_active), [designs]);

  return { designs, activeDesigns, loading, error, reload };
}
