# Project Overview

## Purpose
MerchPress Queue is a press-queue PWA for event merch stands. Cashiers take custom T-shirt orders, the press station prints them from a realtime FIFO queue, and the cashier hands over the finished shirt. Admins set up events and designs and read stats. Priorities: fast, calm, touch-first on tablets.

## Users and roles
- **Cashier**: creates orders, sees own in-progress and ready orders, cancels, picks up.
- **Press**: works the queue (claim, ready, cancel).
- **Admin**: Events, Designs, Staff, Stats.

Login is role, name, 4-digit PIN (`verify_pin`). Staff share a nominal PIN; admins have their own. Staff are managed in the Staff tab.

## Event timeline
- Gdansk, 10-11 Oct 2026: first live event; this phase prepares for it.
- Poznan, 20-22 Nov 2026: next event. Supabase Auth with role-based RLS must land before it (see `11_PHASE_GDANSK.md`).

## Status
As of 2026-10-05, branch `gdansk-sprint` (not merged to `main`, not pushed):
- Migrations 0001-0004 applied to the live database, with backups.
- Reliability, cancel, idempotent create, staff management, per-event options and design editing are built and covered by live scripts (R1 live test not yet run; R2 staff scenarios skipped, see reports).
- Manual checklists in R1, R2B and R2C have blank results; the runbook's go/no-go check must be run on real tablets before the event.
