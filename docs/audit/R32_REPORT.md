# R32: loading and error states from the R29 audit (gdansk-fix-ui-2b)

Branch `gdansk-fix-ui-2b`, off `main` at 3c47368 (v1.4). `git log main` contains `Merge gdansk-fix-ui-2a: swatches, Picked up label, Reset, update banner` (a669821). The audit `docs/audit/R29_REPORT.md` lives on `gdansk-audit-1`; it was read with `git show` and is not merged or copied. Logic round, additive and small. No schema, RLS, RPC, migration, SQL or dependency change; `package.json` and `package-lock.json` untouched. Nothing pushed or merged.

## Recon

Written before any other file was edited. Line numbers are for 3c47368. Everything here is from reading code; nothing was run on a device or in a browser.

| ID | Verdict | Where | Go / stop |
|---|---|---|---|
| A-05 | **Confirmed.** `useOrders` has no first-load state. `connected = subscribed && online && fetchOk` and `subscribed` starts `false`, so the banner shows at every app start until the socket reports SUBSCRIBED. Press prints `{queue.length} in queue` and "Queue is empty 🎉" from the first render; Cashier prints "None of your orders is ready yet." and "No open orders from you." the same way. Corrected detail: the audit points at `:29-33` and `:145`; the success branch that sets `hasLoaded.current` and `fetchOk` is `:73-76`, the error branch is `:66-70`, the reset effect is `:80-87`, the return is `:147`. | [useOrders.ts:33](../../src/hooks/useOrders.ts#L33), [:73-76](../../src/hooks/useOrders.ts#L73-L76), [:85-86](../../src/hooks/useOrders.ts#L85-L86), [:147](../../src/hooks/useOrders.ts#L147); [TopBar.tsx:135-142](../../src/components/TopBar.tsx#L135-L142); [PressPage.tsx:131](../../src/pages/PressPage.tsx#L131), [:146-148](../../src/pages/PressPage.tsx#L146-L148), [:176](../../src/pages/PressPage.tsx#L176); [CashierPage.tsx:148](../../src/pages/CashierPage.tsx#L148), [:202](../../src/pages/CashierPage.tsx#L202), [:211](../../src/pages/CashierPage.tsx#L211) | **GO.** New `loaded` state: `setLoaded(true)` right after `setFetchOk(true)` in the success branch; `setLoaded(false)` in the reset effect next to `setOrders([])`; return `{ orders, connected, loaded, reload }`. The error branch, sequence guards (`reqSeq`, `appliedSeq`), `mergeOrders`, `rtUpserts`/`rtDeletes`, callbacks, subscription and poll are not touched. If `eventId` becomes null the effect returns before the reset, so `loaded` keeps its last value; both pages show "No active event" then, so nothing reads it. |
| A-06 | **Confirmed.** The `staff_v` read destructures only `data`; `error` is ignored and there is no loading state. A failed or slow read leaves `staff = []`, so the name step shows "No staff for this role yet." and offers no retry. | [RoleSelect.tsx:38-44](../../src/components/RoleSelect.tsx#L38-L44), [:141](../../src/components/RoleSelect.tsx#L141) | **GO.** Track `staffState` (loading, error, ok) in the existing effect, extracted to a `loadStaff` that Retry re-runs; unmount guard with a flag. Tiles, PIN step, Back and `handlePin` are not touched. |
| A-07 | **Confirmed.** The `designs` read ignores `error`, and a failed read runs `setDesigns([])`, wiping the list. The Bundle picker then shows only "No print". Designs load once per event; nothing retries. | [useDesigns.ts:11-22](../../src/hooks/useDesigns.ts#L11-L22), [:30](../../src/hooks/useDesigns.ts#L30); [CashierPage.tsx:41](../../src/pages/CashierPage.tsx#L41), [:184](../../src/pages/CashierPage.tsx#L184), [:432-457](../../src/pages/CashierPage.tsx#L432-L457) | **GO.** Hook returns `loading` and `error`; on a failed read it keeps the previous `designs` and sets `error`. `NewOrderForm` gets three additive props and renders a status line with a 56 px Retry above the Bundle picker and above the Front and Back pickers; the "No print" tile (inside `DesignPicker`) is untouched and stays. One risk, accepted as specified: keeping the previous list on error also keeps the previous event's rows if the event changes and the new read fails. Cashier picks that are no longer in the list already count as unselected ([CashierPage.tsx:264-265](../../src/pages/CashierPage.tsx#L264-L265)), and an event change on a live tablet is rare. |

### Consumers

`useOrders` (all read only `orders`, `connected`, `reload`; the new `loaded` is extra):
- [PressPage.tsx:69](../../src/pages/PressPage.tsx#L69): `orders, connected, reload`; will also read `loaded`.
- [CashierPage.tsx:106](../../src/pages/CashierPage.tsx#L106): `orders, connected, reload`; will also read `loaded`.
- [AdminOrdersPage.tsx:28](../../src/pages/AdminOrdersPage.tsx#L28): `orders, reload`; unchanged.

`OfflineBanner`: [PressPage.tsx:131](../../src/pages/PressPage.tsx#L131), [CashierPage.tsx:148](../../src/pages/CashierPage.tsx#L148). Both get `loaded`.

`useDesigns` (the added `loading` and `error` are ignored by everyone but Cashier):
- [CashierPage.tsx:41](../../src/pages/CashierPage.tsx#L41): `designs, activeDesigns`; will also read `loading, error, reload`.
- [PressPage.tsx:23](../../src/pages/PressPage.tsx#L23), [StatsPage.tsx:30](../../src/pages/StatsPage.tsx#L30), [AdminOrdersPage.tsx:27](../../src/pages/AdminOrdersPage.tsx#L27), [AdminCompatPage.tsx:27](../../src/pages/AdminCompatPage.tsx#L27): `designs` only. They gain one behavior change: after a failed read they keep the last good list instead of an empty one.
- [AdminDesignsPage.tsx:29](../../src/pages/AdminDesignsPage.tsx#L29): `designs, reload`; same note.

## What changed

3 code commits on top of this report, in this order.

1. `feat(orders)`: `useOrders` returns `loaded`; Press and Cashier show "Loading orders…" instead of the empty states until it is true ; `OfflineBanner` waits for the first connection or a 3 s grace from mount, decided by `offlineBannerVisible(connected, everConnected, graceElapsed)` in [offlineBanner.ts](../../src/lib/offlineBanner.ts) (see Review fix); [check-offline-banner.ts](../../scripts/check-offline-banner.ts) covers connected, startup (never connected, inside grace), cannot connect (grace elapsed), and was connected before. The "N in queue" line stays empty until loaded.
2. `fix(login)`: `RoleSelect` tracks `staffState` (loading, error, ok); "Loading staff…", "Couldn't load staff. Check the connection." with a 72 px Retry (`btn-lg`), "No staff for this role yet." only after an ok load; a `mounted` ref drops answers after unmount.
3. `fix(cashier)`: `useDesigns` returns `loading` and `error`, keeps the previous list on a failed read; `NewOrderForm` renders `DesignsStatus` above the Bundle and Custom pickers.

Not changed, as required: `mergeOrders`, `rtUpserts`, `rtDeletes`, `reqSeq`, `appliedSeq`, `onNew`, `onLoaded`, `onReady`, `onCancelled`, the subscription, polling, `lib/appUpdate`, audio, wake lock, `handlePin`, `verify_pin`, `unlockAudio`, order numbering, `create_order_v2`, `createOrder`, `canSubmit`, `submit()`, `complete()`, `askCancel()`, `clearDraft()`. No real data touched, `activate_event` not called.

Notes:
- The grace timer lives in `OfflineBanner`, so it starts when the page mounts. Resume from background does not restart it (the connection already existed), as decided.
- `useDesigns` now sets `loading` to true on every `reload`, including the ones the Admin Designs page triggers after an edit. Only Cashier reads `loading`, so nothing flickers there.
- Acceptance texts are in Russian like the rest of the file.

## Review fix

Review found that the first version keyed the banner on `loaded`. At launch the first REST fetch usually finishes before the realtime socket subscribes, so `loaded` was true while `connected` was still false and the banner still flashed at every launch, which is what A-05 was meant to remove. The rule is now `offlineBannerVisible(connected, everConnected, graceElapsed) = !connected && (everConnected || graceElapsed)`. `OfflineBanner` sets `everConnected` in an effect when `connected` is true and never resets it while mounted; the 3 s timer (`OFFLINE_GRACE_MS`) starts at mount. The `loaded` prop is gone from `OfflineBanner` and its two call sites; `useOrders` still returns `loaded` for the "Loading orders…" texts, and `useOrders.ts` is not touched. Press: the "N in queue" line is a non-breaking space until loaded (keeps its height), because the empty state below already says "Loading orders…". Effect: launch on a slow link, no banner inside 3 s; no network at launch, banner after about 3 s; network drops after a connection, banner at once. `connected` still requires `subscribed && online && fetchOk`, so a socket that never subscribes also shows it after 3 s.

## Validation

All run on the final tree.

- `npx tsc -b`: clean.
- `npm run lint`: clean.
- `npm run build`: ok.
- `grep -c "Dev login" dist/assets/*.js`: 0 in both files.
- `git --no-pager grep -n -i "service_role" -- src`: empty.
- Every `scripts/check-*.ts` passes (20 scripts, including `check-offline-banner.ts`, 5 checks after the review fix); `node scripts/check-sounds.mjs` passes.
- `package.json` and `package-lock.json`: no diff against `main`.

## Manual steps for an iPhone PWA

**Nothing below has been verified on a device or in a browser. Everything above is from reading code and running the pure-function check scripts.** Do it on the `ZZ-TEST` event, never during a live event.

1. **Login without network.** Airplane mode on, then launch the app. Tap Cashier. Expect "Couldn't load staff. Check the connection." and a Retry button, not "No staff for this role yet.". Turn airplane mode off, wait a few seconds, tap Retry: "Loading staff…" briefly, then the names; log in with a PIN.
2. **Slow link, Press.** Throttle the link (weak Wi-Fi, or Slow 3G on a laptop), open Press. Expect "Loading orders…" in the counter line and in the empty area, no "0 in queue", no "Queue is empty 🎉", and no orange banner within the first 3 s, and the "N in queue" line empty (not "Loading orders…" twice). After the orders arrive, "N in queue" or the empty state.
3. **Slow link, Cashier.** Same, open the Queue tab: "Loading orders…" in both sections, no "None of your orders is ready yet." or "No open orders from you." until loaded.
4. **Network lost after login.** Logged in on Press or Cashier with orders on screen, switch on airplane mode. The orange banner appears at once (the connection existed) and the list stays.
5. **Launch with no network at all.** Airplane mode, open an already-logged-in session. Expect "Loading orders…", then the orange banner about 3 s after the screen opens (it cannot connect, so the banner is allowed).
6. **Cashier, designs failing.** Log in on Cashier with the network on, then launch again with airplane mode on (session survives reload) and open New order. In Bundle and in Custom print: "Couldn't load designs. Check the connection." with Retry above the tiles, "No print" still selectable. Network back, Retry: "Loading designs…", then the design tiles.
7. **Banner timing (review fix).** Launch on a slow link: no orange banner within 3 s while the socket connects. Airplane mode before launch: the banner appears after about 3 s. Drop the network after the app was connected: the banner appears at once.
8. **Regression glance.** Normal network: login names appear, Press and Cashier show orders, a new order still alerts once, Admin Orders still lists orders.

## Not in this round

Everything else in the audit (round 3, P2), the update banner, resume-from-background banner timing, type scale, any new feature.

## Diff of `src/hooks/useOrders.ts` against `main`

```diff
@@ -31,6 +31,8 @@ export function useOrders(eventId: string | null, opts: Options = {}) {
   const [subscribed, setSubscribed] = useState(false);
   const [online, setOnline] = useState(() => navigator.onLine);
   const [fetchOk, setFetchOk] = useState(true);
+  // True after the first successful fetch for this event; pages show "Loading…" until then.
+  const [loaded, setLoaded] = useState(false);
 
   // Keep latest callbacks without re-subscribing.
   const cb = useRef(opts);
@@ -74,6 +76,7 @@ export function useOrders(eventId: string | null, opts: Options = {}) {
     hasLoaded.current = true;
     setOrders(list);
     setFetchOk(true);
+    setLoaded(true);
     cb.current.onLoaded?.(list, kind);
   }, [eventId]);
 
@@ -83,6 +86,7 @@ export function useOrders(eventId: string | null, opts: Options = {}) {
     hasLoaded.current = false;
     appliedSeq.current = reqSeq.current; // anything in flight for the old event is stale
     setOrders([]);
+    setLoaded(false);
     setFetchOk(true);
     void reload();
 
@@ -144,5 +148,5 @@ export function useOrders(eventId: string | null, opts: Options = {}) {
   // Real connection state: socket subscribed, browser online, last query ok.
   const connected = subscribed && online && fetchOk;
 
-  return { orders, connected, reload };
+  return { orders, connected, loaded, reload };
 }
```
