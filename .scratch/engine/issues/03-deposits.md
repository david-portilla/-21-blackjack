# 03 · Deposits

Status: done
Blocked by: 02
Implements: AC-2.1, AC-2.2, AC-2.3

## What
`engine.deposit({ accountId, amount, idempotencyKey })`:
- Amount check: `Number.isSafeInteger(amount) && amount > 0`, else `INVALID_AMOUNT`.
- Key already used by this account: return the existing transaction.
- Else increase balance and write a `DEPOSIT` transaction with `balance_after`.

## Tests
- `AC-2.1 deposit increases balance and records DEPOSIT`
- `AC-2.2 rejects 0, negative, decimal and non-number; state unchanged`
- `AC-2.3 same idempotency key changes balance once`

## Comments

- 2026-10-24: done, pushed to main (64e8f42..d407501).
