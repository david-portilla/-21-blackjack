// In-browser stand-in for /api/game/*, so the table can be built before the game service and Edgar's engine exist.
// Used together with the site's fake engine (NEXT_PUBLIC_ENGINE_FAKE=1): without a real engine there is no
// server session for the game routes. It runs the real rules but moves no money: payouts here are display only.
import type { RoundView, RunView } from "@/contracts/round";
import type { Card } from "@/contracts/types";
import { shuffledDeck } from "../rules/cards";
import { applyAction, deal, RuleError, type RoundState } from "../rules/round";
import { recordRound, roundNet, startRun, type RunState } from "../rules/run";
import { toRoundView } from "../rules/view";
import { GameError, type GameClient } from "./game-client";

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

type StoredRound = {
  state: RoundState;
  deck: Card[];
  drawn: number;
  version: number;
  settled: boolean;
  payouts: Record<string, number>;
  idempotencyKey: string;
};

type State = { round: StoredRound | null; run: RunState | null };

const KEY = "blackjack.fakeGame";

export function createFakeGameClient(store: () => KeyValueStore, newDeck: () => Card[] = () => shuffledDeck()): GameClient {
  const load = (): State => JSON.parse(store().getItem(KEY) ?? "null") ?? { round: null, run: null };
  const save = (s: State) => store().setItem(KEY, JSON.stringify(s));

  const drawFrom = (r: StoredRound) => () => {
    const next = r.deck[r.drawn++];
    if (!next) throw new Error("deck exhausted");
    return next;
  };

  const runView = (run: RunState): RunView => ({
    runId: run.runId,
    candles: run.candles,
    roundsWon: run.roundsWon,
    ended: run.ended,
  });

  const view = (s: State): RoundView =>
    toRoundView(s.round!.state, {
      version: s.round!.version,
      settled: s.round!.settled,
      run: runView(s.run!),
      payouts: s.round!.payouts,
    });

  // Simplified even money (AC-11.2). The real payout comes from the engine.
  function settleIfResolved(s: State) {
    const r = s.round!;
    if (r.state.phase !== "resolved" || r.settled) return;
    for (const h of r.state.hands) {
      r.payouts[h.handId] = h.outcome === "win" || h.outcome === "blackjack" ? 2 * h.stake : h.outcome === "push" ? h.stake : 0;
    }
    const net = roundNet(r.state.hands.map((h) => h.stake), Object.values(r.payouts));
    s.run = recordRound(s.run!, r.state.roundId, net);
    r.settled = true;
  }

  return {
    async currentRound() {
      const s = load();
      return s.round && !s.round.settled ? view(s) : null;
    },

    async currentRun() {
      const s = load();
      return s.run && !s.run.ended ? runView(s.run) : null;
    },

    async startRound(stake, idempotencyKey) {
      const s = load();
      if (s.round?.idempotencyKey === idempotencyKey) return view(s);
      if (s.round && !s.round.settled) throw new GameError("ROUND_IN_PROGRESS", "Finish the round on the table first");
      if (!Number.isInteger(stake) || stake < 1) throw new GameError("INVALID_AMOUNT", "Bet a positive whole number");

      if (!s.run || s.run.ended) s.run = startRun(crypto.randomUUID());
      const round: StoredRound = {
        state: null as unknown as RoundState,
        deck: newDeck(),
        drawn: 0,
        version: 1,
        settled: false,
        payouts: {},
        idempotencyKey,
      };
      round.state = deal(crypto.randomUUID(), stake, drawFrom(round));
      s.round = round;
      settleIfResolved(s);
      save(s);
      return view(s);
    },

    async act(roundId, { handId, action, version }) {
      const s = load();
      const r = s.round;
      if (!r || r.state.roundId !== roundId) throw new GameError("ROUND_NOT_FOUND", "No such round");
      if (r.version !== version) throw new GameError("STALE_VERSION", "The table moved on", view(s));
      try {
        r.state = applyAction(r.state, handId, action, drawFrom(r));
      } catch (e) {
        if (e instanceof RuleError) throw new GameError("INVALID_ACTION", e.message);
        throw e;
      }
      r.version++;
      settleIfResolved(s);
      save(s);
      return view(s);
    },
  };
}
