# R12: r3 live test rerun

Branch `gdansk-fix-9`. No source file changed. Ran `node scripts/r3-livetest.mjs` against the real Supabase project.

## Result: premise not met for scenario c

`staff_v` returned **1** active staff row (an admin), not several. Scenario c therefore used **1 distinct real id** for all 3 concurrent claims, and the classifier check ran with SYNTHETIC caller ids, as in the previous run. The goal of this round (2+ real ids, real `taken` ids) was **not achieved**. Fix: add at least one more staff user through the Admin UI (not done here, since this task forbids modifying users), then rerun.

## Real output

```
PASS  throwaway event is inactive
PASS  a. 20 concurrent creates: zero errors
PASS  a. order numbers are exactly 1..20, no duplicates  (got 1..20)
PASS  a. 20 rows stored  (found 20)
PASS  b. 5 same-request-id creates: zero errors
PASS  b. all five returned the same order id and number  (ids=1 nos=21)
PASS  b. exactly one row exists  (found 1)
INFO  c. real staff ids available: 1; distinct callers used: 1
PASS  c. 3 concurrent claims: zero errors
PASS  c. exactly one claimed_by wins and every returned row shows it  (distinct claimed_by in returned rows=1)
PASS  c. classifier (SYNTHETIC callers, only 1 real staff id): one claimed, two taken  (claimed,taken,taken)
PASS  d. cancel vs in_progress: final status cancelled in 10/10 runs  (bad=0)
PASS  cleanup: zero leftover events  (found 0)
PASS  cleanup: zero leftover orders  (found 0)

all checks passed
```

## What this does and does not confirm

- One `claimed_by` wins and all returned rows agree: true, but with a single caller id this is a weak test (all callers are the same user).
- One `claimed` and two `taken` with REAL ids: **not confirmed**. Classification was checked with synthetic ids only.

## Leftover check (separate read-only query)

- events named `ZZ-%`: 0
- designs named `ZZ-%`: 0
- users named `ZZ-%` (read via `staff_v`): 0 (staff_v has 1 row total)
- orders with client_name `ZZ-%` / `r3-%` or cashier_key `r3-test`: 0

Not run: r2-livetest.mjs, activate_event, any user modification, push, merge.
