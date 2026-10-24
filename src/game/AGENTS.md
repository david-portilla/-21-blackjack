# AGENTS.md · game

Owner: **Heriberto**. Folders: `src/game/, src/app/api/game/`.
Scope: round state, rules, dealer, deck, RoundView, game UI component, fixtures.

Root `AGENTS.md` applies. Local rules below are written by the owner.

## Local rules

- Two layers. `src/game/rules/` is pure: `(state, action, draw) → state`, no I/O, no engine; it covers R4 to R10 and is tested against the shared fixtures. `src/game/service/` loads and saves rounds, checks `version`, calls `debit`/`settle`/`closeRun` and maps errors. Route handlers in `src/app/api/game/` stay thin.
- Contracts first: `RoundView`, `HandView`, the round API and `src/contracts/fixtures/` land in their own `contracts:` PR, approved by David, before any feature PR depends on them.
- Bet validation: the game rejects a stake that is not a positive integer with `INVALID_AMOUNT`; the balance check is the engine's (`INSUFFICIENT_FUNDS`). The game never reads the balance.
- Round net for candles (AC-16.6) = sum of `PAYOUT` amounts returned by `settle` minus every stake of the round. Never use the game's own payout maths.
- Stale action: HTTP 409 with `{ error: { code: "STALE_VERSION", message }, round: RoundView }`; nothing is drawn.
- `GET /api/game/rounds/current` returns only an unfinished round; 404 otherwise.
- `GET /api/game/runs/current` returns `{ runId, candles, roundsSurvived, ended }` for the open run, 404 when none. The table shows candles from it between rounds (AC-16.3).
- Bet write order: insert the round `pending` with its deck shuffled and stored once, unique on `(account_id, idempotency_key)`, at most one unfinished round per account; then `debit(BET)`; then deal, check naturals, save. Same key retried returns the same round and finishes a `pending` one; another key while one is open is `ROUND_IN_PROGRESS`; `INSUFFICIENT_FUNDS` on the bet deletes the pending round (AC-3.2).
- Every round update is compare-and-swap on `version`. Settlement order: dealer plays, save `settling`, `settle` each hand, save `settled`, update the run, `closeRun` at 0 candles. A round left in `settling` is finished by the next read or action. `settling` is internal, never in `RoundView.status`.
- `HandView.status`: `stood` = player chose Stand; `busted` = over 21; `finished` = closed automatically (21, double, split aces). `outcome: 'blackjack'` only for a player natural; dealer natural is `loss`, both naturals `push`.
- The UI shows each response at once; no dealer animation.
- Run score: a round is won when its net is positive (mirror of AC-16.6). The run counts won rounds as `roundsWon`; push and net 0 count neither way. Renaming `roundsSurvived` and rewording AC-16.7 needs David's and Edgar's approval (shared contract and requirements).
- `RoundStore` is in-memory only for now; AC-12.3 (survive a restart) is a known limitation until a Postgres store exists.
- Fixtures are the draw order as `Card[]`: player, dealer up, player, dealer hidden, then draws in order (split: left hand's new card, then right's). Rules take a `draw()` function.
- Shuffle: Fisher–Yates with `crypto.getRandomValues`, once per round at creation. A deck or shuffle is injected only through `createGameService({ engine, store, shuffle })`; no route accepts one (AC-4.4).
- UI: `BlackjackTable` is a client component calling the API via `src/game/ui/game-client.ts` (`fetch`, no extra dependency). One `crypto.randomUUID()` per bet submit, reused on retry. `onMoneyChanged()` after bet, double, split, settle and run close.
- UI errors: `INSUFFICIENT_FUNDS` inline, state unchanged; `STALE_VERSION` render the returned `round` silently; `ROUND_IN_PROGRESS` load `/rounds/current` and resume; `UNAUTHENTICATED` left to the site; anything else shows `message` in `text-bj-ember`.
- Bet form: number input defaulting to the last stake (`localStorage`, first time 10), a Deal button; action buttons only from the active hand's `allowedActions`.

Deferred (owner's call, not yet decided): who provides a `FakeEngine` before Edgar's lands; the persistent `RoundStore` backend; recording these agreements in shared files.
