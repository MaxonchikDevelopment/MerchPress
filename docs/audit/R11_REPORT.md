# R11 Report: admin confirmations, build tag, hints (gdansk-fix-8)

## Recon

Written before any other file was created or edited. Branch `gdansk-fix-8` off `main` at 1d0bc37. `git log --merges` shows main contains the merge of gdansk-fix-7 (1d0bc37, event end date). No SQL, schema, RLS, RPC or dependency change is part of this task.

### Confirm dialog today
- `src/components/ConfirmDialog.tsx:4-18` takes `title`, `confirmLabel`, `cancelLabel`, optional `busy`, `onConfirm`, `onCancel`. The scrim click calls `onCancel` unless `busy` (line 21). The confirm button is always `btn-danger` (line 41). It has no body text slot: the whole message is the `title` (26 px, line 40).
- The only user is `src/hooks/useCancelOrder.tsx:32-41`: `target` state decides whether the dialog is rendered, `busy` state guards double taps (line 18), the hook returns `{ askCancel, dialog }` and the page renders `{cancelDialog}` as the last child of `.app` (`CashierPage.tsx:199`, `PressPage.tsx:146`).
- Consequence for the plan: a long sentence goes into `title` as-is. I will use the same pattern locally (a `pending` state plus a conditional `<ConfirmDialog>`), no new component.

### "Set active" wiring
- `src/pages/AdminEventsPage.tsx:39-45`: `activate(id)` returns early if `activating`, sets `activating`, awaits `activateEvent(id)`, stores the returned error string, awaits `reloadActiveEvent()`, clears `activating`.
- Button at `AdminEventsPage.tsx:117-119`: `onClick={() => activate(e.id)}`, only rendered for non-active events (line 114-116 shows the badge otherwise).
- "Another event is active" is known from the local list: `events.some((x) => x.is_active)`; `useSession().activeEvent` (`SessionContext.tsx:20`) is the other source. The list is the one the buttons are rendered from, so I will use it.

### "Deactivate" wiring
- `src/pages/AdminStaffPage.tsx:232-240` in `PersonRow`: `disabled={busy || (isSelf && person.is_active)}` and `onClick={() => run(() => onUpdate(person.name, person.role, !person.is_active))}`. The label is `Deactivate` or `Activate` (line 239). `run` (lines 214-220) guards `busy`, awaits, and returns to `view` mode on success.
- Last-admin protection is server-side: the `staff_update` RPC raises `last_admin`, mapped to a message in `src/lib/staffApi.ts:12`. The client only blocks self-deactivation (the `disabled` above). Both stay untouched; the dialog only sits in front of the existing call.
- Plan: local `confirming` state in `PersonRow`; Deactivate sets it, "Activate" still calls `run` directly. Dialog confirm calls the same `run(...)` and closes the dialog first.

### vite.config.ts and Vercel
- `vite.config.ts:6-30`: `defineConfig({ plugins: [react(), VitePWA({ registerType: 'autoUpdate', includeAssets: [...], manifest })] })`. No `define`, no `process` use yet. `tsconfig.node.json` includes only `vite.config.ts`, has `types: ["node"]`, `allowImportingTsExtensions: true`, `erasableSyntaxOnly: true`, so `node:child_process` and an import of `./src/lib/buildId.ts` both type-check.
- `vercel.json` only has the SPA rewrite. It sets no env and no build command, so the build is Vercel's default (`npm run build`).
- Whether Vercel exposes `VERCEL_GIT_COMMIT_SHA` to the build: Vercel documents it as a System Environment Variable, available at build time when "Automatically expose System Environment Variables" is on (the default). **Update: verified on production, the build tag on the login screen showed the merge commit hash (0b98022) on 07.10.2026.** Original note: I could not verify this from the repo or from here: the project setting lives in the Vercel dashboard, and `.vercel/` holds only the link files, no env. If it is off, the fallback `git rev-parse --short HEAD` still works, because Vercel clones the repo with `.git`; if that fails too, the tag shows `dev`. Check on the first deploy that the tag is a real hash.
- `process.env.VERCEL_GIT_COMMIT_SHA` is read in Node at config time and inlined as a string by `define`; it is not a `VITE_` variable and is a public commit hash, not a secret.
- Local dev: `dist`, `.env.local` exist; `.gitignore:11` ignores `dist`. The PWA plugin generates `dist/sw.js` with a Workbox precache manifest (revision per file), see 3b below for the check.

### Where each screen's bottom renders
| Screen | File | Bottom of the content area |
|---|---|---|
| Login (RoleSelect) | `src/components/RoleSelect.tsx:73-157` | `.app` > `header.topbar` + `div.content` (maxWidth 640, line 83); the content `</div>` closes at line 156. The tag goes as the last child inside `.content`, after the three stage blocks (line 155). |
| Admin | `src/pages/AdminPage.tsx:29-34` | `div.content` (maxWidth 980) holds the active tab; closes at line 34. The tag goes as the last child inside it, after `{tab === 'stats' && ...}`. |
| Cashier | `src/pages/CashierPage.tsx:143-196` | `div.content` (maxWidth 1100) holds `.cashier-tabs` and `.two-col`; closes at line 196. The sticky Send bar lives inside `NewOrderForm` in the `.two-col` (`CashierPage.tsx:304-355`, CSS `.send-bar` at `index.css:375-377`, "sticky (never fixed) at the bottom of the scrolling .content"). The tag goes after `</div>` of `.two-col` (line 195), as the last child of `.content`, never inside the bar. |
| Press | `src/pages/PressPage.tsx:110-144` | `div.content` (no max width) holds the toast, the count and the grid; closes at line 144. The tag goes as the last child after the grid. |

- `.content` is `flex: 1; overflow-y: auto` with bottom padding `--sp-6` plus the safe area (`index.css:301-306`), so a muted line at the end of the content scrolls with the content and does not take fixed space.
- The "No active event" early-return screens of Cashier (line 130-135) and Press (98-103) do not get the tag. They are not one of the four listed content areas, so I leave them alone.

### Other findings
- `AdminPage.tsx:13` initial tab is `'designs'`. `useSession()` provides `activeEvent` and `loadingEvent`; the Admin page is only shown after the session loads, but I will verify in the code whether `activeEvent` can still be loading at first render.
- `AdminDesignsPage.tsx:103-104`: the "Compatible colors" label and `ColorToggles`. No hint today.
- `ColorPicker.tsx:9-27` is advisory: `dim = allowed && allowed.length > 0 && !allowed.includes(c.key)` gives opacity 0.45 and a tooltip, but the button still calls `onChange`. So `12_ACCEPTANCE_TESTS.md:190` (C1.AC3: "only colours compatible with all chosen designs are available") and `:202` (C1.4: "Только совместимые") are wrong, and an empty compatible list allows all.
- Event poll interval is `EVENT_POLL_MS = 20_000` (`SessionContext.tsx:16`), so "within about 30 seconds" in the dialog texts is the user's wording and is on the safe side.

### Cannot verify
- (Resolved) Whether Vercel exposes `VERCEL_GIT_COMMIT_SHA`: verified on production, the build tag on the login screen showed the merge commit hash (0b98022) on 07.10.2026.
- Dialogs, build tag and layout on a real device.

## What changed

| Item | Where |
|---|---|
| (1) Switch confirm | `AdminEventsPage.tsx`: `askActivate(e)` opens `ConfirmDialog` ("Switch the active event to <name>? All stations will switch within about 30 seconds.", "Switch" / "Keep current") when `events.some(x => x.is_active)`, else calls `activate` directly. `activate` itself is unchanged. |
| (2) Deactivate confirm | `AdminStaffPage.tsx` `PersonRow`: `confirming` state; Deactivate opens the dialog ("Deactivate <name>? They will be signed out within about 30 seconds.", "Deactivate" / "Cancel"), Activate still calls `run` directly. The `disabled` self-protection and the server-side `last_admin` error are untouched. |
| (3) Build tag | `src/lib/buildId.ts` (pure `buildId(env, gitSha)`), `vite.config.ts` (`define: { __BUILD_ID__ }`, `git rev-parse --short HEAD` through `execSync`, errors give `''`), `src/vite-env.d.ts`, `src/components/BuildTag.tsx` (muted, 11 px, centred, `build <id>`). Rendered as the last child of `.content` in RoleSelect, AdminPage, CashierPage (after `.two-col`, outside the Send bar) and PressPage (after the grid). No network call, no state. |
| (4) Hints | `AdminDesignsPage.tsx`: muted 13 px line under the "Compatible colors" label. `AdminPage.tsx`: initial tab is `activeEvent ? 'designs' : 'events'`. |
| Docs | `12_ACCEPTANCE_TESTS.md`: C1.AC3 and C1.4 corrected (dimmed but selectable, empty list allows all); new A3.5, A5.10, A4.9; H1.1 extended. `11_PHASE_GDANSK.md`: entry added. |

Commit split note: `src/lib/buildId.ts` is in the build-tag commit, not in the "check script" commit, because `vite.config.ts` imports it and each commit has to build. The check script and this report are in the third commit as requested.

Behavior note: `AdminPage` remounts after an activation (`reloadActiveEvent` is non-silent, so `App` unmounts the page while loading). After activating the first event from the Events tab the page therefore returns on the Designs tab, as it did before; with an active event the initial tab is `designs`.

## 3b: does the build tag change the service worker precache hash?

Yes. Checked with three local builds. `__BUILD_ID__` is inlined into the main bundle, so its content hash changes, and Workbox lists that file by URL (`revision:null`, the hash is in the name) and `index.html` (which references it) with a changed revision:

```
VERCEL_GIT_COMMIT_SHA=aaaaaaa1234  ->  assets/index-BfjCcWb5.js, index.html revision c50c3c4166400b84112745961ac4bbc1
VERCEL_GIT_COMMIT_SHA=bbbbbbb9999  ->  assets/index-CTcpIZ-l.js, index.html revision 0833eb4872f8ac99fd0d8c98c0f33afb
```

A build with no env var printed ``children:[`build `,`50ac493` `` in the bundle, which is the local `git rev-parse --short HEAD` fallback. So a new commit on Vercel gives a new precache manifest and the service worker updates, as it does today with any code change. Caveat: a deploy with identical source but a different commit sha now also produces a new precache, which is intended here.

## Validation

- `npx tsc -b`: clean.
- `npm run lint`: clean.
- `npm run build`: built, `precache 9 entries (460.58 KiB)`.
- `grep -c "Dev login" dist/assets/*.js`: `0`.
- `git --no-pager grep -n -i "service_role" -- src`: empty.
- `git diff --stat` before the last commits: 4 modified files (the two docs, `AdminDesignsPage.tsx`, `AdminPage.tsx`) plus the new report and check script.

`node scripts/check-build-id.ts` (real output):

```
ok 1 env value present
ok 2 env missing, git value present
ok 3 env empty string falls back to git
ok 4 both missing gives dev
ok 5 both blank gives dev
ok 6 longer value cut to 7
ok 7 git value cut to 7
ok 8 whitespace trimmed
ok 9 trim happens before the cut
ok 10 git newline trimmed
ok 11 short value kept as is
all 11 checks passed
```

## Not verified

- **The two dialogs, the build tag and the layout (900 px breakpoint, sticky Send bar, 11 px tag) are not verified on a device.** Only type-check, lint, build and the pure-logic script ran. The dialog is the existing `ConfirmDialog`, fixed-position; its ancestors end their `enter` animation with `transform: none`, so I expect no containing-block problem, but I did not see it render.
- (Resolved) Whether Vercel exposes `VERCEL_GIT_COMMIT_SHA`: verified on production, the build tag on the login screen showed the merge commit hash (0b98022) on 07.10.2026.
- No real data touched, `activate_event` and `staff_update` were not called.
