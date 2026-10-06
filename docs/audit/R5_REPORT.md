# R5 report: louder, richer alert sounds and a Test sound button

Branch `gdansk-fix-2`, not pushed, not merged. No schema, RLS, RPC, migration, dependency, auth or SoundGate change.

## Recon
- Sounds are built in [scripts/gen-assets.mjs](../../scripts/gen-assets.mjs): `wav(beeps)` at lines 59-88 (old version) generated one sine per beep (`Math.sin(2π·freq·t) * env * 0.6`, 10 ms linear fade, no normalisation), and lines 90-98 called it for `public/sounds/new-order.wav` (660 Hz 140 ms, gap, 880 Hz 180 ms) and `ready.wav` (988, 988, 1319 Hz). Peak 0.6 gives -4.44 dBFS. Icons are generated above (lines 11-57) and were left alone; re-running the script leaves them byte-identical.
- `soundRetry` is an optional boolean prop on TopBar ([TopBar.tsx:13](../../src/components/TopBar.tsx#L13)). Only [PressPage.tsx:108](../../src/pages/PressPage.tsx#L108) and [CashierPage.tsx:125](../../src/pages/CashierPage.tsx#L125) pass it (the loading variants at PressPage:100 and CashierPage:117 and AdminPage do not). It gates `SoundRetryButton` and the wake-lock pill.
- [App.tsx:29-37](../../src/App.tsx#L29-L37) routes role `press` to PressPage and `cashier` to CashierPage one to one, so TopBar picks the sound from `user.role` and needs no new prop.
- [notify.ts](../../src/lib/notify.ts) exports: `getAudioState` (20), `getGateDismissed` (25), `isAudioUnlocked` (26), `subscribeAudioState` (27), `tapGate` (33), `unlockAudio` (55), `alertNewOrder` (99), `alertReady` (104), `SeenSet` (130). `unlockAudio` is a no-op unless the state is `locked`.

## Changes
1. `gen-assets.mjs` (sound part only): each beep is fundamental + 2nd (0.8) + 3rd (0.5) harmonic, 5 ms attack, exponential decay (about -40 dB over the beep), 3 ms release, whole file normalised to -1 dBFS.
   - new-order, 1.2 s: 880 Hz 220 ms, 1175 Hz 300 ms, played twice (4 bursts).
   - ready, 1.6 s: 1320, 1320, 1760 Hz at 140/140/200 ms with a 200 ms pause, played twice (6 bursts).
2. `scripts/check-sounds.mjs`: plain Node, own WAV parser and FFT, exits 1 on failure. "Before" reads the old files via `git show $BEFORE_REF:...` (default HEAD; use `BEFORE_REF=main` after committing).
3. TopBar: "🔔 Test sound" button (class `btn`) after `SoundRetryButton`, only when `soundRetry` and a user. It calls `unlockAudio()` then `alertNewOrder()` for press or `alertReady()` otherwise. It also vibrates, because the existing alert functions do; they were not changed.

## check-sounds output (`BEFORE_REF=main node scripts/check-sounds.mjs`)
```
before  new-order  peak -4.44 dBFS | clipped 0 | 0.38 s | 1.5-4 kHz 0.0% | bursts 2 | 33 KB
before  ready      peak -4.44 dBFS | clipped 0 | 0.66 s | 1.5-4 kHz 0.0% | bursts 3 | 57 KB
after   new-order  peak -1.00 dBFS | clipped 0 | 1.20 s | 1.5-4 kHz 47.1% | bursts 4 | 103 KB
after   ready      peak -1.00 dBFS | clipped 0 | 1.60 s | 1.5-4 kHz 65.1% | bursts 6 | 138 KB

OK: all checks passed (signal properties only; audibility is verified on devices).
```

## Validation
- `npx tsc -b`, `npm run lint`, `npm run build`: pass.
- `grep -c "Dev login" dist/assets/*.js`: 0.
- `git grep -n -i service_role -- src`: empty.
- Final `git diff --stat` for the whole branch is in the hand-off message.

## Not verified
These numbers describe the files only. **Audibility in the hall is verified on devices only** (iPhone home-screen PWA, Android Chrome, MacBook). Use the Test sound button on each device, with the ringer switch and volume in their normal event position. Peak is -1 dBFS but perceived loudness still depends on the device speaker.
- On first tap while audio is locked, `unlockAudio` and the test play start together; if a device plays nothing on the very first tap, tap again.
