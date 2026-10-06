# R22: cards, cancel notice, colour notes, thresholds, PIN keyboard (gdansk-ux-5)

Branch `gdansk-ux-5`, off `main` at bd4d047. No schema, RLS, RPC, migration or dependency change. Nothing pushed or merged.

## Recon

Written before any other file was edited. Line numbers refer to bd4d047. Everything here is from reading code; nothing was run on a device.

### Item 1: order card (UX-13)

- [OrderCard.tsx:96-98](../../src/components/OrderCard.tsx#L96-L98) number is an inline 32 px / 900. [StatusBadge.tsx:7](../../src/components/StatusBadge.tsx#L7) uses `.badge` (13 px / 800, uppercase-free, tracking 0.04em, [index.css:653-661](../../src/index.css#L653-L661)). [OrderCard.tsx:121-123](../../src/components/OrderCard.tsx#L121-L123) colour, size and client name use `.pill` (14 px / 600, [index.css:663-674](../../src/index.css#L663-L674)). Cashier line is an inline 13 px `.muted` ([OrderCard.tsx:126](../../src/components/OrderCard.tsx#L126)); thumbnail captions are inline 12 px ([:56](../../src/components/OrderCard.tsx#L56)). So the card mixes 32, 14, 13 and 12 px with three different weights; badge and pills differ in size, weight and height.
- Thumbnails are a fixed 84 x 84 px ([OrderCard.tsx:36](../../src/components/OrderCard.tsx#L36), placeholder tile [:46-47](../../src/components/OrderCard.tsx#L46-L47)); tap-to-enlarge is a button plus `ImageLightbox` ([:27-33](../../src/components/OrderCard.tsx#L27-L33), [:40](../../src/components/OrderCard.tsx#L40)). Keep it.
- Claimed name: the card only prints "· claimed" when `order.claimed_by` is set ([:127](../../src/components/OrderCard.tsx#L127)). `Order.claimed_by` is a user id ([types/db.ts](../../src/types/db.ts)). The client already resolves ids through `staffName(id)` in [orderStatus.ts:49-58](../../src/lib/orderStatus.ts#L49-L58), which reads `staff_v` (id, name, role, is_active; `is_active` rows only, [0001_init.sql:189-190](../../supabase/migrations/0001_init.sql#L189-L190)). So no schema change is needed. Limits: it returns null for a deactivated person or on a failed read, so the card needs a fallback; the lookup is one request per distinct id, so it wants a small cache.
- Press renders the card at [PressPage.tsx:131](../../src/pages/PressPage.tsx#L131); Cashier at [CashierPage.tsx:179](../../src/pages/CashierPage.tsx#L179) and [:188](../../src/pages/CashierPage.tsx#L188). The "Claimed by" line is requested for Press only, so it will be an opt-in prop.

### Item 2: Press notice for a cancelled order (UX-14): GO

How the press client learns about a cancelled row today:

1. Realtime. [realtime.ts:26-28](../../src/lib/realtime.ts#L26-L28) subscribes to `event: '*'` on `orders` for the event; an UPDATE reaches `onUpdate(next, prev)` ([realtime.ts:32-34](../../src/lib/realtime.ts#L32-L34)). `orders` has `replica identity full` ([0001_init.sql:194-195](../../supabase/migrations/0001_init.sql#L194-L195)), so `prev` carries the old status. A cancel is an UPDATE to `status = 'cancelled'` with `cancelled_by` set (0004 `set_order_status`).
2. [useOrders.ts:96-103](../../src/hooks/useOrders.ts#L96-L103) `onUpdate` stores the row in `rtUpserts` and replaces it in state; the only callback today is `onReady` when the status enters `ready` ([:100-102](../../src/hooks/useOrders.ts#L100-L102)). The cancelled row stays in `orders` state until the next refetch; the queue hides it through the status filter ([PressPage.tsx:60-66](../../src/pages/PressPage.tsx#L60-L66)).
3. Polling and refetch. [useOrders.ts:46-75](../../src/hooks/useOrders.ts#L46-L75) queries `new`, `in_progress`, `ready` only, so a cancelled row silently disappears from the next snapshot, and `mergeOrders` also drops closed rows ([mergeOrders.ts:20-21](../../src/lib/mergeOrders.ts#L20-L21)). The 20 s poll, visibility, online and resubscribe refetches therefore carry no cancel information.
4. Own cancels: [useCancelOrder.tsx:21-29](../../src/hooks/useCancelOrder.tsx#L21-L29) cancels through the RPC and refetches; the realtime UPDATE for it arrives too, so the notice must skip rows where `cancelled_by` is my id.

Where the toast hooks in without touching the protected semantics: add one optional callback `onCancelled(next, prev)` to `useOrders` options, fired from the existing `onUpdate` branch exactly like `onReady`, after the unchanged `rtUpserts` and `setOrders` lines. No change to `mergeOrders`, `rtUpserts`/`rtDeletes`, `SeenSet`, `alertNewOrder`, `onNew` or `onLoaded`. The decision rule is pure and goes to `src/lib/cancelNotice.ts` with a check script: notice only when `prev.status` is `new` or `in_progress`, `next.status` is `cancelled`, and `cancelled_by` is not the current user. `PressPage` resolves the name with the existing `staffName(cancelled_by)` and shows a visual toast; no sound.

Known limits (to state in the report, not blockers):
- Realtime only. If the socket was down when the cancel happened, the order just vanishes on the next refetch with no notice. A refetch diff could detect a vanished `new`/`in_progress` id, but it cannot tell cancelled from deleted and has no canceller, so it is not used.
- If `prev` is missing, the rule shows no notice (it cannot know the press saw the order).
- A canceller who is deactivated or whose lookup fails is shown as "someone".
- The existing Press toast slot is a single error slot with a 5 s timer ([PressPage.tsx:25-26](../../src/pages/PressPage.tsx#L25-L26), [:53-57](../../src/pages/PressPage.tsx#L53-L57)); a cancel notice must not overwrite or be overwritten by an error, so it gets its own list.

### Item 3: wait thresholds (UX-16)

- [wait.ts:4-5](../../src/lib/wait.ts#L4-L5) `WARN_MINS = 7`, `OVERDUE_MINS = 15`. Used in [WaitTimer.tsx:2](../../src/components/WaitTimer.tsx#L2), [:15-16](../../src/components/WaitTimer.tsx#L15-L16) and [PressPage.tsx:4](../../src/pages/PressPage.tsx#L4), [:123](../../src/pages/PressPage.tsx#L123) (overdue only). No test script covers `wait.ts`.
- Docs that say 7 minutes: [12_ACCEPTANCE_TESTS.md:314](12_ACCEPTANCE_TESTS.md) (D1 AC5), [:323](12_ACCEPTANCE_TESTS.md) (D1.4); [R1_REPORT.md:19](R1_REPORT.md) and [:55](R1_REPORT.md) (historical report, left as written because it describes R1 at the time; a note in R22 records the change). No other doc or test mentions it.

### Item 4: PinPad keyboard (UX-17)

- [PinPad.tsx:5-77](../../src/components/PinPad.tsx#L5-L77). `push` ignores input at 4 digits or when `busy` ([:16-24](../../src/components/PinPad.tsx#L16-L24)); submit fires on the 4th digit and clears. Backspace button is `setPin(p => p.slice(0, -1))` ([:70](../../src/components/PinPad.tsx#L70)). No keyboard handling and no Enter semantics today, because submit is automatic at 4 digits.
- Enter: since 4 digits auto-submit, Enter has nothing to confirm with a full pin. Decision: Enter submits only when exactly 4 digits are held, which cannot occur in practice because the 4th digit already submitted; so Enter is mapped and is a no-op on a partial pin (never submits fewer than 4 digits). Flagged in the report.
- PinPad is mounted from RoleSelect and the Admin staff gate; one listener per mount, removed on unmount. Pure mapping goes to `src/lib/pinKey.ts` with a check script (digits, Backspace, Enter; ignores modifier combos, repeats of held keys are fine, ignores events from `input`, `textarea`, `select`, contenteditable).
- The login screen has no text input today, but the Admin staff gate may sit next to inputs, hence the target filter.

### Item 5: BuildTag (UX-18)

- [BuildTag.tsx:2-7](../../src/components/BuildTag.tsx#L2-L7) is `.muted` (`--text-muted` #8c8c8c) 11 px, margin-top `--sp-5`. It is rendered inside `.content` at the end of the scroller on Cashier ([CashierPage.tsx:203](../../src/pages/CashierPage.tsx#L203)), Press ([PressPage.tsx:147](../../src/pages/PressPage.tsx#L147)), Admin ([AdminPage.tsx:40](../../src/pages/AdminPage.tsx#L40)) and login ([RoleSelect.tsx:164](../../src/components/RoleSelect.tsx#L164)). On Cashier phones it sits above the `.cashier-footer` send bar; on a short page it floats mid-screen instead of at the bottom. `--text-faint` (#7a7a7a) exists ([index.css:23](../../src/index.css#L23)). "Lowest element" is met by making the tag the last child of `.content`, pushed to the end with `margin-top: auto` on a flex-column content, plus the safe-area bottom padding already on `.content`. I will check `.content`'s display before choosing the exact CSS and will not change its layout for other pages.

### Items 6 and 7: colour notes

- [CashierPage.tsx:262-273](../../src/pages/CashierPage.tsx#L262-L273) `pickBundle` clears the colour when `printColors(...).resetColor` is true. Bundle name for the note comes from `designs.find(d => d.id === id)`. The note must live until the next colour pick (`setColor` from the picker) or a print change (another `pickBundle`, `switchMode`).
- [CashierPage.tsx:366-369](../../src/pages/CashierPage.tsx#L366-L369) colour row; `dimmed` from `printColors` ([:253-258](../../src/pages/CashierPage.tsx#L253-L258)) is non-empty only in Custom mode (check against `printColors.ts` during implementation). [ColorPicker.tsx:25](../../src/components/ColorPicker.tsx#L25) dims through `opacity: var(--dim-opacity)` and a `title`, which touch screens do not show.
- A re-pick of the same bundle must not wrongly keep a stale note: the note is cleared on every `pickBundle` and re-set only if that call cleared a colour.

### Item 8: client name field (D8 = A)

- [CashierPage.tsx:408-418](../../src/pages/CashierPage.tsx#L408-L418) input has `autoComplete="off"`, `inputMode="text"`, `enterKeyHint="done"`, aria-label "Client name (optional)"; no `name`. iOS ignores `autocomplete="off"` for contact and address AutoFill often. Planned: `name="order-label"`, `autoCorrect="off"`, `autoCapitalize="words"`, `spellCheck={false}`, `data-form-type="other"`, same type, label and aria-label. Only an iPhone shows whether this suppresses the bar.

### Item 9: Ready overlay (UX-15), verification only

- [CashierPage.tsx:53-56](../../src/pages/CashierPage.tsx#L53-L56) single ready: title `Order #N ready`, subtitle `order.client_name ?? undefined`. [:73-80](../../src/pages/CashierPage.tsx#L73-L80) batch: one missed order gets the same title and subtitle; several get `Orders #a, #b ready` with no subtitle. The title never carries a name. [CashierPage.tsx:210](../../src/pages/CashierPage.tsx#L210) passes both to `AlertOverlay`. No bug found; nothing to change. (Line numbers in the brief, 53-55 and 76-79, are off by one to two lines at bd4d047.)

### Go / stop

- Item 2: **GO**, via the `onCancelled` callback in `useOrders` and a pure `cancelNotice` rule. No semantics touched.
- Items 1, 3, 4, 5, 6, 7, 8: go. None needs a migration.
- Item 9: verified, no change.

## Changes

Commits on `gdansk-ux-5` (the last one holds this report, the acceptance tests and the phase doc):

1. `feat(press)` card and cancel notice: [OrderCard.tsx](../../src/components/OrderCard.tsx), [index.css](../../src/index.css) (`.order-card` scale, `--thumb`), [staffNames.ts](../../src/lib/staffNames.ts), [cancelNotice.ts](../../src/lib/cancelNotice.ts), `onCancelled` in [useOrders.ts](../../src/hooks/useOrders.ts), notices in [PressPage.tsx](../../src/pages/PressPage.tsx), [check-cancel-notice.ts](../../scripts/check-cancel-notice.ts).
2. `feat(cashier)` colour notes and name field: [CashierPage.tsx](../../src/pages/CashierPage.tsx).
3. `fix(ux)` thresholds, PIN keyboard, build tag: [wait.ts](../../src/lib/wait.ts), [PinPad.tsx](../../src/components/PinPad.tsx), [pinKey.ts](../../src/lib/pinKey.ts), [BuildTag.tsx](../../src/components/BuildTag.tsx), [check-pin-key.ts](../../scripts/check-pin-key.ts).
4. `docs`: this file, `12_ACCEPTANCE_TESTS.md` (version 12, date 06.10.2026), `11_PHASE_GDANSK.md`.

Per item:

- **UX-13.** Scale: number 32 px, chips (status, "Yours", colour, size, client name) 16 px / 700 / 40 px high, secondary text (cashier, claimed by, photo captions) 14 px. Done as scoped CSS on `.order-card`, so the `.badge` and `.pill` used on Admin pages are untouched. Photos 120 px under 900 px, 84 px above (two photos plus gap still fit a 360 px phone; on 320 px they wrap). Cashier cards keep "· claimed" with no name, because the "Claimed by" line was asked for on Press only (`showClaimedBy` prop). Name lookup uses the existing `staffName` and `staff_v`; a deactivated person or a failed read shows plain "Claimed".
- **UX-14.** GO as in the recon. 15 s auto-dismiss, "Dismiss" button, one notice per order id, separate from the single error toast. The canceller is shown as "someone" when `cancelled_by` is empty or the lookup fails.
- **UX-16.** `WARN_MINS` 10. Only `12_ACCEPTANCE_TESTS.md` (D1 AC5, D1.4) described it as 7. `R1_REPORT.md` still says 7 because it describes R1 at the time; it is a historical report and was not rewritten.
- **UX-17.** Digits (also numpad), Backspace, Enter; shortcuts, key auto-repeat and events from input, textarea, select or contenteditable are ignored; the listener is added in a `useEffect` and removed on unmount. Enter: PIN submits automatically on the 4th digit, so Enter has nothing left to confirm. It is wired (submits only a full 4-digit PIN) but is effectively a no-op; it never submits a partial PIN. Touch code path unchanged.
- **UX-18.** The tag was already the last child of `.content` on every page. The change is 12 px (was 11), the same `--text-muted` token, `--sp-8` above it, a little padding below, selectable text. On phone Cashier the send bar footer is outside the scroller and is still below it; the tag is the last thing in the scrolling content.
- **D5 notes.** Bundle note uses the exact text "Colour cleared: not available for <name>", orange (`--warn`), cleared by a colour pick, another bundle pick, a mode switch or a successful send. Custom line "Dimmed colours are not recommended for this print (still allowed)" appears only while `dimmed` is non-empty (Custom mode only); the title tooltip stays.
- **D8.** Applied exactly as listed, `type="text"` made explicit. Honest limit: iOS may still show contact or address AutoFill above the keyboard; these attributes only ask. Only an iPhone shows whether it worked. If it did not, the next option is a different field model (for example a password-less `type="search"` or a contenteditable), which changes behaviour and was not tried.
- **UX-15.** Verified, no bug, no change (see recon).

## Validation

Run on the final tree:

- `npx tsc -b`: clean.
- `npm run lint`: clean.
- `npm run build`: ok.
- `grep -c "Dev login" dist/assets/*.js`: 0.
- `git --no-pager grep -n -i "service_role" -- src`: empty.
- Every `scripts/check-*.ts` (14 including the two new ones: `check-cancel-notice.ts` 8 checks, `check-pin-key.ts` 7 checks) and `node scripts/check-sounds.mjs`: all pass.
- `git diff --stat`: see the final message.

## Not verified

Nothing here was run on a device or in a browser. The cancel notice, Claimed by, AutoFill behaviour, keyboard handling and visual sizes are from code and pure-logic checks only.

## Manual steps

**iPhone PWA** (two phones: cashier `C1`, press `P1`; event `ZZ-TEST` active; never on the real event):
1. `P1` Press, `C1` Cashier. `C1` sends a Bundle order with a client name (C1.11). On `P1`: number large, status, colour, size and name chips equal size and weight, photos about 120 px, tap a photo opens it and tap closes it (D1.7, D1.5).
2. `P1` taps "Claim — start printing": the card shows "Claimed by <P1 name>". A second press phone sees the same (D1.8).
3. `C1` sends another order and, while `P1` has it open as New, cancels it from Queue. `P1` shows the red "Order #N cancelled by <C1 name>" notice without a sound; "Dismiss" works. Repeat with an In progress order. `P1` cancelling its own order shows no notice (D1.9).
4. Leave an order unclaimed: timer grey until 10 min, orange from 10, red and pulsing from 15 (D1.4). Use a backdated `new_at` only on `ZZ-TEST` through the SQL editor if waiting is not practical.
5. `C1`, New order, Bundle: pick a colour, then a bundle whose colours exclude it: "Colour cleared: not available for <name>" stays until a colour or another bundle is picked (C1.18).
6. `C1`, Custom print: pick a design with a limited colour list: the "Dimmed colours are not recommended…" line shows (C1.14).
7. `C1`, tap the "Client name (optional)" field: write down whether the AutoFill bar appears (C1.19). Capital letter per word and no autocorrect are expected.
8. Scroll to the bottom of Press, Cashier and the login screen: "build <hash>" is the last line and readable (B1.10, H1.1).
9. Complete an order to Ready on `C1`: overlay title has no name, name is the subtitle (C1.20).

**Laptop:**
1. Login screen, pick a name, type `0000` on the keyboard: logs in. Backspace removes a digit. Letters and Tab do nothing. Enter with a partial PIN does nothing (B1.16).
2. Admin, Staff, PIN pad visible with the "Name" field focused: digits go into the field only (B1.17).
3. Press and Cashier at desktop width: photos 84 px, the same chip scale.
