# R15: phone layout (gdansk-ux-1)

Branch `gdansk-ux-1`, off `main` at e52eb80. No schema, RLS, RPC, migration or dependency change. Nothing pushed or merged.

## Recon

Written before any other file was edited. Line numbers refer to e52eb80. Nothing here was run on a device or in a browser; every statement is from reading code and CSS.

### Which element scrolls

- `html, body, #root` are `height: 100%`, `margin: 0` ([index.css:81-86](../../src/index.css#L81-L86)). `body` has `overscroll-behavior: none` ([index.css:100](../../src/index.css#L100)); `html` has none and no `overflow`.
- `.app` is a flex column, `height: 100%` ([index.css:241-245](../../src/index.css#L241-L245)). `.content` is `flex: 1; overflow-y: auto` ([index.css:301-306](../../src/index.css#L301-L306)), so `.content` is the scroller on every page (Cashier, Press, Admin, login, loading state). `.content` has no `min-height: 0`; it works because a scroll container's automatic minimum size is 0.
- The document itself should not scroll while `.app` fits the viewport. Nothing stops iOS from rubber-banding the root scroller: the `overscroll-behavior` is only on `body`, and I could not confirm from code whether it reaches the viewport on iOS. This is a risk, not a proven cause.

### TopBar layout (UX-01)

- [TopBar.tsx:19](../../src/components/TopBar.tsx#L19) `header.topbar` is `display: flex; justify-content: space-between` ([index.css:247-260](../../src/index.css#L247-L260)). Left child: `h1` plus `.sub` with the event name, no `min-width: 0`, no `white-space: nowrap`, no ellipsis.
- [TopBar.tsx:24](../../src/components/TopBar.tsx#L24) the right child is a `.row`, which is `flex-wrap: wrap` ([index.css:405-410](../../src/index.css#L405-L410)). Every control is a full `.btn` (`min-height: 56px`, `padding: 0 20px`, 18 px bold) or `.pill` (`min-height: 40px`): `SoundRetryButton` ("🔕 Sound off · tap to retry"), "Test sound", the wake lock pill, the user pill, "Sign out" ([TopBar.tsx:26-60](../../src/components/TopBar.tsx#L26-L60)). Admin adds the four-tab `.topbar-nav` ([TopBar.tsx:54](../../src/components/TopBar.tsx#L54)). On a 390 px phone these cannot share a row, so the right group wraps into a stack of large blocks and the title column is squeezed to its minimum content width, which wraps the role title and event name. **Confirmed.**
- "Duplicated Admin label": I found no second "Admin" string in the code. The only place is `<TopBar title="Admin">` ([AdminPage.tsx:21](../../src/pages/AdminPage.tsx#L21)). The most likely duplicate is the user pill showing a person whose staff name is "Admin". Not confirmable from code. I will not delete the `h1`.

### Pinning (UX-03)

- Finding from chat **confirmed**: the `TopBar` and `OfflineBanner` are flex siblings above `.content` ([CashierPage.tsx:141-143](../../src/pages/CashierPage.tsx#L141-L143)), so they already do not scroll. The `position: sticky; top: 0` on `.topbar` ([index.css:257-258](../../src/index.css#L257-L258)) does nothing in a flex column whose parent does not scroll.
- `.cashier-tabs` is the first child INSIDE `.content` ([CashierPage.tsx:144](../../src/pages/CashierPage.tsx#L144)): `position: sticky; top: 0` with `margin: -20px -20px 16px` to cancel `.content`'s 20 px padding ([index.css:346-356](../../src/index.css#L346-L356)). So the tab bar is not in the header block at all; it lives in the scroller and depends on sticky plus negative margins to look attached.
- Why content shows between header and tabs: I cannot prove it from code. The candidates are the scroller's own 20 px `padding-top` (sticky offsets and padding interact differently across engines, and the tab bar's resting position is a negative-margin trick) and the 86 % translucent header. Whatever the cause, it comes from the tabs sitting inside the scroller. Moving them out of it removes the dependence on sticky behaviour entirely.
- The finding that `.topbar` background is a translucent `color-mix` plus `backdrop-filter` ([index.css:254-255](../../src/index.css#L254-L255)) is **confirmed**. It does not matter while nothing scrolls under it, but it is not opaque as the spec requires. `OfflineBanner` is a bare sibling between header and content ([TopBar.tsx:67-75](../../src/components/TopBar.tsx#L67-L75)): not pinned by any wrapper, but also not scrolled.

### Send bar (UX-02)

- Finding from chat **confirmed**. `.send-bar` is the last child of the New order card ([CashierPage.tsx:349](../../src/pages/CashierPage.tsx#L349)), `position: sticky; bottom: 0` ([index.css:376-388](../../src/index.css#L376-L388)). A sticky element can never leave its parent's box, and the parent is the card, not the viewport. That explains both symptoms with no browser quirk:
  - card shorter than the viewport: the bar sits at the end of the card, i.e. in the middle of the screen;
  - card taller than the viewport: the bar pins at the bottom of the scrollport and slides over the form fields that scroll beneath it.
- Queue tab: `.pane-inactive` is `display: none` under 900 px ([index.css:400-404](../../src/index.css#L400-L404)), and the bar is inside the New order pane, so it is already hidden on Queue. Both panes stay mounted, so the draft lives in `NewOrderForm` state.
- The client name input has `scrollMarginBottom: 160` ([CashierPage.tsx:337](../../src/pages/CashierPage.tsx#L337)), a leftover from the sticky bar.

### Dialogs and overlays (UX-05, UX-06)

- `AlertOverlay` ([AlertOverlay.tsx:14-28](../../src/components/AlertOverlay.tsx#L14-L28)), `ConfirmDialog` ([ConfirmDialog.tsx:21-33](../../src/components/ConfirmDialog.tsx#L21-L33)) and `SoundGate` are already `position: fixed; inset: 0; z-index: 100/110`. Finding from chat **confirmed**.
- Mounts: on Cashier the Ready overlay and the cancel dialog are direct children of `.app` ([CashierPage.tsx:200-207](../../src/pages/CashierPage.tsx#L200-L207)), outside `.content`; Press is the same ([PressPage.tsx:147-148](../../src/pages/PressPage.tsx#L147-L148)). The Staff Deactivate dialog is rendered inside `PersonRow`'s card ([AdminStaffPage.tsx:285](../../src/pages/AdminStaffPage.tsx#L285), root at [:224](../../src/pages/AdminStaffPage.tsx#L224)) inside `.content.page-enter` ([AdminPage.tsx:33](../../src/pages/AdminPage.tsx#L33)). The Events switch dialog is in `AdminEventsPage` ([:139](../../src/pages/AdminEventsPage.tsx#L139)) inside the same `.content.page-enter`. `ImageLightbox` is the only component already using `createPortal(..., document.body)` ([ImageLightbox.tsx:9](../../src/components/ImageLightbox.tsx#L9)).
- `.content.page-enter` runs `animation: enter ... both` on `transform` and `opacity` ([index.css:562-564](../../src/index.css#L562-L564), keyframes [:522-531](../../src/index.css#L522-L531)). It also has `overflow-y: auto`. `.stagger > *` does the same per child ([index.css:566-569](../../src/index.css#L566-L569)); no Admin page uses `.stagger`.
- **UX-06 (Staff dialog covers only the top half):** plausible but not provable from code. `position: fixed` is only viewport-relative if no ancestor is a containing block for fixed elements. An ancestor that is transformed, or has an active transform animation (some engines keep that behaviour for a `fill-mode: both` animation), turns it into the containing block; with `overflow-y: auto` on the same element the dialog is then placed against the scroller's padding box and scrolls with the list instead of covering the screen. That matches a dialog that is partly off screen after scrolling a tall Staff list, but I cannot tell from code which engine rule applied. The fix is the same either way: portal to `document.body`.
- **UX-05 (Ready overlay moves when the page scrolls): cannot be explained from code.** On Cashier the overlay is a direct child of `.app`, no ancestor has a transform, filter or `backdrop-filter` (`.topbar` has one but is a sibling), so `fixed` is viewport-relative. Remaining candidates, all about the viewport and not the element: the document rubber-banding because only `body` has `overscroll-behavior`; iOS shifting the visual viewport while the keyboard is open; a stale cached bundle. I will portal it anyway (spec) and add `overscroll-behavior: none` on `html`, but I cannot claim that fixes UX-05.

### Viewport meta and safe areas (UX-04)

- [index.html:6-8](../../index.html#L6-L8): `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover`. `viewport-fit=cover` **is set**. `apple-mobile-web-app-capable=yes` and `black-translucent` status bar ([index.html:10-11](../../index.html#L10-L11)), so content really does draw under the Dynamic Island.
- The `.topbar` has `padding-top: calc(12px + env(safe-area-inset-top))` ([index.css:253](../../src/index.css#L253)). Finding from chat **confirmed**: the "no safe-area" hypothesis is wrong for the top. The login screen also uses `header.topbar` ([RoleSelect.tsx:80](../../src/components/RoleSelect.tsx#L80)), so it is covered too.
- Real gaps: no `env(safe-area-inset-left/right)` anywhere, so in landscape the notch side cuts the header and content. `.content` has a bottom inset ([index.css:305](../../src/index.css#L305)) but no side insets. Overlay `padding: 24` ignores insets.
- **UX-04 (top of content cut by the Dynamic Island): cannot be fully explained from code.** The inset is applied. Candidates: the three-line wrapped header (UX-01) pushing things around so the top looked cut; a stale service worker bundle from before the inset existed (`registerType: 'autoUpdate'` updates on the next load, not mid-session); landscape side insets. I will add the insets and make the top block opaque; whether that closes UX-04 is for the device test.

### Decision for the bottom action bar

Chosen: flex footer outside the scroller, not `position: fixed`.

- Structure: `.app` gets a `.cashier-footer` slot as the last flex child after `.content`, on phones only. `NewOrderForm` keeps all state and renders the bar into the slot with `createPortal` when the viewport is under 900 px and the New order tab is active; on 900 px and up it renders in the card exactly where it is today. The slot is `:empty { display: none }`, so on the Queue tab there is no bar and no space reserved.
- Why: a flex footer shrinks `.content` by exactly the bar's height, so there is no measured height, no `padding-bottom` guess, and no overlap with the last field. `position: fixed` would need `.content` padding that tracks the bar height (which changes with summary and hint lines) and would be the element that jumps when iOS shifts the visual viewport.
- iOS keyboard, stated honestly: in a standalone PWA the keyboard does not resize the layout viewport. A footer at the bottom of the layout viewport is covered by the keyboard while the client name field is focused; iOS then scrolls the focused field into view. The bar reappears when the keyboard closes (Enter blurs the field, existing behaviour). Accepted per the task. Not verified on a device.

## Findings from chat that were wrong or incomplete

| Finding | Verdict |
|---|---|
| TopBar.tsx:24 is a flex-wrap `.row` of full buttons | Correct (the line is the `.row`; the header is :19) |
| `.topbar` already has the safe-area top padding, so "no safe-area" is wrong | Correct for the top. Left/right insets are missing, as noted |
| Translucent background plus backdrop-filter | Correct |
| `.cashier-tabs` is sticky inside `.content` with negative margins | Correct |
| `.send-bar` is bounded by the card | Correct, and it explains both symptoms |
| Queue pane is `display: none` on narrow screens | Correct |
| AlertOverlay and cancel dialog are children of `.app`; Staff and Events dialogs are inside `.content.page-enter` | Correct. Press mounts like Cashier |
| `.page-enter` animates transform, so it can contain fixed children | Plausible for UX-06, not provable from code. Not a cause for UX-05 (the Ready overlay is outside `.content`) |
| `ImageLightbox` already portals | Correct |

Not explainable from code: UX-04 (see above), UX-05 (see above), and the exact reason content shows between header and tabs (UX-03), though removing the tabs from the scroller makes it moot.

## What changed

| Area | Change |
|---|---|
| Header ([TopBar.tsx](../../src/components/TopBar.tsx), [index.css](../../src/index.css)) | One compact bar. Left: role title and event name, one line each, ellipsis. Right: 🔔 Test sound (icon on phones, label from 900 px, same handler), 💤 wake lock button that renders only for `released` and `unsupported` (same `retryWakeLock`; the hint text now goes into a toast under the header for 4 s), user chip with a menu ("Signed in as <name>", Sign out; closes on outside tap and Escape). `SoundRetryButton` is icon-only on phones. All action buttons are at least 44 x 44 px. |
| Admin nav | The four sections are a horizontally scrollable segmented control on its own row on phones, inline from 900 px. No second "Admin" label exists in code (see Recon), so none was removed. |
| Top block | New `TopBlock` wraps header, `OfflineBanner` and the Cashier tab bar above `.content`. Opaque (`color-mix` of card over page, same tone as before but no transparency), `padding: env(top) env(right) 0 env(left)`. `.topbar` lost its sticky and safe-area padding. Used on Cashier, Press, Admin and the login screen. `.cashier-tabs` lost sticky and negative margins. `.content` got `min-height: 0`, `overscroll-behavior-y: contain` and left/right insets. |
| Document scroll | `html, body { overflow: hidden; overscroll-behavior: none }`. Only `.content` scrolls. CSS only. |
| Bottom bar | `.cashier-footer` is the last flex child of `.app` on Cashier. Under 900 px `NewOrderForm` portals the send bar (toast of the last send, summary, "Send to press →", hint) into it while the New order tab is active; otherwise it renders in the card as before. Empty slot is `display: none`, so Queue shows no bar. New `useMediaQuery` hook uses the same 899.98 px breakpoint as the CSS. |
| Overlays | `ConfirmDialog` and `AlertOverlay` use `createPortal(..., document.body)`, shared `.overlay` backdrop (fixed, `inset: 0`, z-index 100, above the top block at 10, `touch-action: none`, safe-area padding) and a card capped at 360 px (Alert card goes back to 640 px from 900 px). Tap-outside-to-cancel and tap-to-dismiss are unchanged. `SoundGate` and `ImageLightbox` are untouched. |

Not touched: PIN login flow, audio logic, wake lock hook, polling and realtime, queue ordering and statuses, order creation, all SQL, dependencies. No pure logic was added, so there is no new `scripts/check-*.ts`.

Side effects to know about:
- Sign out is now only in the user menu, on wide screens too.
- The wide header buttons are 44 px high instead of 56 px, and the header background is opaque.
- The Staff and Events dialogs, the cancel dialog and the Ready alert are now siblings of `#root` in the DOM. Screen readers and focus order are as before (no focus trap existed).
- The ConfirmDialog title is 22 px instead of 26 px, the Ready alert title is 44 px (was 56) under 900 px.
- On phones the "Sent to press" toast moved from the card into the bar so it is visible. The stale-notice alert stays in the card, where it always was, so it can sit off screen after a scroll.
- `scrollMarginBottom: 160` on the client name input is left in place; it is harmless now.

## Validation

Run on the branch after the last code commit:

```
npx tsc -b                                    # clean
npm run lint                                  # clean
npm run build                                 # ok, PWA 9 precache entries
grep -c "Dev login" dist/assets/*.js          # 0
git --no-pager grep -n -i "service_role" -- src   # empty
git diff --stat main                          # see the final report
```

## Nothing is verified on a device

I have not opened this on an iPhone, an Android phone or in a desktop browser. Everything above is from reading code and CSS, and the build passing. UX-04 and UX-05 were not explained from code, so a green device test is the only evidence that they are gone.

## Manual steps: iPhone PWA

Deploy first (or run the preview build on the test URL). Delete the home screen icon and add it again, or fully close the app and reopen it twice, so the new service worker bundle is the one running; the build tag at the bottom of the login screen must match the new commit. Use the `ZZ-TEST` event only.

1. **Login, portrait.** Open the app. Title is not under the Dynamic Island; nothing wraps. (F4.1)
2. **Cashier header.** Title and event on one line each; right side shows 🔔 and the user chip only (no 💤 while the screen is held). Tap 🔔: the cashier sound plays. Tap the chip: menu opens with "Signed in as …" and "Sign out"; tap outside: it closes. (F4.6)
3. **Cashier scroll.** On New order scroll the form up and down. Header and tab bar do not move and nothing shows between them. The bottom bar stays at the bottom edge above the home indicator, never mid-screen, never over the fields. (C1.7, C1.9)
4. **Queue tab.** Tap Queue: no bottom bar, content reaches the bottom. Back to New order: draft intact, bar back.
5. **Keyboard.** Focus the client name field. Expected: the keyboard may cover the bar and that is acceptable; no page zoom (C1.5). Tap Done: the bar is visible again. Check the header did not scroll away.
6. **Send.** Pick colour and size, tap "Send to press →", see the toast in the bar.
7. **Landscape.** Rotate. The header, tabs and bottom bar clear the notch side (left or right inset). On a Pro Max the width is over 900 px: you get the wide layout with the send bar inside the card. Rotate back.
8. **Ready alert.** From a Press device take an order of this cashier to ready. The alert covers the whole screen, card centred and compact, title readable. Scroll the page behind it, rotate, focus a field before it arrives: it does not move. Tap anywhere: it closes and the Queue tab opens. (F4.5)
9. **Cancel dialog.** In Queue tap "Cancel order": backdrop covers the whole screen including the header, card centred (max 360 px). Tap outside: nothing cancelled. Open again, "Keep order". (C3)
10. **Wake lock.** If the 💤 button shows, tap it: a toast explains and disappears by itself.
11. **Press.** Log in as Press: same header, queue scrolls, nothing pinned wrongly.
12. **Admin header.** Log in as Admin: Events, Designs, Staff, Stats in one scrollable row under the title; swipe it sideways; the active section is highlighted.
13. **Staff dialog.** Staff, enter the admin PIN, scroll down a long list, "Deactivate" on an active person: the dialog covers the whole screen (not the top half), centred, does not move on scroll. "Cancel" and tap outside both keep the person. (A5.10)
14. **Events dialog.** With another event active, "Set active" on the inactive event: "Switch the active event to …" covers the whole screen. Choose "Keep current". Do not switch the real event during an event. (A3.5)
15. **Overscroll.** On any page drag down at the top of the content: the whole app does not slide.
16. **Android.** Repeat 1 to 6 and 8 to 14 on AN-N and AN-S (Chrome installed app).
17. **Laptop.** At 900 px and up, Cashier and Press look as before except the header (compact buttons, name chip, Sign out in the menu). The send bar is in the card. (F5)
