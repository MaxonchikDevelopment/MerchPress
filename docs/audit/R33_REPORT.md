# R33 regression on v1.5

Branch `gdansk-t5-2` off main at 4eb261e (release v1.5). Main contains the merge of `gdansk-fix-ui-2b`. No source file was changed. `activate_event` was not called. Nothing was pushed or merged. No PIN was read or printed.

## Results

Counts are `events ZZ-* / designs ZZ-* / users ZZ-* / orders in ZZ-* events`, read through `staff_v` and the events, designs and orders tables.

| Script | Result | Leftover check (before → after) | Anomalies |
|---|---|---|---|
| check-admin-orders.ts | PASS, 6 ok | n/a (offline) | none |
| check-build-id.ts | PASS, 11 ok | n/a | none |
| check-build-label.ts | PASS, 16 ok | n/a | none |
| check-cancel-notice.ts | PASS, 8 ok | n/a | none |
| check-cashier-cancel-notice.ts | PASS, 11 ok | n/a | none |
| check-cashier-queue.ts | PASS, 7 ok | n/a | none |
| check-cashier-ui.ts | PASS, 15 ok | n/a | none |
| check-claim-result.ts | PASS, 12 ok | n/a | none (the "fail" grep hits are test names such as "null row is failed") |
| check-compat-matrix.ts | PASS, 21 ok | n/a | none |
| check-csv.ts | PASS, 6 ok | n/a | none |
| check-display-name.ts | PASS, 7 ok | n/a | none |
| check-event-dates.ts | PASS, 8 checks | n/a | uses a different output format (PASS lines) |
| check-event-time.ts | PASS, 10 ok | n/a | none |
| check-merge-orders.ts | PASS, 5 checks | n/a | different output format |
| check-offline-banner.ts | PASS, 5 ok | n/a | none |
| check-pin-key.ts | PASS, 7 ok | n/a | none |
| check-print-colors.ts | PASS, 12 ok | n/a | none |
| check-print-mode.ts | PASS, 5 ok | n/a | none |
| check-send-hint.ts | PASS, 4 ok | n/a | none |
| check-stats-tally.ts | PASS, 8 ok | n/a | none |
| check-update-policy.ts | PASS, 25 ok | n/a | none |
| check-sounds.mjs | PASS | n/a | audibility is not covered, only signal properties |
| r1-livetest.mjs | PASS | 0/0/0/0 → 0/0/0/0, no growth | own cleanup check found 0 leftovers |
| r2c-livetest.mjs | PASS | no growth; own check found 0 orders and 0 storage objects left | none |
| r3-livetest.mjs | PASS | no growth; own check found 0 leftovers | none |
| r10-livetest.mjs | PASS | no growth; own check found 0 leftovers | none |
| r2-livetest.mjs | SKIPPED | n/a | `MP_ADMIN_ID` and `MP_ADMIN_PIN` not set in the shell, as instructed |

## Leftover check

| Measure | Before | After | Diff |
|---|---|---|---|
| events (total / ZZ-*) | 1 / 0 | 1 / 0 | 0 |
| designs (total / ZZ-*) | 2 / 0 | 2 / 0 | 0 |
| users in staff_v (total / ZZ-*) | 12 / 0 | 12 / 0 | 0 |
| orders (total / in ZZ-* events) | 26 / 0 | 26 / 0 | 0 |

No growth, so no leftovers.

## Anomalies

- **The permanent ZZ-TEST event and the ZZ-* people were not visible.** The brief expected them, but the anon key sees 0 events, designs and users starting with `ZZ-`. The only event is 1 non-ZZ event. Likely causes: the owner's ZZ data was removed, it lives in a different project from the one in `.env.local`, or the names use a different prefix. This needs the owner's confirmation. The before and after counts match either way.
- The scratch counting script was kept outside the repo, so no file other than this report is committed.
