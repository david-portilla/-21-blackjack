# 09 · Contract PR: engine types

Status: done
Implements: contract for R1, R2, R3, R9, R10, R11, R13

Separate PR touching only `src/contracts/`, approved by Heriberto and David.

## What
- `src/contracts/engine.ts`: `CasinoEngine`, `Transaction`, HTTP payloads.
- `ErrorCode`: add `INVALID_USERNAME` (types.ts section is David's: ask him to approve).
- `debit` input: `amount` optional, used only for `BET`; engine computes `DOUBLE`/`SPLIT`.
- README: remove `FakeEngine`; say tests use `createEngine(openDb(':memory:'))`; note `IDEMPOTENCY_CONFLICT` is not thrown (same key returns original).

## Comments

- 2026-10-24: done, pushed to main (64e8f42..d407501).
