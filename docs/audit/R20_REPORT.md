# R20: Hyrox black and yellow palette (gdansk-ux-3)

Branch `gdansk-ux-3`, off `main` at 15a3a43 (gdansk-ux-4b merged). Tokens and visual styling only. No schema, RLS, RPC, migration or dependency change. No font file or external asset. Nothing pushed or merged.

## Recon

Written before any other file was edited. Line numbers refer to `main` at 15a3a43. Nothing here was run on a device or in a browser; every statement is from reading code and CSS.

### Colour tokens in `:root` ([index.css:8-75](../../src/index.css#L8-L75))

| Group | Tokens (line) |
|---|---|
| Surfaces | `--surface-page #0b0c0e` (:10), `--surface-card #15171b` (:11), `--surface-raised #1e2127` (:12), `--surface-overlay rgba(11,12,14,.96)` (:13), `--border-subtle #2a2e36` (:14), `--border-strong #3a3f4a` (:15) |
| Text | `--text-primary #f4f5f7` (:18), `--text-secondary #b4bac4` (:19), `--text-muted #7c828e` (:20), `--text-faint #545a64` (:21) |
| Accent (lime) | `--accent #c5ff00` (:24), `--accent-hover #d4ff33` (:25), `--accent-press #aee000` (:26), `--accent-ink #0b0c0e` (:27), `--accent-soft rgba(197,255,0,.14)` (:28) |
| Status | `--status-new-bg #c5ff00` / `-ink #0b0c0e` (:31-32), `--status-progress-bg #f59e0b` / ink (:33-34), `--status-ready-bg #38bdf8` / ink (:35-36), `--status-done-bg #3a3f4a` / `-ink #c7ccd4` (:37-38), `--status-cancelled-bg #3a3f4a` / `-ink #c7ccd4` (:39-40) |
| Semantic | `--danger #ef4444` (:41), `--warn #f59e0b` (:42), `--ok #34d399` (:43) |
| Elevation and focus | `--shadow-card rgba(0,0,0,.45)` (:59), `--shadow-raised rgba(0,0,0,.5)` (:60), `--ring-focus 0 0 0 3px var(--accent-soft)` (:61) |

Not colours, left alone: spacing, radii, motion, `--touch-min` 56 px and `--touch-lg` 72 px ([:46-71](../../src/index.css#L46-L71)).

Problems for the new palette:

- The "new" status fill is the accent itself (`--status-new-bg` = `--accent`, [:31](../../src/index.css#L31)), so with a yellow accent a new order would be yellow. Not allowed (spec: no yellow for any status).
- "In progress" is amber `#f59e0b` ([:33](../../src/index.css#L33)), and `--warn` is the same amber ([:42](../../src/index.css#L42)). Amber sits next to brand yellow, so it has to move away from yellow too.
- The 0.14 alpha `--accent-soft` focus ring ([:61](../../src/index.css#L61)) is hardly visible on near-black with yellow. It needs a stronger ring.

### Hard-coded colours (hex, rgb, rgba, hsl) outside `:root`

`src/index.css`:

- [:13](../../src/index.css#L13) overlay rgba (inside `:root`, listed above).
- [:98-99](../../src/index.css#L98-L99) body background: two radial gradients, `rgba(197,255,0,.05)` lime and `rgba(56,189,248,.04)` sky, `background-attachment: fixed`. Hard-coded lime.
- [:178](../../src/index.css#L178) `.btn-danger { color: #fff }` on `--danger #ef4444` is 3.76:1, below AA for 18 px bold.
- [:269](../../src/index.css#L269) `.top-block` background `color-mix(card 86%, page)`: opaque but derived, no token of its own.
- [:767-768](../../src/index.css#L767-L768) `.toast-error`: `rgba(239,68,68,.12)` background and `#fca5a5` text.
- [:793, :796](../../src/index.css#L793) `@keyframes pulse` lime `rgba(197,255,0,.55)`.
- [:802, :805](../../src/index.css#L802) `@keyframes pulse-danger` `rgba(239,68,68,.55)`.
- [:951](../../src/index.css#L951) select arrow: `stroke='%239a9a9a'` inside a `url("data:image/svg+xml,...")`. CSS variables do not resolve inside `url()`.

`src` (TypeScript):

- [lib/colors.ts:7-11](../../src/lib/colors.ts#L7-L11) `STATUS_COLORS`: five bg/fg pairs as hex strings that "mirror" the `--status-*` tokens by hand. Only consumer: [StatusBadge.tsx:5](../../src/components/StatusBadge.tsx#L5). This is a second copy of the status colours and will drift unless it references the variables.
- [config.ts:7-11](../../src/config.ts#L7-L11) default shirt colours (`#ffffff #111111 #1e2a4a #9aa0a6 #c0392b`), [EventEditor.tsx:144](../../src/components/EventEditor.tsx#L144) default `#808080` for a new colour, [lib/eventOptions.ts:14, :27-34](../../src/lib/eventOptions.ts#L14) `inkFor` returning `#fff` or `#000`. These are product data (the real shirt colours and the ink computed from them), not UI chrome. **Not touched**: they must show the true shirt colour.
- [lib/imageUpload.ts:70](../../src/lib/imageUpload.ts#L70) `ctx.fillStyle = '#fff'`: canvas fill for JPEG export, not UI. Not touched.
- No other hex, rgb, rgba or hsl in any component or page. All other inline styles already use `var(--...)` ([ColorPicker.tsx:32](../../src/components/ColorPicker.tsx#L32), [DesignPicker.tsx:86-132](../../src/components/DesignPicker.tsx#L86), [PinPad.tsx:41-50](../../src/components/PinPad.tsx#L41), [OrderCard.tsx:37-109](../../src/components/OrderCard.tsx#L37), [SoundGate.tsx:21](../../src/components/SoundGate.tsx#L21), [ImageLightbox.tsx:18](../../src/components/ImageLightbox.tsx#L18), AdminDesignsPage, AdminEventsPage, StatsPage). So component work is mostly in `index.css` and `colors.ts`.

Outside `src`:

- [index.html:10](../../index.html#L10) `<meta name="theme-color" content="#0b0c0e">`.
- [vite.config.ts:29-30](../../vite.config.ts#L29-L30) manifest `theme_color` and `background_color`, both `#0b0c0e`.
- Icons are PNG files, not touched.

### What drives the status colours

- Badge: `STATUS_COLORS` in `lib/colors.ts` (hex strings, see above) through `StatusBadge`, `.badge` class ([index.css:634-642](../../src/index.css#L634-L642)).
- Press card edge: [PressPage.tsx:124-128](../../src/pages/PressPage.tsx#L124-L128) uses `var(--danger)` when overdue, else `var(--status-new-bg)` for new and `var(--status-progress-bg)` for in progress. So the edge colour reads the CSS tokens while the badge reads the hex copy.
- Cashier Queue tab badge: `.tab-badge` uses `--status-ready-bg` / `--status-ready-ink` ([index.css:533-542](../../src/index.css#L533-L542)).
- Wait timer: [WaitTimer.tsx:16](../../src/components/WaitTimer.tsx#L16) `--danger` overdue, `--warn` at the warning threshold, `--text-muted` otherwise.
- Offline banner: `.banner-offline` is `--warn` with `--accent-ink` ([index.css:721-724](../../src/index.css#L721-L724)).
- Completed and cancelled share one grey (`#3a3f4a` / `#c7ccd4`, [:37-40](../../src/index.css#L37-L40)); only the label differs.

### Accent users (everything that becomes yellow)

`.btn-primary` ([:157-168](../../src/index.css#L157-L168)), `.btn-secondary` text ([:182-186](../../src/index.css#L182-L186)), `.btn-selected` ring ([:208-210](../../src/index.css#L208-L210)), `.tab-active` ([:465-468](../../src/index.css#L465-L468)), focus ring and input focus border ([:112-116](../../src/index.css#L112-L116), [:238-242](../../src/index.css#L238-L242)), `.toast` ([:752-765](../../src/index.css#L752-L765)), `.alert-card` ([:679-686](../../src/index.css#L679-L686)), `.pulse` ([:823-825](../../src/index.css#L823-L825)), plus inline: [DesignPicker.tsx:116](../../src/components/DesignPicker.tsx#L116) selected ring, [OrderCard.tsx:96](../../src/components/OrderCard.tsx#L96) highlight ring and [:109](../../src/components/OrderCard.tsx#L109) badge, [PinPad.tsx:41-42](../../src/components/PinPad.tsx#L41-L42) filled dots, [AdminEventsPage.tsx:132](../../src/pages/AdminEventsPage.tsx#L132) "Active" badge.

### Focus and disabled states

- Focus: `:focus-visible` removes the outline and draws `--ring-focus` ([:112-116](../../src/index.css#L112-L116)); inputs and selects also get `border-color: var(--accent)` ([:238-242](../../src/index.css#L238-L242)).
- Disabled: `.btn:disabled { opacity: .4 }` ([:152-155](../../src/index.css#L152-L155)); the Replace label in [AdminDesignsPage.tsx:322](../../src/pages/AdminDesignsPage.tsx#L322) uses inline `opacity: .5`. A disabled `.btn-primary` is a 40 % yellow block; on near-black it still reads as a yellow button, only dimmer. Kept (opacity is not a colour value), checked in the acceptance cases.
- Other opacities: Staff inactive row 0.7 ([AdminStaffPage.tsx:239](../../src/pages/AdminStaffPage.tsx#L239)), Designs hidden card 0.6 ([AdminDesignsPage.tsx:255](../../src/pages/AdminDesignsPage.tsx#L255)). Not touched.

### Ready alert

- [AlertOverlay.tsx:13-24](../../src/components/AlertOverlay.tsx#L13-L24): portalled `.overlay` (backdrop `--surface-overlay`, [index.css:660-672](../../src/index.css#L660-L672)) with `.alert-card` ([:679-686](../../src/index.css#L679-L686)) filled with `--accent` and inked `--accent-ink`, class `pulse` (lime box-shadow keyframes, [:790-798](../../src/index.css#L790-L798)), title 44 px / 900 ([:687-693](../../src/index.css#L687-L693)), "Tap to dismiss" in `--text-secondary` (inline, [AlertOverlay.tsx:21](../../src/components/AlertOverlay.tsx#L21)).
- It is the only large flood of accent colour in the app. Yellow with black ink is the brand pairing and is the most visible thing available, so it stays on the accent, but it gets its own tokens (`--alert-bg`, `--alert-ink`) so it can be tuned apart from the buttons. The `pulse` animation is existing behaviour and stays (not an animation change; its colour will follow the accent).

### Dimmed colours in ColorPicker

- [ColorPicker.tsx:31](../../src/components/ColorPicker.tsx#L31) `opacity: dim ? 0.45 : 1`, with the swatch `background: c.hex` and `border: 1px solid var(--border-strong)` ([:32](../../src/components/ColorPicker.tsx#L32)). The swatch is a real shirt colour, so it is not a token. At 0.45 a black swatch (`#111111`) on a near-black card nearly vanishes into the surface; a white swatch becomes grey. With the old bluish card (`#15171b`) the same was true. Plan: keep 0.45 behind one variable `--dim-opacity` (inline `opacity: var(--dim-opacity)` works), make `--border-strong` visible enough on the new surface that a dimmed black swatch keeps a readable outline, and add an acceptance case.

### Select arrow

- [index.css:947-955](../../src/index.css#L947-L955): `appearance: none`, `padding-right: 44px`, SVG chevron in a data URI with a fixed grey stroke `#9a9a9a`.
- Variable-friendly replacement without markup change: draw the arrow with two `linear-gradient` backgrounds (a 45deg and a 135deg half-square, together a small triangle) coloured with `var(--text-secondary)`. Gradients accept variables, so the arrow follows the tokens and no data URI is needed. Select height, padding and 44 px right padding stay.

### Surfaces that need to move to tokens (shared styling)

Headers (`.top-block`, `.topbar`, [:253-290](../../src/index.css#L253-L290)), cards ([:484-496](../../src/index.css#L484-L496)), buttons ([:130-210](../../src/index.css#L130-L210)), inputs, selects and date inputs ([:215-242](../../src/index.css#L215-L242)), tabs and segmented controls (`.tab`, `.topbar-nav`, `.print-mode`, `.cashier-tabs`, [:376-468](../../src/index.css#L376-L468), [:518-542](../../src/index.css#L518-L542)), chips and pills ([:634-655](../../src/index.css#L634-L655)), toasts (`.toast`, `.topbar-toast`, [:360-374](../../src/index.css#L360-L374), [:752-770](../../src/index.css#L752-L770)), user menu ([:336-359](../../src/index.css#L336-L359)), `ConfirmDialog` (uses `.overlay`, `.card`, `.btn`), design cards ([:843-895](../../src/index.css#L843-L895)), staff rows ([:897-928](../../src/index.css#L897-L928)), login tiles (`.btn-lg` in `.name-grid`, [:930-944](../../src/index.css#L930-L944)) and the Ready alert. All of these already read tokens except the items listed above. Touch sizes (`--touch-min` 56, `--touch-lg` 72, 44 px compact controls, 48 px design actions) are not edited.

### Typography today

System stack only: `font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` ([index.css:73](../../src/index.css#L73)). `h2` 20 px / 700 / -0.01em ([:615-619](../../src/index.css#L615-L619)), `.topbar h1` 20 px / 700 ([:275-280](../../src/index.css#L275-L280)), `.label` 11 px / 600 uppercase 0.08em ([:622-629](../../src/index.css#L622-L629)), `.who-heading h2` 30 px ([:937-944](../../src/index.css#L937-L944)), `.alert-title` 900 ([:687-693](../../src/index.css#L687-L693)). No `@font-face` and no external font anywhere; none will be added.

### Plan

1. One token group in `:root`: neutral near-black surfaces (no blue cast), neutral greys for text and borders, `--accent` brand yellow (single value, derived hover, press, soft and ring from it with `color-mix`), `--accent-ink` black. Contrast checked with a script before choosing values (ink on yellow 14:1).
2. Status colours: new = violet, in progress = sky blue, ready = green, completed = grey, cancelled = dark red tint with light red ink. No yellow, no orange-yellow. `--warn` moves from amber to orange. Danger stays red, success green.
3. `lib/colors.ts` points at the CSS variables instead of repeating hex.
4. Replace the remaining literal colours in `index.css` with tokens (toast error, pulses, body gradients removed, danger button ink, select arrow).
5. `theme-color` and manifest colours set to the new page surface.

## What changed

| Area | Change |
|---|---|
| Tokens ([index.css:8-58](../../src/index.css#L8-L58)) | One `:root` group. Surfaces `#0a0a0a` page, `#141414` card, `#1f1f1f` raised, `#101010` bar; borders `#2c2c2c` / `#454545`; text `#f5f5f5`, `#b8b8b8`, `#8c8c8c`, `#7a7a7a`. `--accent: #ffd800` is the only yellow value; hover, press, soft and the focus ring are `color-mix` of it. `--accent-ink` black. `--alert-bg` / `--alert-ink` for the Ready alert. New `--danger-bg`, `--danger-ink`, `--danger-text`, `--danger-soft`, `--dim-opacity`. |
| Status colours | new violet `#a78bfa`, in progress sky `#38bdf8`, ready green `#34d399`, completed grey, cancelled dark red tint with light red ink. No yellow. `--warn` amber to orange `#ff8a3d` (banner, wait timer). Danger stays red, success green. |
| Contrast (computed, WCAG relative luminance) | ink on yellow 14.2:1; primary text on card 16.9:1; secondary 9.3:1; muted 5.5:1 on card and 4.9:1 on raised; faint 4.3:1 on card and 4.6:1 on page (placeholders and the empty state only); status inks 7.3 to 10.3:1; white on danger button 4.8:1 (was 3.8:1); danger text 6.6:1. |
| `lib/colors.ts` | `STATUS_COLORS` returns `var(--status-*)` strings, so the badge and the Press card edge read the same source. |
| Typography | Headings 800 with -0.02em, role title (`.topbar h1`) uppercase, labels 700 with 0.1em, alert title tracking tightened, badge tracking 0.04em. System stack only. Button weight and sizes unchanged. |
| Components | Body glow gradients removed (flat page). Header block opaque `--surface-bar` with a 2 px accent stripe drawn as an outside `box-shadow` (no size change). Danger button, error toast, both pulse keyframes, Ready alert and `.btn-text:hover` use tokens. Select arrow is two gradients in `--text-secondary` instead of the grey SVG. ColorPicker dim uses `--dim-opacity` (still 0.45). |
| Manifest and meta | `theme-color` ([index.html:10](../../index.html#L10)) and manifest `theme_color`, `background_color` ([vite.config.ts:29-30](../../vite.config.ts#L29-L30)) are `#0a0a0a`. Icons untouched. |
| Docs | `12_ACCEPTANCE_TESTS.md` version 10 with section F6 (F6.1 to F6.11), `11_PHASE_GDANSK.md` R20 entry. Build tag verification date corrected from 07.10.2026 to 06.10.2026 in `R11_REPORT.md` (3 places), `R17_REPORT.md` and `11_PHASE_GDANSK.md`. |

Left as is on purpose:

- Shirt colour data ([config.ts:7-11](../../src/config.ts#L7-L11), EventEditor default `#808080`, `inkFor`) and the canvas fill in `imageUpload.ts`: product data, not UI.
- Disabled state (`opacity .4`), inactive Staff row (.7), hidden design card (.6).
- The `pulse` animation on the Ready alert exists already; only its colour follows the accent. No animation, glass or blur was added.
- The version-line date in `12_ACCEPTANCE_TESTS.md` still says 07.10.2026 (unchanged); I did not guess whether it should follow the 06.10 correction.

Side effects to know about:

- "In progress" changes from amber to blue and "Ready" from blue to green, "New" from lime to violet. Cashiers and press staff will see different colours for the same statuses; tell them before the event.
- The cashier "Queue" tab badge (counts Ready) is now green.
- The role title in the header is uppercase, so it is wider; the ellipsis rule already there handles long names.
- Completed and Cancelled are now two different greys/reds instead of one grey.

## Validation

Run on the branch after the last code commit:

```
npx tsc -b                                    # clean
npm run lint                                  # clean
npm run build                                 # ok, PWA 9 precache entries
grep -c "Dev login" dist/assets/*.js          # 0
git --no-pager grep -n -i "service_role" -- src   # empty
scripts/check-*.ts                            # build-id 11, cashier-ui 15, claim-result 12, display-name 7, event-dates 8, merge-orders 5, print-colors 12, send-hint 4: all pass
node scripts/check-sounds.mjs                 # ok
git diff --stat main                          # see the final report
```

## Nothing is verified on a device, the yellow is untuned

I have not opened this on an iPhone, an Android phone or in a desktop browser. Everything above is from reading code and CSS, a contrast calculation and the build and check scripts passing. Contrast numbers are computed, not seen. `#ffd800` is a placeholder: the owner tunes `--accent` in `index.css` (one line) and the derived values follow. Whether the five status colours are distinguishable in sunlight and in a dark hall, whether dimmed black swatches are still visible, and whether the select arrow looks right (gradient triangle, never rendered by me) are device questions.

## Manual steps: iPhone PWA

Deploy first (or run the preview build on the test URL). Delete the home screen icon and add it again, or fully close the app and reopen it twice; the build tag on the login screen must match the new commit. `theme-color` and the manifest colour are cached by iOS at install time, so re-adding the icon is needed to see the black status bar and splash. Use the `ZZ-TEST` event only; do not switch the real active event.

1. Login, Cashier, Press, Admin: black pages, yellow primary buttons with black text, a thin yellow stripe under the header. (F6.1, F6.9)
2. Press with New and In progress orders, Cashier Queue with Ready, Completed, Cancelled: five different colours, none yellow, outside and in a dark room. (F6.2, F6.3)
3. Cashier, Custom print, a design that excludes a colour: that colour is dimmed but tappable, black and white swatches stay readable. (F6.4)
4. Ready alert from a Press device: yellow card, black text, legible at arm's length. (F6.5)
5. Admin Designs "Designs for…" and Staff Role selects: arrow visible. (F6.6)
6. Dialogs and toasts: Deactivate, cancel order, "Sent to press", an error. (F6.10)
7. Compare sizes with the previous build: nothing wraps or shifts. (F6.11)
8. Laptop: tab through controls, yellow focus ring. (F6.7)
