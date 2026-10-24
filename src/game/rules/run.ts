// Candles (R16). Pure: the service feeds it the round's net from the engine's transactions.

export const STARTING_CANDLES = 3;

export type RunState = {
  runId: string;
  candles: number;
  roundsWon: number;
  roundIds: string[];
  ended: boolean;
};

export function startRun(runId: string): RunState {
  return { runId, candles: STARTING_CANDLES, roundsWon: 0, roundIds: [], ended: false };
}

/** Net of one round: everything returned minus every stake (AC-16.6). */
export function roundNet(stakes: number[], payouts: number[]): number {
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  return sum(payouts) - sum(stakes);
}

/** Negative net snuffs a candle, positive net counts as a win, zero does nothing (AC-16.1, AC-16.6, AC-16.7). */
export function recordRound(run: RunState, roundId: string, net: number): RunState {
  if (run.ended) throw new Error(`run ${run.runId} has ended`);
  const candles = net < 0 ? run.candles - 1 : run.candles;
  return {
    ...run,
    candles,
    roundsWon: net > 0 ? run.roundsWon + 1 : run.roundsWon,
    roundIds: [...run.roundIds, roundId],
    ended: candles === 0,
  };
}
