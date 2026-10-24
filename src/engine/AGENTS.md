# AGENTS.md · engine

Owner: **Edgar**. Folders: `src/engine/, src/app/api/engine/`.
Scope: accounts, balances, deposits, debits, payouts, history, Candles runs, the engine HTTP API and the database (D-017).

Root `AGENTS.md` applies. Local rules below are written by the owner.

## Local rules

### Goal

Simplest engine that meets the brief for a local demo. Few validations, no extra infrastructure, no new dependencies. Before adding a check, a table or a helper, ask whether an AC needs it. Decisions: D-017 to D-020 in `docs/decisions.md`.

### Map

| File | Owns |
|---|---|
| `db.ts` | `openDb(path)` runs the schema (`CREATE TABLE IF NOT EXISTS`); `getDb()` opens `data/casino.db` lazily |
| `engine.ts` | `createEngine(db)`: `signIn`, `getAccount`, `deposit`, `debit`, `settle`, `listTransactions` |
| `runs.ts` | `createRuns(db)`: `closeRun`, `listRuns` (R16 Candles) |
| `session.ts` | Signed session cookie: `signSession`, `verifySession`, `getSessionAccount(req)` |
| `http.ts` | Route helpers: `errorResponse`, `requireAccountId`, `readJson` |
| `index.ts` | App wiring: `getEngine()`, `getRuns()`, `getCasinoEngine()` (what the game imports) |
| `src/app/api/engine/*/route.ts` | `session` (POST, DELETE), `me`, `deposits`, `transactions`, `runs` |

Contract types live in `src/contracts/engine.ts` (`CasinoEngine`, `Transaction`, `Run`, `EngineError`). Never redefine them here.

### Data

- Storage is `node:sqlite` (built into Node 22), loaded with `process.getBuiltinModule` because `@types/node` 20 has no types for it. Do not add another DB library.
- Tables: `accounts`, `transactions` (the ledger), `runs`. Schema changes go in `SCHEMA` in `db.ts` and must stay `IF NOT EXISTS`. There are no migrations: to reset local data, delete `data/`.
- Never open the DB at import time: `next build` must not create it. Use `getDb()` or `getEngine()`.
- The game may create its own tables on the same connection; it never writes engine tables.

### Money rules (do not break)

- Money moves only through `deposit`, `debit` and `settle`. Credits are positive safe integers: `Number.isSafeInteger(n) && n > 0`.
- `accounts.balance` and the ledger row change in one SQL transaction (`record` in `engine.ts`). Every row stores `balance_after`.
- Debit is `UPDATE … WHERE balance >= ?`; 0 rows changed means `INSUFFICIENT_FUNDS` and nothing is written. `CHECK (balance >= 0)` is the backstop.
- Atomicity comes from keeping method bodies synchronous: no `await` between reading and writing, even though the methods are `async`.
- Idempotency: `UNIQUE(account_id, idempotency_key)`. If the key exists, return the stored transaction before any other check. The payload is not compared.
- `DOUBLE` and `SPLIT` amounts are computed by the engine (D-019); only `BET` takes an amount.
- `settle`: stake = sum of debits for the hand. Payout: win and blackjack 2x, push 1x, loss 0. Always write a `PAYOUT` row (0 on loss). A hand already paid returns its payout, whatever the key.
- `closeRun`: `net` = PAYOUT minus BET, DOUBLE and SPLIT over the run's rounds; never touches the balance. Same `runId` returns the stored run.
- Usernames are only trimmed (D-020); validation lives in the site.

### Errors and HTTP

- Throw `new EngineError(code)` from `@/contracts/engine` for every business error; never return error values.
- Routes wrap their body in `try/catch` and answer with `errorResponse(err)`: 400 invalid input, 401 `UNAUTHENTICATED`, 404 not found, 409 `INSUFFICIENT_FUNDS`, 500 anything else (logged, generic message). Messages are short English sentences the site shows to the player.
- The account always comes from the session cookie (`requireAccountId`), never from the body or the URL. Only `POST /session` takes a username.
- `debit`, `settle` and `closeRun` are in-process only (`getCasinoEngine()`). Never add an HTTP route for them.
- Route handlers use the default Node.js runtime. This is Next.js 16: read `node_modules/next/dist/docs/` before using a Next API you have not seen in this folder.

### Tests

- Vitest, next to the code (`*.test.ts`). Each test opens a fresh `createEngine(openDb(":memory:"))`; no mocks of the DB.
- Name tests with the AC they prove: `it("AC-9.4 double without funds rejected, state unchanged", …)`. "State unchanged" means balance and transaction list are equal before and after.
- For a bug: write the failing test first, then fix.
- Session tests set `process.env.SESSION_SECRET` in `beforeEach`.
- Run `pnpm vitest run src/engine` while working, `pnpm check` before pushing.

### Running locally

- `.env` needs `SESSION_SECRET` (any long random string). The site uses this engine when `NEXT_PUBLIC_ENGINE_FAKE=0`.
- Manual check: `pnpm dev`, then curl `POST /api/engine/session`, `POST /api/engine/deposits`, `GET /api/engine/me` with a cookie jar.

### Workflow

- Tickets live in `.scratch/engine/issues/`, one file per ticket with `Status:` and the ACs it implements.
- Before starting: `git pull --rebase --autostash` and check `AGENTS.md` and recent `main` commits for teammates' work.
- When a ticket is done: `pnpm check`, commit only engine files (`engine: <what>`, name the ACs), pull and push to `main`. Contract changes go in their own `contracts:` commit.
