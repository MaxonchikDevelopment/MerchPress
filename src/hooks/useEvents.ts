import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { EventRow } from '../types/db';

export function useEvents() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    setEvents((data as EventRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createEvent = useCallback(
    async (name: string, location: string, eventDate: string) => {
      await supabase.from('events').insert({
        name,
        location: location || null,
        event_date: eventDate || null,
      });
      await reload();
    },
    [reload],
  );

  // Make exactly one event active, atomically, through activate_event.
  // Returns an error message, or null on success.
  const activateEvent = useCallback(
    async (id: string): Promise<string | null> => {
      const { error } = await supabase.rpc('activate_event', { p_event_id: id });
      await reload();
      return error ? `Couldn't activate the event: ${error.message}` : null;
    },
    [reload],
  );

  return { events, loading, reload, createEvent, activateEvent };
}
