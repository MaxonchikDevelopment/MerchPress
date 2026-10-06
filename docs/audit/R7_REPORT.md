# R7 report: gdansk-fix-4 (narrow-screen layout, print zoom, Send hint)

## Recon
Line numbers are from `main` before the edits.

**Inline `gridTemplateColumns` with `1fr`**
- `src/components/RoleSelect.tsx:103` `'1fr'`, `:121` `'1fr 1fr'`
- `src/components/PinPad.tsx:55` `repeat(3, 1fr)`
- `src/pages/AdminEventsPage.tsx:71` `'1fr'` (the create form, holds the date input at `:61`)
- `src/pages/AdminStaffPage.tsx:112` `'1fr'`
- `src/pages/CashierPage.tsx:134`, `:143` `'1fr'`
- Left alone, because the minimum is already a fixed length: `auto-fill, minmax(Npx, 1fr)` in `DesignPicker.tsx:25`, `StatsPage.tsx:125,137`, `AdminDesignsPage.tsx:123`, `PressPage.tsx:117`.
- `src/components/EventEditor.tsx` has no inline grid. Its date input is at `:92`, inside a parent grid from a shared class.

**`.grid`** (`src/index.css:318-321`) was `display: grid; gap` only, so items had `min-width: auto`. `.two-col` (`:324-329`) used `grid-template-columns: 1fr` below 900px. Inputs (`:209-221`) had no date-specific rule.

**OrderCard thumbnails** (`src/components/OrderCard.tsx:12-52`): `DesignThumb` renders a plain 84x84 `<img>` (`:20-26`), or a non-interactive initials tile when the photo is missing or failed (`:27-46`). No handler of any kind. `OrderCard` is shared by Press and Cashier.

**Send disabled state** (`src/pages/CashierPage.tsx:185-201`): `color` and `size` are null unless the picked value is valid for the event; `canSubmit = color && size && !busy`; the button has `disabled={!canSubmit}` (`:293`). No explanation was shown.

## Changes
1. `fix(layout)`: `.grid > * { min-width: 0 }`; `minmax(0, 1fr)` on the inline and `.two-col` columns listed above; `input[type='date']` gets `min-width: 0; max-width: 100%; appearance: none`. Font size (16px) and height are unchanged (they come from the shared `input` rule).
2. `feat(orders)`: `ImageLightbox` (portal to `document.body`, `zIndex: 90`, existing `--surface-overlay`, `object-fit: contain`, "Close" button, tap anywhere closes). The thumbnail is wrapped in a button that calls `stopPropagation`. The Ready alert and confirm dialogs use `zIndex: 100`, so they sit above the lightbox. Tiles without a photo are unchanged.
3. `feat(cashier)`: `src/lib/sendHint.ts`; hint shown only when not busy and something is missing.

## Check script
`node scripts/check-send-hint.ts`
```
ok - color missing
ok - size missing
ok - both missing
ok - none missing
4 checks passed
```

## Validation
`npx tsc -b`, `npm run lint` and `npm run build` pass. `grep -c "Dev login" dist/assets/*.js` gives 0. `git grep -i service_role -- src` is empty.

## Not verified
The layout fix and the lightbox are **not verified on a device** (no iPhone or iPad test, no browser run). The date-input cause is a code-review hypothesis; `appearance: none` also changes how iOS draws the date field, so check it looks right. Check that an alert arriving while the lightbox is open appears on top.
