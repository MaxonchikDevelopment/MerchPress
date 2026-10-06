# R19: staff row buttons (gdansk-ux-4b)

Branch `gdansk-ux-4b`, off `main` at 3928583 (gdansk-ux-4 merged). No schema, RLS, RPC, migration or dependency change. Nothing pushed or merged.

## Recon

Written before any other file was edited. Nothing here was run on a device or in a browser; every statement is from reading code and CSS.

### Row layout

- [AdminStaffPage.tsx:240](../../src/pages/AdminStaffPage.tsx#L240) the `PersonRow` header is one `.row` holding name, role pill, optional Inactive and You pills, a `.spacer`, and in `view` mode the three actions ([:246-262](../../src/pages/AdminStaffPage.tsx#L246-L262)). `.row` is `display: flex; flex-wrap: wrap; gap: 12px` ([index.css:602-607](../../src/index.css#L602-L607)).
- The name div ([:241](../../src/pages/AdminStaffPage.tsx#L241)) has no `min-width: 0`, no ellipsis, no `nowrap`. Name, pills and three buttons share one wrapping line, so where the break falls depends on name length. That is the reported "long name two lines, short name one line". **Confirmed.**
- The actions are plain `.btn`: `min-height: var(--touch-min)` (56 px), `padding: 0 20px`, 18 px bold ([index.css:130-148](../../src/index.css#L130-L148)). Widths follow the label ("Edit", "Set PIN", "Deactivate"), so they are unequal as well.
- Edit form ([:271-276](../../src/pages/AdminStaffPage.tsx#L271-L276)) and Set PIN form ([:291-296](../../src/pages/AdminStaffPage.tsx#L291-L296)): a wrapping `.row` with a primary `.btn` and a plain `.btn`, same 56 px size, content-width.
- Deactivate is `disabled` for yourself while active ([:253](../../src/pages/AdminStaffPage.tsx#L253)); it stays in the row, so equal-width flex must keep a disabled button in place.

### Inactive block

- The Activate button is not a separate component: inactive people render through the same `renderPerson` / `PersonRow` ([:107-121](../../src/pages/AdminStaffPage.tsx#L107-L121), [:139-144](../../src/pages/AdminStaffPage.tsx#L139-L144)). Changing `PersonRow` covers it.
- "Add person" submit is a bare `.btn .btn-primary` in a `.grid` ([:203](../../src/pages/AdminStaffPage.tsx#L203)), so it is full width already and is left alone.

### CSS available

- No `.btn-row` or `.btn-compact`. Closest precedent: `.design-actions` ([index.css:886-896](../../src/index.css#L886-L896)), three equal buttons from gdansk-ux-4. A new generic pair is cleaner than reusing a designs-named class.
- The `@media (min-width: 900px)` blocks do not touch `.row` or `.btn`, so the one-row layout needs no breakpoint rule; `nowrap` plus `flex: 1 1 0` holds at any width.
- Risk: three labels at 15-16 px bold in a 390 px phone card (about 310 px inner, 2 gaps of 12 px, about 95 px per button). "Deactivate" at 15 px bold is about 80 px, so it fits with small horizontal padding. Buttons need `min-width: 0` and tight padding so a narrow screen never overflows.

### Plan

- `.btn-row`: `display: flex; flex-wrap: nowrap; gap`. `.btn-compact`: `min-height: 44px; font-size: 15px; padding: 0 var(--sp-2); flex: 1 1 0; min-width: 0`.
- Title line: name (ellipsis, `min-width: 0`) plus pills, nowrap; buttons in a `.btn-row` below, in view, edit and pin modes.
