# Requirements · Blackjack, your way

Status: **DRAFT v0**. It becomes v1 when Edgar, Heriberto and David approve it. After v1, changes only by PR with the three approvals (see `docs/playbook.md`).

This is the single "what". Every PR, test and demo check points to an ID here (`R7`, `AC-7.2`). If code and this file disagree, this file wins until a PR changes it. If this file is ambiguous, stop and ask: do not guess.

## Goal

One working casino with fictional credits: create an account, add credits, place a bet, play blackjack, see the result, the new balance and the transaction history. Three code owners, one original twist.

## Owners

| Part | Owner | Folder |
|---|---|---|
| Game: rules, dealer, deck, game UI, round state | Heriberto | `src/game/`, `src/app/api/game/` |
| Casino engine: accounts, balances, deposits, bets, payouts, history | Edgar | `src/engine/`, `src/app/api/engine/` |
| Website: lobby, account flow, wallet, history screens, journey, startup | David | `src/web/`, `src/app/(site)/`, repo root |
| Contracts | shared, one owner per section | `src/contracts/` |

## Requirements and acceptance criteria

Format: Given / When / Then. "State unchanged" means: no card dealt, no hand changed, no balance changed, no transaction written.

### R1 · Account (Edgar, David)
- AC-1.1 When a player creates an account with a username, then an account exists with balance 0.
- AC-1.2 Given a username already exists, when it is used again, then the player is signed into that account (no password: fictional credits only).
- AC-1.3 The signed-in account is identified server-side (cookie); the browser never chooses whose money moves.

### R2 · Deposit (Edgar, David)
- AC-2.1 When a positive whole number is deposited, then the balance increases by exactly that amount and a `DEPOSIT` transaction is recorded.
- AC-2.2 When the amount is 0, negative, decimal or not a number, then it is rejected with `INVALID_AMOUNT` and state is unchanged.
- AC-2.3 When the same deposit request is retried with the same idempotency key, then the balance changes only once.

### R3 · Place a bet (Heriberto, Edgar)
- AC-3.1 Given balance >= stake and stake is a positive whole number, when the player bets, then the stake is debited (`BET`) and a round starts.
- AC-3.2 Given balance < stake, when the player bets, then it is rejected with `INSUFFICIENT_FUNDS` and no round is created.
- AC-3.3 An account has at most one unfinished round at a time.

### R4 · Deal and secrecy (Heriberto)
- AC-4.1 Each round uses a fresh shuffled 52-card deck; no card appears twice in a round.
- AC-4.2 Player gets two cards, dealer gets two: one face up, one hidden.
- AC-4.3 Until the round is settled, no API response contains the hidden card (only `{ hidden: true }`), and neither does the remaining deck.
- AC-4.4 The deck order can be injected in tests only; production never accepts a deck or seed from the client.

### R5 · Card values (Heriberto)
- AC-5.1 2 to 10 count face value; J, Q, K count 10.
- AC-5.2 An ace counts 11 if the total stays <= 21, otherwise 1. A hand with an ace counted as 11 is soft.
- AC-5.3 A + 6 is soft 17; A + 6 + 10 is hard 17.

### R6 · Natural blackjack (Heriberto)
- AC-6.1 Right after the deal, before any action, both sides are checked for A + 10-value.
- AC-6.2 Both natural: push. Only player: player wins. Only dealer: player loses. In all three the round settles immediately and the hidden card is revealed.
- AC-6.3 A + 10-value made after a split is a normal 21, not a natural.

### R7 · Hit and Stand (Heriberto)
- AC-7.1 Hit adds one card to the active hand; the player may hit again unless the hand is finished.
- AC-7.2 Stand finishes the active hand.
- AC-7.3 A hand over 21 busts and finishes immediately. A hand reaching exactly 21 finishes automatically.

### R8 · Dealer (Heriberto)
- AC-8.1 When all player hands are finished, the dealer reveals the hidden card.
- AC-8.2 Dealer draws below 17 and stands on every 17, including soft 17.
- AC-8.3 Dealer bust: every non-busted player hand wins. Otherwise higher total wins; equal totals push.

### R9 · Double down (Heriberto, Edgar)
- AC-9.1 Allowed only on a two-card hand before any Hit, including split hands except split aces.
- AC-9.2 The engine debits an extra stake equal to the hand's current stake (`DOUBLE`) before any card is dealt.
- AC-9.3 Exactly one card is dealt, then the hand finishes; no further Hit, Split or Double on it.
- AC-9.4 Insufficient funds: rejected with `INSUFFICIENT_FUNDS`, state unchanged.
- AC-9.5 Example: bet 10, 5 + 6, double: hand stake 20; win returns 40, push 20, loss 0.

### R10 · Split (Heriberto, Edgar)
- AC-10.1 Allowed only on the original two cards with the same rank (8 + 8 yes, K + Q no), once per round. No re-split.
- AC-10.2 The engine debits an extra stake equal to the original stake (`SPLIT`) before cards change.
- AC-10.3 One original card goes to each hand, then one new card to each, left hand first. Left hand is played first, then right.
- AC-10.4 Split aces get exactly one card each and both stand; no Hit or Double.
- AC-10.5 Non-ace split hands can Hit, Stand, or Double before any Hit.
- AC-10.6 The dealer plays once after both hands finish; each hand settles separately against that dealer hand.
- AC-10.7 Insufficient funds: rejected with `INSUFFICIENT_FUNDS`, state unchanged.
- AC-10.8 Example: bet 10, 8 + 8, split: two 10-credit hands; one win and one loss return 20 in total.

### R11 · Settlement (Edgar, Heriberto)
- AC-11.1 One result per hand, one payout per result.
- AC-11.2 Total returned per hand: win 2x final stake, push 1x, loss 0, natural 2x (simplified even money).
- AC-11.3 The engine computes the payout from its own recorded stakes for that hand; the game sends the outcome, never the amount.
- AC-11.4 Example: balance 100, bet 10: ends at 110 on win, 100 on push, 90 on loss.

### R12 · Retries and integrity (Edgar, Heriberto)
- AC-12.1 Repeating any debit or payout with the same idempotency key returns the original transaction and changes nothing.
- AC-12.2 Repeating a game action (same round `version`) never draws another card.
- AC-12.3 Round state is persisted so an interrupted round can be finished and settled.
- AC-12.4 Balance never goes negative.

### R13 · History (Edgar, David)
- AC-13.1 The player sees every transaction: deposits, original stakes, double and split stakes, and each hand's payout, linked to round and hand.
- AC-13.2 The sum of transactions equals the balance.

### R14 · Player journey (David)
- AC-14.1 From the lobby a signed-in player can deposit, open the game, play a round and come back.
- AC-14.2 The visible balance refreshes after the bet, after each extra stake and after the payout.
- AC-14.3 The game UI is embedded in the site (the website hosts the game owner's component).

### R15 · Delivery (David, all)
- AC-15.1 A fresh clone starts with one documented command after filling `.env` from `.env.example`.
- AC-15.2 `pnpm check` runs typecheck, lint and tests for the whole repo.
- AC-15.3 No credentials in Git or in browser code.
- AC-15.4 README lists known limitations.

### R16 · Twist (all, TBD)
- AC-16.1 To be defined Friday. It must touch the three parts and have one visible success criterion we can demo.

## Open questions (proposed default in brackets)

- Q1 If every player hand busts, does the dealer still draw? [Reveals the hidden card, does not draw.]
- Q2 Username rules? [3 to 20 chars, letters, digits, `_`, case-insensitive unique.]
- Q3 Minimum and maximum bet? [Min 1, max = balance.]
- Q4 Hit on a split hand that reaches 21? [Finishes automatically, per AC-7.3.]
- Q5 What is the twist? [Open.]
