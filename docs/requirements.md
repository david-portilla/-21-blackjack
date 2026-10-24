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

### R16 · Twist: Candles (all)
Inspired by Inscryption, which is also the visual reference for the game and the site (mood only: no copied assets or fonts).
- AC-16.1 A run starts with 3 candles; each lost round snuffs one.
- AC-16.2 At 0 candles the dealer claims the player: the run ends and is recorded.
- AC-16.3 The player sees their candles at the table and their past runs (and best run) on the site.
- AC-16.4 Visible success criterion for the demo: losing 3 rounds snuffs 3 candles and the run appears in the player's history.
- AC-16.5 A run starts automatically with the first bet when the player has no open run, and stays open across visits until it ends.
- AC-16.6 A round is lost when its net is negative: total returned minus every stake of the round (original, double, split). Push or net 0 (e.g. split with one win and one loss) snuffs nothing.
- AC-16.7 Candles never relight. The run's score is rounds survived.
- AC-16.8 Candles never change the balance.
- AC-16.9 Ownership: the game keeps the live run (candles, rounds survived) and returns it in `RoundView`; when the run ends the game calls `engine.closeRun`, the engine computes the run's net from its transactions, stores it and serves it at `GET /api/engine/runs`; the site shows past runs and the best one.

### R17 · Side quest: Omens (Edgar, David; proposed)
A daily challenge about how you play, never about how much. Reward is cosmetic. Rules: `src/contracts/omens.ts`.
- AC-17.1 Every day (UTC) has one omen, the same for every player, rotating through: win a hand you doubled, split a pair, draw a natural blackjack, tie the dealer.
- AC-17.2 An omen is fulfilled only by that day's own play, read from the ledger; deposits and bet sizes never fulfil it.
- AC-17.3 The streak counts consecutive days with the omen fulfilled, ending today, or yesterday while today is open. Missing a day only resets the count: no warnings, no penalty.
- AC-17.4 The lobby shows today's omen, whether it is fulfilled and the streak; a fulfilled omen marks the player's name with ✶ for the day.
- AC-17.5 Omens never move credits, never require a deposit and never depend on the amount bet.

## Open questions

Resolved:
- Q1 If every player hand busts, the dealer still reveals and plays to 17 (literal brief, no special case). Proposed by David, pending Heriberto.
- Q2 Username: the engine trims it and otherwise stores and matches it as sent, with no rules; any validation lives in the site. Using an existing name signs into that account. Decided by Edgar.
- Q3 Bet: min 1, max = balance, no fixed cap. Proposed by David, pending Heriberto and Edgar.
- Q4 A split hand reaching 21 finishes automatically: settled by the brief ("A hand reaching 21 finishes automatically"), AC-7.3.
- Q5 Twist: Candles (R16), Inscryption-inspired. Agreed by David; team to confirm.
- Q6 to Q9 Run start, lost round, no relight, no money effect: AC-16.5 to AC-16.8. Agreed by David; team to confirm.
- Q10 Run ownership and contract additions: AC-16.9. Proposed by David, pending Edgar and Heriberto.
