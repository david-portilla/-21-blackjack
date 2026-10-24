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

- To be filled before the demo (AC-15.4).
