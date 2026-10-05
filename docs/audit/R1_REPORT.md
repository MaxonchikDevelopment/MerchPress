# R1 Report: queue reliability on bad event Wi-Fi

Branch `gdansk-sprint`. Not pushed, not merged. No schema, RLS, RPC, migration, auth or dependency change.

## Done
Commit 1, realtime, refetch, gap alerts (2a-2e, 2g)
- `subscribeOrders` takes `onStatus`. `useOrders.connected` = subscribed (SUBSCRIBED only) AND browser online AND last query ok. The unconditional `setConnected(true)` is gone.
- Refetch on resubscribe, `visibilitychange` to visible, `online`, and every 20 s while visible.
- A failed refetch keeps the list, does not call `onLoaded`, and sets connected false until a query succeeds. A request counter plus an event check drops stale responses.
- `onLoaded(list, 'initial' | 'refetch')`. Initial seeds silently. Refetch: press plays one sound if any `new` order is unseen; cashier plays one sound and shows one overlay for own orders now `ready` and unseen ("Order #N ready" or "Orders #A, #B ready").
- Silent active-event refresh in `SessionContext` on the same triggers (only while signed in). It never touches `loadingEvent`, keeps the same object if nothing changed, and uses the same stale-response guard as `reloadActiveEvent`.

Commit 2, RPC errors and audio (2f, 2h)
- `src/lib/orderStatus.ts` wraps `set_order_status` with a 10 s abort. Press and Cashier show "Couldn't update order #N. Check the connection and tap again." and re-enable the button. `create_order` is untouched. Retrying after a timeout is safe: the RPC is forward-only and no-ops if the aborted call had landed.
- `notify.ts`: audio state is locked, pending or unlocked. It becomes unlocked only after both `play()` promises resolve, and returns to locked on failure so a tap can retry. `isAudioUnlocked()` is exported. `SoundGate` is a full-screen "Tap to enable sound" on both pages. It stays hidden while a login-tap unlock is pending, so there is no flash after login.

Commit 3, PWA config, thresholds, placeholders, test script (2i-2k)
- Manifest orientation `any`. Dead `navigateFallbackDenylist` removed (the `workbox` block is now empty and gone).
- `WARN_MINS = 7` in `lib/wait.ts`; `WaitTimer` uses it and `OVERDUE_MINS`.
- Placeholders: "e.g. Hyrox Gdansk", "e.g. Finisher Front".
- `scripts/r1-livetest.mjs` (see below).

## Validation
`npx tsc -b`, `npm run lint`, `npm run build` clean. `grep -c "Dev login" dist/assets/*.js` = 0. `service_role` grep in `src` empty. `riga` grep in `src` empty.

## Live test: NOT RUN
`.env.local` holds no usable credentials: `VITE_SUPABASE_URL` is the literal string `"[SENSITIVE]"` (apparently a redacted Vercel export). The script exits with code 2 and a message in that state. Put the real URL and anon key in `.env.local`, then run `node scripts/r1-livetest.mjs`. It refuses to start if a "ZZ-R1-TEST" event already exists, so it cannot touch other data. It has never run against the database, so treat it as unverified until it has.

Commit 4 (R1.1), gate and refetch merge
- Sound gate: `gateDismissed` is a module-level flag in `notify.ts`, set only by a tap on the gate button (success or failure). A failed unlock from the login flow does not set it. The gate shows only while audio is locked and the flag is false. After dismissal, a locked state shows "Sound off · tap to retry" in the Press and Cashier top bar until audio unlocks, so the user is never trapped behind the overlay.
- Refetch merge: `useOrders` records realtime inserts, updates and deletes since the latest request started (reset right after `++reqSeq`) and applies the snapshot through `mergeOrders` (`src/lib/mergeOrders.ts`), which overlays upserts, keeps deletes deleted, and drops completed and cancelled orders. The merged list feeds `setOrders` and `onLoaded`. `node scripts/check-merge-orders.ts` asserts the five cases. If two refetches overlap and the older one lands first, realtime events from before the newer request started can still be overwritten until the newer response applies.
- RoleSelect calls `unlockAudio()` before the `verify_pin` await; `useOrders` loads only new, in_progress and ready orders.

## Deferred / known limits
- Offline write queue, cancel, staff, event activation, design editing, image compression: non-goals.
- `create_order` has no timeout or retry guard (not idempotent). A dropped response can leave the cashier unsure whether the order exists.
- Muted `play()` succeeds without a gesture on some browsers, so unlocked is decided only by `unlockAudio()` calls, which only come from taps. Whether sound is truly audible on a given tablet still needs the manual check.
- PWA orientation change only reaches installed tablets after the service worker updates and the app is re-added or the manifest refreshes; some platforms cache the manifest.

## Manual checklist (results blank)
| # | Check | Result |
|---|-------|--------|
| 1 | Press: kill Wi-Fi. Banner appears within a few seconds and shows while offline | |
| 2 | Press: restore Wi-Fi. Banner clears only after reconnect; list refreshes | |
| 3 | Press: create 2 orders from another device while Press is offline. After reconnect, ONE sound, both orders present, in FIFO order | |
| 4 | Press: reload mid-queue. No sound for existing orders | |
| 5 | Cashier: own order marked ready while offline. After reconnect, one sound and overlay; no repeat on next poll | |
| 6 | Cashier: another cashier's ready order while offline. No sound | |
| 7 | Press: lock the tablet 1+ min, unlock. List refreshes without a tap | |
| 8 | Press/Cashier: tap Claim/Ready/Picked up with Wi-Fi off. Within 10 s the error toast appears and the button re-enables; tapping again after reconnect works | |
| 9 | Reload while signed in: "Tap to enable sound" shows; tapping hides it and alerts play | |
| 10 | Fresh login via PIN: no gate flashes | |
| 11 | Admin activates a different event; Press/Cashier switch within ~20 s without the loading screen | |
| 12 | Rotate the tablet (installed PWA): landscape allowed | |
| 13 | Wait timer turns amber at 7 min and red at 15 min | |
| 14 | `node scripts/r1-livetest.mjs` against real credentials: all PASS, zero leftovers | |
| 15 | Gate never traps: with audio unable to unlock, tap the gate once; it disappears and "Sound off · tap to retry" shows in the top bar | |
| 16 | An order created from another device during a refetch does not flicker away | |
| 17 | Sound works after a fresh PIN login on iPad | |
