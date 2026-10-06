# R18: admin and login tidy-up (gdansk-ux-4)

Branch `gdansk-ux-4`. No schema, RLS, RPC, migration or dependency change. Nothing pushed or merged.

## Recon

Written before any other file was edited. Line numbers refer to `gdansk-ux-1b` at e1a6ba9. Nothing here was run on a device or in a browser; every statement is from reading code and CSS.

### Base branch

The task says to branch off the latest `main` after `gdansk-ux-1b` is merged. At the start of this work `main` is at 0b98022 and `gdansk-ux-1b` (2 commits, R17) is not merged. `main` is an ancestor of `gdansk-ux-1b`, so `gdansk-ux-4` is cut from `gdansk-ux-1b`. It carries the R17 header change and nothing else extra; once `gdansk-ux-1b` is merged the diff against `main` is the same as if it had been cut from `main`.

### 1. UX-10 Design card

- [AdminDesignsPage.tsx:196](../../src/pages/AdminDesignsPage.tsx#L196): `const url = designPhotoUrl(d.photo_front) ?? designPhotoUrl(d.photo_back)`: one photo, back only when front is missing. Rendered as one 140 px `img` or an initials tile ([:268-274](../../src/pages/AdminDesignsPage.tsx#L268-L274)). `initials` is already imported ([:5](../../src/pages/AdminDesignsPage.tsx#L5)).
- Reusable pieces: `BundlePreview` ([DesignPicker.tsx:127-140](../../src/components/DesignPicker.tsx#L127-L140)) already shows front and back side by side with the initials tile for a missing side, but it is fixed at 200 px, lowercase captions ("front", "back") and no tap. It is used by the Cashier ([CashierPage.tsx:392](../../src/pages/CashierPage.tsx#L392)) and R16 behaviour must not change, so I will not edit it; the card gets its own small two-photo block in `AdminDesignsPage.tsx`.
- `ImageLightbox` ([ImageLightbox.tsx:5](../../src/components/ImageLightbox.tsx#L5)): takes `src`, `alt`, `onClose`, portalled to `body`, z-index 90. Usable as is for tapping a photo.
- Action row today ([:301-309](../../src/pages/AdminDesignsPage.tsx#L301-L309)): two `.row` blocks. Replace front / Replace back are `.btn-text` labels with a hidden file input (`PhotoReplace`, [:318-335](../../src/pages/AdminDesignsPage.tsx#L318-L335)). Then Edit and Hide/Show as `.btn` (56 px, 18 px bold, 20 px side padding) and Delete as a small `.btn-text`. Three different button styles in a row that wraps in a 220 px card, which is the untidy look from the phone test.
- Delete keeps `window.confirm` ([:254](../../src/pages/AdminDesignsPage.tsx#L254)) and the 23503 message ([:259](../../src/pages/AdminDesignsPage.tsx#L259)); both stay.
- The grid is `repeat(auto-fill, minmax(220px, 1fr))` ([:126](../../src/pages/AdminDesignsPage.tsx#L126)). Two photos side by side need about 260 px, so the minimum becomes 280 px; on a 390 px phone that is one column.

### 2. F5 Big/Small

- `designs.type` is `design_type not null` with no default ([0001_init.sql:34](../../supabase/migrations/0001_init.sql#L34)), as the task says. The create path must keep sending a value.
- Every use of `design.type` / `DesignType` in `src` and `scripts` (searched for `\.type`, `DesignType`, `'big'`, `'small'`, `design_type`, `TypeToggle`):
  - [types/db.ts:6](../../src/types/db.ts#L6) the type and [:32](../../src/types/db.ts#L32) the `Design.type` field (read-only type; the field stays, the DB still has the column);
  - [AdminDesignsPage.tsx:31](../../src/pages/AdminDesignsPage.tsx#L31) create state, [:58](../../src/pages/AdminDesignsPage.tsx#L58) insert payload, [:98-99](../../src/pages/AdminDesignsPage.tsx#L98-L99) toggle, [:137-144](../../src/pages/AdminDesignsPage.tsx#L137-L144) `TypeToggle`, [:191](../../src/pages/AdminDesignsPage.tsx#L191), [:213](../../src/pages/AdminDesignsPage.tsx#L213), [:224](../../src/pages/AdminDesignsPage.tsx#L224) edit state and the `update` payload (it sends `type`, which must go), [:279](../../src/pages/AdminDesignsPage.tsx#L279) edit toggle, [:299](../../src/pages/AdminDesignsPage.tsx#L299) the `{d.type} ·` text.
  - No other reader: DesignPicker, OrderCard, CashierPage, PressPage, StatsPage, csv, orderSummary, printColors and all `scripts/*` do not use it. **Confirmed: only the Admin Designs page reads or writes it.**
- Plan: the create `insert` sends the constant `type: 'big'` (new `DEFAULT_DESIGN_TYPE` constant next to its use, typed `DesignType`); the edit `update` sends `{ name, compatible_colors }` only, so existing rows keep whatever type they have (including `small`).

### 3. UX-07 / UX-08 / D7 names and Back

- Login "Continue as": [RoleSelect.tsx:100](../../src/components/RoleSelect.tsx#L100) renders `Continue as {lastUser.name} · {ROLE_LABELS[lastUser.role]}`. The real data has a person named "Admin" (A5.5, B1.9), so the button reads "Continue as Admin · Admin". **Confirmed.**
- Header chip: [TopBar.tsx:109-110](../../src/components/TopBar.tsx#L109-L110) always renders 👤 plus the name, so the Admin page shows title "Admin" ([AdminPage.tsx:22](../../src/pages/AdminPage.tsx#L22)) and chip "Admin". Page titles are "Admin", "Press queue" / "Press" ([PressPage.tsx:101](../../src/pages/PressPage.tsx#L101), [:110](../../src/pages/PressPage.tsx#L110)) and "Cashier" ([CashierPage.tsx:137](../../src/pages/CashierPage.tsx#L137), [:146](../../src/pages/CashierPage.tsx#L146)). "Press queue" differs from the role label "Press", so the comparison must be against the page title and the role label. **Rule (D7 = B):** a name that equals, case-insensitively and ignoring surrounding space, the role label or the page title is not repeated. Pure function in `src/lib`, with a check script.
- Back on the PIN screen: [RoleSelect.tsx:144](../../src/components/RoleSelect.tsx#L144) does `setPicked(null)` and leaves `role` set, so it lands on the name list ("Who are you?"). **Confirmed.** For "Continue as" the user never saw the list, so this is the odd path. Fix: Back clears both `picked` and `role`. The name-list Back ([:122](../../src/components/RoleSelect.tsx#L122)) already goes to the start.
- Admin navigation: the segmented control and the user menu from UX-1 stay as they are (Sign out only in the menu, [TopBar.tsx:115-117](../../src/components/TopBar.tsx#L115-L117)). Nothing to change in the header or top block; the only TopBar edit is the chip name, which the task allows.

### 4. UX-09 Events

- [AdminEventsPage.tsx:64-103](../../src/pages/AdminEventsPage.tsx#L64-L103): the create form is the first section, always open, above the list ([:105-137](../../src/pages/AdminEventsPage.tsx#L105-L137)). Form state (`name`, `location`, `date`, `endDate`, `createError`, `busy`) lives in the page ([:17-22](../../src/pages/AdminEventsPage.tsx#L17-L22)).
- Plan: list on top with a "New event" button in the section header row; the form opens below the button (collapsed by default) and closes after a successful create. The create logic and field validation are unchanged. A1 AC1 to AC5: AC1 (Create disabled on empty name), AC2, AC3, AC4/4a (end disabled until start, min, error text), AC4b (card dates, untouched) and AC5 (full-width inputs) all depend only on the form content and the card, both untouched. AC3 needs the new event to appear in the list, which is above the form now, so it is visible without scrolling.

### 5. UX-11 Select

- Global rule [index.css:216-230](../../src/index.css#L216-L230): `input, select` share padding 14 px 16 px and `min-height: var(--touch-min)`, but `select` has no `appearance` reset and no arrow of its own, so the native control renders (Safari: small arrows and a different height from the text input, as seen on "Designs for…"). The "Designs for…" select is in a `.row` ([AdminDesignsPage.tsx:82-90](../../src/pages/AdminDesignsPage.tsx#L82-L90)) with an `h2`, so it is not full width either. Other selects: Add person role ([AdminStaffPage.tsx:173](../../src/pages/AdminStaffPage.tsx#L173)), edit person role ([:253](../../src/pages/AdminStaffPage.tsx#L253)).
- Fix, CSS only: `select { appearance: none; padding-right: 44px; background-image: <inline SVG chevron>; background-position/size }`, same `min-height` as inputs. The chevron colour is hard-coded in the SVG data URI (CSS variables do not work in a `url()`), a mid grey that reads on the dark raised surface. No token changes (UX-3 scope).

### 6. UX-12 Staff

- [AdminStaffPage.tsx:140-193](../../src/pages/AdminStaffPage.tsx#L140-L193) `AddPerson`: three `SectionLabel` blocks, the PIN input has `aria-label="PIN"` but no visible hint besides the label "PIN (4 digits)", and the Role select is the plain native one. Works, but reads as a loose stack.
- The list ([:111-135](../../src/pages/AdminStaffPage.tsx#L111-L135)) renders every person, active and inactive, in one list in the order `staff_list` returns them; inactive rows are only dimmed (opacity 0.7) with an "Inactive" pill ([:224-228](../../src/pages/AdminStaffPage.tsx#L224-L228)).
- Plan (F4 = B): active people first under "Staff · N" (N counts active only); inactive people in a native `<details>` block "Inactive · N" below, closed by default, only when N > 0. Each inactive row stays a `PersonRow`, so Edit, Set PIN and Activate behave exactly as now. After Activate the list reloads and the person moves up. **No Delete button.** `staffCreate`, `staffUpdate`, `staffSetPin`, `staffList`, the admin PIN handling and `act` are not touched. `AddPerson` gets visible labels "Name", "Role", "PIN (4 digits)", a one-line hint under the PIN and a numeric input; the submit still goes through `onCreate(name, role, pin)` unchanged.
- The `<details>` element exposes the same state to assistive tech without new state or dependency. The `ConfirmDialog` portal from UX-1 is unaffected.

### 7. UX-20 Login screen

- Name list: [RoleSelect.tsx:125-136](../../src/components/RoleSelect.tsx#L125-L136), a two-column grid of `btn-lg` tiles. With an odd count the last tile sits left with an empty cell beside it. A role with exactly one person (the Admin case) gets one half-width tile.
- Heading: [RoleSelect.tsx:123](../../src/components/RoleSelect.tsx#L123) `SectionLabel` "Who are you? · Cashier", the small uppercase label style, next to a Back button in a `.row`.
- Plan: one `.name-grid` class: two columns; `.name-grid > :last-child:nth-child(odd)` spans both columns (this covers the odd-last-tile centred full row and a single tile, which then spans the full width). "Spans both columns" renders as a full-width tile, which is centred by definition; I read "last tile centered" as the same thing and avoid a half-width tile in the middle. Heading: a real `h2` ("Who are you?") at 26 px, role shown as a muted second line, Back stays above it. `.stagger` animation index on tiles stays.

### Out of scope, confirmed not touched

Palette and tokens, Cashier and Press pages, order card typography, CSV and stats, anything server-side, `staff_*` RPC calls, PIN login logic (`handlePin`, `verify_pin`), audio, wake lock, polling, queue semantics, order creation, header, top block, bottom bar and overlays (the only TopBar edit is the chip name).

### Pure logic added

`src/lib/displayName.ts` (`repeatsLabel(name, ...labels)`), `scripts/check-display-name.ts`.

## What changed

| Area | Change |
|---|---|
| Designs ([AdminDesignsPage.tsx](../../src/pages/AdminDesignsPage.tsx), [index.css](../../src/index.css)) | Card shows Front and Back in two columns with the labels, a missing side is an initials tile, tap on a photo opens `ImageLightbox`. Replace front / Replace back sit under their photo (hidden while editing). One `.design-actions` row of three equal buttons: Edit, Hide or Show, Delete (now a normal `.btn`; `window.confirm` and the 23503 message are unchanged). Grid minimum 280 px. The line under the name reads "Colors: …". |
| Big/Small | `TypeToggle`, the create and edit state and the `{d.type} ·` text are gone. Create sends `type: DEFAULT_DESIGN_TYPE` (`'big'`); the edit update sends `name` and `compatible_colors` only. `types/db.ts` is unchanged. |
| Names | `src/lib/displayName.ts` `repeatsLabel`. Login "Continue as <name>" drops " · <role>" when the name equals the role label. The TopBar chip hides the name when it equals the page title or the role label (icon only; aria-label and the menu "Signed in as" keep the name). Back on the PIN screen clears the role and the person, so it lands on the start screen. |
| Login tiles | `.name-grid` (two columns, odd last tile spans the row, so a single tile is full width). "Who are you?" is a 30 px `h2`, the role is a muted line under it. |
| Events | List first with an "Events · N" row and a "New event" button; the form opens under that row, the button reads "Close" while open, the form closes after a successful create. Form fields and validation unchanged. |
| Staff | "Add person": labelled Name, Role, PIN, a "4 digits" placeholder and the hint "4 digits. Admin PINs cannot be 0000." (matches `weak_admin_pin`). "Staff · N" counts active people; inactive people are in a `<details>` block "Inactive · N", closed by default, same `PersonRow` (Edit, Set PIN, Activate). No Delete button. |
| Select | `appearance: none`, 44 px right padding, inline SVG chevron, same padding and `min-height` as inputs. CSS only. |

Side effects to know about:
- The chevron colour is a fixed grey in the SVG data URI (CSS variables do not work inside `url()`); UX-3 may want to revisit it with the tokens.
- A person named like the page title or role sees only 👤 in the chip on wide screens too.
- "Staff · N" no longer counts inactive people; the "Inactive · N" block does.
- Designs already stored with `type = 'small'` keep that value; nothing reads it.

Not touched: header and top block structure, bottom bar, overlays, PIN login logic (`handlePin`, `verify_pin`), `staff_*` calls and admin PIN handling, audio, wake lock, polling, queue semantics, order creation, all SQL, dependencies.

## Validation

Run on the branch after the last code commit:

```
npx tsc -b                                    # clean
npm run lint                                  # clean
npm run build                                 # ok, PWA 9 precache entries
grep -c "Dev login" dist/assets/*.js          # 0
git --no-pager grep -n -i "service_role" -- src   # empty
scripts/check-*.ts                            # build-id 11, cashier-ui 15, claim-result 12, display-name 7 (new), event-dates 8, merge-orders 5, print-colors 12, send-hint 4: all pass
node scripts/check-sounds.mjs                 # ok
git diff --stat main                          # see the final report
```

## Nothing is verified on a device

I have not opened this on an iPhone, an Android phone or in a desktop browser. Everything above is from reading code and CSS, and the build and the check scripts passing. The select arrow, the 280 px design grid, the `<details>` block and the odd-tile rule are CSS behaviours that only a device run proves.

## Manual steps: iPhone PWA

Deploy first (or run the preview build on the test URL). Delete the home screen icon and add it again, or fully close the app and reopen it twice; the build tag on the login screen must match the new commit. Use the `ZZ-TEST` event and the `ZZ-Test` person only. Do not switch the real active event.

1. **Login start.** Logged out, last user "Admin": the quick-start button reads "Continue as Admin" (not "· Admin"). Tap it, then "← Back" on the PIN screen: you land on "Select your station", not on a name list. (B1.12, B1.13)
2. **Name tiles.** Cashier: "Who are you?" is large, "Cashier" under it. With an odd number of names the last tile fills the row. Back, Admin: the single tile is full width. (B1.14)
3. **Header chip.** Log in as Admin: the chip shows only 👤; tap it: "Signed in as Admin" and "Sign out". Log in as a person with another name: the chip shows the name. (B1.15)
4. **Designs card.** Admin, Designs, pick `ZZ-TEST`: each card shows Front and Back side by side with labels. Tap a photo: full screen, tap again: closed. A design with one photo shows the initials tile on the other side. (A4.10, A4.11)
5. **Design actions.** One row of three equal buttons: Edit, Hide or Show, Delete. Replace front and Replace back sit under their photos. No Big or Small anywhere. Hide then Show: the "Hidden" badge toggles. Delete on a design used by an order: "This design is used by orders. Hide it instead." (A4.5, A4.8)
6. **New design.** Add a design with name, colours and photos: no type step, saved without error. Edit an older design, Save: works. (A4.12)
7. **Selects.** The "Designs for…" select has an arrow on the right and the same height as the inputs. Same for the Role select in Staff. (UX-11)
8. **Events.** Events tab: list on top, "New event" button. Create `ZZ-Test-2` with a start and end date: the form closes and the event is in the list, not active. Pick a date: no horizontal scroll. Do not set it active. (A1.0, A1.1, A1.4, A1.5)
9. **Staff form.** Staff, enter the admin PIN: "Add person" has Name, Role, PIN and the hint line. Add `ZZ-Test` as Cashier, PIN 0000. (A5.14, A5.11)
10. **Inactive block.** Deactivate `ZZ-Test`: it leaves the list, "Inactive · 1" appears collapsed. Open it: Edit, Set PIN, Activate, no Delete. Activate: back in the active list. Delete the test person later with the SQL from A5.11. (A5.12, A5.13)
11. **Android.** Repeat 1 to 10 on AN-N and AN-S (Chrome installed app).
12. **Laptop.** Repeat 3 to 10 at 900 px and up.
