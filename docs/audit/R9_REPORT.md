# R9 report: gdansk-fix-6 (Cashier tabs, sticky Send bar, Ready alert opens the queue)

## Recon
Line numbers are from `main` (c5742c9) before any edit. Written before any other file was touched.

**What scrolls: `.content`, not `.app` and not the window.**
- `html, body, #root { height: 100% }` (`src/index.css:81-86`).
- `.app { height: 100%; display: flex; flex-direction: column }` (`:241-245`). It does not scroll.
- `.content { flex: 1; overflow-y: auto; padding: var(--sp-5); padding-bottom: calc(var(--sp-6) + env(safe-area-inset-bottom)) }` (`:301-306`). This is the only scroll container on the Cashier page. The window never scrolls.
- `TopBar` (`<header class="topbar">`, `:247-259`, `position: sticky; top: 0; z-index: 5`) and `OfflineBanner` (`.banner`, `:403-411`, `TopBar.tsx:67`) are flex siblings above `.content` (`CashierPage.tsx:126-128`). They stay visible because they are outside the scroller, not because of the sticky.
- `.content` has `className="page-enter"`; the `enter` keyframes end with `transform: none` (`:462-470`), so no lasting transform or containing-block problem for sticky descendants.

**Existing `.tab` CSS and breakpoint**
- `.tab` (`:281-292`): `min-height: 44px; padding: 0 var(--sp-4); border: none; background: transparent; font-size: 15px; border-radius: var(--r-pill); text-transform: capitalize`. `.tab-active` (`:296-299`): `--accent` background, `--accent-ink` text.
- `.tab` is only used inside `.topbar-nav` (`:271-279`, `TopBar.tsx:54`; Admin tabs at `AdminPage.tsx:17-27`). Cashier has no tab bar today.
- `text-transform: capitalize` would render "New Order"; the new bar needs a small override to keep "New order".
- The 900 px breakpoint is `@media (min-width: 900px)` on `.two-col` (`:340-344`). Below it `.two-col` is one `minmax(0, 1fr)` column (`:334-339`), so the form stacks above the queue.

**Where the draft state lives**
- `NewOrderForm` (`CashierPage.tsx:172-310`) owns it: `pickedColor`, `pickedSize`, `pickedFront`, `pickedBack`, `clientName`, `busy` (`:174-179`), the idempotency key `requestId` ref (`:180`), plus `toast` and `staleNotice` (`:181-182`).
- It is a child of `CashierPage` rendered at `:130`. It keeps its state as long as it stays mounted, so conditional rendering would lose the draft and the request id. The tab switch must hide with CSS only.
- Only the `!activeEvent` early return (`:115-122`) unmounts it; that is an existing, event-less state.

**Will `position: sticky; bottom: 0` work?**
- Yes. Sticky resolves against the nearest scrolling ancestor, which is `.content` (`overflow-y: auto`, height bounded by the flex column). No ancestor between the form and `.content` sets `overflow` (`.card`, `.grid`, `.two-col` have none), so the bar sticks to the bottom edge of `.content`'s scrollport.
- The bar must be a descendant of the New order card (its sticky containing block), as the last child, so it rests in normal flow at the end of the card and stays on screen while any part of the form is visible.
- The tab bar can be sticky at `top: 0` of `.content`, with negative margins to cancel `.content`'s 20 px padding; the TopBar and banner are already outside the scroller, so `top: 0` is directly under them.
- Caveat for the report, not a blocker: iOS Safari does not shrink the layout viewport when the keyboard opens, so the bar can sit behind the keyboard while the client-name field is focused. `Enter` already blurs that field (`:290`). Not verifiable without a device.
- No scroll-structure change is needed, so no alternative is proposed.

**Other facts used**
- `readyOrders` (all ready orders, mine first) is at `CashierPage.tsx:92-104`; "mine" is `created_by === user?.id`. The Ready overlay is dismissed at `:166` (`onDismiss={() => setOverlay(null)}`), shared by the single and batch alerts.
- Scroll position lives in `.content` and persists across a CSS tab switch; the switch should reset it to the top, otherwise Queue opens scrolled to wherever the form was.

## Changes
1. `feat(cashier) tabs on narrow screens`: `CashierPage` gets a `New order` / `Queue` tab bar (`.cashier-tabs`, existing `.tab` styles, 44 px, `position: sticky; top: 0` inside `.content`, opaque `--surface-card`). Both panes stay mounted; the inactive one gets `.pane-inactive`, which is `display: none` only under 900 px. From 900 px up the bar is `display: none` and the layout is unchanged. Default tab is New order. Switching resets `.content` scroll to the top. The Queue tab badge uses `readyBadgeCount(orders, userId)` (`src/lib/readyBadge.ts`), hidden at 0.
2. `feat(cashier) sticky send bar with summary`: Send, the `sendHint` line (still only while color or size is missing) and a summary line move into `.send-bar` (`position: sticky; bottom: 0`, opaque `--surface-card`, `env(safe-area-inset-bottom)` padding), last child of the New order card. Summary comes from `orderSummary` (`src/lib/orderSummary.ts`), e.g. `Black · M · Front: Name · Back: Name`, only chosen parts. The client-name input has `scroll-margin-bottom: 160px` so focus scrolling does not park it under the bar. Success and error toasts moved above the bar.
3. This commit: `AlertOverlay` is untouched; `CashierPage` calls `selectTab('queue')` in its `onDismiss` (covers the single and the batch alert). `scripts/check-cashier-ui.ts`, this report, and an entry in `11_PHASE_GDANSK.md`.

No `position: fixed` added. No SQL, schema, RLS, RPC, auth, dependency, audio, wake lock, polling or queue change.

## Check script output
`node scripts/check-cashier-ui.ts`:
```
ok - summary: nothing chosen is empty
ok - summary: color only
ok - summary: size only
ok - summary: color and size
ok - summary: front design only
ok - summary: skips unchosen parts in the middle
ok - summary: all chosen with designs
ok - summary: all chosen without designs
ok - badge: own ready orders are counted
ok - badge: others' ready orders are ignored
ok - badge: no ready orders is 0
ok - badge: empty list is 0
ok - badge: unknown user is 0
13 checks passed
```

## Validation
- `npx tsc -b`: no errors. `npm run lint`: no output (clean). `npm run build`: succeeded (PWA, 9 precache entries).
- `grep -c "Dev login" dist/assets/*.js`: 0.
- `git --no-pager grep -n -i "service_role" -- src`: empty.
- `git diff main --stat` before the third commit: 6 files, 220 insertions, 12 deletions (docs and script excluded from the count of src changes: `index.css`, `orderSummary.ts`, `readyBadge.ts`, `CashierPage.tsx`).

## Not verified
**Tab behavior, the sticky Send bar and keyboard interaction are not verified on a device.** Only types, lint, build and the pure-function script ran. Specifically unchecked:
- sticky bottom/top behavior in iOS Safari and the installed PWA, including the safe-area inset;
- the on-screen keyboard: iOS keeps the layout viewport, so the bar may hide behind the keyboard while the client-name field is focused (Enter already blurs it);
- that the draft (color, size, designs, name, request id) survives a switch to Queue and back (expected from CSS-only hiding, not exercised);
- the badge and the overlay-dismiss-to-Queue flow against real Ready orders.

## Notes
- On wide screens the Send bar is also sticky and shows the summary line, so that part of the wide layout is not byte-identical to before. Panes and columns are unchanged.
- The tab bar does not mark the other pane `inert`; a hidden pane is `display: none`, so it is out of the tab order and accessibility tree anyway.
