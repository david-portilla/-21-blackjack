"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { HandView, RoundView, RunView } from "@/contracts/round";
import type { Action, Outcome } from "@/contracts/types";
import { STARTING_CANDLES } from "../rules/run";
import { Candles } from "./Candles";
import { GameError, httpGameClient as gameClient } from "./game-client";
import { PlayingCard } from "./PlayingCard";

const STAKE_KEY = "blackjack.lastStake";
const DEFAULT_STAKE = "10";

const ACTION_LABEL: Record<Action, string> = { hit: "Hit", stand: "Stand", double: "Double", split: "Split" };
const OUTCOME_LABEL: Record<Outcome, string> = { win: "Won", push: "Push", loss: "Lost", blackjack: "Blackjack" };

function readStake(): string {
  try {
    return window.localStorage.getItem(STAKE_KEY) ?? DEFAULT_STAKE;
  } catch {
    return DEFAULT_STAKE;
  }
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong";
}

/** The game, mounted by the site on /play (AC-14.3). Calls onMoneyChanged after every response that moved money (AC-14.2). */
export function BlackjackTable({ onMoneyChanged }: { onMoneyChanged: () => void }) {
  const [round, setRound] = useState<RoundView | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [loading, setLoading] = useState(true);
  const [stake, setStake] = useState(DEFAULT_STAKE);
  // One key per bet intent: reused on retry, renewed when the stake changes or a bet is accepted.
  const [betKey, setBetKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([gameClient.currentRound(), gameClient.currentRun()])
      .then(([r, open]) => {
        setRound(r);
        setRun(r?.run ?? open);
        setStake(readStake());
      })
      .catch((e) => setError(messageOf(e)))
      .finally(() => setLoading(false));
  }, []);

  function show(view: RoundView) {
    setRound(view);
    setRun(view.run);
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
    setBusy(true);
    setError(null);
    try {
      show(await gameClient.startRound(value, betKey));
      try {
        window.localStorage.setItem(STAKE_KEY, stake);
      } catch {}
      setBetKey(crypto.randomUUID());
      onMoneyChanged();
    } catch (err) {
      await handle(err);
    } finally {
      setBusy(false);
    }
  }

  async function onAction(hand: HandView, action: Action) {
    if (!round) return;
    setBusy(true);
    setError(null);
    try {
      const view = await gameClient.act(round.roundId, { handId: hand.handId, action, version: round.version });
      show(view);
      if (action === "double" || action === "split" || view.status === "settled") onMoneyChanged();
    } catch (err) {
      await handle(err);
    } finally {
      setBusy(false);
    }
  }

  async function handle(err: unknown) {
    if (err instanceof GameError) {
      if (err.code === "STALE_VERSION" && err.round) return show(err.round);
      if (err.code === "ROUND_IN_PROGRESS") {
        const current = await gameClient.currentRound().catch(() => null);
        if (current) return show(current);
      }
    }
    setError(messageOf(err));
  }

  if (loading) {
    return <p className="p-10 text-center italic text-bj-muted">The dealer shuffles…</p>;
  }

  const playing = round?.status === "player_turn";
  // No run yet: the next bet lights a fresh one (AC-16.5).
  const candles = run ? run.candles : STARTING_CANDLES;

  return (
    <section aria-label="Blackjack table" className="flex w-full flex-col gap-6 rounded border border-bj-line bg-bj-wood/70 p-4 shadow-2xl sm:p-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl">The dealer&rsquo;s table</h1>
          <p className="text-sm text-bj-muted">
            Rounds won this run: <span className="font-mono text-bj-text">{run?.roundsWon ?? 0}</span>
          </p>
        </div>
        <Candles lit={candles} />
      </header>

      <Seat label="Dealer" total={round?.dealer.total}>
        {round ? round.dealer.cards.map((c, i) => <PlayingCard key={i} card={c} />) : <EmptySlot />}
      </Seat>

      <div className="flex flex-col gap-4 sm:flex-row">
        {round ? (
          round.hands.map((hand) => (
            <Hand key={hand.handId} hand={hand} active={hand.handId === round.activeHandId} busy={busy} onAction={onAction} split={round.hands.length > 1} />
          ))
        ) : (
          <Seat label="You">
            <EmptySlot />
          </Seat>
        )}
      </div>

      {round?.status === "settled" && round.run.ended && (
        <p className="text-center font-display text-xl text-bj-ember">
          The last candle goes out. The dealer claims you after {round.run.roundsWon} {round.run.roundsWon === 1 ? "win" : "wins"}.
        </p>
      )}

      {!playing && (
        <form onSubmit={onBet} className="bj-paper flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
          <label htmlFor="stake" className="italic">
            {round ? "Another round?" : "Place your bet"}
          </label>
          <div className="flex flex-1 gap-2">
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

      {error && (
        <p role="alert" className="text-center text-bj-ember">
          {error}
        </p>
      )}
    </section>
  );
}

function Seat({ label, total, children }: { label: string; total?: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-display text-bj-muted">
        {label}
        {total !== undefined && <span className="ml-2 font-mono text-bj-text">{total}</span>}
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function EmptySlot() {
  return <div className="h-24 w-16 rounded-[3px] border border-dashed border-bj-line sm:h-28 sm:w-20" />;
}

function Hand({
  hand,
  active,
  busy,
  split,
  onAction,
}: {
  hand: HandView;
  active: boolean;
  busy: boolean;
  split: boolean;
  onAction: (hand: HandView, action: Action) => void;
}) {
  const label = split ? (hand.handId.endsWith(":0") ? "Left hand" : "Right hand") : "You";
  return (
    <div className={`flex flex-1 flex-col gap-2 rounded p-2 ${active ? "ring-1 ring-bj-candle" : ""}`}>
      <p className="font-display text-bj-muted">
        {label}
        <span className="ml-2 font-mono text-bj-text">
          {hand.total}
          {hand.soft && hand.total < 21 ? " soft" : ""}
        </span>
        <span className="ml-3 text-sm">stake {hand.stake}</span>
        {hand.status === "busted" && <span className="ml-3 text-bj-ember">bust</span>}
      </p>
      <div className="flex flex-wrap gap-2">
        {hand.cards.map((c, i) => (
          <PlayingCard key={i} card={c} />
        ))}
      </div>
      {hand.outcome && (
        <p className={`font-display text-lg ${hand.outcome === "loss" ? "text-bj-ember" : hand.outcome === "push" ? "text-bj-muted" : "text-bj-moss"}`}>
          {OUTCOME_LABEL[hand.outcome]}
          {hand.payout !== undefined && <span className="ml-2 font-mono text-sm">returns {hand.payout}</span>}
        </p>
      )}
      {hand.allowedActions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {hand.allowedActions.map((a) => (
            <button key={a} type="button" disabled={busy} onClick={() => onAction(hand, a)} className="bj-button">
              {ACTION_LABEL[a]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
