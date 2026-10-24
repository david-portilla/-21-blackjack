# 04 · debit (BET, DOUBLE, SPLIT)

Status: done
Blocked by: 03
Implements: AC-3.1, AC-3.2, AC-9.2, AC-9.4, AC-10.2, AC-10.7, AC-12.1, AC-12.4
Deadline: Friday (unblocks the game)

## What
`engine.debit({ accountId, roundId, handId, kind, amount?, idempotencyKey })`:
- Key already used: return the existing transaction.
- Amount:
  - `BET`: given `amount`, must pass the safe-integer check, else `INVALID_AMOUNT`.
  - `DOUBLE`: sum of debits recorded for `handId`.
  - `SPLIT`: the `BET` of `${roundId}:0`.
  - No stake found for DOUBLE/SPLIT: `ROUND_NOT_FOUND`.
- Conditional `UPDATE … WHERE balance >= ?`; 0 rows: `INSUFFICIENT_FUNDS`, nothing written.
- Write the transaction with `round_id`, `hand_id`, `balance_after`.

## Tests (use fixtures from `src/contracts/fixtures/` where relevant)
- `AC-3.1 bet debits stake`
- `AC-3.2 bet over balance rejected, state unchanged`
- `AC-9.2 double debits the hand's current stake` (bet 10 then double = 10)
- `AC-9.4 double without funds rejected, state unchanged`
- `AC-10.2 split debits the original stake against hand 1`
- `AC-10.7 split without funds rejected, state unchanged`
- `AC-12.1 repeated debit key returns original and changes nothing`
- `AC-12.4 balance never negative`

## Comments

- 2026-10-24: done, pushed to main (64e8f42..d407501).
