# 02 · Accounts: create or sign in

Status: done
Blocked by: 01
Implements: AC-1.1, AC-1.2

## What
`engine.signIn(username)` in `src/engine/engine.ts` (`createEngine(db)`):
- `username.trim()` empty: throw `INVALID_USERNAME`.
- Existing username (exact match): return it. Otherwise create with balance 0.
- Returns `{ accountId, username, balance }`.

## Tests
- `AC-1.1 new username creates account with balance 0`
- `AC-1.2 same username returns the same account`
- empty username rejected with `INVALID_USERNAME`

## Comments

- 2026-10-24: done, pushed to main (64e8f42..d407501).
