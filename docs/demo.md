# Demo · Team 2

Five minutes, as the brief asks (`docs/brief/`, page 07). Owner of this script: David. Each owner fills their own lines marked `(owner)`.

## Before the demo (12:10 to 12:30)

Run on the demo laptop, from a fresh `git pull`:

```bash
pnpm install
pnpm check                                   # typecheck, lint, unit tests (CI runs the same)
SESSION_SECRET=x E2E_ENGINE=real pnpm e2e    # browser journey on the real engine
pnpm e2e                                     # browser journey on the fake engine
```

Then start the app the way we will show it: `.env` with `SESSION_SECRET` set and `NEXT_PUBLIC_ENGINE_FAKE=0` once the real table is mounted (`1` otherwise, see "Fallback"), then `pnpm dev` and open http://localhost:3000. Use a fresh username so history starts empty.

### The brief's checks, mapped to tests

| Brief check (page 06) | Where it is proven | Owner |
|---|---|---|
| Core flow: account, deposit, bet, play, result, balance, history | `e2e/site-journey.spec.ts` (AC-1.1, 2.1, 13.1, 14.1, 14.2); engine AC-1.x, 2.x, 13.x | David, Edgar |
| Rules: flexible aces, natural, bust, push, dealer soft 17 | game tests (AC-5.x, 6.x, 7.3, 8.2) | Heriberto |
| Double: one extra stake, one card, then no actions | engine AC-9.2, 9.4, 9.5; game AC-9.3 | Edgar, Heriberto |
| Split: two hands, stakes and results, no re-split, split aces one card | engine AC-10.2, 10.7, 10.8; game AC-10.1, 10.4 | Edgar, Heriberto |
| Money: insufficient funds unchanged, retries never debit or pay twice | engine AC-3.2, 11.1, 12.1, 12.4 | Edgar |
| Our twist: one visible success criterion | Candles AC-16.4: three lost rounds snuff three candles and the run shows in History | all |

Today the game rows are covered by the site's in-browser emulation (`src/web/fake-game/`, D-016). They must move to Heriberto's own tests once the real table lands.

## Script

### 1 · The journey, a wallet transaction and the twist (2 min, David drives)

1. **Sign the book** with a new name: the lobby opens at 0 credits (AC-1.1).
2. **Deposit 100**: the balance in the header updates (AC-2.1, AC-14.2).
3. **Take a seat**, bet 10, play a hand: show the hidden dealer card, then the result and the new balance.
4. **History**: the DEPOSIT, the BET and the PAYOUT with the running balance (AC-13.1). That is the wallet transaction.
5. **The twist, Candles**: lose rounds until the last candle goes out and the dealer claims you; the run appears in History with rounds survived (AC-16.4). Tip: bet small and stand on low totals.
6. **The side quest, Omens**: in the lobby, today's omen and the streak; fulfilling it marks the name with ✶ (R17). One sentence: it rewards how you play, never how much.

### 2 · Each owner, their delivery and one decision (2 min, about 40 s each)

- **Edgar, the engine** (owner): accounts, wallet, ledger, payouts and runs. Decision to tell, for example: the engine computes double and split amounts and payouts itself, so the game can never send a wrong number (D-019).
- **Heriberto, the game** (owner): rules, dealer, hidden card on the server, the table. Decision to tell: (owner).
- **David, the website**: lobby, wallet, history, theme, hosting the table. Decision to tell: the site was built against a fake engine behind one variable, so it never waited for the others, and the same browser tests run against the real engine (D-016, `E2E_ENGINE=real`).

### 3 · AI: a mistake caught and a technique borrowed (1 min)

Each person, one line each, from `docs/ai-notes/<name>.md`.

- **David**: mistake: the agent pushed a database decision onto the website owner; it was stopped and became a rule (D-011). Bug the browser tests caught: a slow "who am I" answer could sign a player out right after signing in, only on the real engine. Technique: `grill-me` to settle open questions in rounds.
- **Edgar** (owner)
- **Heriberto** (owner)

## Fallback

If the real table is not mounted in time: keep `NEXT_PUBLIC_ENGINE_FAKE=1`, show the same journey on the in-browser emulation, and say so plainly. The hidden card then lives in the browser (AC-4.3 only holds in the real game), and money runs on the fake engine. Then show `SESSION_SECRET=x E2E_ENGINE=real pnpm e2e` passing to prove the site works on Edgar's real engine.

## Leave us with (brief, page 07)

- Runnable code and one startup command: README "Start".
- Checks we can run: `pnpm check`, `pnpm e2e`.
- Known limitations: README "Known limitations", updated before the demo.
- One thing each of us will use again: `docs/ai-notes/<name>.md`.

## Open gaps to close before 12:30

- Real table (`BlackjackTable`) mounted on `/play`, fake game removed (D-016), `NEXT_PUBLIC_ENGINE_FAKE=0`.
- Game tests for AC-4.1, 4.2, 5.1, 6.1, 7.1, 7.2, 8.1, 8.3, 9.1, 9.3, 10.1, 10.3, 10.5, 10.6 (Heriberto).
- `GET /api/engine/omens` (Edgar, `.scratch/omens/issues/01-engine-route.md`).
- README "Known limitations" refreshed.
