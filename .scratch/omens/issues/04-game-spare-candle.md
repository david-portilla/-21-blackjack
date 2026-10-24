# 04 · Game: light the spare candle on a new run

Status: done
Owner: Heriberto
Implements: AC-18.5

## What
- When the service opens a new run it calls `engine.claimSpareCandle({ accountId, runId })` and starts with 4 candles if true, 3 otherwise (`src/game/service/service.ts`).
- `game_runs.starting_candles` stores it; existing databases get the column through a guarded `ALTER TABLE` in `createGameStore`.
- `RunView.startingCandles` (contract `src/contracts/round.ts`); `Candles` draws `total` candles, so a snuffed spare stays on the table unlit.

## Tests
`src/contracts/omens.integration.test.ts`: after tier III and a finished run, the next run starts with 4 candles and credits move only by the round's own result.

## Comments

- 2026-10-24: done by David at the team's request (Heriberto's folder). Please review the service and store changes.
