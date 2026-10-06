# R28: active-state contrast, event sizes, Press busy (gdansk-ux-10)

Branch `gdansk-ux-10`, off `main` at c2848ef. `git log main` contains `Merge gdansk-rel-1: version label and safe auto-update` (024d50b). No schema, RLS, RPC, migration or dependency change. `package.json` and `package-lock.json` untouched. Nothing pushed or merged.

## Recon

Written before any other file was edited. Line numbers are for c2848ef. Everything here is from reading code; nothing was run on a device or in a browser.

### 1. Tab and segment colour bug

Rules that set `color` or `background` on the affected classes ([src/index.css](../../src/index.css)):

| Class | Rule | Line | Specificity | Sets |
|---|---|---|---|---|
| `.tab` | base | 484-495 | 0,1,0 | `background: transparent`, `color: var(--text-secondary)` |
| `.tab:hover` | hover | 496-498 | 0,2,0 | `color: var(--text-primary)` |
| `.tab-active` | active | 499-502 | 0,1,0 | `background: var(--accent)`, `color: var(--accent-ink)` |
| `.topbar-nav .tab` | layout only | 426, 444 | 0,2,0 | no colour |
| `.print-mode .tab` | layout only | 478 | 0,2,0 | no colour |
| `.cashier-tabs .tab` | layout only | 559 | 0,2,0 | no colour |

**Which override caused the bug:** `.tab:hover` (0,2,0) at line 496 beats `.tab-active` (0,1,0) at line 499 whatever the source order, so any hovered tab gets `--text-primary` (near white) even when it also carries `.tab-active` (yellow background). Touch browsers keep `:hover` on the last tapped element, so the tab just tapped (white text on yellow) stays wrong until the hover moves. The same stuck hover has a second symptom: an inactive tab that was tapped earlier keeps `--text-primary` instead of `--text-secondary` until another element is tapped. No other rule (focus, active, `.topbar-nav .tab`, `.print-mode .tab`, `.cashier-tabs .tab`) sets a colour on `.tab`. `.tab-active` is applied in [AdminPage.tsx:36](../../src/pages/AdminPage.tsx#L36), [CashierPage.tsx:153](../../src/pages/CashierPage.tsx#L153), [:161](../../src/pages/CashierPage.tsx#L161) and the Bundle / Custom print switch [:423](../../src/pages/CashierPage.tsx#L423).

Audit of every control that paints text on a yellow (`--accent`) surface:

| Control | Rules (file:line) | Hover / focus / active override of colour? | Verdict |
|---|---|---|---|
| `.tab-active` (Queue, New order, Bundle, Custom print, Admin tabs) | index.css:496, 499 | yes, `.tab:hover` colour (above) | **bug** |
| `.btn-primary` | 170-174; hover 175-178; active 179-181 | no colour override. Hover and active change the background only, but `:hover` is sticky on touch, so the lighter `--accent-hover` stays after a tap | text safe; hover background should be gated by `(hover: hover)` |
| `.btn-primary.btn-selected` (SizePicker, EventEditor sizes) | 170, 232 | none | OK |
| `.compat-cell[aria-pressed='true']` | 1227-1243 base, 1244-1248 ticked, 1249 active | none (only `transform` on `:active`, no hover rule) | OK |
| `.orders-chip-active` (Admin Orders filter) | 1270-1280 base, 1281-1285 active | none, no hover rule | OK |
| `.tab-badge` | 567-576 | none; it is green (`--status-ready-bg` / `--status-ready-ink`), not yellow | OK |
| Compatibility `.compat-link` | 1220-1226 | `--accent` text on transparent (dark), not text on yellow | OK |
| Global `:focus-visible` | 125-129 | box-shadow ring only, no colour | OK |
| Bundle / Custom print switch | uses `.tab` / `.tab-active` ([CashierPage.tsx:423](../../src/pages/CashierPage.tsx#L423)) | same bug as tabs | **bug** (fixed with the tab rule) |

The only other `:hover` rules in the file are lines 175, 211 (`.btn-text`, red text on transparent) and 221 (`.btn-danger-outline`); neither paints on yellow.

### 2. Events form sizes picker

- Create form: [AdminEventsPage.tsx:79-122](../../src/pages/AdminEventsPage.tsx#L79-L122). It has name, location, start and end date only. `createEvent` ([useEvents.ts:27-37](../../src/hooks/useEvents.ts#L27-L37)) inserts `name, location, event_date, event_end_date`, so a new event gets `shirt_sizes = null` (app defaults, all six).
- Edit flow exists: the Edit button opens [EventEditor.tsx](../../src/components/EventEditor.tsx), which already has a Sizes picker ([:149-166](../../src/components/EventEditor.tsx#L149-L166)), a "Keep at least one size." check ([:55](../../src/components/EventEditor.tsx#L55)) and stores `null` when all six are chosen ([:63](../../src/components/EventEditor.tsx#L63)). So the edit side needs no change; only the create form needs the picker, plus `createEvent` must take sizes.
- `SHIRT_SIZES` ([config.ts](../../src/config.ts)) is the app default and stays unchanged. The create form pre-checks S, M, L, XL.
- Decision for create: always store the explicit array chosen (S, M, L, XL by default). Storing `null` when all six are checked matches the editor, so future default changes still apply.

### 3. Press busy

- [PressPage.tsx:25](../../src/pages/PressPage.tsx#L25) keeps `busyIds`; `setStatus` ([:85-112](../../src/pages/PressPage.tsx#L85-L112)) adds the order id before `claimOrder` / `setOrderStatus` and removes it on every exit path. That is the claim / status-change in-flight state.
- The registry is [appBusy.ts](../../src/lib/appBusy.ts); `BusyReason` is a closed union (`draft | sending | alert | confirm | pin`). `'sending'` is the Cashier's reason; reusing it on Press would blur the meaning, so add one reason, `'status'`, to the union. [updatePolicy.ts](../../src/lib/updatePolicy.ts) takes `readonly string[]` and is not touched.
- Hook: `useBusy('status', busyIds.length > 0)` in PressPage, placed above the early return for no active event. Nothing else on Press registers a reason (cancel goes through `ConfirmDialog`, which already registers `'confirm'`).

### 4. Compatibility "Clear"

- [AdminCompatPage.tsx](../../src/pages/AdminCompatPage.tsx): rows render a ticked list from `tickedKeys(stored(d), keys)`; a stored empty list means "all ticked", so "no ticks" cannot be written (`toggleKey` blocks the last untick).
- A pending state fits in the page without touching [compatMatrix.ts](../../src/lib/compatMatrix.ts): a local `Set` of pending design ids. A pending row renders no ticks and the hint "Pick at least one colour"; the first tick on it saves `toStored([key], keys)` through the existing `save`, then clears pending. Leaving the page unmounts the component, which drops the state. Estimated about 25 lines, so it will be done.
- Edge: `tickKey` / `toggleKey` read `stored(d)`; for a pending row the click handler must bypass them and call `toStored([key], keys)` directly. `onAll` on a pending row must clear pending and save `tickAll()`.

## Changes

1. **Contrast** ([index.css](../../src/index.css)): `.tab:not(.tab-active):hover` is inside `@media (hover: hover)`; `.tab-active` plus `:hover`, `:focus-visible`, `:active` keep `--accent` and `--accent-ink`. Same four-state guard on ticked `.compat-cell` and `.orders-chip-active`. `.btn-primary` hover is inside `(hover: hover)` and both hover and active repeat `color: var(--accent-ink)`. Tokens only, no palette value touched.
2. **Events create form** ([AdminEventsPage.tsx](../../src/pages/AdminEventsPage.tsx), [useEvents.ts](../../src/hooks/useEvents.ts)): sizes picker, S, M, L, XL pre-checked, at least one required (button disabled otherwise), all six stores `null` like the editor. The picker uses the same toggle buttons (`aria-pressed`) as the existing Edit flow rather than native checkboxes, so both screens look and behave alike. The Edit flow already had a sizes picker; unchanged.
3. **Press busy**: `'status'` added to `BusyReason` ([appBusy.ts](../../src/lib/appBusy.ts)); `useBusy('status', busyIds.length > 0)` in [PressPage.tsx](../../src/pages/PressPage.tsx). `updatePolicy.ts` untouched. `scripts/check-update-policy.ts` loop now includes `'status'`.
4. **Clear** ([AdminCompatPage.tsx](../../src/pages/AdminCompatPage.tsx)), done, about 25 lines, `compatMatrix.ts` untouched: local `pending` ids, reset on event change and on unmount; first tick saves `toStored([key], keys)`; "All" clears pending.

## Validation

`npx tsc -b` clean, `npm run lint` clean, `npm run build` ok, `grep -c "Dev login" dist/assets/*.js` 0 in both files, `service_role` grep in `src` empty, every `scripts/check-*.ts` and `node scripts/check-sounds.mjs` pass (`check-update-policy` 25 checks).

## Manual steps on an iPhone PWA

**Nothing here is verified on a device.** The CSS fix is reasoned from specificity and the `(hover: hover)` media feature, not observed.

1. Cashier: tap Queue, New order, Queue again. The tapped tab's text stays black on yellow right after the tap and after tapping elsewhere; the other tab stays grey.
2. New order: tap Bundle, Custom print, Bundle. Same.
3. Admin: tap every tab, same check. On Orders tap each filter chip; the active chip stays black on yellow.
4. Compatibility: tick and untick cells; a ticked cell keeps a black ✓. Tap "Clear" on a row: no ticks, hint "Pick at least one colour", reload the page and the row is back as saved. Tick one cell: only that colour saved.
5. Events, New event: S, M, L, XL are yellow, XS and XXL not. Create, open Edit, same four. Untick all: Create is disabled.
6. Press: with a New order, tap Claim and deploy at the same moment (or throttle the network). The update banner shows instead of a reload until the call returns.
