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

`pnpm e2e` walks the player journey in Chromium at desktop and phone width (Playwright, local only; first time: `pnpm exec playwright install chromium`). It runs against the fake engine; `E2E_ENGINE=real pnpm e2e` runs it against the real `/api/engine/*` routes. Report: `pnpm exec playwright show-report`.

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
- Username rules (3 to 20 letters, digits or `_`) live only in the sign-in form; the engine trims the name and stores it as sent, case-sensitive (Q2).
- The real engine needs `SESSION_SECRET` in `.env` (see `.env.example`).
- With `NEXT_PUBLIC_ENGINE_FAKE=1` the site runs on an in-browser fake engine and an in-browser game emulation (D-016): data lives in that browser's localStorage only, and the hidden card is in the browser, so AC-4.3 holds only once the real game is mounted.
- The real game table is not mounted yet: `/play` uses the emulation with the fake engine and a static preview otherwise, until `BlackjackTable` lands.
- On the real engine, candle runs are recorded only once the real game calls `closeRun`; until then History shows none.
- The browser journey (`pnpm e2e`) runs locally, not in CI; CI runs `pnpm check` only.
- The site is checked in Chromium at desktop width and at 390 px; other sizes and browsers are untested.
