# R27: app version label, update polling and safe apply (gdansk-rel-1)

Branch `gdansk-rel-1`, off `main` at 333e1d1 (`git log main` contains `Merge gdansk-ux-9: own-only queue, admin Orders, meta lines, countdown`). No schema, RLS, RPC, migration or dependency change. Only the `"version"` field of `package.json` and `package-lock.json` changes. Nothing pushed or merged. Owner decisions D21 = A and D22 = A, not reopened.

## Recon

Written before any other file was edited. Line numbers refer to 333e1d1 and to the installed packages (`vite-plugin-pwa` 1.3.0, `workbox-build` 7.4.1, `workbox-window` 7.4.1). Everything here is from reading code and the existing `dist/` output; nothing was run on a device or in a browser.

### Why phones stay on the old JS

- [vite.config.ts:23](../../vite.config.ts#L23) sets `registerType: 'autoUpdate'`; `injectRegister` is left at its default `'auto'`.
- [src/main.tsx](../../src/main.tsx) never imports `virtual:pwa-register`. With no import, the plugin falls back to a plain registration script: `injectRegister: 'auto'` becomes `'script'` when no import is found (`node_modules/vite-plugin-pwa/dist/index.js:253-254` and `:391-392`; `useImportRegister` is set only when the virtual module is imported, `:1019`). The built `dist/registerSW.js` is exactly `navigator.serviceWorker.register('/sw.js', { scope: '/' })` on `load`: no `update()` polling, no `controllerchange` or `activated` handler, no reload.
- So the browser's own update check (on navigation, at most about every 24 h for a page that stays open) is the only trigger, and even when the new service worker takes over, the running page keeps the old JS until the user restarts it. That is the "swipe away two or three times" the owner sees.

### How the plugin behaves in autoUpdate mode

- **Generated SW does `skipWaiting` and `clientsClaim`.** `index.js:874-877`: when `injectRegister` is `'auto'` (or null) and `registerType` is `autoUpdate`, `workbox.skipWaiting` and `workbox.clientsClaim` are set to true. The existing build confirms it: `dist/sw.js` contains `self.skipWaiting(), e.clientsClaim(), e.precacheAndRoute(...), e.cleanupOutdatedCaches()` and a `NavigationRoute` bound to `index.html`. Importing the virtual module does not change this, because the check runs on the user's option (still `'auto'`) when options are resolved, before the per-build resolution at `:253` and `:391`. To be sure, I check `dist/sw.js` again after the build.
- **The virtual registration script reloads by itself.** `node_modules/vite-plugin-pwa/dist/client/build/register.js:39-47`: in auto mode it listens to workbox-window's `activated` and, when `event.isUpdate || event.isExternal`, calls `onNeedReload()` if given, **otherwise `window.location.reload()`**. Because the SW skips waiting, `activated` follows right after `installed`, so with a bare `registerSW()` the page would reload immediately, in the middle of a draft or an alert. Passing `onNeedReload` replaces that reload, so it is my hook for the safe apply.
- **`immediate: true`** is passed to `wb.register({ immediate })` (`register.js:84`): registration runs at once instead of waiting for `window.load`.
- **`onRegisteredSW(url, registration)`** (`register.js:84-89`) hands out the `ServiceWorkerRegistration`, which is what `registration.update()` needs for polling.
- **Interplay with `registerSW.js`.** Once `virtual:pwa-register` is imported, `injectRegister` resolves to `false`/`null` and no `registerSW.js` is emitted or injected into `index.html`, so there is one registration path, not two. `registerSW.js` also drops out of the precache list. Old phones that still have the old `index.html` registered keep working: the old script only registers `/sw.js`.
- **Lazy chunks.** `src` has no `lazy(` or `import(`, so the app is one bundle. The plugin's register code loads `workbox-window` with a dynamic `import()` at start (`register.js:27`); in the build it is `assets/workbox-window.prod.es5-*.js` and is in the precache list. When the new SW activates, `cleanupOutdatedCaches` removes the old precache, so a page that stays on the old JS (banner case) has no lazy chunk of its own to lose; the new build's precache holds the images and sounds it fetches by URL.
- **First rollout caveat.** Phones that run the current build have no update code. The first deploy of this branch still needs the manual swipe-away on each phone; after that the new logic is the one that is running. Stated here so nobody expects the first deploy to self-update.

### sw.js caching headers

- [vercel.json](../../vercel.json) has only a rewrite `/(.*)` to `/index.html`; there is no `headers` block. Vercel serves files that exist in the build output before applying rewrites, so `/sw.js` is the real file, not `index.html`.
- Vercel's default for static output without custom headers is `Cache-Control: public, max-age=0, must-revalidate`, which means revalidation on every request. This is Vercel's documented default; **I did not request the live URL, so it is not measured here**. Browsers also bypass the HTTP cache for the SW script itself by default (`updateViaCache: 'imports'`), so `registration.update()` fetches `sw.js` from the network. The `workbox-<hash>.js` it imports has a hash in its name.
- No `vercel.json` change is needed. I add a manual step to `curl -I` the live `/sw.js` once to confirm.

### Busy places (item 3)

- Cashier draft: [CashierPage.tsx:325](../../src/pages/CashierPage.tsx#L325) `dirty` is the condition that enables Reset ([:395](../../src/pages/CashierPage.tsx#L395) `disabled={!dirty || busy}`). Send in flight: [:252](../../src/pages/CashierPage.tsx#L252) `busy`. Both live in the same component (the order form), so two one-line hook calls cover them.
- Ready alert overlay: [AlertOverlay.tsx:11-24](../../src/components/AlertOverlay.tsx#L11-L24) is mounted only while the overlay is open, so "mounted" means "open".
- Confirm dialog: [ConfirmDialog.tsx:5-34](../../src/components/ConfirmDialog.tsx#L5-L34), same: mounted means open. More than one can exist (Press, Admin, Cashier each own theirs), so the registry counts per reason.
- PIN digits: [PinPad.tsx:16](../../src/components/PinPad.tsx#L16) `pin` state; busy while `pin.length > 0` (it is cleared right after the 4th digit is sent, [:21-23](../../src/components/PinPad.tsx#L21-L23)).
- Not covered by the list, so not covered by the code: admin forms (staff name, event editor, design upload) and the Press screen. A reload on those drops unsent input or an open lightbox. Reported, not added (non-goal).
- Mounting point for the code: `startAppUpdates()` is called once from [main.tsx](../../src/main.tsx) before `createRoot`, not from an effect, so React StrictMode cannot start it twice; the banner is a small component mounted in `App`.

### Plan

- `src/lib/appBusy.ts`: module-level registry, `acquireBusy(reason)` returns a release function, counted per reason; `busyReasons()` and `subscribeBusy`. `src/hooks/useBusy.ts`: `useBusy(reason, active)`.
- `src/lib/updatePolicy.ts`: pure `updateAction({ updateReady, busyReasons })` returning `wait | banner | apply`, and pure `reloadGuard(...)` for the safety rules (offline, first 10 s, already reloaded from this build).
- `src/lib/appUpdate.ts`: registration, polling (60 s while visible, plus `visibilitychange` to visible and `online`), the evaluation loop, and a tiny store for the banner. `UpdateBanner` shows "New version ready, tap to reload".
- Loop protection: the running build id is written to `sessionStorage` right before an automatic reload; if the page comes back with the same build id and an update is reported again, it does not reload again. At most one automatic reload per page load.

### Go / stop

- Item 1 (version label): **GO.**
- Item 2 (polling): **GO.** `onNeedReload` replaces the plugin's own reload, so polling and the safe apply share one entry point.
- Item 3 (busy registry): **GO.** It is four one- or two-line hook calls (CashierPage form, AlertOverlay, ConfirmDialog, PinPad), no behavior change in any of them. Option B is not needed.
- Item 4 (safety rules): **GO.**
- Not touched: PIN login logic, audio and sound triggers, wake lock, order numbering, `create_order_v2`, `mergeOrders`, alert dedupe, Stats and CSV, palette and tokens, server.

## Changes

Commits on `gdansk-rel-1` (the last one holds this report, the acceptance tests and the phase doc):

1. `feat(build)` version label: `package.json` and `package-lock.json` (only the `"version"` value, `0.0.0` to `1.0.0`; the lock file has it in two places), [vite.config.ts](../../vite.config.ts) (`__APP_VERSION__` read from `package.json`), [vite-env.d.ts](../../src/vite-env.d.ts), [buildLabel.ts](../../src/lib/buildLabel.ts) (`formatBuildLabel`), [BuildTag.tsx](../../src/components/BuildTag.tsx), [check-build-label.ts](../../scripts/check-build-label.ts) (16 checks).
2. `feat(pwa)` update polling and safe apply: [appUpdate.ts](../../src/lib/appUpdate.ts), [updatePolicy.ts](../../src/lib/updatePolicy.ts), [appBusy.ts](../../src/lib/appBusy.ts), [useBusy.ts](../../src/hooks/useBusy.ts), [UpdateBanner.tsx](../../src/components/UpdateBanner.tsx), [check-update-policy.ts](../../scripts/check-update-policy.ts) (24 checks), [main.tsx](../../src/main.tsx), [index.css](../../src/index.css) (`.update-banner`), and one or two lines each in [CashierPage.tsx](../../src/pages/CashierPage.tsx), [AlertOverlay.tsx](../../src/components/AlertOverlay.tsx), [ConfirmDialog.tsx](../../src/components/ConfirmDialog.tsx), [PinPad.tsx](../../src/components/PinPad.tsx).
3. `docs`: this file, `12_ACCEPTANCE_TESTS.md` (version 16; B1.10, J.0, new F1.3 to F1.10, M), `11_PHASE_GDANSK.md`.

What it does:

- **Label.** "v1.0 · 333e1d1" (major.minor only, patch hidden). A missing or invalid version gives the id alone; the id is always in the label. In the built bundle both values appear as literals (`ro('1.0.0','333e1d1')`), so the deploy grep for the hash still matches. The "build " prefix is gone; the label stands alone.
- **Polling.** `registerSW({ immediate: true })`; `registration.update()` every 60 s while the page is visible, on `visibilitychange` to visible, and on `online`. Skipped while `navigator.onLine` is false; a failed `update()` is swallowed and retried on the next tick.
- **Apply.** `onNeedReload` (fires when the new SW has activated) sets `updateReady`. `updateAction` gives `apply` when idle, `banner` when any busy reason is held, `wait` when nothing is ready. The banner is a fixed pill at the top ("New version ready, tap to reload"), below the overlays (z-index 60 against 100), and its tap reloads without the guards. The decision is re-run when the busy set changes, on `online`, on visibility and once 10 s after load.
- **Busy reasons.** `draft` (the `dirty` condition that enables Reset), `sending` (`busy`), `alert` (AlertOverlay mounted), `confirm` (ConfirmDialog mounted, counted so two dialogs do not cancel each other), `pin` (PIN digits typed). No behavior of those components changed.
- **Safety.** At most one automatic reload per page load; before reloading, the running build id goes into `sessionStorage` (`mpq.reloadedFrom`) and an update reported again by a page that has the same build id is not applied (no loop if a reload does not bring a new build); no automatic reload while offline; none in the first 10 s.

Things to know:

- **First rollout.** Phones running the current build have no update code, so the first deploy of this branch still needs the manual swipe-away on each phone.
- **Not covered busy states.** Admin forms (staff, event editor, design upload) and the Press screen do not register as busy; an automatic reload there drops unsent input. Not in the list, so not added. A one-line `useBusy` call per form would cover them if wanted.
- **sessionStorage in a PWA.** If storage is unavailable the cross-reload loop guard is skipped (`appliedThisLoad` still stops a repeat inside one page load).
- **`updateReady` is not a version id.** The plugin callback carries no version. "Once per detected version" is implemented as "once per page load, and not again from the same build id".
- **Banner on Press.** The Press screen has no busy hooks, so on Press an update applies as soon as it is detected (after the first 10 s), also while a lightbox is open. A claim or status tap in flight can be cut by the reload; the server call is idempotent by status (forward-only), and the card refetches on load.
- **`sw.js` headers** are read from the repo and Vercel's documented default, not measured.

## Validation

Run on the final tree:

- `npx tsc -b`: clean.
- `npm run lint`: clean.
- `npm run build`: ok (PWA 9 precache entries; `dist/registerSW.js` is no longer emitted; `dist/sw.js` still has `skipWaiting()` and `clientsClaim()`).
- `grep -c "Dev login" dist/assets/*.js`: 0 in both files.
- `git --no-pager grep -n -i "service_role" -- src`: empty.
- Every `scripts/check-*.ts` (20, including `check-build-label.ts` and `check-update-policy.ts`) and `node scripts/check-sounds.mjs`: all pass.
- `git diff --stat main`: see the final message.

## Nothing is verified on a device

I have not opened this in a browser, on an iPhone or an Android phone. Nothing here ran against a real service worker update: the service worker was never registered, never updated, and the banner was never rendered. Covered by pure check scripts only: the label formatter, `updateAction`, `reloadGuard` and the busy registry. Everything else (that `update()` finds a new `sw.js`, that `onNeedReload` fires after `skipWaiting`, the reload, the banner position on a phone, iOS standalone behavior with timers and `visibilitychange`, the 60 s timing) comes from reading the plugin code and the build output. **The update flow can only be proven by two real deploys.**

## Manual steps

Use the `ZZ-TEST` event only; never during a real event, never push `main` while an event runs. Do not call `activate_event`.

1. Deploy this branch once (after review and merge). On each phone swipe the PWA away until the label reads "v1.0 · <hash>" and the hash equals `git rev-parse --short main`. This first deploy is the only manual one.
2. `curl -sI https://merchpress-queue.vercel.app/sw.js | grep -i cache-control`: expect `max-age=0, must-revalidate`.
3. Phone A (cashier, idle, screen on, Queue tab, no draft) and phone B (cashier, a draft: pick a colour and a size, do not send). Phone C optional: Press, idle.
4. Make a trivial change, bump the minor with the release helper (`1.1.0`), merge and deploy (deploy 1). Do not touch the phones.
5. Within about 60 s: phone A reloads by itself and the label reads "v1.1 · <new hash>", still logged in (F1.5). Phone B shows the banner "New version ready, tap to reload", the draft is intact, label still old (F1.6). On B tap Reset: the page reloads by itself (F1.7).
6. Repeat the change and deploy again (deploy 2, `1.2.0`). On B, trigger a Ready alert (press phone sets one of B's orders Ready) or open "Cancel order" on the Queue, and wait over a minute: no reload while the overlay or dialog is open, reload after dismissing (F1.8).
7. On a phone at the login screen, type two PIN digits and deploy: no reload until the digits are cleared or the PIN is sent.
8. Airplane mode on phone A, deploy, wait two minutes, turn the network on: no reload while offline, reload within about a minute after reconnect (F1.9).
9. Open the app right before an expected update reaches it (F1.10): no reload in the first 10 s.
10. Two consecutive deploys are the only real proof of the flow; the pure scripts do not exercise a service worker.

Nothing above has been run on a device.
