# Phase Summary: Gdansk (10-11 Oct 2026)

Branch `gdansk-sprint` was merged into `main` at aa2105f and deployed by Vercel.

## Shipped
| Commit | What |
|---|---|
| a5e00c2 | Removed unused `react-router-dom`; hardened `.gitignore` |
| 0098b30 | `CLAUDE.md`, audit skeleton, recon, security decision |
| 88be89a, c46c6e6 | Real connection state, refetch triggers, gap alerts; `set_order_status` failures surfaced; audio gated on a tap |
| f73a2dd | PWA orientation any, shared wait thresholds (7 / 15 min), placeholders |
| 32c31fe | Migrations 0003/0004 written (round 1 of 2) |
| b95d6f6, 967fd51 | Audio unlock before the PIN await; sound gate that never traps; realtime merged into refetch snapshots |
| 2c72336 | Live DB check, security status (0003/0004 applied 2026-10-05) |
| 79969ea | `cancelled` types, idempotent `create_order_v2` with 12 s abort |
| 99a9484 | Cancel from Cashier and Press with confirmation |
| 3cf3f9c | Staff tab on `staff_*` RPCs; `activate_event` RPC |
| 877bdb0 | Cancelled KPI, totals exclude cancelled; R2 live test |
| aca618f | Block false success when a resent draft returns an earlier order |
| 525f4f6 | Per-event shirt colours and sizes, event editor |
| 1f2be54 | Design edit, hide/show, replace photos, client-side compression |
| 3ab0640 | Session revalidation; `createOrder` separates rejection from network failure |
| a01dabc | Wording, dead code removal, R2C live test and report |

This docs commit also deletes `supabase/seed.sql` and rewrites README and the audit docs.

## Post-merge fixes
| Branch | What |
|---|---|
| `gdansk-fix-1` | Wake lock re-acquires when the system releases it (stops after 3 quick failures until the next visibilitychange or a tap); state exposed via `useSyncExternalStore`; TopBar shows a "Screen may sleep" pill, tap to retry. No device test yet. |
| `gdansk-fix-1` (R3) | Wake lock `pending` state, pill only on Press and Cashier; a losing Claim now shows "Already taken by <name>" and refetches (client-side `claimOrder`); concurrency live test `scripts/r3-livetest.mjs`, see `R3_REPORT.md`. |
| `gdansk-fix-2` (R5) | Alert sounds regenerated (1.2 s and 1.6 s, harmonics, -1 dBFS) with `scripts/check-sounds.mjs`; "Test sound" button in TopBar on Press and Cashier. Audibility not verified, devices only. See `R5_REPORT.md`. |
| `gdansk-fix-3` (R6) | Pill shows "Set Auto-Lock to Never" when wake lock is unsupported (title was invisible on touch); a Claim that lands on a `ready` row is now `taken` (or `claimed` if it is ours) instead of "Check the connection"; `scripts/check-claim-result.ts`, see `R6_REPORT.md`. |
| `gdansk-fix-4` (R7) | Date inputs and `1fr` grid columns can no longer stretch the page on narrow phones (`minmax(0, 1fr)`, date input `min-width: 0`); tap a print thumbnail to enlarge it (`ImageLightbox`, below the Ready alert); a muted line says why "Send to press" is disabled (`sendHint`, `scripts/check-send-hint.ts`). Not verified on a device. See `R7_REPORT.md`. |
| `gdansk-fix-6` (R9) | Cashier on phones: below 900 px a New order / Queue tab bar (both panes stay mounted, CSS-only hide, so the draft survives), Queue badge with own Ready count, sticky Send bar with a one-line summary, and dismissing the Ready alert opens Queue. Based on `main`, independent of `gdansk-fix-5`. Not verified on a device. `scripts/check-cashier-ui.ts`, see `R9_REPORT.md`. |

## Deferred
| Item | Why | Return condition |
|---|---|---|
| Supabase Auth with per-person accounts and role-based RLS | PIN plus anon key accepted for Gdansk; events, designs, orders, Storage stay open to anon; `staff_*` and `activate_event` have no rate limit | Before Poznan (20-22 Nov 2026) |
| PIN hashing | PINs are plain text and `verify_pin` returns the user row including `pin` | With the Auth move, or earlier if the PIN column outlives it |
| Product catalog | Orders are a design, colour and size; no SKUs or prices needed for Gdansk | When stock, prices or payments are in scope |
| Sizes outside XS-XXL | `orders.shirt_size` is an enum; event sizes can only be a subset | When an event needs another size (column type change, two-round pattern) |
| Offline write queue | Cloud-first by design; retries are safe but nothing is queued | After real Wi-Fi data from Gdansk shows it matters |
| Tests and CI | Only live scripts (`scripts/r*-livetest.mjs`, `check-merge-orders.ts`) exist | Before Poznan, at least for queue semantics |

Smaller open items: `scripts/r1-livetest.mjs` never ran; R2 staff live scenarios were skipped (need `MP_ADMIN_ID` and `MP_ADMIN_PIN`) and the `ZZ-R2-STAFF` row must be deleted by the owner; designs load once per event so Hide/Show reaches tablets after a reload; admin PIN is lost on reload by design; the R1, R2B and R2C manual checklists have no results; open questions 3, 5, 6, 7, 8 and 10 in `R2A_REPORT.md`.

## Where the next phase starts
1. Run the go/no-go check in `08_TESTING_RUNBOOK.md` on the real tablets and record results.
2. After Gdansk, collect what failed on site (Wi-Fi, sound, PIN friction).
3. Plan Supabase Auth and role-based RLS (two-round migration pattern), including PIN hashing, before Poznan.
