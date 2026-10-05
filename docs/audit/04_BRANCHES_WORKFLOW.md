# Branches and Workflow

## Branch model
- `main`: the deploy branch. Auto-deploys to production.
- `gdansk-sprint`: current work branch (all Gdansk-phase commits).
- `feature/maxona-ui-redesign`: earlier UI redesign branch, already in history.
Work in a branch, one commit per logical change.

## Review and merge
Run the validation block from `CLAUDE.md` before every commit (tsc -b, lint, build, "Dev login" count 0, no `service_role` in `src`, `git diff --stat`). Merge to `main` only after human review, with a merge commit so it can be reverted with `git revert -m 1 <merge>`. Schema, RLS and RPC changes use two rounds: SQL in a report, then human approval, a backup, and apply. Auth changes only when asked. Flag any heavy dependency first.

## Deploy rules
`main` auto-deploys and the service worker auto-updates open tablets. There is one database, production, shared by every branch, so apply migrations before deploying code that needs them (old bundles stay compatible with 0003/0004). No secret gets a `VITE_` prefix.

## Event freeze
Never push or merge `main` during an event. Freeze starts before the pre-event check and ends after the event closes. Emergency fix only with owner approval, tested on a branch first.
