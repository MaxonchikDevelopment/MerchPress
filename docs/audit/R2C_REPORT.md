# R2C Report: per-event options, design editing, session revalidation

Branch `gdansk-sprint`. Not pushed, not merged. No migration, SQL, RLS, RPC or dependency change. Migrations 0003 and 0004 were already applied.

## Done
Commit 1: per-event options and Events editor
- `src/lib/eventOptions.ts`: `eventOptions(event)` returns `{ colors, sizes, colorLabel }`. Colours are validated (`{ key, label, #rrggbb }`), ink colour comes from WCAG luminance, sizes keep XS..XXL order, null or empty falls back to `config.ts`. `colorLabel` returns the stored key when nothing matches.
- ColorPicker, SizePicker, OrderCard (active event), StatsPage (selected event) and AdminDesignsPage use it. CashierPage treats a colour or size the event no longer offers as unselected.
- `EventEditor` (Admin Events, Edit button on each event): name, location, date; colour rows (colour input + label, Add, Remove, Reset to defaults); size toggles. Existing keys are kept when a label changes; a new colour gets a slug of its label, unique within the event, assigned on save. Defaults-equal colours or all six sizes are stored as null. Direct `update` on `events`, errors shown. Saving the active event calls `refreshActiveEvent`.

Commit 2: designs
- Edit name, type and compatible colours (stored keys the event no longer offers stay visible so they are not dropped silently). Replace front or back photo: upload, update the row, delete the old object (failure only logged; a failed row update removes the new object). Hide / Show via `is_active`. Delete keeps working: 23503 shows "This design is used by orders. Hide it instead."; storage objects are removed only after the row is gone. Adding a design removes already-uploaded photos if a later step fails.
- `useDesigns` returns `designs` (all) and `activeDesigns`; the cashier pickers use active ones, a hidden pick in an open draft counts as unselected.
- `src/lib/imageUpload.ts`: decode (`createImageBitmap`, `<img>` fallback), longest side at most 1600 px, never upscaled; PNG and WebP sources re-encoded as PNG, everything else JPEG 0.85 on a white background; content type and extension match. Messages: "Use a JPEG or PNG image." and "This photo is still over 5 MB after resizing. Use a smaller image." The button shows "Preparing photo…" then "Uploading…".

Commit 3: session and create errors
- Session revalidation (owner-approved) on app load and on every silent refresh (20 s, visibility, online): `staff_v` lookup by id. Missing or inactive: sign out. Name or role changed: stored session updated (the in-memory admin PIN is dropped if the role is no longer admin). A failed lookup does nothing. A result that arrives after the user changed is ignored.
- `createOrder` returns `{ ok, order }`, `{ kind: 'network' }` or `{ kind: 'rejected', message }`. Rejected means the server answered with a 4xx; `status` 0 (fetch failure, abort), 5xx or an empty result counts as network, because the order may have landed. Rejected shows "Order rejected: <message>"; both keep the form.

Commit 4: wording, dead code, test, docs
- Admin tabs: Events, Designs, Staff, Stats. "Exit" is now "Sign out".
- Removed `clearLastUser`, the legacy CSS aliases (no `var(--bg|panel|panel-2|border|text|muted)` use anywhere), and the unused `loading` returns of `useDesigns`, `useEvents`, `useOrders`. One `initials()` in `src/lib/initials.ts` replaces three copies.
- `scripts/r2c-livetest.mjs`, CLAUDE.md data model lines for the two columns and `is_active`.

## Differences from the brief
- `useDesigns`'s `loading` was removed in commit 2 (not 4) because that commit rewrote the hook.
- `src/lib/initials.ts` is introduced in commit 2 (AdminDesignsPage needed it); commit 4 switches the other two copies to it.
- The cashier and press devices load designs once per event, so Hide / Show shows up there after a reload or event switch, not live. Same limitation as before for any design change.
- Staff names in `mpq.lastUser` ("Continue as") are not refreshed by revalidation; it never bypasses the PIN.

## Validation
`npx tsc -b`, `npm run lint`, `npm run build` clean at each commit. `grep "Dev login"` in `dist/assets` = 0. `service_role` grep in `src` empty.

## Live test
`node scripts/r2c-livetest.mjs` against the live database: 20 checks, all PASS (colours and sizes round-trip and reset, hide / show, PNG upload and removal, text file rejected with "mime type text/plain is not supported", used design delete refused with 23503 and hide allowed, zero leftover events, designs, orders and storage objects). The first run reported one FAIL in the test itself (jsonb reorders object keys); the comparison was made order-insensitive and the script re-run. The image compression and the UI are not covered by it (browser only); see the checklist.

## Manual checklist (results blank)
| # | Check | Result |
|---|-------|--------|
| 1 | Admin > Events > Edit: change name, location, date, Save; the list updates | |
| 2 | Edit the active event's name: the top bar shows it without a full-screen reload | |
| 3 | Add a colour "Sand" with a light and then a dark colour input: the ink on the swatch stays readable | |
| 4 | Rename a colour, Save: old orders with that key show the new label; remove a colour: old orders show the stored key | |
| 5 | Remove all colours and Save: refused. "Reset to defaults" + Save restores the five default colours | |
| 6 | Turn off XXL and XS, Save: the Cashier size picker shows S to XL only; turning all on stores defaults | |
| 7 | Cashier with a colour picked, admin removes it: the picker shows nothing selected after the next event refresh and Send stays disabled | |
| 8 | Stats uses the event's colour labels (breakdown and CSV) | |
| 9 | Designs: Edit name, type, compatible colours, Save | |
| 10 | Designs: add a design with a 12 MP phone photo: upload works, stored image is at most 1600 px | |
| 11 | Designs: a transparent PNG stays transparent; a JPEG stays JPEG; a WebP becomes PNG | |
| 12 | Designs: choose a .txt or .pdf file: "Use a JPEG or PNG image." | |
| 13 | Designs: Replace front on a design: new photo shows, old object gone from the bucket | |
| 14 | Designs: Hide a design: Cashier pickers drop it after reload; existing order cards still show its photo | |
| 15 | Designs: Show it again: back in the Cashier picker | |
| 16 | Designs: Delete a design with no orders: row and photos gone | |
| 17 | Designs: Delete a design used by an order: "This design is used by orders. Hide it instead."; photos still there | |
| 18 | Designs: the button shows "Preparing photo…" then "Uploading…" on a slow connection | |
| 19 | Staff tab: deactivate a signed-in cashier; within about 20 s (or on tab focus) that tablet returns to the login screen | |
| 20 | Staff tab: rename a signed-in person or change their role; the tablet picks up the new name or role without logging out | |
| 21 | Open the app with Wi-Fi off while signed in: stays signed in; lookup failure never signs out | |
| 22 | Cashier: send with Wi-Fi off: "Not confirmed. Tap Send again.", form kept | |
| 23 | Cashier: a server rejection (for example event deleted meanwhile) shows "Order rejected: <message>", form kept | |
| 24 | Admin tabs read Events, Designs, Staff, Stats; the top-right button says "Sign out" | |
| 25 | `node scripts/r2c-livetest.mjs`: all PASS, zero leftovers | |
