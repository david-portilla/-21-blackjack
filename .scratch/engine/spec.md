# Engine spec (backend)

Owner: Edgar. Folders: `src/engine/`, `src/app/api/engine/`.
Source: grilling session 2026-10-24. Requirements win if they differ (`docs/requirements.md`).

Goal: the simplest engine that meets the brief for a local demo. Few validations, no extra infrastructure, no new dependencies.

## Decisions

| Topic | Decision |
|---|---|
| Storage | `node:sqlite` (built into Node 22). App: file `data/casino.db`. Tests: `:memory:`. No Neon, no `DATABASE_URL`. |
| Schema | `openDb(path)` runs `CREATE TABLE IF NOT EXISTS`. No migration tool. The game creates its own tables on the same connection. |
| Balance | `accounts.balance` column + `transactions` ledger with `balance_after`. Debit is `UPDATE accounts SET balance = balance - ? WHERE id = ? AND balance >= ?`; 0 rows changed means `INSUFFICIENT_FUNDS`. `CHECK (balance >= 0)` as backstop. |
| Idempotency | `UNIQUE(account_id, idempotency_key)` on `transactions`. If the key exists, return that transaction and do nothing. Payload is not compared; `IDEMPOTENCY_CONFLICT` is never thrown. |
| Concurrency | Not handled separately: `node:sqlite` is synchronous and there is no `await` between reading and writing. |
| `debit` | `BET` uses the given amount. `DOUBLE` amount = hand's current stake; `SPLIT` amount = hand 0's `BET`. Both computed by the engine; input `amount` ignored. |
| `settle` | Only check: the hand has a recorded stake, else `ROUND_NOT_FOUND`. Payout: win/blackjack 2x stake, push 1x, loss 0. Always writes a `PAYOUT`, amount 0 on loss. Outcome is trusted from the game. |
| Username | Non-empty string after `trim`, exact match (case-sensitive). Empty: `INVALID_USERNAME`. |
| Amounts | `Number.isSafeInteger(n) && n > 0`. No maximum. |
| Session | HTTP-only cookie holding `accountId.hmac` signed with `SESSION_SECRET` (`node:crypto`). |
| Fake | No `FakeEngine`. Everyone tests with `createEngine(openDb(':memory:'))`. |
| Tests | `src/engine/*.test.ts`, in memory, named by AC ID, always run in `pnpm check`. |
| HTTP errors | 400 `INVALID_AMOUNT`/`INVALID_USERNAME`, 401 `UNAUTHENTICATED`, 404 `ROUND_NOT_FOUND`/`ACCOUNT_NOT_FOUND`, 409 `INSUFFICIENT_FUNDS`. |
| History | `GET /api/engine/transactions` returns all, newest first. No pagination. No logout. |

## Out of scope

Game rules, round state, website. Engine part of the twist (R16) until the team defines it.

## Issues

See `issues/`. Issue 04 (`debit`) must be ready Friday: it unblocks Heriberto.
