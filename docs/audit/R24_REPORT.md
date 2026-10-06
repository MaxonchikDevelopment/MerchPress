# R24: print-first form, Reset, visible cancel, claimed-by retry, cashier cancel notice (gdansk-ux-7)

Branch `gdansk-ux-7`, off `main` at 8fecccb (`git log main` contains `Merge gdansk-ux-5`). No schema, RLS, RPC, migration or dependency change. Nothing pushed or merged.

## Recon

Written before any other file was edited. Line numbers refer to 8fecccb. Everything here is from reading code; nothing was run on a device.

### Item 1: form order

- [CashierPage.tsx:375-392](../../src/pages/CashierPage.tsx#L375-L392) Shirt color (with the colour-cleared note at :378-382 and the dimmed note at :383-387), then Size; [:393-424](../../src/pages/CashierPage.tsx#L393-L424) Print (mode switch, bundle or custom pickers); [:425-444](../../src/pages/CashierPage.tsx#L425-L444) Client name. Order is only JSX order: the colour list already derives from the chosen print through `printColors` ([:254-260](../../src/pages/CashierPage.tsx#L254-L260)), so moving the Print block above Color needs no logic change. Every state, `pickBundle` ([:264-276](../../src/pages/CashierPage.tsx#L264-L276)), `switchMode`, `submit` and the request-id code stay as they are.

### Item 2: compact chosen print: GO

- Bundle mode today shows `DesignPicker side="bundle"` plus `BundlePreview` ([:408-412](../../src/pages/CashierPage.tsx#L408-L412)); the grid is 160 px tiles with a 120 px photo each ([DesignPicker.tsx:26,33](../../src/components/DesignPicker.tsx#L26)) and the preview is two 200 px photos ([:133](../../src/components/DesignPicker.tsx#L133)). That is the long scroll.
- Problem: "No print" is `null`, the same value as "nothing picked yet" (`pickedFront`/`pickedBack` are `string | null`, [:235-236](../../src/pages/CashierPage.tsx#L235-L236)). A collapsed row for "No print" therefore needs one extra piece of UI state: whether the cashier has made the choice. It is view state only, never sent, never part of the draft check.
- Thumbnails that enlarge: `ImageLightbox` ([ImageLightbox.tsx:5](../../src/components/ImageLightbox.tsx#L5), `src`, `alt`, `onClose`) is already used by `OrderCard`'s `DesignThumb` ([OrderCard.tsx:27-42](../../src/components/OrderCard.tsx#L27-L42)); a missing or failed photo falls back to initials. The compact row reuses both ideas.
- Custom mode: two pickers ([:414-423](../../src/pages/CashierPage.tsx#L414-L423)), each with its own None tile. Same one flag per side is enough, so collapsing each side is simple. **GO** for Bundle and for Custom.
- Hidden design: if the picked design was hidden since (`frontId` null while `pickedFront` is set, [:250-251](../../src/pages/CashierPage.tsx#L250-L251)), the row must not claim a choice; the grid stays open.

### Item 3: Reset

- Successful send resets at [:344-353](../../src/pages/CashierPage.tsx#L344-L353): `requestId.current = null`, `staleNotice` null, then colour, colour note, size, front, back, client name. Mode is not touched. Reset does the same set, plus the new "choice made" flags.
- Bar at [:358-369](../../src/pages/CashierPage.tsx#L358-L369): `.send-bar` is a grid (summary, full-width Send button, hint). On phones it is portalled into `.cashier-footer` ([:454](../../src/pages/CashierPage.tsx#L454), [index.css:574-617](../../src/index.css#L574-L617)); from 900 px it is the sticky end of the card. One JSX for both, so one change covers both. Send button is `btn-lg` (72 px) with inline `width: 100%`; Reset goes next to it in a flex row.
- In-flight guard: `busy` ([:239](../../src/pages/CashierPage.tsx#L239)) is set around `createOrder`. Reset is `disabled` while `busy`.

### Item 4: Cancel order visibility

- [CashierPage.tsx:180](../../src/pages/CashierPage.tsx#L180) (In progress) and [:196](../../src/pages/CashierPage.tsx#L196) (Ready) use `btn btn-text`: 14 px, no border, `--text-muted` ([index.css:202-213](../../src/index.css#L202-L213)), 44 px high. Press has the same button at [PressPage.tsx:169](../../src/pages/PressPage.tsx#L169), out of scope.
- Existing tokens: `--danger` (edge, #ef4444), `--danger-text` (#ff6b6b), `--danger-soft` ([index.css:48-52](../../src/index.css#L48-L52)); `.btn-danger` is a filled style that exists but is too loud and unused here. `.btn` is `--touch-min` (56 px), 18 px / 700. New class `.btn-danger-outline` built only from those tokens. Confirm dialog ([useCancelOrder.tsx:35-45](../../src/hooks/useCancelOrder.tsx#L35-L45)) is untouched.

### Item 5: Claimed by on the cashier

- [OrderCard.tsx:94](../../src/components/OrderCard.tsx#L94) resolves the name only when `showClaimedBy` and the order is `in_progress`; [:126-134](../../src/components/OrderCard.tsx#L126-L134) prints either "· claimed" in the cashier line (without the prop) or a second "Claimed by <name>" / "Claimed" line (with it). The cashier's In progress cards ([CashierPage.tsx:179](../../src/pages/CashierPage.tsx#L179)) do not pass the prop. Ready cards never show the line (status filter), so only the In progress cards get it.
- Fallback wording: today Press's unknown-name fallback is a separate line "Claimed". The brief asks for the plain " · claimed" fallback, so I will change `OrderCard` so the extra line appears only when the name is known and the " · claimed" suffix stays whenever the name is not. That also changes Press's fallback from a "Claimed" line to the suffix; noted in the report as a small side effect.

### Item 6: why a press card shows only "Claimed"

Reading [staffNames.ts:1-38](../../src/lib/staffNames.ts) and [orderStatus.ts:49-58](../../src/lib/orderStatus.ts#L49-L58):

1. **Failed read is indistinguishable from "no such person".** `staffName` returns `null` on a Supabase error, on a thrown fetch error and when no row matches.
2. **A null is never retried.** `useStaffName`'s effect depends only on `[id]` ([:35](../../src/lib/staffNames.ts#L35)) and sets state only for a truthy name ([:30](../../src/lib/staffNames.ts#L30)). After a null the card stays at "Claimed" until it remounts (reload, tab switch that unmounts it, or the order leaving and re-entering the list). `names` correctly never stores nulls, but nothing triggers a second try. This explains the **intermittent** case: a single failed request (flaky Wi-Fi at the moment the card appeared, or one of several parallel lookups failing when a list of in-progress cards loads) sticks.
3. **Deactivated claimer, deterministic.** `staff_v` is `select ... from users where is_active` ([0001_init.sql:189-190](../../supabase/migrations/0001_init.sql#L189-L190); 0004 did not redefine it). If the person who claimed the order was deactivated afterwards, the lookup returns no row and the card will show only "Claimed" on every load, forever. **Yes, a deactivated person explains it**, and no retry can fix it (that needs a staff view that includes inactive people, a schema change; not in scope, reported).
4. Not a cause: the dedupe maps. `inflight` is deleted in `.finally`, so a failed promise is not reused; `names` holds successes only.

Fix plan: `staffName` keeps its signature; a new `staffNameLookup` returns `{ name, ok }` so only a real failure (not "not found") is retried. `useStaffName` retries a failed lookup after 1.5 s and again after 4 s, caches nothing on failure, keeps the `inflight` dedupe, and clears its timers on unmount or id change. A deactivated person (ok, null) costs one request and no retry.

### Item 7: cashier notice when press cancels: GO

- `useOrders` already exposes `onCancelled(next, prev)`, fired from the realtime UPDATE branch ([useOrders.ts:106](../../src/hooks/useOrders.ts#L106)); `prev` is complete because `orders` has `replica identity full`. It is realtime only (a poll or refetch carries no cancel information, the cancelled row just disappears; [mergeOrders.ts:20-21](../../src/lib/mergeOrders.ts#L20-L21)). Same known limit as the press notice, stated in the report.
- Cashier passes `{ onReady, onLoaded }` ([CashierPage.tsx:85](../../src/pages/CashierPage.tsx#L85)); adding `onCancelled` changes no merge semantics. `userId` is available ([:38](../../src/pages/CashierPage.tsx#L38)). Cashier's own cancel ([useCancelOrder.tsx:21-29](../../src/hooks/useCancelOrder.tsx#L21-L29)) arrives as the same UPDATE with `cancelled_by` = me, so the rule skips it.
- Rule (pure, new `src/lib/cashierCancelNotice.ts`): notice only when `next.status` is `cancelled`, `prev.status` is `new`, `in_progress` or `ready`, `next.created_by === me`, and `next.cancelled_by !== me`. Missing `prev` gives no notice. `cancelled_by` null gives a notice with the name unknown ("the press"). The existing [cancelNotice.ts](../../src/lib/cancelNotice.ts) is the Press rule (new/in_progress only, no ownership); it stays as is. Check script `scripts/check-cashier-cancel-notice.ts`, same runner.
- Visibility on both tabs: the `NewOrderForm` pane and the Queue pane are siblings inside `.content`, and the inactive one is `display: none` on phones ([index.css:590-592](../../src/index.css#L590-L592)). The notice therefore goes in `.top-block` (the opaque non-scrolling header, [CashierPage.tsx:145-167](../../src/pages/CashierPage.tsx#L145-L167)), under the tab bar, so it shows on both tabs and on wide screens. No portal, no sound.
- Name: existing `staffName` (as Press does), fallback "the press". Auto-dismiss 30 s, "Dismiss" button, one notice per order id, separate from the error toast.

### Item 8: Press auto-dismiss

- [PressPage.tsx:63](../../src/pages/PressPage.tsx#L63) `setTimeout(() => dismissNotice(next.id), 15_000)`. Changed to 30 s through one shared constant in `cancelNotice.ts`, used by both pages. Dismiss button stays ([:140](../../src/pages/PressPage.tsx#L140)).

### Go / stop

- Item 2: **GO** (Bundle and Custom).
- Item 7: **GO**.
- Items 1, 3, 4, 5, 6, 8: go. None needs SQL, RLS, RPC, a migration or a dependency.
- Item 6 limit (not blocking): a deactivated claimer cannot be named without a schema change; reported.

## Changes

Commits on `gdansk-ux-7` (the last one holds this report, the acceptance tests and the phase doc):

1. `feat(cashier)` print-first form, compact print and Reset: [CashierPage.tsx](../../src/pages/CashierPage.tsx), [DesignPicker.tsx](../../src/components/DesignPicker.tsx) (new `ChosenPrint`, unused `BundlePreview` removed), [index.css](../../src/index.css) (`.send-row`, `.btn-reset`).
2. `fix(ux)` visible cancel, claimed-by name and retry: [index.css](../../src/index.css) (`.btn-danger-outline`), [OrderCard.tsx](../../src/components/OrderCard.tsx), [staffNames.ts](../../src/lib/staffNames.ts), [orderStatus.ts](../../src/lib/orderStatus.ts) (`staffNameLookup`), [cancelNotice.ts](../../src/lib/cancelNotice.ts) (`NOTICE_MS`), [PressPage.tsx](../../src/pages/PressPage.tsx) (30 s), cashier cards in CashierPage.
3. `feat(cashier)` press-cancel notice: [cashierCancelNotice.ts](../../src/lib/cashierCancelNotice.ts), [check-cashier-cancel-notice.ts](../../scripts/check-cashier-cancel-notice.ts) (11 checks), `onCancelled` and the notice list in CashierPage, `.top-notices` in index.css.
4. `docs`: this file, `12_ACCEPTANCE_TESTS.md` (version 13), `11_PHASE_GDANSK.md`.

Per item:

- **1 Form order.** Print block first, then Shirt color (with both notes), Size, Client name. Pure JSX move; no logic change.
- **2 Compact print.** `chosen` view flags (`bundle`, `front`, `back`) mark an answered picker, so "No print" and "None" collapse too. Collapsed row: 56 px front and back thumbnails (tap opens `ImageLightbox`, missing photo shows initials), name, "Change" (44 px). Custom collapses each side on its own. Mode switch, Reset and a successful send clear the flags; a design hidden since keeps its grid open. The big `BundlePreview` is gone (it was only used here).
- **3 Reset.** `clearDraft` is the one function used by the successful send and by Reset, so they cannot drift; it clears request id, stale notice, colour, colour note, size, front, back, flags and name, and leaves `mode`. Enabled when anything is picked or typed, disabled while `busy`, no confirm. Send and Reset share a `.send-row` (Reset compact on the left, Send fills the rest) in the phone footer and in the card.
- **4 Cancel.** `.btn-danger-outline`: transparent, `--danger` border, `--danger-text` text, hover `--danger-soft`; on `.btn` so it is 56 px like the other buttons. Both cashier Queue buttons. Press keeps its text button (out of scope).
- **5 Claimed by on cashier.** In progress cards pass `showClaimedBy`. `OrderCard` now prints the "Claimed by <name>" line only when the name is known and keeps " · claimed" otherwise. **Side effect on Press:** its unknown-name fallback is now " · claimed" in the cashier line instead of a separate "Claimed" line.
- **6 Retry.** Findings in the recon. Done: a failed read retries at 1.5 s and 4 s, timers cleared on unmount or id change, no failure cached, `inflight` dedupe kept. A deactivated person is a clean "not found" and is not retried. **A deactivated claimer explains a permanent "Claimed", but not the intermittent case** (that one is the never-retried failed read). Naming a deactivated person would need `staff_v` to include inactive people, a schema change: not done, reported.
- **7 Cashier notice.** As in the recon; no change to `useOrders` or `mergeOrders` (the callback already existed). Realtime only, same limit as Press: if the socket was down at the moment of the cancel the order just disappears on the next refetch with no notice.
- **8 Press 30 s.** One shared `NOTICE_MS`.

## Validation

Run on the final tree:

- `npx tsc -b`: clean.
- `npm run lint`: clean.
- `npm run build`: ok (PWA 9 precache entries).
- `grep -c "Dev login" dist/assets/*.js`: 0.
- `git --no-pager grep -n -i "service_role" -- src`: empty.
- Every `scripts/check-*.ts` (15 including the new `check-cashier-cancel-notice.ts`) and `node scripts/check-sounds.mjs`: all pass.
- `git diff --stat main`: see the final message.

## Not verified

Nothing here was run on a device or in a browser. Layout of the compact row, the Reset button next to Send on a 360 px phone, the notice in the top block, the danger-outline look, and the retry timing are from code and pure-logic checks only. The new components were not rendered once.

## Manual steps

**iPhone PWA** (cashier `C1` and, for 8 to 11, a press phone or laptop; event `ZZ-TEST` only; reload the app twice so the new build runs and the build tag matches):
1. `C1`, New order: blocks run Print, Shirt color, Size, Client name (C1.21).
2. Bundle: pick a design; the grid and big preview collapse to one row with two small photos, name and "Change". Tap a photo: enlarged, tap closes. "Change" reopens the grid. Pick "No print": row reads "No print" (C1.22).
3. Pick a colour, then a bundle whose colours exclude it: colour cleared note still shows under Shirt color (C1.18).
4. Custom print: pick Front and Back; each collapses alone; "Change" on one reopens only that one (C1.23).
5. Reset: greyed when empty, active after any pick or typing, clears print, colour, size, name and note, stays in the same mode, no dialog. Check it sits left of "Send to press →" in the bottom bar at 360 px width and that Send is still comfortable to tap. Start a send on a bad connection: Reset is greyed while "Sending…" (C1.24).
6. Send an order normally: form clears exactly as after Reset.
7. Queue tab: "Cancel order" has a red outline and red text, opens the same confirm dialog (C3.11).
8. Press claims `C1`'s order: Queue shows "Claimed by <press name>" (C3.12). Turn Wi-Fi off on `C1` just before the claim, back on after 2 s: the name should appear without a reload (retry).
9. On the New order tab, press cancels `C1`'s New order, then an In progress one, then a Ready one: red notice under the tabs each time, no sound, on both tabs, Dismiss works, and it vanishes after 30 s (C3.13).
10. `C1` cancels its own order: no notice (C3.14).

**Laptop (press, and a cashier window at 900 px and up):**
1. Press: cancel a cashier's order from another cashier window: notice shows 30 s, "Dismiss" works (D1.9).
2. Cashier at desktop width: Reset left of "Send to press →" at the end of the card, notices show in the header block, Queue and New order are side by side.
3. Press: an in-progress card shows "Claimed by <name>" (D1.8). Deactivate a test claimer on `ZZ-TEST` through Admin, Staff: the card shows only " · claimed" and does not keep retrying (not retried because the read succeeds).
