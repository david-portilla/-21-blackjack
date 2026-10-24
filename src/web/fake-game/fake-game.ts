// In-browser emulation of the game API (R3 to R10, R16), so the site can be played before Heriberto's
// server-side game exists. Enabled with NEXT_PUBLIC_ENGINE_FAKE=1 and removed when BlackjackTable lands.
// Limitation: the hidden card lives in the browser here; only the real server-side game satisfies AC-4.3.
import type { Action, Card, Outcome } from "@/contracts/types";
import { EngineError } from "../engine-client";
import type { FakeEngine, KeyValueStore } from "../fake-engine-client";
import type { HandView, RoundView } from "../game-types";
import { freshDeck, handTotal, isNatural, shuffle } from "./rules";

type HandState = {
  handId: string;
  cards: Card[];
  stake: number;
  status: HandView["status"];
  hits: number;
  splitAces: boolean;
  outcome?: Outcome;
  payout?: number;
};

type RoundState = {
  roundId: string;
  accountId: string;
  version: number;
  status: RoundView["status"];
  deck: Card[];
  dealer: Card[];
  hands: HandState[];
  split: boolean;
};

type RunState = { runId: string; candles: number; roundsSurvived: number; roundIds: string[]; ended: boolean };

type State = {
  rounds: Record<string, RoundState>;
  current: Record<string, string>; // accountId -> latest roundId
  runs: Record<string, RunState>; // accountId -> latest run
  starts: Record<string, string>; // start idempotency key -> roundId
};

export type FakeGame = {
  current(): Promise<RoundView | null>;
  start(stake: number, idempotencyKey: string): Promise<RoundView>;
  act(roundId: string, handId: string, action: Action, version: number): Promise<RoundView>;
};

const KEY = "blackjack.fakeGame";
const CANDLES = 3;

export function createFakeGame(
  store: () => KeyValueStore,
  engine: FakeEngine,
  newDeck: () => Card[] = () => shuffle(freshDeck()),
): FakeGame {
  const load = (): State => JSON.parse(store().getItem(KEY) ?? "null") ?? { rounds: {}, current: {}, runs: {}, starts: {} };
  const save = (s: State) => store().setItem(KEY, JSON.stringify(s));

  async function accountId() {
    const account = await engine.me();
    if (!account) throw new EngineError("UNAUTHENTICATED", "Sign in first");
    return account.accountId;
  }

  const draw = (round: RoundState) => {
    const card = round.deck.shift();
    if (!card) throw new Error("Deck exhausted");
    return card;
  };
  const activeHand = (round: RoundState) =>
    round.status === "player_turn" ? round.hands.find((h) => h.status === "playing") : undefined;

  function allowedActions(round: RoundState, hand: HandState): Action[] {
    if (hand !== activeHand(round)) return [];
    const actions: Action[] = ["hit", "stand"];
    if (hand.cards.length === 2 && hand.hits === 0 && !hand.splitAces) actions.push("double");
    if (!round.split && hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank) actions.push("split");
    return actions;
  }

  // Busts and 21s finish the hand on their own (AC-7.3).
  function finishIfDone(hand: HandState) {
    const { total } = handTotal(hand.cards);
    if (total > 21) hand.status = "busted";
    else if (total === 21) hand.status = "finished";
  }

  function view(round: RoundState, run: RunState): RoundView {
    const settled = round.status === "settled";
    return {
      roundId: round.roundId,
      version: round.version,
      status: round.status,
      dealer: settled
        ? { cards: round.dealer, total: handTotal(round.dealer).total }
        : { cards: [round.dealer[0], { hidden: true }] },
      hands: round.hands.map((h) => ({
        handId: h.handId,
        cards: h.cards,
        ...handTotal(h.cards),
        stake: h.stake,
        status: h.status,
        allowedActions: allowedActions(round, h),
        outcome: h.outcome,
        payout: h.payout,
      })),
      activeHandId: activeHand(round)?.handId ?? null,
      run: { runId: run.runId, candles: run.candles, roundsSurvived: run.roundsSurvived, ended: run.ended },
    };
  }

  // Dealer plays (unless a natural decided the round), each hand settles, then the candles (R8, R11, R16).
  async function settleRound(round: RoundState, run: RunState, natural?: Outcome) {
    if (!natural) {
      while (handTotal(round.dealer).total < 17) round.dealer.push(draw(round));
    }
    const dealer = handTotal(round.dealer).total;
    for (const hand of round.hands) {
      const total = handTotal(hand.cards).total;
      const outcome: Outcome =
        natural ??
        (hand.status === "busted" ? "loss" : dealer > 21 || total > dealer ? "win" : total === dealer ? "push" : "loss");
      const tx = await engine.settle({ roundId: round.roundId, handId: hand.handId, outcome, idempotencyKey: `payout:${hand.handId}` });
      hand.outcome = outcome;
      hand.payout = tx.amount;
      if (hand.status === "playing") hand.status = "finished";
    }
    round.status = "settled";

    const staked = round.hands.reduce((sum, h) => sum + h.stake, 0);
    const returned = round.hands.reduce((sum, h) => sum + (h.payout ?? 0), 0);
    run.roundIds.push(round.roundId);
    if (returned < staked) run.candles--;
    if (run.candles === 0) {
      run.ended = true;
      await engine.closeRun({ runId: run.runId, roundIds: run.roundIds, roundsSurvived: run.roundsSurvived });
    } else {
      run.roundsSurvived++;
    }
  }

  return {
    async current() {
      const acc = await accountId();
      const s = load();
      const round = s.rounds[s.current[acc]];
      return round ? view(round, s.runs[acc]) : null;
    },

    async start(stake, idempotencyKey) {
      const acc = await accountId();
      const s = load();
      const retried = s.rounds[s.starts[idempotencyKey]];
      if (retried) return view(retried, s.runs[acc]);
      if (s.rounds[s.current[acc]]?.status === "player_turn") {
        throw new EngineError("ROUND_IN_PROGRESS", "Finish the round on the table first");
      }
      if (!Number.isInteger(stake) || stake < 1) throw new EngineError("INVALID_AMOUNT", "Bet a positive whole number");

      const roundId = crypto.randomUUID();
      const handId = `${roundId}:0`;
      // Debit first: insufficient funds leaves no round behind (AC-3.2).
      await engine.debit({ roundId, handId, kind: "BET", amount: stake, idempotencyKey: `bet:${handId}` });

      const run =
        s.runs[acc] && !s.runs[acc].ended
          ? s.runs[acc]
          : { runId: crypto.randomUUID(), candles: CANDLES, roundsSurvived: 0, roundIds: [], ended: false };
      const round: RoundState = {
        roundId,
        accountId: acc,
        version: 1,
        status: "player_turn",
        deck: newDeck(),
        dealer: [],
        hands: [{ handId, cards: [], stake, status: "playing", hits: 0, splitAces: false }],
        split: false,
      };
      const [hand] = round.hands;
      hand.cards.push(draw(round));
      round.dealer.push(draw(round));
      hand.cards.push(draw(round));
      round.dealer.push(draw(round));

      // Naturals are checked right after the deal and settle at once (R6).
      const player = isNatural(hand.cards);
      const dealer = isNatural(round.dealer);
      if (player || dealer) await settleRound(round, run, player && dealer ? "push" : player ? "blackjack" : "loss");

      s.rounds[roundId] = round;
      s.current[acc] = roundId;
      s.runs[acc] = run;
      s.starts[idempotencyKey] = roundId;
      save(s);
      return view(round, run);
    },

    async act(roundId, handId, action, version) {
      const acc = await accountId();
      const s = load();
      const round = s.rounds[roundId];
      if (!round || round.accountId !== acc) throw new EngineError("ROUND_NOT_FOUND", "Round not found");
      // A repeated or out-of-date request never draws a card (AC-12.2).
      if (round.version !== version) throw new EngineError("STALE_VERSION", "The table moved on; refreshing");
      const hand = activeHand(round);
      if (!hand || hand.handId !== handId || !allowedActions(round, hand).includes(action)) {
        throw new EngineError("INVALID_ACTION", "That move is not allowed now");
      }

      switch (action) {
        case "hit":
          hand.cards.push(draw(round));
          hand.hits++;
          finishIfDone(hand);
          break;
        case "stand":
          hand.status = "stood";
          break;
        case "double":
          await engine.debit({ roundId, handId, kind: "DOUBLE", idempotencyKey: `double:${handId}` });
          hand.stake *= 2;
          hand.cards.push(draw(round));
          hand.status = handTotal(hand.cards).total > 21 ? "busted" : "finished";
          break;
        case "split": {
          const rightId = `${roundId}:1`;
          await engine.debit({ roundId, handId: rightId, kind: "SPLIT", idempotencyKey: `split:${rightId}` });
          const second = hand.cards.pop() as Card;
          const aces = second.rank === "A";
          round.hands.push({ handId: rightId, cards: [second], stake: hand.stake, status: "playing", hits: 0, splitAces: false });
          round.split = true;
          for (const h of round.hands) {
            h.cards.push(draw(round));
            h.splitAces = aces;
            // Split aces take exactly one card each and stand (AC-10.4).
            if (aces) h.status = "finished";
            else finishIfDone(h);
          }
          break;
        }
      }

      round.version++;
      if (!activeHand(round)) await settleRound(round, s.runs[acc]);
      save(s);
      return view(round, s.runs[acc]);
    },
  };
}
