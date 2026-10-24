// Game orchestration: rounds, money calls and candles on top of the pure rules.
// Money moves only through the engine (debit, settle); the game sends outcomes, never amounts (AC-11.3).
import { randomUUID } from "node:crypto";
import { EngineError, type CasinoEngine } from "@/contracts/engine";
import type { RoundView, RunView } from "@/contracts/round";
import type { Action, Card } from "@/contracts/types";
import { shuffledDeck } from "../rules/cards";
import { applyAction, assertAllowed, deal, RuleError } from "../rules/round";
import { recordRound, roundNet, STARTING_CANDLES } from "../rules/run";
import { toRoundView } from "../rules/view";
import type { GameStore, RoundRow, RunRow } from "./store";

/** STALE_VERSION carries the current round so the table can re-render it. */
export class StaleVersionError extends EngineError {
  constructor(readonly round: RoundView) {
    super("STALE_VERSION");
  }
}

export type GameServiceDeps = {
  engine: CasinoEngine;
  store: GameStore;
  /** Tests inject fixture decks here; production always shuffles (AC-4.4). */
  newDeck?: () => Card[];
};

export function createGameService({ engine, store, newDeck = () => shuffledDeck() }: GameServiceDeps) {
  function drawFrom(row: RoundRow) {
    return () => {
      const card = row.deck[row.drawn++];
      if (!card) throw new Error(`deck exhausted in round ${row.roundId}`);
      return card;
    };
  }

  function runView(run: RunRow): RunView {
    return {
      runId: run.runId,
      candles: run.candles,
      startingCandles: run.startingCandles,
      roundsWon: run.roundsWon,
      ended: run.candles === 0,
    };
  }

  function view(row: RoundRow): RoundView {
    return toRoundView(row.state!, {
      version: row.version,
      settled: row.status === "settled",
      run: runView(store.runById(row.runId)!),
      payouts: row.payouts,
    });
  }

  /** Saves with compare-and-swap; on a lost race returns the winner's round as STALE_VERSION. */
  function save(row: RoundRow, expectedVersion: number) {
    if (!store.saveRound(row, expectedVersion)) {
      throw new StaleVersionError(view(store.roundById(row.accountId, row.roundId)!));
    }
  }

  async function closeRunIfOver(run: RunRow) {
    if (run.candles > 0 || run.closed) return;
    // AC-16.2, AC-16.9: the engine stores the ended run. Idempotent by runId.
    await engine.closeRun({ accountId: run.accountId, runId: run.runId, roundIds: run.roundIds, roundsSurvived: run.roundsWon });
    store.saveRun({ ...run, closed: true });
  }

  /** Pays every hand, updates the candles, closes the run at 0. Safe to repeat after a crash (AC-12.3). */
  async function settle(row: RoundRow) {
    if (row.status === "player_turn") {
      const expected = row.version;
      row.status = "settling";
      row.version++;
      save(row, expected);
    }
    for (const hand of row.state!.hands) {
      const tx = await engine.settle({
        accountId: row.accountId,
        roundId: row.roundId,
        handId: hand.handId,
        outcome: hand.outcome!,
        idempotencyKey: `payout:${hand.handId}`,
      });
      row.payouts[hand.handId] = tx.amount;
    }

    let run = store.runById(row.runId)!;
    if (!run.roundIds.includes(row.roundId)) {
      const stakes = row.state!.hands.map((h) => h.stake);
      const net = roundNet(stakes, Object.values(row.payouts));
      const next = recordRound({ ...run, ended: false }, row.roundId, net);
      run = { ...run, candles: next.candles, roundsWon: next.roundsWon, roundIds: next.roundIds };
      store.saveRun(run);
    }

    const expected = row.version;
    row.status = "settled";
    row.version++;
    save(row, expected);
    await closeRunIfOver(run);
  }

  /** Takes a pending round through BET and the deal, or finishes an interrupted settlement. */
  async function resume(row: RoundRow): Promise<RoundRow> {
    if (row.status === "pending") {
      try {
        await engine.debit({
          accountId: row.accountId,
          roundId: row.roundId,
          handId: `${row.roundId}:0`,
          kind: "BET",
          amount: row.stake,
          idempotencyKey: `bet:${row.roundId}:0`,
        });
      } catch (e) {
        // AC-3.2: a rejected bet leaves no round (and no run it would have started).
        store.deleteRound(row.roundId);
        const run = store.runById(row.runId);
        if (run && run.roundIds.length === 0) store.deleteRun(run.runId);
        throw e;
      }
      const expected = row.version;
      row.state = deal(row.roundId, row.stake, drawFrom(row));
      row.status = "player_turn";
      row.version++;
      save(row, expected);
    }
    if (row.status === "player_turn" && row.state!.phase === "resolved") await settle(row);
    else if (row.status === "settling") await settle(row);
    return row;
  }

  async function openRun(accountId: string): Promise<RunRow | null> {
    const run = store.openRun(accountId);
    if (run && run.candles === 0) {
      await closeRunIfOver(run);
      return null;
    }
    return run;
  }

  return {
    /** POST /api/game/rounds (R3, R4, R6). */
    async startRound(accountId: string, stake: unknown, idempotencyKey: string): Promise<RoundView> {
      const prior = store.roundByKey(accountId, idempotencyKey);
      if (prior) return view(await resume(prior));
      if (store.openRound(accountId)) throw new EngineError("ROUND_IN_PROGRESS");
      if (typeof stake !== "number" || !Number.isSafeInteger(stake) || stake < 1) throw new EngineError("INVALID_AMOUNT");

      // AC-16.5: the first bet without an open run lights a new one.
      let run = await openRun(accountId);
      if (!run) {
        // AC-18.5: a spare candle earned with omen tier III lights a fourth candle on the new run.
        const runId = randomUUID();
        const candles = STARTING_CANDLES + ((await engine.claimSpareCandle({ accountId, runId })) ? 1 : 0);
        run = { runId, accountId, candles, startingCandles: candles, roundsWon: 0, roundIds: [], closed: false };
        store.insertRun(run);
      }

      const row: RoundRow = {
        roundId: randomUUID(),
        accountId,
        idempotencyKey,
        runId: run.runId,
        status: "pending",
        version: 1,
        stake,
        deck: newDeck(),
        drawn: 0,
        state: null,
        payouts: {},
      };
      if (!store.insertRound(row)) {
        const raced = store.roundByKey(accountId, idempotencyKey);
        if (raced) return view(await resume(raced));
        throw new EngineError("ROUND_IN_PROGRESS");
      }
      return view(await resume(row));
    },

    /** POST /api/game/rounds/{roundId}/actions (R7 to R10, AC-12.2). */
    async act(accountId: string, roundId: string, handId: string, action: Action, version: number): Promise<RoundView> {
      let row = store.roundById(accountId, roundId);
      if (!row) throw new EngineError("ROUND_NOT_FOUND");
      row = await resume(row);
      if (row.version !== version) throw new StaleVersionError(view(row));
      if (row.status !== "player_turn") throw new EngineError("INVALID_ACTION");

      try {
        assertAllowed(row.state!, handId, action);
      } catch (e) {
        if (e instanceof RuleError) throw new EngineError("INVALID_ACTION");
        throw e;
      }

      // AC-9.2, AC-10.2: the extra stake is debited before any card moves. A retry reuses the key.
      if (action === "double") {
        await engine.debit({ accountId, roundId, handId, kind: "DOUBLE", idempotencyKey: `double:${handId}` });
      } else if (action === "split") {
        await engine.debit({ accountId, roundId, handId: `${roundId}:1`, kind: "SPLIT", idempotencyKey: `split:${roundId}:1` });
      }

      const expected = row.version;
      row.state = applyAction(row.state!, handId, action, drawFrom(row));
      row.version++;
      save(row, expected);
      if (row.state.phase === "resolved") await settle(row);
      return view(row);
    },

    /** GET /api/game/rounds/current: the unfinished round, or null. */
    async currentRound(accountId: string): Promise<RoundView | null> {
      const row = store.openRound(accountId);
      if (!row) return null;
      const resumed = await resume(row).catch(() => null);
      return resumed && resumed.status === "player_turn" ? view(resumed) : null;
    },

    /** GET /api/game/runs/current: the open run, or null. */
    async currentRun(accountId: string): Promise<RunView | null> {
      const run = await openRun(accountId);
      return run ? runView(run) : null;
    },
  };
}

export type GameService = ReturnType<typeof createGameService>;
