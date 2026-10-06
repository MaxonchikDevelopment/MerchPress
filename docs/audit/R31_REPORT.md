# R31: second batch of UI fixes from the R29 audit (gdansk-fix-ui-2a)

Branch `gdansk-fix-ui-2a`, off `main` at 8e703d6 (v1.3). `git merge-base --is-ancestor gdansk-fix-ui-1 main` succeeds and `main` contains `Merge gdansk-fix-ui-1: sticky hover, toast region, tiles, labels, PIN name` (d72009b). The audit `docs/audit/R29_REPORT.md` lives on `gdansk-audit-1`; it was read with `git show` and is not merged or copied. CSS and markup only. No schema, RLS, RPC, migration or dependency change. Nothing pushed or merged.

## Recon

Written before any other file was edited. Line numbers are for 8e703d6. Everything here is from reading code; nothing was run on a device or in a browser.

| ID | Verdict | Where | Go / stop |
|---|---|---|---|
| A-08 | **Confirmed.** The whole button gets `opacity: var(--dim-opacity)` (0.45) through an inline style. `--dim-opacity` is read only there; nothing else in `src` uses it. | [ColorPicker.tsx:31](../../src/components/ColorPicker.tsx#L31), token [index.css:57](../../src/index.css#L57). Hint text [CashierPage.tsx:465-469](../../src/pages/CashierPage.tsx#L465-L469) | **GO.** New class `.swatch` plus modifier `.swatch-dim` (dashed `var(--warn)` border, `::after` hatch with `pointer-events: none`, label above the hatch), remove the inline `opacity`, `aria-label` "<label>, not recommended for this print" on dimmed swatches, hint text "Hatched colors are not recommended for this print (still allowed)". `--dim-opacity` and its comment are removed (no other reader). The tooltip (`title`) stays. `printColors`, `dimmed` and `visible` are not touched. |
| A-09 | **Confirmed, with a correction for Admin.** The selected state is `.btn-selected` (4 px ring, [index.css:251-253](../../src/index.css#L251-L253)), no check mark. The edge is `1px solid var(--border-strong)` inline. Admin Designs has **its own markup**, `ColorToggles` ([AdminDesignsPage.tsx:138-168](../../src/pages/AdminDesignsPage.tsx#L138-L168)), not `ColorPicker`. `.btn-selected` is also used by `SizePicker`, `EventEditor` and `AdminEventsPage` (all `btn-primary btn-selected`), so it must not change. The orphan chip (a stored key the palette no longer has, [:162](../../src/pages/AdminDesignsPage.tsx#L162)) is a plain `.btn-selected` without a face colour. | as listed | **GO.** New `--swatch-edge: #707070` in `:root` (added, nothing existing changed). `.swatch` sets the edge and `.swatch-selected` sets the offset ring; both `ColorPicker` and `ColorToggles` use them instead of `btn-selected`. "✓ " prefix on selected labels. The orphan chip keeps `btn-selected` (it has no swatch face, the old ring still reads) and gets no check; left as is. |
| A-13 + D25 C | **Confirmed.** Cashier Ready card: "✓ Picked up" then a full-width `btn btn-danger-outline` "Cancel order" ([CashierPage.tsx:192-199](../../src/pages/CashierPage.tsx#L192-L199)). Admin Orders: the same pair, but "Cancel order" is outside the `status === 'ready'` block ([AdminOrdersPage.tsx:75-82](../../src/pages/AdminOrdersPage.tsx#L75-L82)), shared by every status. | as listed | **GO** for both. Label `✓ Picked up #{o.event_order_no}` (the `Confirming…` branch is unchanged). On Admin the compact class has to be conditional (`o.status === 'ready' ? 'btn btn-danger-outline btn-compact' : 'btn btn-danger-outline'`), a className expression only, so non-ready cards stay exactly as now. Cashier In progress card (:208) is untouched. `complete()`, `pickedUp()` and `askCancel()` are not touched. `btn-compact`: `align-self: flex-end`, normal width, `margin-top`, min-height 44 px. Need to check how `OrderCard` lays out its children (flex or grid) for `align-self`. No check script asserts the old label (grep for "Picked up" in `scripts/` is empty). |
| A-14 | **Confirmed.** `className="btn btn-secondary btn-reset"`, 72 px, yellow text ([CashierPage.tsx:399](../../src/pages/CashierPage.tsx#L399), [index.css:627-631](../../src/index.css#L627-L631)). | as listed | **GO.** Class becomes `btn btn-reset` (markup only, `disabled` and `onClick` unchanged); `.send-row .btn-reset` gets `min-height: var(--touch-min)` (56 px), `color: var(--text-secondary)`. The row is `display: flex` with default `align-items: stretch`, so Reset would stretch to Send's 72 px. A CSS `align-self: center` keeps it at 56 px. |
| A-15 | **Confirmed.** `.update-banner` is fixed at `safe-area + 8px`, centred, `--accent-soft` (translucent) ([index.css:1352-1367](../../src/index.css#L1352-L1367)). Padding 8 px and a 16 px inherited font give about 37 px. | as listed | **GO, CSS only.** Background `var(--surface-raised)`, accent border kept, `color: var(--accent)` kept (yellow on `#1f1f1f` is far above 4.5:1), `min-height: 44px`, flex-centred text. Placement is not changed (owner decision). `UpdateBanner.tsx` and `appUpdate` untouched. See "Header coverage" below. |

Items checked and **not** touched: `useOrders`, `mergeOrders`, alert dedupe, update policy, audio, wake lock, PIN logic, order numbering, `create_order_v2`, `printColors`, existing `:root` values, bodies and conditions of `complete()`, `askCancel()`, `clearDraft()`, `canSubmit`, `submit()`.

No item needs logic. No stops.

## Changes

Three code commits and this docs commit on `gdansk-fix-ui-2a`:

1. `fix(ui)` color swatches ([ColorPicker.tsx](../../src/components/ColorPicker.tsx), [AdminDesignsPage.tsx](../../src/pages/AdminDesignsPage.tsx), [CashierPage.tsx](../../src/pages/CashierPage.tsx), [index.css](../../src/index.css)): A-08, A-09.
   - New token `--swatch-edge: #707070`; `--dim-opacity` removed (nothing else read it).
   - `.swatch` (edge, 96 × 56 minimum), `.swatch-selected` (offset ring `0 0 0 3px var(--surface-card), 0 0 0 6px var(--accent)`), `.swatch-dim` (2 px dashed `var(--warn)` border plus an `::after` hatch, `pointer-events: none`).
   - The hatch is `repeating-linear-gradient(135deg, ...)` in the label's own colour at 30 %, so it never adds a contrast the label does not already have. It is drawn above the label (it is a later positioned child) as thin 2 px lines every 8 px; whether the label stays easy to read on Gray and Red is a device check.
   - Selected labels get "✓ "; dimmed swatches get `aria-label="<label>, not recommended for this print"`; the `title` tooltip stays. Hint now reads "Hatched colors are not recommended for this print (still allowed)".
   - Admin Designs `ColorToggles` uses the same classes (own markup, not `ColorPicker`). Side effect: its buttons now get the 96 px minimum width. The orphan chip (a stored key the palette lacks) keeps `btn-selected` and gets no check. `.btn-selected` is unchanged, `SizePicker` and the event editors still use it.
2. `fix(ui)` Picked up label and compact Cancel ([CashierPage.tsx](../../src/pages/CashierPage.tsx), [AdminOrdersPage.tsx](../../src/pages/AdminOrdersPage.tsx), [index.css](../../src/index.css)): A-13, D25 C.
   - Label is `✓ Picked up #<event_order_no>` on Cashier Ready cards and on Admin ready cards; `Confirming…` unchanged.
   - `.btn-compact` (`align-self: flex-end`, 44 px minimum, `margin-top: var(--sp-3)`, 16 px text) on `Cancel order` of Ready cards only, still `btn-danger-outline`. On Admin the class is chosen by `o.status === 'ready'`; the other statuses and the Cashier In progress card keep the old full-width button. No check script asserted the old label, so no script changed.
3. `fix(ui)` Reset and update banner ([CashierPage.tsx](../../src/pages/CashierPage.tsx), [index.css](../../src/index.css)): A-14, A-15.
   - Reset: class `btn btn-secondary btn-reset` becomes `btn btn-reset`; 56 px (`--touch-min`), `align-self: center` (otherwise the flex row stretches it to 72 px), text `--text-secondary`. `disabled` and `onClick={clearDraft}` unchanged. Send keeps `--touch-lg`.
   - Banner: `background: var(--surface-raised)`, accent border and `color: var(--accent)` kept, `min-height: 44px`, flex-centred. Position, `UpdateBanner.tsx` and `appUpdate` unchanged.
4. `docs` this report, `12_ACCEPTANCE_TESTS.md` (version 19) and `11_PHASE_GDANSK.md`.

## Header coverage of the update banner (A-15)

Placement is unchanged by owner decision, so the banner still sits on the header row. Estimate from CSS, **not measured**: the text is about 32 characters in bold 16 px, so the banner is about 285 px wide (padding and border included) and 44 px tall, centred, from `safe-area + 8 px`, which is the same band as the 44 px header controls (header padding is 8 px).

| Width | Banner spans (about) | Header controls it covers |
|---|---|---|
| 360 px | x 38 to 322 | The role title and event name, 🔔 Test sound, the 💤 chip when present, and most of the user chip. Only a few px at the right edge stay visible. |
| 390 px | x 53 to 337 | Same set. About 37 px at the right edge stay free. |
| 430 px | x 73 to 357 | Title, 🔔, 💤 and the left part of the user chip. About 57 px at the right edge (the end of the user chip) stay free. |

Before this change the same area was covered too, but through a translucent fill; now the fill is opaque, so the covered controls are **hidden, not just hard to read**, and tapping there hits the banner, which reloads. The Cashier tab bar and everything below the header row stay uncovered. The audit's proposal to move the banner below the header would remove this; that is a placement change and stays out of this round.

## Validation

`npx tsc -b` clean, `npm run lint` clean, `npm run build` ok, `grep -c "Dev login" dist/assets/*.js` 0 in both files, `git --no-pager grep -n -i "service_role" -- src` empty, all 20 `scripts/check-*.ts` and `node scripts/check-sounds.mjs` pass. `package.json` and `package-lock.json` are not in the diff; no migration or SQL file changed.

## Manual steps on an iPhone PWA

**Nothing here is verified on a device or in a browser.** All of it is reasoned from CSS and markup.

Use the `ZZ-TEST` event only (do not activate another event, do not touch real orders).

1. Cashier, New order, Custom print. Pick two designs with a restricted `compatible_colors` so at least one colour is advised against. Look at a hatched swatch next to a normal one:
   - dashed orange border, hatch visible, face and label as strong as the neighbour;
   - the label is still easy to read on Gray, Red, Navy and Black;
   - the hint under the row says "Hatched colors are not recommended for this print (still allowed)", and the swatch is still tappable;
   - with VoiceOver on, the swatch is read as "<colour>, not recommended for this print".
2. Selected colour: tap a normal colour. The label shows "✓ ", the ring has a dark gap between the face and the yellow ring and does not merge with the face. Add a yellow shirt colour to `ZZ-TEST` (Events, Edit) first, select it and check the ring is clearly visible; restore the colour list afterwards. Dark swatches (Black, Navy) have a visible grey edge. Select a hatched colour: ring, check and hatch together still read.
3. Admin Designs, edit a design: colour buttons have the same edge, check and ring; tapping toggles; the orphan chip (if any) looks as before.
4. Cashier, Queue, with two Ready orders (create two on `ZZ-TEST` and mark them Ready from Press): each green button reads "✓ Picked up #<its own number>". "Cancel order" under each is a compact red-outline button on the right, with more space above it than before, at least 44 px high, not full width. Tap it, choose "Keep order": nothing changes. An In progress card's Cancel button is still full width. Do not tap Picked up on a real order.
5. Admin, Orders: a Ready card shows the same label and compact Cancel; a New or In progress card has the full-width Cancel and no Picked up.
6. Cashier, New order, with a draft: at 360 px and at 390 px wide, Reset sits left of "Send to press →", is visibly shorter (56 px) than Send (72 px), vertically centred next to it, with grey text, no yellow. Disabled when empty, enabled with a draft, Reset still clears the draft without a dialog.
7. Update banner: only visible after a real deploy while the app is busy (see F1.6). If a deploy is not possible do not force one; do not push `main` during an event. If it can be triggered on a test build: the banner is a solid dark pill with a yellow border, readable text, at least 44 px tall, and hides the header controls listed above while it is up; tapping it reloads.
