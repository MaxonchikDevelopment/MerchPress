# R6 report: gdansk-fix-3

## Recon

**Pill label today.** `src/components/TopBar.tsx:39` renders the pill when `soundRetry && user` and wake state is `released` or `unsupported`. The explanation is only in `title` (`TopBar.tsx:44-48`, differs per state). The visible text is the fixed string "Screen may sleep" (`TopBar.tsx:50`) for both states. Touch devices never show `title`, so the unsupported hint ("Set Auto-Lock to Never") is invisible. Click handler is `retryWakeLock` (`TopBar.tsx:42`).

**`classifyClaim` today** (`src/lib/claimResult.ts:17-26`):

| row | userId | result | line |
|---|---|---|---|
| null | any | failed | 18 |
| completed / cancelled | any | closed | 19 |
| in_progress, claimed_by == userId | defined | claimed | 21 |
| in_progress, claimed_by other | any | taken (by other) | 22 |
| in_progress, claimed_by null | any | taken (by null) | 22 |
| in_progress, userId undefined | undefined | taken (the `userId &&` guard) | 21-22 |
| new (any claimed_by) | any | failed | 25 |
| ready (any claimed_by) | any | failed (the gap) | 25 |

**PressPage `taken` branch** (`src/pages/PressPage.tsx:73-79`): calls `staffName(res.by)`, which returns null for a null id or a failed lookup (`src/lib/orderStatus.ts:49-57`), falling back to "another press station". It then shows "Already taken by <name>", clears busy and refetches. It does not look at the order status, so it works unchanged for a `ready` row. No PressPage change needed.

## Changes
- TopBar: visible label is "Set Auto-Lock to Never" when `unsupported`, "Screen may sleep" when `released`. Titles and handler unchanged.
- `classifyClaim`: `ready` with `claimed_by === userId` gives `claimed`, otherwise `taken`. `new` stays `failed`.

## Check script

```
$ node scripts/check-claim-result.ts
ok - null row is failed
ok - new is failed
ok - in_progress own is claimed
ok - in_progress other is taken
ok - in_progress null claimed_by is taken
ok - ready own is claimed
ok - ready other is taken
ok - ready null claimed_by is taken
ok - completed is closed
ok - cancelled is closed
ok - userId undefined never claims (in_progress)
ok - userId undefined never claims (ready, null claimed_by)
12 checks passed
```

## Validation
tsc -b, lint and build pass; `grep -c "Dev login" dist/assets/*.js` gives 0; `git grep -i service_role -- src` is empty. No device test of the pill label.
