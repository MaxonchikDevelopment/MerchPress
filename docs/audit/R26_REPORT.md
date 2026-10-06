# R26: own-only cashier queue, admin Orders screen, card meta, countdown bar (gdansk-ux-9)

Branch `gdansk-ux-9`, off `main` at be207e4 (`git log main` contains `Merge gdansk-ux-8: Compatibility matrix`). No schema, RLS, RPC, migration or dependency change. Nothing pushed or merged. Owner decisions D18 = A and D19 = C (design ordering is not part of this round), not reopened.

## Recon

Written before any other file was edited. Line numbers refer to be207e4. Everything here is from reading code and SQL; nothing was run on a device or in a browser.

### Item 1: cashier Queue shows only my orders

- [CashierPage.tsx:107-113](../../src/pages/CashierPage.tsx#L107-L113) `myOpenOrders`: `new` and `in_progress` with `created_by === userId`, sorted by `created_at` (FIFO). Already own-only.
- [CashierPage.tsx:115-127](../../src/pages/CashierPage.tsx#L115-L127) `readyOrders`: **every** `ready` order of the event, mine sorted first, then `ready_at` ascending. This is the shared list from the 06.10 test, and the `Cancel order` button at [:219](../../src/pages/CashierPage.tsx#L219) is on every one of those cards.
- Section order today: In progress ([:205-214](../../src/pages/CashierPage.tsx#L205-L214)), then Ready for pickup ([:215-229](../../src/pages/CashierPage.tsx#L215-L229)). Item 1 swaps them in JSX only.
- Sounds, overlay and dedupe already filter on `created_by`: `onReady` ([:45](../../src/pages/CashierPage.tsx#L45)) returns for another cashier's order, `onLoaded` ([:59](../../src/pages/CashierPage.tsx#L59)) filters `mine`; the tab badge uses `readyBadgeCount` ([readyBadge.ts:4-7](../../src/lib/readyBadge.ts#L4-L7)), also own-only. None of them is touched, so alert behaviour and dedupe do not change.
- `highlight={o.created_by === user?.id}` on the Ready cards ([:217](../../src/pages/CashierPage.tsx#L217)) draws the accent ring and a "Yours" badge. Once the list is own-only every card would be "Yours", so the prop is dropped there (noise, no information). Noted as a small visible side effect.
- Plan: pure `src/lib/cashierQueue.ts` (`cashierQueue(orders, myId)` returns `{ inProgress, ready }`, both own-only; in progress `new` + `in_progress` by `created_at`, ready by `ready_at` as today; no user id gives two empty lists) with `scripts/check-cashier-queue.ts`, same runner as `check-cashier-cancel-notice.ts` (`node scripts/<file>.ts`, plain `node:assert`).
- Limit: nothing about this is enforced by the server, see "Server" below.

### Item 2: Admin "Orders" screen

- Tab list: [AdminPage.tsx:11](../../src/pages/AdminPage.tsx#L11) `Tab`, [:13-19](../../src/pages/AdminPage.tsx#L13-L19) `TAB_LABELS`, [:20](../../src/pages/AdminPage.tsx#L20) `TABS`, switch at [:48-52](../../src/pages/AdminPage.tsx#L48-L52). Default tab is [:25](../../src/pages/AdminPage.tsx#L25) `activeEvent ? 'designs' : 'events'` and stays. A sixth tab only lengthens the strip, which already scrolls and scrolls the tapped tab into view ([:35-39](../../src/pages/AdminPage.tsx#L35-L39), R25). Placement is not specified; I append "Orders" as the last tab so the existing tab order does not move.
- Data: `useOrders(eventId)` ([useOrders.ts:33](../../src/hooks/useOrders.ts#L33)) loads `new`, `in_progress`, `ready` for the event, then realtime, a 20 s poll and refetch on visible/online. With no options it fires no callbacks, so no sound, overlay or notice can come from it. `alertNewOrder`, `alertReady` and `SeenSet` are never imported by the new screen. `activeEvent` is `useSession().activeEvent`; no event gives an empty state.
- Designs for the thumbnails: `useDesigns(eventId).designs` (hidden included, so an order that used a hidden design still shows its print).
- `OrderCard` ([OrderCard.tsx:70-144](../../src/components/OrderCard.tsx#L70-L144)) already renders number, status, thumbnails, colour, size, client, cashier line, claimer line and, with `showWait`, `WaitTimer` (since `new_at`). It reads `useSession().activeEvent` for colour labels, which is the same event as the one listed. `showClaimedBy` resolves the claimer name only when `status === 'in_progress'` ([:94](../../src/components/OrderCard.tsx#L94)); a **ready** card of the admin list would show no claimer name. So the lookup is widened to `in_progress` and `ready`. The prop is opt-in, Press and the Cashier In progress cards are unaffected, the Cashier Ready cards never pass it.
- Actions: Cancel through `useCancelOrder(userId, notify, refresh)` ([useCancelOrder.tsx:9-44](../../src/hooks/useCancelOrder.tsx#L9-L44)): confirm dialog "Cancel order #N?", `cancelOrder` then `refresh`. "Picked up" through `setOrderStatus(id, 'completed', userId)` ([orderStatus.ts:34-40](../../src/lib/orderStatus.ts#L34-L40)), the Cashier's `complete` ([CashierPage.tsx:141-148](../../src/pages/CashierPage.tsx#L141-L148)) pattern: double-tap guard, error toast on failure. I add a refetch after it so the card leaves even if realtime is down.
- Pure grouping: `src/lib/adminOrders.ts` (`adminOrderList(orders, filter)` for the chips All, New, In progress, Ready; sort Ready, In progress, New, then `created_at` ascending; closed statuses never listed; plus the per-chip counts) with `scripts/check-admin-orders.ts`.
- Chips: no chip or toggle-button class exists (`.tab` is the nav pill, `.pill` is a read-only label), so a few `.orders-filter` classes go in `index.css` from existing tokens only.

### How the admin user id reaches `useCancelOrder` and `setOrderStatus`

- Login stores the `Staff` row in `SessionContext` (`user`, [SessionContext.tsx:16-41](../../src/context/SessionContext.tsx#L16-L41), persisted as `mpq.session`). `verify_pin` returns that row, role included, so for an admin `user.id` is the admin's users.id.
- `AdminPage` renders inside the same provider, so the new screen calls `useSession()` and passes `user?.id` as the first argument of `useCancelOrder` and as the third of `setOrderStatus`. Both put it into `set_order_status(p_order_id, p_status, p_user_id)` ([orderStatus.ts:17-18](../../src/lib/orderStatus.ts#L17-L18)). No admin PIN is involved; the admin PIN cached for the `staff_*` RPCs ([adminPin](../../src/lib/adminPin.ts)) is a different thing and is not used here.

### Server: can the admin role call `set_order_status` for `completed` and `cancelled` on another user's order?

Read, not changed: [0004_ops.sql:18-65](../../supabase/migrations/0004_ops.sql#L18-L65).

- The function never reads `users`, never compares `p_user_id` with `created_by` or `claimed_by`, and has no role check. It is `security definer` and executable by anon, so **any caller can complete or cancel any order of any cashier**, an admin included, and `p_user_id` is only recorded.
- `cancelled`: allowed from `new`, `in_progress` and `ready`; sets `cancelled_at` and `cancelled_by = p_user_id`. With the admin id in `p_user_id`, `cancelled_by` becomes the admin.
- `completed`: forward-only from `ready` (rank 2 to 3), stamps `completed_at`; `claimed_by` is changed only by `in_progress`. An order already completed or cancelled comes back unchanged (terminal), which the client reads as "already closed".
- Consequence for the rules of this round: **cashier-only visibility and the admin-only Orders screen are interface rules**. The server does not check who cancels or completes, so a cashier on a modified client, or anyone with the anon key, can still cancel or complete another cashier's order. Making it real needs an RPC and RLS change, which is out of scope; reported, not done.
- Notices that fire when the admin cancels (no code change needed): Cashier `cashierCancelNotice` ([cashierCancelNotice.ts:14-24](../../src/lib/cashierCancelNotice.ts#L14-L24)) fires when it is the cashier's own order and `cancelled_by` is not them; Press `cancelNotice` ([cancelNotice.ts:14-19](../../src/lib/cancelNotice.ts#L14-L19)) fires for `new` and `in_progress` (not for `ready`, as designed in R22). Both resolve the name through `staffName`, so the admin's name shows. The admin's own screen has no notice (it gets no `onCancelled`).

### Item 3: card meta lines

- [OrderCard.tsx:131-139](../../src/components/OrderCard.tsx#L131-L139): "Cashier: {name}" plus " · claimed" when `claimed_by` is set and the name is unknown, then a second `.order-secondary` "Claimed by <strong>name</strong>" only when the name is known. `.order-secondary` is 14 px / 500 secondary text, and its `strong` is 700 primary ([index.css:727-734](../../src/index.css#L727-L734)). So the bold treatment already exists in one place; the Cashier line has no bold name.
- Change: line one "Sold by <strong>{cashier_name ?? '—'}</strong>"; line two the same markup, "Claimed by <strong>name</strong>" when known, a plain "Claimed" line when `claimed_by` is set and the name is not known (not appended to line one). Same class on both. The unknown-name case includes the moments while the lookup runs or is retried (existing behaviour showed " · claimed" then).
- Cases that quote the old text: `12_ACCEPTANCE_TESTS.md` C3 AC10, C3.12, D1.7, D1.8.

### Item 4: countdown bar on cancel notices

- Press: [PressPage.tsx:~130-139](../../src/pages/PressPage.tsx#L130-L139) (`.toast.toast-error` with text and Dismiss) and the 30 s timer in `onCancelled`; Cashier: [CashierPage.tsx:~159-166](../../src/pages/CashierPage.tsx#L159-L166) and its timer ([:93-94](../../src/pages/CashierPage.tsx#L93-L94)). `NOTICE_MS = 30_000` is in [cancelNotice.ts:4](../../src/lib/cancelNotice.ts#L4).
- `.toast` is `display: flex` with no `position` ([index.css:842-854](../../src/index.css#L842-L854)), so the bar needs `position: relative; overflow: hidden` on the notice and `position: absolute; inset: auto 0 0 0` on the bar.
- Bar: `transform: scaleX(1 → 0)`, `transform-origin: left`, `animation: notice-countdown <NOTICE_MS>ms linear forwards`, the duration passed as an inline `animationDuration` from the constant, so there is one source of truth. A transform animates on the compositor and does not relayout.
- **Reduced motion:** the existing block ([index.css:923-930](../../src/index.css#L923-L930)) sets `animation-duration: 0.001ms` for everything, which would collapse the bar to nothing at once or leave it at the first frame, depending on fill mode. I add an explicit rule in the same media query that hides the bar (`display: none`). Choice: no bar rather than a static full bar, because a full bar that never shrinks reads as "stays forever". The notice, the Dismiss button and the 30 s timer behave exactly the same.
- **Correction to the brief:** this is not the first animation in the app. `index.css` already has the `enter` keyframes (used by `.toast`, [:866-870](../../src/index.css#L866-L870)), `pulse-danger` (overdue press cards) and `shake`, all under the reduced-motion block. The bar is one more keyframe, kept as small as asked.
- Dismiss removes the element, so the bar goes with it; no extra state.
- Edge, existing and unchanged: a second cancel update for the same order id replaces the notice but the first timer still fires, so it can disappear early. Cancel happens once per order, so not touched.

### Go / stop

- Item 1: **GO**.
- Item 2: **GO.** `set_order_status` accepts both calls for any order from any caller (read above), the id reaches both through `useSession().user`, and the cashier and press notices already fire on an admin cancel. No SQL, RLS, RPC, migration or dependency is needed.
- Items 3 and 4: **GO**.
- Not touched: PIN login, audio and sound triggers, wake lock, order numbering, idempotency, `mergeOrders`, alert dedupe, Stats and CSV, the print-first form, design ordering, main menu look, palette and tokens, press screen layout.

## Changes

Commits on `gdansk-ux-9` (the last one holds this report, the acceptance tests and the phase doc):

1. `feat(cashier)` own-only queue, Ready first: [cashierQueue.ts](../../src/lib/cashierQueue.ts), [check-cashier-queue.ts](../../scripts/check-cashier-queue.ts) (7 checks), [CashierPage.tsx](../../src/pages/CashierPage.tsx).
2. `feat(admin)` Orders screen: [AdminOrdersPage.tsx](../../src/pages/AdminOrdersPage.tsx), [adminOrders.ts](../../src/lib/adminOrders.ts), [check-admin-orders.ts](../../scripts/check-admin-orders.ts) (6 checks), [AdminPage.tsx](../../src/pages/AdminPage.tsx), [OrderCard.tsx](../../src/components/OrderCard.tsx) (claimer lookup for ready), [index.css](../../src/index.css) (`.orders-filter`, `.orders-chip`).
3. `fix(ux)` card meta lines and countdown bar: [OrderCard.tsx](../../src/components/OrderCard.tsx), [CashierPage.tsx](../../src/pages/CashierPage.tsx), [PressPage.tsx](../../src/pages/PressPage.tsx), [index.css](../../src/index.css) (`notice-countdown`, `.toast-notice`, `.notice-bar`).
4. `docs`: this file, `12_ACCEPTANCE_TESTS.md` (version 15; C3 AC2, AC2b, AC10, C3.3, C3.12, C3.15 to C3.17; D1.7, D1.8, D1.10; new A7 with A7.1 to A7.9; K; M), `11_PHASE_GDANSK.md`.

Per item:

- **1 Cashier Queue.** Both sections come from one pure `cashierQueue(orders, myId)`: only `created_by === me`; In progress is `new` + `in_progress` FIFO by `created_at`, Ready is oldest `ready_at` first (unchanged order); no user id gives two empty lists. "Ready for pickup" is above "In progress". Another cashier's Ready card, with its Cancel button, can no longer be on screen. Dropped on the Ready cards: the `highlight` ring and "Yours" badge (every card is mine now). Empty text for Ready is "None of your orders is ready yet." `onReady`, `onLoaded`, `seenReady`, the badge and the cancel notice are untouched.
- **2 Admin Orders.** As in the recon. The screen shows an empty state without an active event, filter chips with counts over all active orders, a card per order with the wait timer (`showWait`) and `showClaimedBy`. "Cancel order" is on every card; "✓ Picked up" only on Ready, with a double-tap guard, an error toast ("Couldn't update order #N. Check the connection and tap again.") and a refetch after success. The default Admin tab is untouched. One small change to a shared component: `OrderCard` now resolves the claimer name for `ready` orders too when `showClaimedBy` is set (before: only `in_progress`); only this screen shows a ready card with that prop.
- **3 Card meta.** "Sold by <strong>Max</strong>" (`—` when the cashier name is missing) and "Claimed by <strong>Name</strong>" are two `.order-secondary` lines; an unknown claimer (or one still loading) gives a plain "Claimed" line in the same style, never a suffix on the first line. **Side effect:** Press's old " · claimed" suffix is gone, the plain line replaces it (same data, new place), and cashier Ready cards that have a `claimed_by` but no `showClaimedBy` now show a "Claimed" line (before: " · claimed" in the cashier line).
- **4 Countdown bar.** A 3 px bar at the bottom edge of the Press and Cashier cancel notices, `transform: scaleX(1 → 0)` from the left, `linear forwards`, duration set inline from `NOTICE_MS` (no second copy of 30 s in CSS). `pointer-events: none` so it never blocks the Dismiss button. Under `prefers-reduced-motion: reduce` the bar is `display: none`: the notice, Dismiss and the 30 s timer are unchanged. Dismiss removes the notice (and the bar) at once. The bar animation starts when the notice mounts and the existing `setTimeout` starts a moment earlier, so they end together within a frame or two.

Things to know:

- **Everything is an interface rule.** `set_order_status` does not look at the caller, the order's `created_by` or any role ([0004_ops.sql:18-65](../../supabase/migrations/0004_ops.sql#L18-L65)). Hiding other cashiers' orders, the admin-only Orders screen and the admin "Picked up" are not enforced by the server: a modified client or anyone with the anon key can cancel or complete any order. Real enforcement needs a new RPC and RLS (two-round pattern), not done here.
- **Freshness on the cashier screen** is as before: realtime plus the 20 s poll. A cashier can no longer cancel another cashier's order from the UI, but the server would still allow it.
- **Admin cancel and the press notice:** the press notice does not fire for a cancelled `ready` order (R22 rule, `new` and `in_progress` only); the cashier notice does. Unchanged.
- **Admin `useOrders`** adds one realtime subscription and a 20 s poll while the Orders tab is open, same as a Press or Cashier screen. It ends when the tab is left (the page remounts per tab).
- **Tab strip:** six tabs on a 360 px phone scroll as the five did; no CSS change to `.tab`.
- **Not the first animation:** see the recon; `enter`, `pulse-danger` and `shake` exist already.

## Validation

Run on the final tree:

- `npx tsc -b`: clean.
- `npm run lint`: clean.
- `npm run build`: ok (PWA 9 precache entries).
- `grep -c "Dev login" dist/assets/*.js`: 0.
- `git --no-pager grep -n -i "service_role" -- src`: empty.
- Every `scripts/check-*.ts` (18, including the new `check-cashier-queue.ts` and `check-admin-orders.ts`) and `node scripts/check-sounds.mjs`: all pass.
- `git diff --stat main`: see the final message.

## Nothing is verified on a device

I have not opened this in a browser, on an iPhone, an Android phone or a laptop, and I did not write to the database, call `activate_event` or touch any real order, so no `orders` row was changed. The new screen and the bar were never rendered once. Covered by pure check scripts: the cashier filter and the admin grouping and sort. Everything else (the layout of the chips and the six-tab strip on a phone, the Ready-above-In-progress order, the bar animation and its timing against the 30 s timer, reduced motion, the confirm dialog from the Admin tab, realtime updates on the Orders screen, the cashier and press notices after an admin cancel) comes from code, CSS and the build passing only.

## Manual steps

Use the `ZZ-TEST` event only (active during the test; never on the real event), cashiers `C1` and `C2`, press `P1`, admin on a laptop. Do not call `activate_event`. Reload each device twice so the new build runs (the build tag on the login screen matches).

**iPhone PWA, two cashier phones (`C1`, `C2`) and a press phone (`P1`):**
1. `C1` and `C2` each create two orders (`C1`: #a, #b; `C2`: #c, #d). `P1` claims all four, sets #a and #c Ready, leaves #b and #d in progress.
2. `C1`, Queue tab: "Ready for pickup" is above "In progress". Ready shows #a only, In progress shows #b only. #c and #d are nowhere, and no Cancel button for them (C3.15, C3.16). Counters and the tab badge count one each.
3. `C2`: same, with #c, #d only.
4. `C1` Ready overlay and sound fire only for #a when it turns Ready (C3.1, C3.3).
5. `P1` cancels #b: `C1` sees the red notice under the tabs; look for the thin bar at its bottom edge shrinking over about 30 s; "Dismiss" removes it at once. Same on `P1` when another phone cancels a New or In progress order (D1.10, C3.17).
6. On the iPhone turn on Settings, Accessibility, Motion, Reduce Motion; cancel another order: notice appears with no bar, Dismiss works, it disappears after 30 s. Turn Reduce Motion off again.
7. Card meta: "Sold by **name**" and, on an In progress card, "Claimed by **name**", both the same size and weight with a bold name (D1.7, D1.8). Deactivate a test claimer on `ZZ-TEST` in Admin, Staff: the line reads plain "Claimed".

**Laptop (admin) plus the phones above:**
1. Admin: six tabs, "Orders" last; the default tab on opening is still Designs (A7.1). At 360 px the strip scrolls and tapping "Orders" keeps it in view.
2. Orders: all active orders of both cashiers; Ready group first, then In progress, then New, oldest first inside each (A7.2). Chips All, New, In progress, Ready show counts and filter; the counts do not change when the filter changes (A7.3).
3. Create an order on `C1`, claim it, set it Ready on `P1`: the card appears and moves group without a reload, no sound, no overlay, no notice on the admin screen (A7.4).
4. "Cancel order" on `C2`'s In progress order (#d): dialog "Cancel order #N?", confirm. Card disappears. `C2`'s phone shows "Order #N was cancelled by <admin name>. Check with the press." with the bar. `P1` shows "Order #N cancelled by <admin name>" (A7.5).
5. "Cancel order" on a Ready order: `C1` or `C2` gets the notice; `P1` gets none (A7.6). "Keep order" changes nothing.
6. "✓ Picked up" on a Ready order: gone from Orders and from the cashier's Ready list; no button on New or In progress cards (A7.7). Double-tap: one action (A7.8). Turn Wi-Fi off and tap: red message, order stays (A7.9).
7. Confirm nothing was changed on the real event: Admin, Events still shows the same active event.

Nothing above has been run on a device.
