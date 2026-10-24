# 07 · Session cookie

Status: done
Blocked by: 02
Implements: AC-1.3

## What
`src/engine/session.ts`:
- `sign(accountId)` → `${accountId}.${hmacSha256(accountId, SESSION_SECRET)}`; `verify(value)` → accountId or null (use `timingSafeEqual`).
- `getSessionAccount(req)`: read cookie, verify, return `{ accountId }` or null.
- Cookie: HTTP-only, `SameSite=Lax`, `Path=/`.
- Missing `SESSION_SECRET`: throw at startup with a clear message.

## Tests
- `AC-1.3 valid cookie resolves the account`
- `AC-1.3 tampered cookie returns null`

## Comments

- 2026-10-24: done, pushed to main (64e8f42..d407501).
