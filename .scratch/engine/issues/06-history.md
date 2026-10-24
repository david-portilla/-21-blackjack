# 06 · Balance and history

Status: done
Blocked by: 05
Implements: AC-13.1, AC-13.2

## What
- `engine.getAccount(accountId)`: `{ accountId, username, balance }` or `ACCOUNT_NOT_FOUND`.
- `engine.listTransactions(accountId)`: all, newest first, mapped to the contract `Transaction` type.

## Tests
- `AC-13.1 history shows deposit, bet, double, split and payouts with round and hand`
- `AC-13.2 sum of signed transactions equals balance` (debits negative)

## Comments

- 2026-10-24: done, pushed to main (64e8f42..d407501).
