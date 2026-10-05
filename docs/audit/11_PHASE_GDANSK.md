# Phase Summary: Gdansk (10-11 Oct 2026)

Branch `gdansk-sprint`, not merged, not pushed.

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
