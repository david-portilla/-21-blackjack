# Contracts

Status: **DRAFT v0**. Freezes as v1 on Friday together with `docs/requirements.md`. After freeze: additive changes only, by PR approved by every owner affected.

This folder is the only place where the three parts meet. Types live here as TypeScript; this README is the human-readable version. If the README and the types disagree, fix one of them in the same PR.

| Section | Owner |
|---|---|
| Shared types (cards, IDs, errors) | David |
| `CasinoEngine` interface + engine HTTP API | Edgar |
| Round API + `RoundView` | Heriberto |
| Test fixtures (fixed decks) | Heriberto |
| Website integration + shared theme | David |

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

## Website integration (David)

How the site consumes your parts. The site already runs against an in-browser fake engine (`src/web/fake-engine-client.ts`); when your routes exist, set `NEXT_PUBLIC_ENGINE_FAKE=0` in `.env` and the same screens call the real thing.

### What the site expects from `/api/engine/*` (Edgar)

- JSON in and out. Success: the body in the table above, status 2xx. Failure: status 4xx/5xx with `ApiError` (`{ error: { code, message } }`); the site shows `message` and branches on `code`.
- Session: `POST /api/engine/session` sets an HTTP-only, same-origin cookie. The site never sends an `accountId`; every other call relies on the cookie.
- `GET /api/engine/me` without a session: status 401 with code `UNAUTHENTICATED`. The site treats that as "signed out", not as an error.
- `Transaction.amount` is always a positive integer; the site derives the sign from `kind` (`BET`, `DOUBLE`, `SPLIT` are debits).
- Fields the site renders: `Transaction.createdAt | kind | outcome | handId | amount | balanceAfter`, `Run.endedAt | roundsSurvived | net`. Lists newest first.
- Proposed, pending Edgar: `INVALID_USERNAME` error code for `POST /session`, and `DELETE /api/engine/session` to sign out.
- When you publish the engine types as TypeScript, the site switches `src/web/engine-types.ts` to import them.

### How the game mounts in the site (Heriberto, proposed)

- Export a client component from `src/game/ui/BlackjackTable.tsx`:

  ```ts
  export function BlackjackTable(props: { onMoneyChanged: () => void }): JSX.Element
  ```

- The site renders it on `/play` under the header, which already shows the balance, inside a centered column up to `max-w-5xl`.
- Call `onMoneyChanged()` after every response that moved money: bet accepted, double or split debited, round settled, run closed. The site then refetches `/api/engine/me` (AC-14.2).
- The player is already signed in when the table renders; your routes read the account from the session cookie via `engine.getSessionAccount(req)`.

### Shared theme

Defined in `src/app/globals.css`. Use the tokens so the table and the site look like one place.

| Use | Tailwind / class |
|---|---|
| Colors | `bg-bj-night`, `bg-bj-wood`, `border-bj-line`, `text-bj-text`, `text-bj-muted`, `text-bj-candle`, `bg-bj-blood`, `text-bj-ember` (errors), `text-bj-moss` (wins) |
| Fonts | `font-sans` (IM Fell English), `font-display` (small caps, titles), `font-mono` (Special Elite, numbers) |
| Paper card with ink text | `.bj-paper` |
| Primary button | `.bj-button` |
| Input on paper | `.bj-input` |
| Candlelight (candles, balance) | `.bj-candle-glow` (respects reduced motion) |

Inscryption is a mood reference only: draw or generate your own art, never copy its assets.

Visual pieces you can import (no logic, take them or leave them): `PlayingCard` (`@/web/ui/playing-card`, renders a `CardView`, hidden card included), `Candles` (`@/web/ui/candles`, `lit` of 3), and `TableView` (`@/web/ui/table-view`, renders a whole `RoundView` with action buttons). Until `BlackjackTable` lands, `/play` runs an in-browser emulation of the round API on the fake engine (`src/web/fake-game/`, D-016) and a static `TablePreview` otherwise. Heriberto: its tests (`fake-game.test.ts`) use fixed decks for double, split, split aces, naturals and soft 17; reuse the scenarios if useful. Your server-side game is the source of truth.

## Fixtures

`fixtures/` holds named fixed decks (e.g. `double-5-6`, `split-8-8`, `split-aces`, `both-natural`, `dealer-soft-17`). Every owner's tests use the same ones, so agents and models agree on what "correct" looks like.
