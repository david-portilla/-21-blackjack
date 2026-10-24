# 11 · Candles: closeRun

Status: done
Implements: AC-16.2, AC-16.8, AC-16.9

## What
- Contract (`src/contracts/engine.ts`): `Run` type and `closeRun` in `CasinoEngine`, as proposed in `src/contracts/README.md` (R16).
- Table `runs(id TEXT PK, account_id, rounds_survived, net, ended_at)`.
- `closeRun({ accountId, runId, roundIds, roundsSurvived })`: same `runId` returns the stored run. `net` = sum over the account's transactions in `roundIds` of PAYOUT minus BET/DOUBLE/SPLIT. No balance change (AC-16.8).
- Exposed in-process via `getCasinoEngine()`; not over HTTP.

## Comments

- 2026-10-24: done, pushed to main.
