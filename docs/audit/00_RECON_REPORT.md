# Recon Report

Read-only recon, branch `gdansk-sprint`, 2026-10-05.

## Findings
1. **react-router-dom**: zero imports in the repo. It appeared only in `package.json` (dependency) and as prose in `docs/maxona-ui-redesign-plan.md:57`. Removed in the deps commit.
2. **package-lock.json diff** (before changes, +30/-18): resync noise only. Removed `peer` flags on a few packages, added `@emnapi/core` and `@emnapi/runtime` as optional peers, bumped `@emnapi/wasi-threads` 1.2.2 to 1.2.3. No functional dependency change.
3. **Nested `MerchPress/` directory**: gone.
4. **.gitignore** at recon time: Node/Vite defaults plus an uncommitted `.env*` line. `.vercel/` was untracked and not ignored.
5. **Audit**: `npm audit --omit=dev` reports 0 vulnerabilities after removal.

## Other observations
- `supabase/migrations` contains only `0001_init.sql` and `0002_storage.sql`. No staff-management RPCs exist there; the only PIN RPC is `verify_pin`. The `users` table has open insert/update/delete policies for anon. The decision in `06_SECURITY.md` describes SECURITY DEFINER staff RPCs that are not in the migrations, so they may exist only in the live database (one DB, production) or not at all. Needs verification.
- `0001_init.sql:2` and `:172-173` already document the PIN/permissive-RLS trade-off.
- `git config user.name/email` is not set; commits used a one-off `-c` override.
