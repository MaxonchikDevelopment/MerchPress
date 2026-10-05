-- MerchPress Queue — enum additions (round 2A, step 1 of 2)
-- Apply this file ON ITS OWN, before 0004_ops.sql: a new enum value cannot be
-- used in the same transaction that adds it.
-- Additive and re-runnable.

alter type order_status add value if not exists 'cancelled';
