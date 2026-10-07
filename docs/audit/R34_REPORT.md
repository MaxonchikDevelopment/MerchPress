# R34: owner feedback from the 07.10 device test (gdansk-fix-feedback-1)

Branch `gdansk-fix-feedback-1`, off `main` at 4eb261e (v1.5). `git log main` contains `Merge gdansk-fix-ui-2b: loading and error states, offline banner grace` (cda0948). CSS and markup only. Nothing in this report was run on a device.

## Recon

Written before any other file was edited. Line numbers are for 4eb261e. Everything here is from reading code.

| # | Verdict | Where | Go / stop |
|---|---|---|---|
| 1 | **Confirmed.** `OrderCard` already resolves the name for `in_progress` and `ready` when `showClaimedBy` is set and renders "Claimed by <name>", fallback "Claimed" when `claimed_by` is set but the name is unknown. Only the Cashier In progress list passes the prop (CashierPage.tsx:216); the Ready list does not. Admin Orders (AdminOrdersPage.tsx:74) and Press (PressPage.tsx:162) pass it already. No script under `scripts/` asserts "Claimed by" or "Sold by". | [OrderCard.tsx:94](../../src/components/OrderCard.tsx#L94), [OrderCard.tsx:133-139](../../src/components/OrderCard.tsx#L133-L139), [CashierPage.tsx](../../src/pages/CashierPage.tsx) Ready list | **Go.** Markup: label by `order.status`, prop on the Ready cards. The label expression is markup, not logic. |
| 2 | **Confirmed.** In edit mode `ColorToggles` and the Save / Cancel `.row` are siblings with the default gap; Save and Cancel are the same `.btn` height as the swatches and sit in the same wrapping row style. No label, no divider. | [AdminDesignsPage.tsx:282-296](../../src/pages/AdminDesignsPage.tsx#L282-L296) | **Go.** `SectionLabel` (already imported), new `.design-edit-actions` in index.css. |
| 3 | **Confirmed.** `PhotoReplace` renders only under `!editing`; the spinner line is `working && !editing`. `replacePhoto` is untouched and saves immediately. Labels are "Replace front" / "Replace back". One interaction to note: `replacePhoto` calls `onChanged()` which reloads designs, and `DesignCard` is keyed by `d.id`, so the card keeps its `editing`, `name` and `colors` state across the reload and an unsaved name edit survives a photo replace. Verified by reading, not run. | [AdminDesignsPage.tsx:274-276](../../src/pages/AdminDesignsPage.tsx#L274-L276), [:313](../../src/pages/AdminDesignsPage.tsx#L313) | **Go.** Markup only. |
| 4 | **Confirmed.** One user-facing occurrence in src. The only other hit is `docs/audit/R1_REPORT.md:20`, a historical record of the R1 state; left as is (not user-facing text). | [AdminDesignsPage.tsx:98](../../src/pages/AdminDesignsPage.tsx#L98) | **Go.** |
| 5 | **Corrected in one detail, otherwise confirmed.** `AdminCompatPage` takes no props, owns its event selector, fetch (`useDesigns`), optimistic state and its `compat-toast` (sticky to the bottom of the `.content` scroller, which is the same scroller the Designs tab uses). It can be rendered as is. Correction: `.cashier-tabs` is `display: none` from 900 px up (it is a narrow-screen-only strip), so reusing it verbatim would hide the sub-tabs on a laptop, where the admin works. Plan: a new `.admin-subtabs` class that copies the `.cashier-tabs` layout without the 900 px hide and gives `.tab` a 56 px height; `.tab` / `.tab-active` styles reused as is. Also: `AdminPage` wraps the page in `key={tab}`, so removing 'compat' needs no other change; the default tab logic (`activeEvent ? 'designs' : 'events'`) is unaffected. Switching sub-tabs uses conditional rendering, so Compatibility unmounts and refetches. | [AdminPage.tsx:12-22](../../src/pages/AdminPage.tsx#L12-L22), [:52](../../src/pages/AdminPage.tsx#L52), [AdminCompatPage.tsx:19](../../src/pages/AdminCompatPage.tsx#L19), [index.css:618-640](../../src/index.css#L618-L640) | **Go.** Sub-tab state lives in a small new wrapper (`useState`) in AdminDesignsPage; the existing page body moves into an unchanged `CatalogView`. No handler or data loading changes. |

### Docs affected
- `12_ACCEPTANCE_TESTS.md`: AC5 (A7), AC10 / C3.12 (Cashier, "Claimed by" on Ready), AC8 and A4.13, A4.19, A4.21, F6.12 (tab path "Admin → Compatibility"), plus the version line.
- `11_PHASE_GDANSK.md`: new R34 row.

## What changed

Four commits on `gdansk-fix-feedback-1`.

1. `feat(ui): Printed by on ready cards`: [OrderCard.tsx](../../src/components/OrderCard.tsx) picks the label from `order.status` ("Printed" for ready, "Claimed" otherwise) for both the named line and the unnamed fallback; [CashierPage.tsx](../../src/pages/CashierPage.tsx) passes `showClaimedBy` to the Ready list. The Sold by line is unchanged. No script asserted the old wording, so no script changed.
2. `fix(ui): design edit mode actions, photo replace and placeholder`: [AdminDesignsPage.tsx](../../src/pages/AdminDesignsPage.tsx) edit mode gets the "Compatible colors" `SectionLabel`, a `.design-edit-actions` row (two equal columns, 56 px, top border and spacing; Save `btn-primary`, Cancel plain `btn`); `PhotoReplace` renders in both modes with the labels "Replace front photo" / "Replace back photo"; the working line shows in edit mode; placeholder "e.g. City Map".
3. `feat(admin): Compatibility inside Designs`: the old page body is now `DesignsCatalog` (unchanged); `AdminDesignsPage` is a thin wrapper with the Catalog / Compatibility `tablist`. `AdminPage` loses `compat` from `Tab`, `TAB_LABELS`, `TABS` and the render line. New `.admin-subtabs` CSS.
4. Docs: this report, `12_ACCEPTANCE_TESTS.md` (version 21, AC0, AC5, AC8, AC10, AC1 and the cases that named the Compatibility tab; new A4.22-A4.25, C3.19), `11_PHASE_GDANSK.md` row.

Untouched as required: `useOrders`, `mergeOrders`, `useStaffName`, `useDesigns`, the compat matrix logic, `uploadDesignPhoto`, `replacePhoto`, `saveEdit`, `remove`, update policy, audio, wake lock, PIN flow, order creation. `package.json` and the lockfile are unchanged. No real data touched, `activate_event` not called.

## Deviations and notes

- Item 5 reuses `.tab` / `.tab-active` and the `.cashier-tabs` layout, but through a new `.admin-subtabs` class, because `.cashier-tabs` is hidden from 900 px up (see Recon).
- The "Printed by" name comes from `claimed_by` (the person who claimed the order), as the existing line does. If another press person moves the order to Ready, the card still names the claimer. That is the data the app has; a separate "readied by" would need a schema change.
- Press shows only new and in-progress orders, so it never renders the Ready label.
- `R1_REPORT.md` still mentions "Finisher Front": historical record, not user-facing.
