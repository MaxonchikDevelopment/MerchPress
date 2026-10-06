# R21: Stats and CSV, UX-6 (gdansk-ux-6)

Branch `gdansk-ux-6`, off `main` at ec1c3f1. Client only: Stats page and pure helpers in `src/lib`. No schema, RLS, RPC, migration, dependency or `order_stats_v` change. Nothing pushed or merged.

Note: the brief says "after gdansk-ux-5 is merged". There is no `gdansk-ux-5` branch locally or remotely and `main` (ec1c3f1) ends at the gdansk-ux-3 merge. I branched off the current `main`. None of the Stats files are touched by anything I could find, but confirm that ux-5 does not edit `StatsPage.tsx` or `csv.ts`.

## Recon

Written before any other file was edited. Line numbers refer to `main` at ec1c3f1. Nothing was run in a browser or spreadsheet; every statement is from reading code.

1. Time.
   - The CSV writes raw ISO strings (UTC, with `T` and `Z`): `created_at`, `ready_at`, `completed_at`, `cancelled_at` are passed through unchanged ([StatsPage.tsx:75-83](../../src/pages/StatsPage.tsx#L75-L83)).
   - The file name date is `new Date().toISOString().slice(0, 10)`, which is UTC, so an export after 00:00 Warsaw time but before 02:00 UTC (summer) is dated the day before ([StatsPage.tsx:102](../../src/pages/StatsPage.tsx#L102)).
   - No time-zone helper exists in `src/lib`; `eventDates.ts` formats event date ranges only.

2. Headers and values.
   - Headers are mostly Title case but the last one is `cancelled_at` ([StatsPage.tsx:99](../../src/pages/StatsPage.tsx#L99)).
   - Status is the raw enum (`in_progress`) ([StatsPage.tsx:76](../../src/pages/StatsPage.tsx#L76)). Labels already exist in `STATUS_COLORS[...].label` ([colors.ts:4-9](../../src/lib/colors.ts#L4-L9)): New, In progress, Ready, Completed, Cancelled.
   - There is no Print mode column. Cancelled orders are already in the CSV (`orders`, not `liveOrders`, [StatsPage.tsx:73](../../src/pages/StatsPage.tsx#L73)).

3. Separator.
   - `toCsv` hard-codes `,` in the join and `escape` quotes on `[",\n]` only ([csv.ts:3-5](../../src/lib/csv.ts#L3-L5), [:14-17](../../src/lib/csv.ts#L14-L17)). Stats is the only caller of `toCsv` and `downloadCsv` ([StatsPage.tsx:3](../../src/pages/StatsPage.tsx#L3)). The UTF-8 BOM is added in `downloadCsv` ([csv.ts:21](../../src/lib/csv.ts#L21)) and stays.
   - `escape` does not quote on `\r`; left as is, out of scope.

4. By design.
   - `byDesign` flat-maps front and back ids and counts both ([StatsPage.tsx:61-66](../../src/pages/StatsPage.tsx#L61-L66)), so a bundle (same id front and back) counts twice. The tally also counts by design name, so two designs with the same name merge.

5. By day. There is no such breakdown. `Breakdown` takes `[string | number, number][]` ([StatsPage.tsx:160](../../src/pages/StatsPage.tsx#L160)) and `tally` sorts by count descending ([StatsPage.tsx:18-22](../../src/pages/StatsPage.tsx#L18-L22)); by day needs its own ascending sort.

6. Hidden designs: answer is that the problem does not exist. `useDesigns(eventId)` selects every design of the event with no `is_active` filter and returns them as `designs`; hidden ones are filtered only into the separate `activeDesigns` that pickers use ([useDesigns.ts:6-28](../../src/hooks/useDesigns.ts#L6-L28), the comment at :6-8 says the same). Stats uses `designs` ([StatsPage.tsx:30](../../src/pages/StatsPage.tsx#L30)), so hidden designs resolve to names in the CSV and in By design today. No change needed, and no other screen is touched. The residual case is a design deleted from the database: orders cannot reference one (fk 23503 on delete), so it cannot occur.

## Plan

- `src/lib/eventTime.ts`: `EVENT_TZ`, `formatEventTime`, `eventDay`.
- `src/lib/printMode.ts`: `printMode`.
- `src/lib/statsTally.ts`: `tally`, `distinctDesignTally`, `byDay`.
- `src/lib/csv.ts`: `separator` parameter.
- Check scripts in `scripts/`, one per helper plus csv.

## Changes

| Item | Where |
|---|---|
| 1 Time | `src/lib/eventTime.ts`: `EVENT_TZ`, `formatEventTime` (`Intl.DateTimeFormat`, `hourCycle: 'h23'` so midnight is 00, not 24), `eventDay`. Used for the four timestamp columns and the file name date. |
| 2 Headers, values | Headers unified (`Cancelled at` was `cancelled_at`); Status from `STATUS_COLORS[...].label`; new `Print mode` column from `src/lib/printMode.ts`. Cancelled orders stay in the CSV. |
| 3 Separator | `toCsv(rows, columns, separator = ',')`; a field is quoted if it contains the separator, a quote or a newline. Stats passes `';'`. BOM unchanged. With `;` a comma in a name is no longer quoted, which is correct. |
| 4 By design | `distinctDesignTally` in `src/lib/statsTally.ts`: a `Set` of front and back id per order, then count. It now tallies by design id lookup; two designs with the same name still merge in the display. |
| 5 By day | `byDay` in `statsTally.ts`, ascending, cancelled excluded (it takes `liveOrders`). Uses the existing `Breakdown`. |
| 6 Hidden designs | Not an issue, see Recon. No change. |

`tally` moved from `StatsPage.tsx` to `statsTally.ts` unchanged. Nothing else on the page changed.

## Validation

```
npx tsc -b                                    # clean
npm run lint                                  # clean
npm run build                                 # ok
grep -c "Dev login" dist/assets/*.js          # 0
git --no-pager grep -n -i "service_role" -- src   # empty
scripts/check-*.ts                            # build-id 11, cashier-ui 15, claim-result 12, csv 6, display-name 7, event-dates 8, event-time 10, merge-orders 5, print-colors 12, print-mode 5, send-hint 4, stats-tally 8: all pass
node scripts/check-sounds.mjs                 # ok
```

## Nothing is verified in a real spreadsheet

I have not opened an exported file in Excel or Google Sheets, nor run the Stats page in a browser. The checks cover the pure functions only. Open questions that only a spreadsheet answers: whether Excel in a Polish locale splits on `;` by double click with the BOM, whether the `YYYY-MM-DD HH:mm` text is turned into a date and displayed differently, and whether Google Sheets import needs the separator chosen. Note that `Order #` and size values are plain text and numbers; a leading-zero or formula-like client name (starting with `=`, `+`, `-`, `@`) is not escaped, as before.

## Manual steps

Use the `ZZ-TEST` event only; do not touch the real active event.

1. On ZZ-TEST create four orders: Bundle (one design front and back), Custom with two different designs, a no-print order, and one that you then cancel. Move one to Ready and one to Completed so those time columns fill. Hide one design that an order uses.
2. Admin, Stats, pick ZZ-TEST, "Export CSV". The file name date is the Warsaw date. (A6.2)
3. Open it in Excel by double click (Polish or German locale if possible) and in Google Sheets (File, Import). Check: 13 columns in the order Order #, Created, Status, Color, Size, Front, Back, Print mode, Client, Cashier, Ready at, Completed at, Cancelled at; times `YYYY-MM-DD HH:mm`, two hours ahead of UTC in summer; Status as a label; Print mode Bundle, Custom, None; the cancelled order present with Cancelled at filled; the hidden design name still shown. (A6.5)
4. Check By design by hand against the CSV: the Bundle counts once for its design, the Custom counts once for each of its two, the no-print order counts nothing, the cancelled order counts nothing. (A6.6)
5. By day shows ZZ-TEST days in Warsaw time, ascending, cancelled excluded. For a midnight check compare an order created after 22:00 UTC with its CSV Created value. (A6.7)
6. Phone width 390 px: Stats shows four breakdown cards without horizontal page scroll. (A6.4)
