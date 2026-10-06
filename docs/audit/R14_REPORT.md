# R14: r3-livetest rerun with real staff ids

Branch `gdansk-fix-10`, off `main` at 20051ab. No source file changed. Only `node scripts/r3-livetest.mjs` was run (not r2). No PIN used, no users modified, no `activate_event`, nothing pushed or merged.

## Staff ids used

Scenario c found 3 real staff ids and used 3 distinct callers. That is a real cross-user claim race (at least 2 ids required).

## Real output

```
PASS  throwaway event is inactive
PASS  a. 20 concurrent creates: zero errors
PASS  a. order numbers are exactly 1..20, no duplicates  (got 1,2,...,20)
PASS  a. 20 rows stored  (found 20)
PASS  b. 5 same-request-id creates: zero errors
PASS  b. all five returned the same order id and number  (ids=1 nos=21)
PASS  b. exactly one row exists  (found 1)
INFO  c. real staff ids available: 3; distinct callers used: 3
PASS  c. 3 concurrent claims: zero errors
PASS  c. exactly one claimed_by wins and every returned row shows it  (distinct claimed_by in returned rows=1)
PASS  c. classifier: one claimed, two taken  (claimed,taken,taken)
PASS  d. cancel vs in_progress: final status cancelled in 10/10 runs  (bad=0 ...)
PASS  cleanup: zero leftover events  (found 0)
PASS  cleanup: zero leftover orders  (found 0)

all checks passed
```

Exit code 0.

## Scenario c confirmation

- Exactly one `claimed_by` value across all returned rows.
- Classification: one `claimed`, two `taken`, with real ids.

## Separate leftover query

Run after the script, independent of its own cleanup:

| Check | Result |
|---|---|
| events with name `ZZ%` | 0 |
| designs with name `ZZ%` | 0 |
| orders in any `ZZ%` event | 0 |
| orders with client_name `r3-%` | 0 |
| users named `ZZ*` (read via `staff_v`, 12 rows total) | 0 |
