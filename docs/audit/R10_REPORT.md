# R10 Report: optional event end date (gdansk-fix-7)

## Recon

Written before any other file was created or edited. Branch `gdansk-fix-7` off `main` at e7ba243. `git log` shows main contains the merges of gdansk-fix-5 (e7ba243) and gdansk-fix-6 (69eb120). Migration 0005 (`events.event_end_date date`, check `events_end_date_check`: end is null, or start is null, or end >= start) is already applied to the live database, per the task. No SQL is run or written here.

### Every use of `event_date` in `src/`
| Where | What |
|---|---|
| `src/types/db.ts:13` | `EventRow.event_date: string \| null`. No `event_end_date` yet. |
| `src/hooks/useEvents.ts:25` | `createEvent(name, location, eventDate)` inserts `event_date: eventDate \|\| null`. |
| `src/hooks/useEvents.ts:34-39` | `updateEvent(id, patch)` passes the patch straight to `.update()`, so the new column flows through once it is in the patch type. |
| `src/components/EventEditor.tsx:16` | `Patch = Pick<EventRow, 'name' \| 'location' \| 'event_date' \| ...>` |
| `src/components/EventEditor.tsx:32` | `date` state initialised from `event.event_date`. |
| `src/components/EventEditor.tsx:71` | `event_date: date \|\| null` in the save patch. |
| `src/components/EventEditor.tsx:97-100` | The single "Date" input. |
| `src/pages/AdminEventsPage.tsx:78` | Event card line: `[e.location, e.event_date].filter(Boolean).join(' · ')`. Shows the raw `YYYY-MM-DD`. |
| `src/pages/AdminEventsPage.tsx:20,25,28,53-54` | Create form `date` state and its input ("Date (optional)"). |

Nothing else reads `event_date` (no CSV, stats, cashier or press code). `select('*')` in `useEvents.ts:10` already returns the new column.

### How create and update errors reach the user
- Update: `useEvents.ts:34-39` returns `Couldn't save the event: ${error.message}`. `AdminEventsPage.save` (line 36) returns it to `EventEditor.save`, which shows it in a `toast-error` (`EventEditor.tsx:152`). The raw Postgres message would appear for a 23514, so it needs mapping on `error.code`.
- Create: `useEvents.ts:23-28` **ignores the result of `insert`**. There is no error handling at all: a failed create silently resets the form (`AdminEventsPage.tsx:25-29`). The end-date check could fail there with no feedback, so `createEvent` must return an error message and the create form needs an error display. The page already has an `error` state and `Toast` (line 58) used for activation; the create form can reuse it.

### Date input layout after fix-4
- `src/index.css:222-227`: `input[type='date']` has `min-width: 0; max-width: 100%; appearance: none`. The inputs use inline `width: 100%`.
- Create form: each field is its own `<div>` with a `SectionLabel` inside a `section.card.grid` (`AdminEventsPage.tsx:44-58`), single column, so two stacked date fields will not widen anything.
- Editor: same stacked `div` + `SectionLabel` + input pattern (`EventEditor.tsx:89-100`), inside `card-raised grid`.
- Plan: stack the two inputs in the same single-column pattern (no side-by-side grid), which keeps the fix-4 guarantees on narrow phones. Not verified on a device.
- A disabled date input keeps the same CSS; no new CSS needed.

## Changes
1. `feat(events)`: `EventRow.event_end_date`; `src/lib/eventDates.ts` (`formatEventDates`, `isEndBeforeStart`, `END_DATE_ERROR`); `useEvents` create and update send `event_end_date` and map `error.code === '23514'` to the end-date message; `createEvent` now returns an error message (it ignored the insert result before) and the create form shows it; both forms have "Start date (optional)" and "End date (optional)", end disabled until a start is set with `min` = start, clearing the start clears the end, end before start is rejected before saving; the event card uses `formatEventDates`. Layout stays single-column, so the fix-4 date input CSS is untouched.
2. `test:` `scripts/check-event-dates.ts`, `scripts/r10-livetest.mjs`.
3. `docs:` `12_ACCEPTANCE_TESTS.md` (A1, A2, C1, C3, D1.5, send hint, caveats removed) and the gdansk-fix-5 row plus a gdansk-fix-7 row in `11_PHASE_GDANSK.md`.

No SQL, RLS, RPC, auth, dependency, PIN flow, audio, wake lock, polling, queue or cashier layout change. Existing events without an end date format exactly as a start-only date (the card shows `10 Oct 2026` instead of the raw `2026-10-10`).

## Check script output
`node scripts/check-event-dates.ts`:
```
PASS no start gives an empty string
PASS start only
PASS same day shows one date
PASS two days
PASS across months
PASS across years
PASS no day shift on the first and last day of a month
PASS end before start is detected

8 checks passed
```

## Live test output
`node scripts/r10-livetest.mjs` (throwaway inactive event `ZZ-R10-TEST`, deleted in `finally`):
```
PASS  throwaway event is inactive
PASS  1. insert with range: start and end read back  (2026-10-10 / 2026-10-11)
PASS  2. insert with start only: end is null  (2026-10-10 / null)
PASS  3. update end to a later date
PASS  4. end before start is rejected with 23514  (code=23514 msg=new row for relation "events" violates check constraint "events_end_date_check")
PASS  4. rejected update left the row unchanged
PASS  5. update end to null
PASS  cleanup: zero leftover events  (found 0)

all checks passed
```
`activate_event` was not called; no real event was read for writing or modified.

## Validation
- `npx tsc -b`: no errors. `npm run lint`: clean. `npm run build`: succeeded.
- `grep -c "Dev login" dist/assets/*.js`: 0. `git grep -n -i service_role -- src`: empty.

## Not verified
**The forms are not verified on a device.** Unchecked: how the stacked date inputs and the disabled state render on iOS Safari and Chrome Android, whether `min` blocks earlier dates in the native picker, and the error toasts in the UI. The 23514 mapping is exercised against the live database only at the Supabase client level, not through the form.

## Notes
- Changing the start date after an end date is set can leave end before start; this is caught by the save-time validation, not blocked in the picker.
- `useEvents.updateEvent` and `createEvent` both go through one `saveError` helper.
