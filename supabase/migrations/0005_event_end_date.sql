-- MerchPress Queue — optional event end date (round 1 of 2, not applied by this commit)
-- Additive only: one nullable column, one check constraint. No default, no drops,
-- no type changes. Existing rows keep NULL, so the check is true for all of them.
-- Re-runnable: the column uses IF NOT EXISTS, the constraint is guarded.

begin;

alter table events add column if not exists event_end_date date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_end_date_check'
      and conrelid = 'public.events'::regclass
  ) then
    alter table events add constraint events_end_date_check
      check (event_end_date is null or event_date is null or event_end_date >= event_date);
  end if;
end $$;

commit;
