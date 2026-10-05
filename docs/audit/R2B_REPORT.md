# R2B Report: migration round 2 of 2 (wire the client)

Branch `gdansk-sprint`. Not pushed, not merged. Migrations 0003 and 0004 were applied by the owner beforehand; no migration, SQL, auth flow or dependency was touched.

## Recon
Section 4 of R2A still matches the code after R1.1. Differences:
- Line numbers drifted after R1/R1.1 (for example the status spots in `CashierPage`).
- `useOrders` now loads only new, in_progress and ready orders and `mergeOrders` already drops `cancelled`, so no change was needed there. A realtime update that flips an order to `cancelled` stays in the in-memory list until the next refetch, so every list filters by status.
- The session user lives in `localStorage` (`mpq.session`), so the admin PIN needed its own in-memory store.

## Done
Commit 1: types, idempotent create
- `OrderStatus` has `cancelled`; `Order`, `EventRow`, `Design`, `OrderStats` have the new columns; `STATUS_COLORS` and the `--status-cancelled-*` tokens; the wait timer hides for cancelled.
- `src/lib/createOrder.ts` calls `create_order_v2` with a 12 s abort. `CashierPage` keeps one `crypto.randomUUID()` per draft in a ref, reused on every retry, renewed after success or when the active event changes. Failure or timeout keeps the form and shows "Not confirmed. Tap Send again."

Commit 2: cancel
- `cancelOrder` in `src/lib/orderStatus.ts` returns `cancelled`, `already_closed` or `failed`. `useCancelOrder` plus `ConfirmDialog` ask "Cancel order #N?" and call `set_order_status` with `cancelled`, then refetch.
- Cashier: new "In progress · N" section (own orders in new or in_progress) with Cancel; Cancel on the Ready list. Press: Cancel on each queue card, quiet text button. A non-cancelled row back shows "Order #N was already closed."

Commit 3: staff tab, activate_event
- `useEvents.activateEvent` uses the `activate_event` RPC and returns an error that `AdminEventsPage` shows.
- `src/lib/adminPin.ts` holds the admin PIN in a module variable only. `RoleSelect` sets it after a successful admin `verify_pin`; logout clears it. The login flow itself is unchanged.
- `AdminStaffPage` (tab "staff"): PinPad "Enter admin PIN to manage staff" when no cached PIN, validated with `staff_list`; `not_admin` clears the cache and asks again; active people first (server order); add person (PIN prefilled 0000 for cashier and press, empty for admin); edit name and role; activate or deactivate; set PIN; own PIN change updates the cache before the list refresh. Errors mapped for `weak_admin_pin`, `last_admin`, `invalid_pin`, `invalid_name` (plus `not_admin`, `invalid_role`, `user_not_found`).

Commit 4: stats, docs, test
- "Cancelled" KPI from `count_cancelled`; "Total orders" is `total_orders - count_cancelled`; breakdowns skip cancelled orders; the CSV keeps all orders with `status` and a `cancelled_at` column.
- `CLAUDE.md` data model and `06_SECURITY.md` updated.
- `scripts/r2-livetest.mjs` (see below).

## Differences from the brief
- The view's `total_orders` still counts cancelled orders (R2A open question 4), so the client subtracts `count_cancelled`.
- The Staff tab disables deactivating yourself and changing your own role, to avoid locking yourself out of the tab. The server still enforces `last_admin`.
- The CSV column header is the literal `cancelled_at`; the other headers are the existing human labels.
- The idempotency id is tied to the draft and the event, not to field contents. If a send fails, the cashier edits the form and sends again, and the first call had actually landed, the server returns the first order (old contents) and the form clears. Fixed in the follow-up below.

## Validation
`npx tsc -b`, `npm run lint`, `npm run build` clean at each commit. `grep "Dev login"` in `dist/assets` = 0. `service_role` grep in `src` empty.

## Live test
`node scripts/r2-livetest.mjs` was run against the live database without admin variables: all PASS (idempotent create, cancel from new / in_progress / ready, cancel on completed no-op, changes on cancelled no-op, anon insert into `users` rejected, `staff_list` wrong PIN gives `not_admin`, zero leftovers). The staff scenarios were SKIPPED (no `MP_ADMIN_ID` / `MP_ADMIN_PIN`) and are unverified. Run them with:
`MP_ADMIN_ID=<uuid> MP_ADMIN_PIN=<pin> node scripts/r2-livetest.mjs`
They create or reuse "ZZ-R2-STAFF", rename it, set its PIN and deactivate it. There is no delete RPC, so the row stays; the script prints its id and `delete from users where id = '<id>';` for the owner to run.

## Follow-up: edited draft after an unconfirmed send (done)
CashierPage compares the order returned by `create_order_v2` with the draft (color, size, front, back, client name with empty to null, as the server does). On a mismatch it does not show success and does not clear the form. It shows an error that stays until dismissed ("Order #N was already sent with the earlier details. Cancel it under In progress, then send again.") and generates a new request id, so the next send creates a fresh order. Live test gained: same request id with a different size returns the first order unchanged.

## Deferred
- Per-event colors and sizes, design hide/edit, image compression (and the 5 MB / jpeg-png-webp bucket limit vs. phone photos): next round.
- Cancel needs a connection; there is no offline queue.
- Existing admins with PIN `0000` still work until their PIN is changed (use the Staff tab).
- The cached admin PIN is lost on reload and in every new tab by design.

## Manual checklist (results blank)
| # | Check | Result |
|---|-------|--------|
| 1 | Cashier: send an order with Wi-Fi off. After 12 s "Not confirmed. Tap Send again.", form still filled | |
| 2 | Cashier: restore Wi-Fi, tap Send again. Exactly one order exists (check the Press queue) | |
| 3 | Cashier: after a successful send the form is cleared and the next send creates a new order number | |
| 4 | Cashier: "In progress · N" lists only my own new and in_progress orders | |
| 5 | Cashier: Cancel asks "Cancel order #N?"; Keep order does nothing; Cancel order removes it here and on Press | |
| 6 | Cashier: Cancel from the Ready list works | |
| 7 | Press: Cancel on a new and on an in_progress card; both leave the queue | |
| 8 | Cancel an order that press just marked completed elsewhere: "Order #N was already closed." | |
| 9 | Cancel with Wi-Fi off: error toast within 10 s, button usable again | |
| 10 | Cancelled badge never appears in any list; no crash on a cancelled order | |
| 11 | Admin: Set active on another event; Press and Cashier follow. Error shown if the RPC fails | |
| 12 | Admin login, Staff tab opens straight away (PIN cached) | |
| 13 | Admin: reload, Staff tab shows the PinPad; wrong PIN is refused, correct PIN opens the list | |
| 14 | Staff: add a cashier (PIN 0000 prefilled), appears in the login picker | |
| 15 | Staff: add an admin with PIN 0000 is refused (weak admin PIN message) | |
| 16 | Staff: rename, change role, deactivate, activate; deactivated person leaves the login picker | |
| 17 | Staff: deactivating the only other admin is allowed only while you remain; the last admin is refused (last_admin) | |
| 18 | Staff: change your own PIN; the Staff tab keeps working without re-asking | |
| 19 | Staff: set a 3-digit PIN is blocked or refused (invalid PIN message) | |
| 20 | Stats: Cancelled KPI correct; Total orders excludes cancelled; breakdowns exclude cancelled | |
| 21 | Stats: CSV contains cancelled orders with status `cancelled` and a `cancelled_at` value | |
| 22 | `MP_ADMIN_ID=… MP_ADMIN_PIN=… node scripts/r2-livetest.mjs`: all PASS, owner deletes the ZZ-R2-STAFF row | |
| 18 | Cashier: send with Wi-Fi off, edit the size, restore Wi-Fi, tap Send. If the first send had landed: persistent error naming the order, form kept, Dismiss works; after cancelling that order and sending again, a new order is created | |
