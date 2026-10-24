# 05 · settle

Status: done
Blocked by: 04
Implements: AC-11.1, AC-11.2, AC-11.3, AC-11.4, AC-12.1

## What
`engine.settle({ accountId, roundId, handId, outcome, idempotencyKey })`:
- Key already used: return the existing transaction.
- Stake = sum of debits recorded for `handId`. None: `ROUND_NOT_FOUND`.
- Payout: `win`/`blackjack` 2x stake, `push` 1x, `loss` 0.
- Always write a `PAYOUT` (amount 0 on loss) with `outcome`, increase balance.

## Tests
- `AC-11.2 win 2x, push 1x, loss 0, blackjack 2x`
- `AC-11.4 balance 100, bet 10: 110 / 100 / 90`
- `AC-9.5 double: win 40, push 20, loss 0`
- `AC-10.8 split, one win one loss returns 20`
- `AC-11.1 + AC-12.1 second settle with same key pays nothing`

## Comments

- 2026-10-24: done, pushed to main (64e8f42..d407501).
