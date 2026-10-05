# Security

## Decision
Auth stays PIN + anon key for Gdansk (10-11 Oct 2026). Staff share a nominal PIN; admin has a separate PIN. Staff management goes through SECURITY DEFINER RPCs that verify admin id + PIN. events, designs, orders and Storage stay open to anon: accepted risk.

## Return condition
Move to Supabase Auth with per-person accounts and role-based RLS before Poznan (20-22 Nov 2026).
