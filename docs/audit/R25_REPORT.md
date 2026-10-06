# R25: Compatibility matrix in Admin (gdansk-ux-8)

Branch `gdansk-ux-8`, off `main` at 6cd1cc5 (`git log main` contains `Merge gdansk-ux-7`; `git branch --merged main` lists `gdansk-ux-7`). No schema, RLS, RPC, migration or dependency change. Nothing pushed or merged. Owner decision D15 = A (a Compatibility matrix screen in Admin), not reopened.

## Recon

Written before any other file was edited. Line numbers refer to 6cd1cc5. Everything here is from reading code and CSS; nothing was run on a device or in a browser.

### Designs of an event, hidden included

- [useDesigns.ts:8-22](../../src/hooks/useDesigns.ts#L8-L22): `select('*').eq('event_id', eventId).order('created_at', { ascending: true })`, no `is_active` filter. `designs` therefore **includes hidden designs**; `activeDesigns` ([:28](../../src/hooks/useDesigns.ts#L28)) is the filtered view that pickers use. The matrix uses `designs`.
- The read ignores `error` (a failed read gives `[]`). Existing behaviour, same on the Designs page; not changed.
- When `eventId` changes, `designs` keeps the previous event's rows until the new fetch lands (no loading flag). The Designs page lives with that. The matrix must not show old rows under the new palette, so it renders only rows whose `event_id` equals the selected event.
- The event select: [AdminDesignsPage.tsx:25-27](../../src/pages/AdminDesignsPage.tsx#L25-L27) `pickedId ?? activeEvent?.id`, options from `useEvents` with " (active)" ([:88-93](../../src/pages/AdminDesignsPage.tsx#L88-L93)). The matrix copies this idiom.

### ColorToggles and eventOptions

- `ColorToggles` is **private to AdminDesignsPage.tsx** ([:138-168](../../src/pages/AdminDesignsPage.tsx#L138-L168)): one `.btn` per palette colour, `aria-pressed`, background `c.hex`, ink `c.text`, plus a button for every stored key the palette lacks ("orphans", title "Not in this event's colours"). It is not exported and the Designs page must stay unchanged, so the matrix draws its own header cell (dot and label) and does not import it.
- `eventOptions(event)` ([eventOptions.ts:63-71](../../src/lib/eventOptions.ts#L63-L71)): `colors` is the event's `shirt_colors` if valid, else `DEFAULT_COLORS` (`config.ts`), each with a computed `text` ink; never empty. So there is always at least one palette column. `parseShirtColors` ([:40-52](../../src/lib/eventOptions.ts#L40-L52)) returns null for any invalid or empty list.
- Key order is the palette order, which is the order the matrix must store.

### compatible_colors semantics (reader side)

- Empty list means any colour: [CashierPage.tsx](../../src/pages/CashierPage.tsx) via `printColors` ([R16](R16_REPORT.md)): an empty `compatible_colors` is a wildcard; if the restrictions of the chosen designs leave no colour that the event offers, **all colours are shown** (the guard). That is why a stored non-empty list with no palette key behaves as "any" on the cashier and must be flagged in the matrix.
- The Designs page writes `compatible_colors: colors` as ticked, in click order, orphan keys kept ([:212](../../src/pages/AdminDesignsPage.tsx#L212)). So stored lists can be in non-palette order and can contain orphans. The matrix normalises on its own writes only; reading tolerates both.

### How designs are updated, and error handling

- Direct client write, no RPC, no PIN: `supabase.from('designs').update({ ... }).eq('id', d.id)` ([:210-213](../../src/pages/AdminDesignsPage.tsx#L210-L213), [:221](../../src/pages/AdminDesignsPage.tsx#L221), [:231](../../src/pages/AdminDesignsPage.tsx#L231)), allowed by `designs_all`. Pattern: `const { error } = await ...; if (error) throw error;` inside `run()` ([:187-198](../../src/pages/AdminDesignsPage.tsx#L187-L198)), whose catch shows `errorMessage(e, 'Something went wrong. Try again.')` in an inline `.toast.toast-error` ([:314](../../src/pages/AdminDesignsPage.tsx#L314)). `run` blocks a second action while one is working (`if (working) return`); the matrix needs the opposite (taps accepted, writes queued).
- `errorMessage` is in [imageUpload.ts](../../src/lib/imageUpload.ts); reused.
- `update` on a row the policy or filter hides returns no error and no data, so a "no row" case is not distinguishable without `.select()`. The matrix asks for the row back (`.update(...).eq('id', id).select('id')`) and treats an empty result as a failure, so a silent no-op cannot show a success toast.
- Toasts: the shared `Toast` component ([ui/Toast.tsx](../../src/components/ui/Toast.tsx)) renders `.toast` (accent) or `.toast.toast-error`. Pages keep their own toast state and a 5 s timer (CashierPage.tsx:46-50, 108-109 pattern). There is no global toast host.

### AdminPage tab strip

- [AdminPage.tsx:10-12](../../src/pages/AdminPage.tsx#L10-L12) `Tab` union and `TAB_LABELS`; the tab list is the inline array at [:23](../../src/pages/AdminPage.tsx#L23); the page switch at [:36-39](../../src/pages/AdminPage.tsx#L36-L39). The default tab is `designs` when an event is active, else `events` ([:17](../../src/pages/AdminPage.tsx#L17)).
- Strip CSS: `.topbar-nav` ([index.css:410-422](../../src/index.css#L410-L422)) is its own flex row on phones (`flex: 1 1 100%`, `overflow-x: auto`, hidden scrollbar, pill background) and `.topbar-nav .tab` is `flex: 1 0 auto; white-space: nowrap` ([:426-429](../../src/index.css#L426-L429)); from 900 px it is `overflow: visible` and tabs are `flex: 0 0 auto` ([:439-446](../../src/index.css#L439-L446)). `.tab` is 44 px high, 15 px, `padding: 0 var(--sp-4)`, `text-transform: capitalize` ([:484-495](../../src/index.css#L484-L495)).
- Width estimate at 360 px: the strip has about 320 px. Four tabs (Events, Designs, Staff, Stats) take roughly 300 px with padding; the fifth, "Compatibility", is about 130 px. **Five tabs do not fit side by side at 360 px**; the control is already horizontally scrollable by design, so it scrolls. Nothing wraps and nothing overflows the page. To make the tab reachable, tapping a tab scrolls it into view inside the strip (`scrollIntoView({ inline: 'center', block: 'nearest' })`, no CSS change). From 900 px all five fit. The Cashier and Press strips share the CSS, so I do not change `.tab` padding.

### Sticky first column inside an overflow container

- Nothing like it exists today (the only `position: sticky` in the CSS is the cashier send bar, [index.css:577-580](../../src/index.css#L577-L580)); there is no table CSS at all.
- Plan with existing tokens: a wrapper `div` with `overflow-x: auto` (and `overscroll-behavior-x: contain`), inside it a `table` with `border-collapse: separate; border-spacing: 0` (collapsed borders vanish under sticky cells), and first-column `th`/`td` with `position: sticky; left: 0; z-index: 1` and an **opaque** background (`var(--surface-card)`, the card's own surface) plus a right border so scrolled cells do not show through. The wrapper is the nearest scrolling ancestor on the x axis, and `.content` ([index.css:505-513](../../src/index.css#L505-L513)) is only the y scroller, so the page body never scrolls sideways (`html, body { overflow: hidden }`, [:105-110](../../src/index.css#L105-L110)). Admin content is capped at 980 px ([AdminPage.tsx:35](../../src/pages/AdminPage.tsx#L35)).
- Safari note: sticky works on `th`/`td` in current Safari; the wrapper needs a bounded width (it is a block child of a card, so it is).
- Touch targets: `--touch-min` is 56 px ([index.css:84](../../src/index.css#L84)); the matrix cell buttons are 44 by 44 as specified, using `min-width`/`min-height` of 44 px.

### Go / stop

- **GO.** No SQL, RLS, RPC, migration or dependency needed; writes use the existing `designs_all` update.
- `.btn-text:hover` turns the text red ([index.css:211-213](../../src/index.css#L211-L213)), wrong for an "All" action, so the matrix gets its own small classes from existing tokens instead of reusing it.
- Not in scope and not touched: cashier and press screens, order creation, PIN login, audio, wake lock, polling, queue semantics, the Designs page and its form, palette and tokens, Stats and CSV.

### Pure logic planned

`src/lib/compatMatrix.ts`, all pure and keyed by the palette key list: `tickedKeys`, `hasNoMatch`, `toggleKey`, `tickKey`, `tickAll`, `toStored`. `scripts/check-compat-matrix.ts` with the same runner as `check-print-colors.ts`.

## Changes

Commits on `gdansk-ux-8` (the last one holds this report, the acceptance tests and the phase doc):

1. `feat(admin)` compat rules and check script: [compatMatrix.ts](../../src/lib/compatMatrix.ts) (`tickedKeys`, `hasNoMatch`, `toStored`, `toggleKey`, `tickKey`, `tickAll`, `sameList`), [check-compat-matrix.ts](../../scripts/check-compat-matrix.ts) (21 checks, run with `node scripts/check-compat-matrix.ts`).
2. `feat(admin)` Compatibility screen: [AdminCompatPage.tsx](../../src/pages/AdminCompatPage.tsx), [AdminPage.tsx](../../src/pages/AdminPage.tsx) (`Tab`, `TAB_LABELS`, `TABS`, the page switch, scroll-into-view on tab tap), [index.css](../../src/index.css) (`.compat-*`, tokens only).
3. `docs`: this file, `12_ACCEPTANCE_TESTS.md` (version 14; A4 AC8, A4.13 to A4.20), `11_PHASE_GDANSK.md`.

How it behaves:

- **Tab.** Fifth tab "Compatibility" between Designs and Staff. Opening Admin still defaults to Designs (or Events without an active event).
- **Rows and columns.** Event select as on the Designs page (default the active event). Rows: every design of the event, hidden included (name muted, thumbnail and cells at 60 %, "Hidden" tag; the sticky cell stays opaque). Columns: the event palette from `eventOptions`, colour dot (palette hex, as `ColorToggles` does) and label. A row whose stored list has no palette key shows nothing ticked and "⚠ No colour of this event matches" (`--warn`).
- **Cell.** 44 by 44 button, `aria-pressed`, accent fill with a check when ticked. Tap updates the screen at once, saves, then shows "Saved: <design>"; on failure the row goes back to the last saved list and an error toast shows the message. The last ticked colour does not untick; the hint toast is "At least one colour must stay ticked." and nothing is written.
- **Serialised writes.** Per design: `desired` (latest tap), `confirmed` (last saved) and one running loop. While a save is in flight, taps only update `desired`; when the call returns, the loop sends the latest list, until `desired` equals `confirmed`. Different designs save in parallel. If a save fails, the row rolls back to `confirmed` and any tap queued behind the failed one is dropped with it (it was built on the failed state); one error toast. Rapid taps give one final state and no stale write.
- **Write.** `supabase.from('designs').update({ compatible_colors }).eq('id', id).select('id')`; an error or an empty result is a failure. No PIN, same as the Designs page. The stored value is `[]` when every palette colour is ticked, otherwise the ticked keys in palette order; keys the palette lacks are never written. A list with palette keys plus orphans is written back clean only when the admin changes that row.
- **"All" and "All designs".** "All" under the design name stores `[]` (no write if it already is). "All designs" under a colour ticks it for every design where it is not ticked (rows that become complete store `[]`), one summary toast; disabled when nothing needs it. There is no untick-all.
- **Layout.** One `.compat-scroll` wrapper (`overflow-x: auto`), a `border-collapse: separate` table, first column `position: sticky; left: 0` with `--surface-card` background and a right border. Page body never scrolls sideways (`html, body` are `overflow: hidden`; the card is `min-width: 0` in the grid). 148 px first column on phones, 200 px from 600 px. Legend line under the title as specified.
- **Phone tab strip.** Five tabs do not fit at 360 px (about 440 px of tabs in about 320 px): the strip scrolls as designed, and tapping a tab calls `scrollIntoView({ inline: 'center', block: 'nearest' })` so "Compatibility" is never half hidden. No `.tab` padding change, so the Cashier and Press strips are untouched. From 900 px all five fit.

Things to know:

- **Cashier freshness.** The cashier loads designs once per event ([useDesigns.ts](../../src/hooks/useDesigns.ts)), so a changed rule reaches a cashier device after that device reloads (known limitation, see A4 AC7). It is not instant on an open cashier screen; A4.20 says "after reload". Making it live would change the cashier side, which this task excludes.
- The matrix does not refetch after saving; it shows what it wrote. Changes made from another admin window show after the tab is reopened.
- A save that fails on one design during "All designs" shows that design's error; the summary success toast is skipped.
- The last-colour hint reuses the error toast style (existing tokens); there is no separate warning style.
- Designs page and form: not touched, they still let an admin store any combination, including a list with orphan keys.

## Validation

Run on the final tree:

- `npx tsc -b`: clean.
- `npm run lint`: clean.
- `npm run build`: ok (PWA 9 precache entries).
- `grep -c "Dev login" dist/assets/*.js`: 0.
- `git --no-pager grep -n -i "service_role" -- src`: empty.
- Every `scripts/check-*.ts` (16 including the new `check-compat-matrix.ts`) and `node scripts/check-sounds.mjs`: all pass.
- `git diff --stat main`: see the final message.

## Nothing is verified on a device

I have not opened this in a browser, on an iPhone, an Android phone or a laptop, and I did not write to the database, so no real or test `designs` row was changed. The screen was never rendered once. The rules are covered by the pure check script; everything else (sticky column, 44 px cells, tab strip scrolling, toasts, optimistic update, rollback and write serialisation against a real network, the empty-result failure path) is from code, CSS and the build passing only.

## Manual steps

Use the `ZZ-TEST` event only, with three designs: **A** with an empty colour list, **B** with two colours ticked, **C** hidden (Designs, Hide) with one colour. Do not switch the active event and do not call `activate_event`. Reload twice so the new build runs (build tag on the login screen matches).

**Laptop (Chrome and Safari, 900 px and up):**
1. Admin, tabs: five tabs, all visible, "Compatibility" between Designs and Staff (A4.19).
2. Open it, select `ZZ-TEST`: A has every cell ticked, B has two, C is muted with "Hidden". Compare with the "Colors:" line on each card in Designs (A4.13).
3. Tap a ticked cell of A: it unticks at once, toast "Saved: A". Reload the page, open Designs: A lists all colours but that one (A4.14, A4.15). Tap it again: back to "any".
4. Tap one cell five times quickly: the final state matches the last tap; check Designs after a reload (A4.16).
5. B: "All": all ticked, Designs shows "any". Untick two, then use "All designs" over one colour: that colour ticks on every row, one toast with a count, the button greys out afterwards (A4.17).
6. B with one colour left: tap it: nothing changes, hint toast shows (A4.18).
7. Failure: turn Wi-Fi off, tap a cell: the cell flips back and an error toast shows; turn Wi-Fi on, tap again: it saves.
8. Resize to 360 px wide: the page does not scroll sideways, the table scrolls by itself, the first column stays on the left (A4.19).
9. Warning row: in Supabase, never on real data; to see "No colour of this event matches", use Designs, Edit on C and tick a colour, then remove that colour from the `ZZ-TEST` palette in Events (Edit event, colours) and reopen the matrix. Put the palette back afterwards.
10. Cashier window on `ZZ-TEST` (or reload it): Bundle, pick A, B, C: colours shown follow the matrix (A4.20).

**iPhone PWA (cashier phone or admin phone, `ZZ-TEST`):**
1. Admin, tab strip: it scrolls sideways; tap "Compatibility": it stays visible in the strip. The page body does not move sideways.
2. Matrix: first column stays while the colour columns scroll; cells are easy to hit with a thumb; "All" and "All designs" are tappable (44 px).
3. Tap cells in a row of A and B, the toast shows without covering the table (it sits at the bottom of the screen area, sticky).
4. Rotate to landscape and back: layout holds.
5. Close the app, reopen, Compatibility: states are as saved.
6. On a second phone as cashier (reload first): Bundle with A and B shows the new colour rule (A4.20).
7. Repeat 1 to 5 on AN-N and AN-S.

Nothing above has been run on a device.
