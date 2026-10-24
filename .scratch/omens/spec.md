# Omens spec (side quest, R17)

Owners: Edgar (route), David (site). Heriberto: optional. Requirements: `docs/requirements.md` R17. Decision: D-021 (proposed).

## Strategy

Bring players back for **how they play, not how much they bet**. One daily challenge (an omen), a streak of fulfilled days, a cosmetic mark. It sits inside the Inscryption mood next to Candles (R16); it is a side quest, not a second twist.

## Rules (single source: `src/contracts/omens.ts`, tests in `omens.test.ts`)

| Topic | Rule |
|---|---|
| Daily omen | One per UTC day, same for every player, rotating: `double-win`, `split`, `blackjack`, `push`. |
| Fulfilled | Read from that day's ledger only: a SPLIT; a PAYOUT `blackjack`; a PAYOUT `push`; a PAYOUT `win` on a hand that has a DOUBLE. |
| Streak | Consecutive fulfilled days ending today, or yesterday while today is open. A missed day resets to 0. |
| Reward | Cosmetic only: "✶ The omen is fulfilled" in the lobby and ✶ next to the name in the header for that day. |
| Storage | None. Computed read-only from `transactions` on each request. |

## Guardrails (do not cross; this is a gambling-themed product)

- Never reward with credits, never require a deposit, never depend on bet size or number of bets.
- No loss aversion: no "your streak is about to break" nags, no countdowns, no penalties for a missed day.
- New omens must be about play choices or outcomes (a move, a result), never about volume, time spent or money.
- Any change to these rules is a contract change: PR to `src/contracts/omens.ts` with Edgar and David approving.

## Ownership

| Part | Owner | State |
|---|---|---|
| Rules + tests (`src/contracts/omens.ts`) | David drafted, Edgar approves | done, pending approval |
| `GET /api/engine/omens` | Edgar (written by David) | done: `issues/01-engine-route.md` |
| Lobby panel, header mark | David | done |
| Table hint when an omen is fulfilled | Heriberto | optional: `issues/02-table-hint.md` |
| Ladder, sigils, titles (R18) in `omens.ts` + lobby panel and header title | David | done |
| `claimSpareCandle` + table (R18) | Edgar (written by David) | done: `issues/03-engine-spare-candle.md` |
| 4 candles on a new run after tier III (R18) | Heriberto (written by David) | done: `issues/04-game-spare-candle.md` |

## Ladder and rewards (R18, D-023)

Same-day ladder: tier I is the day's omen, II adds any other omen, III is all four. One sigil per tier per day; titles from tier III sigils (Marked 1, Seer 3, Prophet 7); tier III earns one spare candle (4 candles on the next run, at most one held). Still no credits.

## Out of scope

Leaderboards, notifications, rewards in credits, per-player omens, time zones other than UTC.
