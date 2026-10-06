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
