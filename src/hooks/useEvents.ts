import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { END_DATE_ERROR } from '../lib/eventDates';
import type { EventRow } from '../types/db';

// events_end_date_check violations come back as Postgres 23514.
const saveError = (error: { code?: string; message: string }): string =>
  error.code === '23514' ? END_DATE_ERROR : `Couldn't save the event: ${error.message}`;

export function useEvents() {
  const [events, setEvents] = useState<EventRow[]>([]);

  const reload = useCallback(async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    setEvents((data as EventRow[]) ?? []);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Returns an error message, or null on success.
  const createEvent = useCallback(
    async (name: string, location: string, eventDate: string, eventEndDate: string): Promise<string | null> => {
      const { error } = await supabase.from('events').insert({
        name,
        location: location || null,
        event_date: eventDate || null,
        event_end_date: eventDate ? eventEndDate || null : null,
      });
      await reload();
      return error ? saveError(error) : null;
    },
    [reload],
  );

  // Direct update of an event row. Returns an error message, or null on success.
  const updateEvent = useCallback(
    async (id: string, patch: Partial<Omit<EventRow, 'id' | 'created_at' | 'is_active'>>): Promise<string | null> => {
      const { error } = await supabase.from('events').update(patch).eq('id', id);
      await reload();
      return error ? saveError(error) : null;
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

  return { events, reload, createEvent, updateEvent, activateEvent };
}
