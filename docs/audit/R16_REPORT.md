# R16: bundle and custom print (gdansk-ux-2)

Branch `gdansk-ux-2`, off `main` at 296d352 (UX-1 merged). No schema, RLS, RPC, migration or dependency change. Nothing pushed or merged.

## Recon

Written before any other file was edited. Line numbers refer to 296d352. Everything is from reading code; nothing was run on a device.

### How NewOrderForm holds the print state

- [CashierPage.tsx:233-234](../../src/pages/CashierPage.tsx#L233-L234): `pickedFront` and `pickedBack` are two independent `useState<string | null>`. There is no mode and no bundle concept.
- [:247-248](../../src/pages/CashierPage.tsx#L247-L248): `frontId` and `backId` are derived. A pick whose design is no longer in `designs` (hidden since) counts as unselected. `designs` here is `activeDesigns` ([:170](../../src/pages/CashierPage.tsx#L170)).
- [:250-257](../../src/pages/CashierPage.tsx#L250-L257): `allowedColors` is `undefined` with no design chosen, otherwise the intersection of `compatible_colors` of the chosen designs (`reduce` over `filter`).
- [:243](../../src/pages/CashierPage.tsx#L243): `color` is derived from `pickedColor` (a colour the event no longer offers counts as unselected). Nothing resets a colour when a design makes it incompatible; today it is only dimmed.
- Reset after a successful send: [:315-319](../../src/pages/CashierPage.tsx#L315-L319) clears colour, size, front, back and name.

### What the pickers do now

- `ColorPicker` ([ColorPicker.tsx:12-18](../../src/components/ColorPicker.tsx#L12-L18)): `allowed` is advisory. `dim = allowed && allowed.length > 0 && !allowed.includes(key)`; a dimmed button has `opacity: 0.45`, the title "not recommended for the selected print (still allowed)", and is still clickable. **An empty `allowed` array means "all allowed".**
- `DesignPicker` ([DesignPicker.tsx:8-56](../../src/components/DesignPicker.tsx#L8-L56)): tile grid with a "None" tile (value `null`) and one tile per design. `side` only picks which photo the tile shows (`photo_front` or `photo_back`). A missing or broken photo falls back to the design's initials ([:58-87](../../src/components/DesignPicker.tsx#L58-L87)). Used twice in the form, as Front and Back ([CashierPage.tsx:352,356](../../src/pages/CashierPage.tsx#L352)).

### How compatible_colors is read

- Column `designs.compatible_colors text[] not null default '{}'` ([0001_init.sql:37](../../supabase/migrations/0001_init.sql#L37)). Admin form writes the list; "None selected means all colors are allowed" ([AdminDesignsPage.tsx:61,224](../../src/pages/AdminDesignsPage.tsx#L61)); the card shows "any" for an empty list ([:299](../../src/pages/AdminDesignsPage.tsx#L299)).
- Reader: only `CashierPage.tsx:255` (intersection) and `ColorPicker` (empty means all).
- **Existing quirk found:** with two chosen designs where one has an empty list ("any") and the other has `[black]`, the intersection is `[]`, which `ColorPicker` reads as "all allowed". The restrictive design's advice is lost. The new logic treats an empty list as a wildcard instead of intersecting it.
- Keys in `compatible_colors` that the event does not offer (colours edited per event) can exist. In bundle mode with hiding this could leave zero visible colours; the logic needs a guard (see Design below).

### What createOrder sends

- [createOrder.ts:32-43](../../src/lib/createOrder.ts#L32-L43): RPC `create_order_v2` with `p_design_front_id` and `p_design_back_id` (both nullable uuid), colour, size, name, creator, cashier, `p_client_request_id`. A bundle just passes the same id twice.
- [CashierPage.tsx:298-303](../../src/pages/CashierPage.tsx#L298-L303): the stale-draft check compares `order.design_front_id === frontId` and `design_back_id === backId`. It keeps working unchanged for a bundle (both equal the bundle id).

### How OrderCard and press resolve photos

- [OrderCard.tsx:89-90](../../src/components/OrderCard.tsx#L89-L90): `front = designs.find(id === design_front_id)`, `back = designs.find(id === design_back_id)`. `DesignThumb` shows `design.photo_front` for the front slot and `design.photo_back` for the back slot ([:17](../../src/components/OrderCard.tsx#L17)). So an order with the same design id in both columns already renders that design's front photo and back photo. **No change to OrderCard or press is needed for a bundle.** Press renders the same `OrderCard` ([PressPage.tsx:131](../../src/pages/PressPage.tsx#L131)).
- Hidden designs still resolve: `designs` passed to the cards is the full list, not `activeDesigns` ([CashierPage.tsx:34,178](../../src/pages/CashierPage.tsx#L34)).
- Design with only one photo: `DesignThumb` falls back to an initials tile with aria-label "<name> (no back photo)" ([OrderCard.tsx:42-60](../../src/components/OrderCard.tsx#L42-L60)); the caption still reads "back: <name>". A one-sided design in a bundle therefore shows one photo and one initials tile. The new bundle preview must do the same instead of showing a blank.

### Other readers of design_front_id / design_back_id

- [StatsPage.tsx:62-65](../../src/pages/StatsPage.tsx#L62-L65): `byDesign` tallies front and back ids together, so a bundle order counts the design **twice** in "by design". Not changed here (UX-6 scope: CSV and stats); flagged.
- [StatsPage.tsx:79-80](../../src/pages/StatsPage.tsx#L79-L80): CSV rows `front` and `back` use `designName`; a bundle prints the same name in both columns. Correct and unambiguous, no change.
- [csv.ts](../../src/lib/csv.ts): generic, no design fields. [orderSummary.ts](../../src/lib/orderSummary.ts): takes `frontName` and `backName` as strings; it would print "Front: X · Back: X" for a bundle, so it needs an optional bundle name.
- `scripts/check-merge-orders.ts:14-15` only builds fixtures.

### Migration check (the "no migration" expectation)

**Confirmed: no migration is needed.**
- `orders.design_front_id` and `design_back_id` are independent nullable uuid foreign keys to `designs` ([0001_init.sql:49-50](../../supabase/migrations/0001_init.sql#L49-L50)). There is no check constraint on them, and no `front <> back` rule anywhere in `supabase/migrations`.
- `create_order_v2` ([0004_ops.sql:73-74,102,106](../../supabase/migrations/0004_ops.sql#L73)) inserts both ids as given, with no cross validation.
- Realtime, `order_stats_v` and `set_order_status` do not read the design columns.
- Deleting a design that orders use still fails with 23503 as before; a bundle order just references the same row from two columns.

### Design decisions that follow from recon

- No new state shape. `pickedFront` and `pickedBack` stay; bundle mode writes the same id into both, custom mode writes them separately. A `mode` state is added.
- Colour logic moves to a pure `src/lib/printColors.ts`. Empty `compatible_colors` is a wildcard (fixes the quirk above). Intersection of non-empty lists only.
- Guard: if the restrictive designs leave no colour that the event offers, show all colours, dim none, so the cashier is never stuck with an empty colour row.
- In custom mode an empty intersection dims nothing (same visible result as today; dimming every colour carries no information).
- `ColorPicker` gets `dimmed: string[]` in place of `allowed`, and receives only the visible colours.

## What changed

| Area | Change |
|---|---|
| [printColors.ts](../../src/lib/printColors.ts) | Pure `printColors({ mode, chosen, colorKeys, picked })` returning `visible`, `dimmed`, `resetColor`. Empty `compatible_colors` is a wildcard. Bundle hides, custom dims. Fallback: if the restrictions leave no colour the event offers, all are shown and none dimmed. Custom never resets. |
| [CashierPage.tsx](../../src/pages/CashierPage.tsx) | New `mode` state (default `bundle`). Bundle writes one id into `pickedFront` and `pickedBack`; custom keeps the two pickers. Picking a bundle clears a colour that no longer fits. Switching mode clears front and back only. Colour list is filtered to `visible`. The send, stale-draft and `createOrder` code is untouched. |
| [DesignPicker.tsx](../../src/components/DesignPicker.tsx) | `side="bundle"` tiles show front and back photos side by side, empty tile reads "No print". New `BundlePreview` (two 200 px photos, initials tile where a photo is missing). |
| [ColorPicker.tsx](../../src/components/ColorPicker.tsx) | `allowed` replaced by `dimmed: string[]`. Hidden colours are simply not passed in. |
| [orderSummary.ts](../../src/lib/orderSummary.ts) | Optional `bundleName`: "Black · M · Bundle: Name". Without it, unchanged. |
| [index.css](../../src/index.css) | `.print-mode` segmented switch (reuses `.tab` / `.tab-active`, 44 px targets). |

Not touched: OrderCard, press, Stats, CSV, `createOrder`, all SQL, auth, audio, wake lock, polling, UX-1 header, top block, bottom bar and overlays.

Things to know:
- Stats "by design" counts a bundle order twice for its design (front and back tallied together). Left for UX-6.
- The old intersection quirk (an "any" design next to a restrictive one lost its advice) is fixed as a side effect.
- Bundle mode lists active designs including ones with one photo; the tile shows the initials on the missing side.
- After a successful send the mode stays as it was.

## Validation

```
npx tsc -b                                    # clean
npm run lint                                  # clean
npm run build                                 # ok, PWA 9 precache entries
grep -c "Dev login" dist/assets/*.js          # 0
git --no-pager grep -n -i "service_role" -- src   # empty
node scripts/check-*.ts                       # all pass, incl. new check-print-colors (12 checks) and 2 new summary checks in check-cashier-ui
node scripts/check-sounds.mjs                 # ok
```

No live DB test: no server, RPC or data path changed; orders use the same two columns and the same RPC as before.

## Nothing is verified on a device

I have not opened this on an iPhone, an Android phone or in a desktop browser. Everything above is from reading code, the check scripts and the build passing.

## Manual steps: iPhone PWA

Deploy first (or preview build), fully close and reopen the app twice so the new bundle runs; the build tag on the login screen must match. Use the `ZZ-TEST` event only, with at least one design that has both photos and an empty colour list, one with a restricted colour list, and one with a single photo.

1. **Default.** Cashier, New order. "Bundle" / "Custom print" switch above the print section; "Bundle" is active. One list of designs (front and back photos on each tile) plus "No print". (C1.10)
2. **Bundle order.** Pick a design: big front and back preview appears; summary reads "… · Bundle: Name" once. Pick colour and size, "Send to press →". (C1.11, C1.17)
3. **Press card.** On a Press device the card shows both photos with "front: Name" and "back: Name". Tap a photo to enlarge. (D1.6)
4. **Hidden colours.** In Bundle pick a design with a restricted colour list: incompatible colours vanish. Pick a colour first, then that design: the colour clears and the hint says "Pick a color". A design with no marked colours shows all. (C1.13)
5. **Custom order.** Switch to "Custom print", Front = design A, Back = design B, send. Then one with only Front. (C1.12)
6. **Dimmed colours.** In Custom pick a restricted design: incompatible colours are dimmed but still tappable and the order sends. (C1.14)
7. **Mode switch.** Pick colour, size, a name and a design, switch Bundle to Custom print and back: print cleared, colour, size and name kept. (C1.15)
8. **One-photo design.** Bundle with a design that has one photo: initials tile on the empty side in the preview and on the press card. (C1.16)
9. **Layout.** Check portrait and landscape: the switch is reachable, the UX-1 bottom bar and header are unchanged. Repeat 1 to 8 on AN-N or AN-S, and glance at MAC (900 px and up).
