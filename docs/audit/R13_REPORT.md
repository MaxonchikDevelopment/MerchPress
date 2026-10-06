# R13 report: full script sweep

Branch `gdansk-fix-9`. No source file changed. `activate_event` not called. Nothing pushed or merged. `r2-livetest.mjs` skipped because `MP_ADMIN_ID` and `MP_ADMIN_PIN` were not set in the shell.

| Script | Result | Leftover check | Anomalies |
|---|---|---|---|
| check-build-id.ts | PASS (11 checks) | n/a | none |
| check-cashier-ui.ts | PASS (13 checks) | n/a | none |
| check-claim-result.ts | PASS (12 checks) | n/a | none |
| check-event-dates.ts | PASS (8 checks) | n/a | none |
| check-merge-orders.ts | PASS (5 checks) | n/a | none |
| check-send-hint.ts | PASS (4 checks) | n/a | none |
| check-sounds.mjs | PASS (signal properties only) | n/a | audibility not covered, needs device check |
| r1-livetest.mjs | PASS (live) | script: 0 events, 0 orders | none |
| r2c-livetest.mjs | PASS (live) | script: 0 events, designs, orders, storage objects | none |
| r3-livetest.mjs | PASS (live) | script: 0 events, 0 orders | check c uses synthetic callers, since only one real staff id is available |
| r10-livetest.mjs | PASS (live) | script: 0 events | none |
| r2-livetest.mjs | SKIPPED | n/a | admin credentials not in the shell |

## Separate leftover query (after all live tests)

Anon client, `name LIKE 'ZZ-%'`: events 0, designs 0, users 0 (read through `staff_v`). Clean.
