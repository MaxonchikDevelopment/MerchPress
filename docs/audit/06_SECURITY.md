# Security

## Decision
Auth stays PIN + anon key for Gdansk (10-11 Oct 2026). Staff share a nominal PIN; admin has a separate PIN. Staff management goes through SECURITY DEFINER RPCs that verify admin id + PIN. events, designs, orders and Storage stay open to anon: accepted risk.

## Status (live database, applied 2026-10-05 via migrations 0003 and 0004)
- The staff RPCs `staff_list`, `staff_create`, `staff_update` and `staff_set_pin` exist in the live database. Each verifies admin id + PIN through `_assert_admin`, which anon cannot execute.
- The `users` table has no direct policies, so anon cannot insert, update, delete or select it. Staff changes go through the RPCs; login lists come from `staff_v`.
- The admin PIN typed at login is held in memory only in the client (never in localStorage or sessionStorage) and sent with each `staff_*` call. After a reload the Staff tab asks for it again.
- `staff_*` and `activate_event` have no rate limiting, so an admin PIN can be brute-forced over RPC (10,000 combinations). Accepted risk for Gdansk.
- Existing admins whose PIN is `0000` keep working until someone sets a new PIN; only create, set-PIN and promotion reject `0000`.
- Still true: events, designs, orders and Storage are open to anon (accepted risk).

## Return condition
Move to Supabase Auth with per-person accounts and role-based RLS before Poznan (20-22 Nov 2026).
