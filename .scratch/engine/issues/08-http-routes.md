# 08 · Engine HTTP routes

Status: done
Blocked by: 03, 06, 07
Implements: AC-1.1, AC-1.2, AC-1.3, AC-2.1, AC-2.2, AC-13.1

Read the route handler guide in `node_modules/next/dist/docs/` first (Next 16).

## What (`src/app/api/engine/`)
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `session` | `{ username }` | account, sets cookie |
| GET | `me` | | account |
| POST | `deposits` | `{ amount, idempotencyKey }` | `Transaction` |
| GET | `transactions` | | `Transaction[]` newest first |

- No cookie / invalid: 401 `UNAUTHENTICATED`.
- Errors as `ApiError`; status per spec (400, 401, 404, 409).
- Node runtime (needed for `node:sqlite`).

## Done when
Manual check with `pnpm dev` + curl: sign in, deposit, me, transactions.

## Comments

- 2026-10-24: done, pushed to main (64e8f42..d407501).
