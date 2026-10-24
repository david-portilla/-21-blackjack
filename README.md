# Blackjack, your way

Team 2 entry for the Blackjack AI Challenge: a small casino with fictional credits. Three owners, one app.

## Start

Requirements: Node 22+, pnpm 10.

```bash
pnpm install
cp .env.example .env   # fill DATABASE_URL (Edgar shares it)
pnpm dev               # http://localhost:3000
```

`pnpm check` runs typecheck, lint and tests (same as CI).

## Layout

| Path | Owner | What |
|---|---|---|
| `src/engine/`, `src/app/api/engine/` | Edgar | Accounts, wallet, bets, payouts, history |
| `src/game/`, `src/app/api/game/` | Heriberto | Blackjack rules, dealer, deck, game UI |
| `src/web/`, `src/app/(site)/` | David | Lobby, sign-in, wallet and history screens |
| `src/contracts/` | shared | Types and API contract between parts |
| `docs/` | shared | Brief, requirements, playbook, decisions |

Working agreement: `AGENTS.md` and `docs/playbook.md`.

## Known limitations

Current state; updated before the demo (AC-15.4).

- Sign-in is a username only, with no password, by design: credits are fictional (D-008).
- There is no sign-out yet (`DELETE /api/engine/session` is proposed). To switch player, clear the site's cookies, or its localStorage when using the fake engine.
- Username rules (3 to 20 letters, digits or `_`) are checked in the sign-in form; the engine check and its error code are pending.
- With `NEXT_PUBLIC_ENGINE_FAKE=1` the site runs on an in-browser fake engine: data lives in that browser's localStorage only, and nothing can be played (no bets, rounds or runs).
- The game table is not mounted yet: `/play` shows a placeholder until `BlackjackTable` lands.
- Candle runs (R16) depend on `GET /api/engine/runs` and `closeRun`, both still proposals.
- The browser journey check is manual (see `src/web/AGENTS.md`); only unit tests run in `pnpm check` and CI.
- The site is checked at desktop width and at 390 px; other sizes and browsers other than Chromium are untested.
