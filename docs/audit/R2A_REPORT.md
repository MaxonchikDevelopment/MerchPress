# R2A Report: migration round 1 of 2 (SQL only)

Branch `gdansk-sprint`. Nothing applied, no SQL run against any database (not even a local one), `src/` untouched, `0001`/`0002` untouched, not pushed, not merged. The SQL is **unexecuted and unverified**; round 2 starts with backup and apply.

Files:
- `supabase/migrations/0003_enums.sql`, apply alone first.
- `supabase/migrations/0004_ops.sql`, apply second, in one transaction (it has its own `begin`/`commit`).
- `supabase/rollback/0004_ops_rollback.sql`, never run unless asked.

Sections 1-4 (call-site recon, the SQL, statement classes, client changes) were closed by R2B/R2C and removed; the SQL lives in `supabase/migrations/0003_enums.sql` and `0004_ops.sql`.

## Open questions still standing
Questions 1 (photo limit, fixed by client compression in 1f2be54), 4 (total_orders, client subtracts `count_cancelled`) and 9 (transaction wrapper, applied) are closed. Numbers kept from the original list.

2. **`events.shirt_sizes text[]` cannot reach `orders.shirt_size`.** That column is the enum `shirt_size` (XS..XXL). A custom size outside that list fails on `create_order_v2`. Subsets work. Real custom sizes need a column type change, which this round does not do.
3. **Seed admin PIN `0000` in production.** The rules only block `0000` on create, set_pin and promotion. An existing admin with `0000` keeps working until someone sets a new PIN via `staff_set_pin`. Do you want that forced before the event?
5. **Promoting a user with a null PIN to admin is allowed** (only `0000` is blocked). That admin cannot log in until a PIN is set. Should it be rejected?
6. **Reactivating an inactive admin** whose PIN is `0000` is allowed (not in the rules).
7. **`verify_pin` returns the whole `users` row including `pin`** to the caller. Pre-existing and out of scope, but the PIN of the person logging in is sent back to the client.
8. **`activate_event` and `staff_*` carry no rate limiting**, so an admin PIN can be brute-forced over RPC (4 digits, 10,000 tries). Matches the accepted risk in 06_SECURITY.md, listed for completeness.
10. **`staff_v` still excludes inactive users** by design, so the login picker never shows them; the admin sees them only via `staff_list`.
