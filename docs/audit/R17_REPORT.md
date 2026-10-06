# R17: wake lock hint on phones (gdansk-ux-1b)

Branch `gdansk-ux-1b`, off `main` at 0b98022. No schema, RLS, RPC, migration or dependency change. Nothing pushed or merged.

## Recon

Written before any other file was edited. Line numbers refer to 0b98022. Nothing here was run on a device or in a browser; every statement is from reading code and CSS.

### Current behaviour

- [TopBar.tsx:54-70](../../src/components/TopBar.tsx#L54-L70): the wake lock button renders for `released` and `unsupported`, only for roles that pass `soundRetry` (Cashier, Press). Content is `<span aria-hidden>💤</span>` plus `<span className="lbl">`, label "Set Auto-Lock to Never" or "Screen may sleep". aria-label and the toast text (`showHint`, [:60-64](../../src/components/TopBar.tsx#L60-L64)) already exist and stay.
- [index.css:304-306](../../src/index.css#L304-L306) `.lbl { display: none }`, shown from 900 px ([:393-395](../../src/index.css#L393-L395)). So on phones the 💤 button is icon only in both states. That is the D1 = A gap: with `unsupported` (no Wake Lock API, the Auto-Lock case) the user sees only an icon and has to tap to learn what to do.

### Width budget (why a plain label would break the header)

- `.topbar` is `flex-wrap: wrap`, padding `var(--sp-4)` per side ([index.css:253-262](../../src/index.css#L253-L262), `--sp-4` = 16 px). Inner width: 328 px at 360, 358 at 390, 398 at 430 (portrait, no side insets).
- `.topbar-title` is `flex: 1 1 0; min-width: 0` ([:271-274](../../src/index.css#L271-L274)): it can shrink to nothing. `.topbar-actions` is `flex-shrink: 0` ([:291-296](../../src/index.css#L291-L296)). Wrapping uses the hypothetical size, so if the actions' content width plus the 12 px gap exceeds the line, the actions drop to a second row. That is the UX-01 failure again.
- Action widths (`.btn-bar`: min 44 px, padding 12 px per side, 1 px border, 16 px font): 🔔 about 46 px; 🔕 (SoundRetryButton, only when audio is locked) about 46 px; user chip about 54 px plus the name, which is capped at 88 px ([:310-314](../../src/index.css#L310-L314)), so up to about 142 px; 8 px gaps.
- A label "Auto-Lock → Never" is roughly 105 px at 16 px. 🔔 + 💤 button (about 54 + 105) + chip 142 + 16 px of gaps is about 363 px, over every width from 360 to 430 once the chip name is long, and the 🔕 case adds 54 px more. An unbounded label does wrap the header.
- Consequence: the label has to be shrinkable (ellipsis), and the actions group must be bounded so its hypothetical width can never push it to a second row.

### Plan

- `unsupported` only: add a second label span, "Auto-Lock → Never", visible under 900 px; the existing long label stays for 900 px and up. `released` keeps the icon-only phone look, the toast and all aria-labels.
- CSS: `.topbar-actions` becomes shrinkable with `max-width: calc(100% - 76px)` (title keeps at least 64 px, so no wrap); the wake button gets `min-width: 48px; overflow: hidden` and its label `min-width: 0` with ellipsis; the chip name gets a small floor and shrinks first (`flex-shrink`), so the hint wins over the person's name. Under 900 px only; the wide layout is unchanged.

### Out of scope

Item 2 of the task (device blocker) was a template placeholder with nothing pasted, so it is not part of this branch. No colours or tokens, admin pages, login, order cards, CSV, stats. No change to `useWakeLock.ts`, audio, PIN flow, polling or queue semantics.

## What changed

| File | Change |
|---|---|
| [TopBar.tsx](../../src/components/TopBar.tsx) | Wake button gets `btn-wake`; for `unsupported` a second label span `lbl-phone` "Auto-Lock → Never". Nothing else (aria-labels, toast text, handlers, `released` look unchanged). |
| [index.css](../../src/index.css) | `.topbar-actions` shrinkable, `max-width: calc(100% - 76px)` under 900 px; `.btn-wake` min 48 px, overflow hidden; `.lbl-phone` 13 px, one line, ellipsis, hidden from 900 px; `.user-chip` shrinks first, name floor 3ch. From 900 px the group is as before. |

Docs: F3 AC2 and F4.6 in `12_ACCEPTANCE_TESTS.md` (version 7), R17 entry in `11_PHASE_GDANSK.md`, the `VERCEL_GIT_COMMIT_SHA` note in `R11_REPORT.md` and `11_PHASE_GDANSK.md` now says verified on production (build tag showed 0b98022 on 07.10.2026).

## Validation

`npx tsc -b`, `npm run lint`, `npm run build` clean; `grep -c "Dev login"` 0; `service_role` grep empty; all `scripts/check-*` pass.

## Not verified on a device

Layout at 360, 390 and 430 px is reasoned from CSS only. The wrap guarantee depends on `max-width` clamping the group; if the label looks too short or the name too squeezed on a real phone, the numbers (76 px, 48 px, 3ch) are the knobs. Test: F3 AC2 and F4.6 on a phone where Wake Lock is unsupported or force `unsupported` in a test build.
