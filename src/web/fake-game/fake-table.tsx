"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Action } from "@/contracts/types";
import { EngineError, messageOf } from "../engine-client";
import type { RoundView } from "../game-types";
import { TableView } from "../ui/table-view";
import type { FakeGame } from "./fake-game";

// Playable table on top of the in-browser game emulation. Same props Heriberto's BlackjackTable will take.
export function FakeTable({ game, onMoneyChanged }: { game: FakeGame; onMoneyChanged: () => void }) {
  const [round, setRound] = useState<RoundView | null>(null);
  const [stake, setStake] = useState("10");
  const [betKey, setBetKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    game.current().then(setRound).catch((e) => setError(messageOf(e)));
  }, [game]);

  async function run(step: () => Promise<RoundView>) {
    setBusy(true);
    setError(null);
    try {
      setRound(await step());
      onMoneyChanged();
    } catch (e) {
      setError(messageOf(e));
      if (e instanceof EngineError && e.code === "STALE_VERSION") setRound(await game.current());
    } finally {
      setBusy(false);
    }
  }

  function onStakeChange(value: string) {
    setStake(value);
    setBetKey(crypto.randomUUID());
  }

  async function onBet(e: FormEvent) {
    e.preventDefault();
    const value = Number(stake);
    if (!Number.isInteger(value) || value < 1) {
      setError("Bet a positive whole number");
      return;
    }
    await run(() => game.start(value, betKey));
    setBetKey(crypto.randomUUID());
  }

  const onAction = (handId: string, action: Action) => {
    if (round) void run(() => game.act(round.roundId, handId, action, round.version));
  };

  const canBet = !round || round.status === "settled";
  const claimed = round?.status === "settled" && round.run.ended;

  return (
    <div className="flex w-full flex-col items-center gap-8">
      {round ? (
        <TableView round={round} onAction={onAction} disabled={busy} />
      ) : (
        <p className="italic text-bj-muted">Three candles are lit. Place your first bet.</p>
      )}

      {claimed && (
        <p className="font-display text-xl text-bj-ember">
          The dealer claims you after {round.run.roundsSurvived} rounds. Your next bet lights three new candles.
        </p>
      )}

      {canBet && (
        <form onSubmit={onBet} className="bj-paper flex w-full max-w-xs flex-col gap-3 p-5">
          <label htmlFor="stake" className="italic">
            Your bet
          </label>
          <div className="flex gap-2">
            <input
              id="stake"
              inputMode="numeric"
              value={stake}
              onChange={(e) => onStakeChange(e.target.value)}
              className="bj-input w-full font-mono"
            />
            <button type="submit" disabled={busy} className="bj-button">
              Deal
            </button>
          </div>
        </form>
      )}

      {error && <p className="text-sm text-bj-ember">{error}</p>}
    </div>
  );
}
