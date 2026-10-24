# 10 · Requests to other owners

Status: done

Open as GitHub issues (label `needs:<owner>`), do not edit their files.

## needs:david
- `.gitignore`: add `/data/`.
- `.env.example`: replace `DATABASE_URL` with `SESSION_SECRET=` (any long random string). Note `.gitignore` has `.env*`, which also matches `.env.example`; consider `!.env.example`.
- FYI: no new dependency (`node:sqlite` is built in). Node >= 22 already required.
- README known limitation: data lives in a local SQLite file; not suitable for Vercel.

## needs:heriberto
- Use `createEngine(openDb(':memory:'))` in tests; no `FakeEngine`.
- Game tables go on the same connection (`src/engine/db.ts`), created with `CREATE TABLE IF NOT EXISTS`.
- `debit` for `DOUBLE`/`SPLIT` needs no amount.

## All owners: rows for `docs/decisions.md`
- D-013 SQLite (`node:sqlite`) replaces Neon for storage; supersedes the Neon part of D-011. Why: no install, no Docker, local demo.
- D-014 No `FakeEngine`; the real engine runs in memory for tests.
- D-015 The engine computes `DOUBLE`/`SPLIT` amounts; same idempotency key returns the original without comparing payload.

## Comments

- 2026-10-24: done. .env.example has SESSION_SECRET; data/ ignored via data/.gitignore (no root change); David aligned the site (de2ff54); decisions recorded as D-017 to D-020; Heriberto notified in GitHub issue #1.
