# R8 Report: optional event end date (round 1 of 2)

Branch `gdansk-fix-5`, off `main` at c5742c9 (gdansk-fix-4 merge verified in `git log`). Nothing is applied to the database. No file in `src/` changed.

## Recon

Written before any other file was created or edited. Read-only greps over `src/`, `scripts/`, `supabase/`.

### 1. Every read and write of `events.event_date`

| Where | Kind | Detail |
|---|---|---|
| supabase/migrations/0001_init.sql:15 | definition | `event_date date`, nullable |
| src/types/db.ts:13 | type | `event_date: string \| null` on `EventRow` |
| src/hooks/useEvents.ts:25 | write (insert) | `event_date: eventDate \|\| null` in `createEvent` (insert at :22) |
| src/components/EventEditor.tsx:16 | type | `Patch` picks `event_date` |
| src/components/EventEditor.tsx:32 | read | initial form state `event.event_date ?? ''` |
| src/components/EventEditor.tsx:71 | write (update) | `event_date: date \|\| null` in the patch, applied by `useEvents.ts:35` (`update(patch)`) |
| src/pages/AdminEventsPage.tsx:78 | read (display) | `[e.location, e.event_date].filter(Boolean).join(' · ')` |

Not referenced anywhere else. In particular:
- **CSV export** (src/pages/StatsPage.tsx:72-103, src/lib/csv.ts): rows are built from `orders`; the only event field used is `name` for the file name (:101). `event_date` is not read.
- **Stats**: `order_stats_v` (0001_init.sql:155-169, replaced in 0004_ops.sql:~305-330) selects only `e.name` from events, joined on `e.id`. `event_date` is not read.
- **scripts/**: none read or write `event_date`. They insert `{ name, is_active: false }` only (r1/r2/r2c/r3 livetests) and update `shirt_colors`/`shirt_sizes` (r2c-livetest.mjs:105-110).
- **supabase/**: only the definition in 0001. No function, view, trigger or policy mentions it.

### 2. Every place that selects from `events`

| Where | Form |
|---|---|
| src/context/SessionContext.tsx:54-55 | `select('*')` (active event, `is_active = true`) |
| src/hooks/useEvents.ts:10-11 | `select('*')` (admin list) |
| src/hooks/useEvents.ts:22 | `insert({ name, location, event_date })`, no return columns |
| src/hooks/useEvents.ts:35 | `update(patch)`, patch is an explicit object, no return columns |
| src/hooks/useEvents.ts:46 | `rpc('activate_event')` (see section 3) |
| scripts/r1-livetest.mjs:42, :46, :114, :117 | column list `id`; insert + bare `.select()`; delete |
| scripts/r2-livetest.mjs:54, :58, :207, :210 | same pattern |
| scripts/r2c-livetest.mjs:89, :93, :105-110, :188, :192 | `id`; insert + `.select()`; update; column list `shirt_colors, shirt_sizes`; delete |
| scripts/r3-livetest.mjs:57, :59, :150, :153 | same pattern as r1 |

`select('*')` consumers (`SessionContext`, `useEvents`) get the new column as an extra property on the row object. Nothing destructures strictly or validates keys, and `EventRow` is a TypeScript type only (erased at build), so an unknown `event_end_date` is ignored. Column-list consumers are unaffected. The `select('*')` calls on `orders`, `order_stats_v`, `staff_v` (StatsPage.tsx:44/50, useOrders.ts:56, RoleSelect.tsx:38) and designs (useDesigns.ts:18) are not on `events`.

### 3. SQL that returns the events row type or selects its columns

| Object | Where | Effect of adding a column |
|---|---|---|
| `activate_event(uuid)` | 0004_ops.sql:126-145, `returns events`, `v_event events`, `returning * into v_event` | Row type follows the table, so the function now returns the extra column automatically. Body is unchanged and valid: `returning *` into a `events`-typed variable matches the new shape. No redefinition needed. Its client caller (useEvents.ts:46) only checks `error`. |
| `order_stats_v` | 0004_ops.sql:~305-330 (original 0001_init.sql:155-169) | Joins `events e` and uses only `e.name`; explicit column list, not `e.*`. Unchanged. |
| `staff_v`, `staff_*`, `_assert_admin`, `verify_pin` | touch `users` only | Unaffected. |
| `create_order`, `create_order_v2`, `set_order_status` | touch `orders`/`users` (and `events` only for id/number lookups) | Unaffected. |
| RLS | `events_all` (0001_init.sql:179), `using (true) with check (true)` | Column-agnostic; no change. |
| Triggers on events | none found | n/a |
| Realtime | only `orders` is published (0001_init.sql:194-195) | n/a |

No function needs to be redefined. Per the hard rules, no RLS or RPC change is made.

### 4. Old cached clients keep working

- Old bundles never name `event_end_date`. Their inserts (`name, location, event_date`) and updates (`name, location, event_date, shirt_colors, shirt_sizes`) leave it at NULL (no default needed).
- The check constraint is `event_end_date is null or event_date is null or event_end_date >= event_date`. With the new column NULL it is always true, so old writes cannot violate it. Once round 2 ships and an end date exists, an old cached tablet in the admin editor could move `event_date` past that end date and get a 23514 error. Only admins write events, so this is a narrow edge case, and the SW auto-update closes it.
- `select('*')` readers tolerate the extra key (section 2). `activate_event` returns one more field; the old client ignores the payload.
- `scripts/` livetests use inserts and bare `.select()`; the extra NULL column does not change their assertions.
- Round-2 ordering hazard (why src is untouched now): a client that writes `event_end_date` before the column exists fails the insert/update with a PostgREST "column not found" error and event creation would break. Hence migration first, client later.

## Migration files (round 1, not applied)

### supabase/migrations/0005_event_end_date.sql

```sql
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
```

### supabase/rollback/0005_event_end_date_rollback.sql

```sql
-- MerchPress Queue — rollback of 0005_event_end_date.sql. NEVER run unless asked.
-- Back up first. Drops the column (DATA LOSS for any end dates entered).
-- Ship a client that no longer writes event_end_date before running this.

begin;

alter table events drop constraint if exists events_end_date_check;
alter table events drop column if exists event_end_date;

commit;
```

**This migration is additive: it contains no DROP, no ALTER COLUMN TYPE, and no change to existing rows.** (The only DROP is in the rollback file, which is never run unless asked.)

## Round 2 (needs human approval)
1. Back up, then apply 0005 to the one production database.
2. Then a client branch: `EventRow.event_end_date`, event create/edit forms, range display, optionally CSV/stats. Not part of this round.

## Validation
- `npx tsc -b`: clean
- `npm run lint`: clean
- `npm run build`: ok
- `grep -c "Dev login" dist/assets/*.js`: 0
- `git grep -n -i service_role -- src`: empty
- `git diff --stat`: no tracked file changed apart from `docs/audit/11_PHASE_GDANSK.md` (3 new files are untracked until the commit)
- Not run: any SQL, psql, `supabase db push`, `activate_event`. The migration has never been executed, so its syntax is unchecked against Postgres.
