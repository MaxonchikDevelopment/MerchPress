# Testing Runbook

## Pre-event setup (admin, a day before)
1. Admin > Events: create the event (name, location, date) and **Set active**.
2. Edit the event: shirt colours (label and colour; the ink colour is automatic) and sizes (XS-XXL subset only). Defaults apply if left empty.
3. Admin > Designs: add each design with front and back photos, type, compatible colours. Phone photos are resized automatically. Hide anything not for sale.
4. Admin > Staff: add cashiers and press with their PINs; deactivate people who are not working. Change every `0000` PIN.
5. Set a new admin PIN for every admin (old admins with `0000` still work until changed).
6. Confirm `main` is frozen (see below).

## Tablet setup
1. Open the production URL, install the PWA (Add to Home Screen), open it from the icon.
2. Log in with role, name and PIN.
3. Tap "Tap to enable sound" and confirm an alert is audible; set the volume. After any reload the gate returns.
4. Keep the screen awake and charged. Rotation is allowed.

## Go / no-go check (all 10 must pass)
1. Cashier and press tablets log in; the active event name shows in the top bar.
2. Cashier sends an order; it appears on Press within seconds with the next event order number.
3. Press hears the new-order sound.
4. Press claims, then marks ready; the cashier gets one sound and an overlay.
5. Cashier marks it picked up; it leaves both lists.
6. Cancel works from Cashier and Press and asks for confirmation.
7. Wi-Fi off on Press: the offline banner appears; on restore it clears and the list refreshes with no duplicate sounds.
8. Cashier sends with Wi-Fi off: "Not confirmed. Tap Send again."; after restore, one send creates exactly one order.
9. Admin Staff tab opens after the PIN prompt; Stats shows correct totals.
10. Reload a signed-in tablet: no sound for existing orders, sound gate appears, a tap enables sound.

Any failure is a no-go until fixed or consciously accepted by the owner. Delete test orders or use a throwaway event, then make the real event active.

## When Wi-Fi drops
- The banner shows within a few seconds; the list stays as last seen.
- Do not reload; the app reconnects and refetches on its own.
- Failed actions show an error and re-enable the button. Tap again once connected; retries are safe (forward-only status, idempotent create).
- A cashier "Not confirmed" send: wait for the connection, tap Send again. If an error says the order was sent with earlier details, cancel it under In progress, then send again.
- If it stays down, switch the tablets to a hotspot. Nothing is queued offline; orders on paper until it returns.

## Rollback of a deploy
Only for a merge to `main` that broke production. Outside an event:
1. `git checkout main && git pull`
2. `git revert -m 1 <merge-commit-hash>`
3. Run the validation block, then push. Vercel redeploys and tablets update.
Migrations are not rolled back this way. `supabase/rollback/0004_ops_rollback.sql` exists but is never run without owner approval and a fresh backup.

## Freeze rule
Never push or merge `main` during an event: it deploys at once and the service worker updates every tablet mid-service. Freeze from the pre-event check until the event ends.
