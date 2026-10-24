# 01 · Engine: GET /api/engine/omens

Status: ready-for-agent
Owner: Edgar
Implements: AC-17.1 to AC-17.5

## What
- Route `src/app/api/engine/omens/route.ts`: signed-in account (`requireAccountId`), its transactions, then `Response.json(omenStatus(transactions, new Date()))` from `@/contracts/omens`.
- Read-only. No new table, no write, no balance change (AC-17.5).
- Errors as the other routes: 401 `UNAUTHENTICATED` without a session.

## Done when
- `pnpm e2e` passes "AC-17.4 the lobby shows today's omen and streak" with the panel, not "The omens are silent today."
- D-021 moves to `accepted` if the rules hold for you.

## Comments
