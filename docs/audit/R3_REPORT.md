# R3 Report: claim race, wake lock polish, concurrency live test

Branch `gdansk-fix-1`. No schema, RLS, RPC or dependency change.

## Recon

- **Where Claim is called:** `src/pages/PressPage.tsx:107-110` renders the "Claim — start printing" button for `new` orders; its `onClick` calls `setStatus(o, 'in_progress')` (`PressPage.tsx:67-73`). The same `setStatus` serves the Ready button (`:113`). `CashierPage.tsx:109` also calls `setOrderStatus` (completed); out of scope.
- **How PressPage handles the boolean today:** `PressPage.tsx:71` does `const ok = await setOrderStatus(...)`; `:72` shows the error toast only when `!ok`. `setOrderStatus` (`src/lib/orderStatus.ts:31-37`) returns `true` for any non-null row, so a losing Claim looks like success.
- **Why the row is returned on a lost race:** `set_order_status` (`supabase/migrations/0004_ops.sql:28`) locks the row with `for update`, so concurrent callers are serialized. A later caller finds the order already `in_progress`, hits the forward-only guard (`0004_ops.sql:55-57`) and returns the row unchanged, with the winner's `claimed_by`.
- **`claimed_by` foreign key:** yes. `0001_init.sql:56` `claimed_by uuid references users(id)`. Random uuids would be rejected, so live scenario (c) needs real ids from `staff_v`.
- **How `check-merge-orders.ts` runs TS:** `scripts/check-merge-orders.ts:1` says `node scripts/check-merge-orders.ts` (Node 26 native type stripping, no runner, no dependency). It imports `../src/lib/mergeOrders.ts` with the `.ts` extension. A `.mjs` can import a `.ts` file the same way, as long as that file has no `import.meta.env` or other Vite-only imports. `src/lib/supabase.ts` is Vite-only, so the classifier goes in its own module without that import.
- **Wake lock:** `src/hooks/useWakeLock.ts:16-17` starts in `'released'`, so the TopBar pill (`src/components/TopBar.tsx:25-29`) renders until the first acquire resolves. The pill is shown on every page with a user, including Admin (`AdminPage.tsx:17`). `soundRetry` is passed only by Press (`PressPage.tsx:87`) and Cashier (`CashierPage.tsx:125`).

## Changes

1. **Wake lock** (`ccc4e5f`): new `pending` state until the first acquire attempt resolves; the pill is rendered only when `soundRetry` is set (Press, Cashier) and the state is `released` or `unsupported`; the `unsupported` title reads "This browser cannot keep the screen on. Set Auto-Lock to Never."
2. **Claim race**: `src/lib/claimResult.ts` (pure `classifyClaim`), `claimOrder` and `staffName` in `src/lib/orderStatus.ts`, Claim path in `PressPage.tsx`. `taken` toasts "Already taken by <name>" (falls back to "another press station") and refetches; `closed` toasts "Order is already closed" and refetches; `failed` keeps the old error toast. Ready, cancel and OrderCard are untouched. A returned row still at `new` is classified `failed`.
3. **Live test**: `scripts/r3-livetest.mjs`, imports the pure classifier from the `.ts` file directly (Node type stripping).

## Live test output

`node scripts/r3-livetest.mjs`:

```
PASS  throwaway event is inactive
PASS  a. 20 concurrent creates: zero errors
PASS  a. order numbers are exactly 1..20, no duplicates  (got 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20)
PASS  a. 20 rows stored  (found 20)
PASS  b. 5 same-request-id creates: zero errors
PASS  b. all five returned the same order id and number  (ids=1 nos=21)
PASS  b. exactly one row exists  (found 1)
INFO  c. real staff ids available: 1; distinct callers used: 1
PASS  c. 3 concurrent claims: zero errors
PASS  c. exactly one claimed_by wins and every returned row shows it  (distinct claimed_by in returned rows=1)
PASS  c. classifier (SYNTHETIC callers, only 1 real staff id): one claimed, two taken  (claimed,taken,taken)
PASS  d. cancel vs in_progress: final status cancelled in 10/10 runs  (bad=0 finals=cancelled,cancelled,cancelled,cancelled,cancelled,cancelled,cancelled,cancelled,cancelled,cancelled)
PASS  cleanup: zero leftover events  (found 0)
PASS  cleanup: zero leftover orders  (found 0)

all checks passed
```

## Caveats

- **Scenario c ran with one real staff id.** `staff_v` returns one person and `claimed_by` has a FK to `users`, so random uuids are rejected. All three concurrent calls therefore used the same id. That proves the server serializes (one winner, identical `claimed_by` in every returned row) but not a real cross-user loss. The 1 claimed / 2 taken classification was checked with synthetic caller ids against the real returned rows. Re-run with 3 active staff for a full check; I did not create staff (needs admin PIN, touches real data).
- Scenarios a, b and d passed with no server-side issue found.
- Name lookup on `taken` reads `staff_v` by id, which only lists active staff; a deactivated claimer falls back to "another press station".
- No device test of the wake lock changes yet.
