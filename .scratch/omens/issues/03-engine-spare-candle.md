# 03 · Engine: spare candle and ladder in /omens

Status: done
Owner: Edgar
Implements: AC-18.3, AC-18.4, AC-18.5, AC-18.8

## What
- `CasinoEngine.claimSpareCandle({ accountId, runId })` (contract in `src/contracts/engine.ts`): true when a spare candle is available (days with omen tier III minus candles already granted, capped at 1); idempotent by `runId`; never moves money.
- Table `spare_candle_claims(run_id PK, account_id, granted, claimed_at)` in `src/engine/db.ts` (`CREATE TABLE IF NOT EXISTS`, works on existing `data/casino.db`).
- `GET /api/engine/omens` returns the extended `OmenStatus` (ladder, sigils, title) with no route change: same `omenStatus` function.
- Wired in `getCasinoEngine()`.

## Tests
`src/contracts/omens.integration.test.ts` (real engine and game on `:memory:`): no candle without tier III, first answer per run stands, capped at 1.

## Comments

- 2026-10-24: done by David at the team's request (Edgar's folder). Please review `claimSpareCandle` in `src/engine/engine.ts` and move D-023 to `accepted` if it holds.
