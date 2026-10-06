# R4 Report: regression run

Branch `gdansk-fix-1`, run 2026-10-06 against the live Supabase project. No source, schema or users change. `activate_event` was not called and the active event was not touched.

| Script | Result | Leftover check (ZZ-* events, designs, orders; ZZ-* users) | Anomaly |
|---|---|---|---|
| `node scripts/r1-livetest.mjs` | PASS, 13/13 | 0 events, 0 designs, 0 orders; 0 ZZ- users | none |
| `node scripts/r2c-livetest.mjs` | PASS, 20/20 | 0 events, 0 designs, 0 orders; 0 ZZ- users | none |
| `node scripts/r3-livetest.mjs` | PASS, 12/12 | 0 events, 0 designs, 0 orders; 0 ZZ- users | Only 1 real staff id exists, so the claim-race classifier check used synthetic callers (the script prints this as INFO) |
| `node scripts/check-merge-orders.ts` | PASS, 5/5 | 0 events, 0 designs, 0 orders; 0 ZZ- users | none; offline check, touches no data |
| `node scripts/r2-livetest.mjs` | SKIPPED | n/a | `MP_ADMIN_ID` and `MP_ADMIN_PIN` are not set in the shell |

## Leftover query

After each script, a separate anon-key read-only query listed events named `ZZ-%`, designs and orders inside those events, designs named `ZZ-%`, and staff named `ZZ-%` (via `staff_v`, which has no PIN). Every run returned empty. Users were listed only, never modified.
