-- MerchPress Queue — rollback of 0005_event_end_date.sql. NEVER run unless asked.
-- Back up first. Drops the column (DATA LOSS for any end dates entered).
-- Ship a client that no longer writes event_end_date before running this.

begin;

alter table events drop constraint if exists events_end_date_check;
alter table events drop column if exists event_end_date;

commit;
