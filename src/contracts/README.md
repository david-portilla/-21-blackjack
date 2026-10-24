# Contracts

Status: **DRAFT v0**. Freezes as v1 on Friday together with `docs/requirements.md`. After freeze: additive changes only, by PR approved by every owner affected.

This folder is the only place where the three parts meet. Types live here as TypeScript; this README is the human-readable version. If the README and the types disagree, fix one of them in the same PR.

| Section | Owner |
|---|---|
| Shared types (cards, IDs, errors) | David |
| `CasinoEngine` interface + engine HTTP API | Edgar |
| Round API + `RoundView` | Heriberto |
| Test fixtures (fixed decks) | Heriberto |

## IDs

- `accountId`, `roundId`, `transactionId`: UUID strings.
- `handId`: `${roundId}:0` (left or only hand) and `${roundId}:1` (right hand after split).
- Idempotency keys between game and engine are deterministic: `${kind}:${handId}`.

| Movement | Kind | Key | Recorded against |
|---|---|---|---|
| Original stake | `BET` | `bet:{roundId}:0` | hand 0 |
| Split stake | `SPLIT` | `split:{roundId}:1` | hand 1 |
| Double stake | `DOUBLE` | `double:{handId}` | that hand |
| Payout | `PAYOUT` | `payout:{handId}` | that hand |

A hand's final stake is the sum of the debits recorded against it. That is how the engine computes payouts without trusting an amount from the game.

## Who calls whom

```
Browser ──HTTP──> /api/engine/*   accounts, session, deposits, balance, history   (Edgar)
Browser ──HTTP──> /api/game/*     start round, actions, round view                (Heriberto)
Game server ──in-process──> CasinoEngine (debit, settle)                          (Edgar implements)
```

The browser never calls `debit` or `settle`. They are not exposed over HTTP.

## Shared types (sketch)

```ts
type Rank = 'A'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'
type Suit = 'S'|'H'|'D'|'C'
type Card = { rank: Rank; suit: Suit }
type CardView = Card | { hidden: true }

type Action = 'hit'|'stand'|'double'|'split'
type Outcome = 'win'|'push'|'loss'|'blackjack'
type TxKind = 'DEPOSIT'|'BET'|'DOUBLE'|'SPLIT'|'PAYOUT'

type ErrorCode =
  | 'INVALID_AMOUNT' | 'INSUFFICIENT_FUNDS' | 'ACCOUNT_NOT_FOUND' | 'UNAUTHENTICATED'
  | 'ROUND_NOT_FOUND' | 'ROUND_IN_PROGRESS' | 'INVALID_ACTION' | 'STALE_VERSION'
  | 'IDEMPOTENCY_CONFLICT'

type ApiError = { error: { code: ErrorCode; message: string } }
```

## Engine: in-process interface (Edgar)

```ts
interface CasinoEngine {
  getSessionAccount(req: Request): Promise<{ accountId: string } | null>
  debit(input: {
    accountId: string; roundId: string; handId: string
    kind: 'BET'|'DOUBLE'|'SPLIT'; amount: number; idempotencyKey: string
  }): Promise<Transaction>        // throws INSUFFICIENT_FUNDS | INVALID_AMOUNT | IDEMPOTENCY_CONFLICT
  settle(input: {
    accountId: string; roundId: string; handId: string
    outcome: Outcome; idempotencyKey: string
  }): Promise<Transaction>        // amount computed by the engine (R11)
}

type Transaction = {
  transactionId: string; accountId: string; kind: TxKind; amount: number
  roundId?: string; handId?: string; outcome?: Outcome
  balanceAfter: number; createdAt: string
}
```

Rules the engine enforces: `BET` amount > 0; `DOUBLE` amount equals the hand's current stake; `SPLIT` amount equals hand 0's `BET`; same key + same payload returns the original transaction; same key + different payload is `IDEMPOTENCY_CONFLICT`; check-and-debit is one atomic DB operation.

**Proposed for the twist (R16, pending Edgar and Heriberto):**

```ts
interface CasinoEngine {
  // ...
  closeRun(input: { accountId: string; runId: string; roundIds: string[]; roundsSurvived: number }): Promise<Run>
}

type Run = {
  runId: string; accountId: string; roundsSurvived: number
  net: number                 // computed by the engine from its transactions of roundIds
  endedAt: string
}
```

Idempotency: `closeRun` with the same `runId` returns the stored run.

A `FakeEngine` (in-memory, same interface) lives next to the interface so the game can be built before the real engine exists.

## Engine: HTTP API for the website (Edgar)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/engine/session` | `{ username }` | `{ accountId, username, balance }`, sets cookie (R1) |
| GET | `/api/engine/me` | | `{ accountId, username, balance }` |
| POST | `/api/engine/deposits` | `{ amount, idempotencyKey }` | `Transaction` (R2) |
| GET | `/api/engine/transactions` | | `Transaction[]`, newest first (R13) |
| GET | `/api/engine/runs` | | `Run[]`, newest first (R16, proposed) |

## Game: HTTP API (Heriberto)

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/api/game/rounds` | `{ stake, idempotencyKey }` | `RoundView` (R3, R4, R6) |
| GET | `/api/game/rounds/current` | | `RoundView` or 404 |
| POST | `/api/game/rounds/{roundId}/actions` | `{ handId, action, version }` | `RoundView` (R7 to R10) |

```ts
type RoundView = {
  roundId: string
  version: number                       // bumps on every state change (R12)
  status: 'player_turn' | 'settled'
  dealer: { cards: CardView[]; total?: number }   // total only when settled
  hands: HandView[]
  activeHandId: string | null
  run: { runId: string; candles: number; roundsSurvived: number; ended: boolean }   // R16, proposed
}

type HandView = {
  handId: string
  cards: Card[]
  total: number
  soft: boolean
  stake: number
  status: 'playing' | 'stood' | 'busted' | 'finished'
  allowedActions: Action[]              // computed server-side; the UI only renders them
  outcome?: Outcome
  payout?: number
}
```

## Sequence of one round

1. Website: `POST /api/engine/session`, then `POST /api/engine/deposits`.
2. Game UI: `POST /api/game/rounds { stake, idempotencyKey }`.
   Game persists the round as pending, calls `engine.debit(BET)`, then deals and checks naturals (R6). On a natural it settles at once.
   A retry with the same `idempotencyKey` returns the same round.
3. Game UI: `POST .../actions { handId, action, version }`.
   - `version` differs from the stored one: return the current `RoundView` with `STALE_VERSION`, draw nothing.
   - `double` / `split`: call `engine.debit` first. On `INSUFFICIENT_FUNDS` return the error and change nothing.
4. When all hands finish: dealer plays (R8), then `engine.settle` once per hand with `payout:{handId}`.
5. Website: refetch `/api/engine/me` and `/api/engine/transactions` after each response that changed money (R14).

## Fixtures

`fixtures/` holds named fixed decks (e.g. `double-5-6`, `split-8-8`, `split-aces`, `both-natural`, `dealer-soft-17`). Every owner's tests use the same ones, so agents and models agree on what "correct" looks like.
