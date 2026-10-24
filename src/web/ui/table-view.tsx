// Presentational blackjack table: renders a RoundView. No game logic; whoever owns the round passes it in.
import type { Action, Outcome } from "@/contracts/types";
import type { HandView, RoundView } from "../game-types";
import { Candles } from "./candles";
import { PlayingCard } from "./playing-card";

const ACTION_LABEL: Record<Action, string> = { hit: "Hit", stand: "Stand", double: "Double", split: "Split" };
const OUTCOME_LABEL: Record<Outcome, string> = { win: "Win", blackjack: "Blackjack", push: "Push", loss: "Loss" };

type Props = {
  round: RoundView;
  onAction?: (handId: string, action: Action) => void;
  disabled?: boolean;
};

export function TableView({ round, onAction, disabled }: Props) {
  const active = round.hands.find((h) => h.handId === round.activeHandId);

  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <Candles lit={round.run.candles} />
        <p className="text-sm italic text-bj-muted">
          Rounds survived: <span className="font-mono text-bj-text">{round.run.roundsSurvived}</span>
        </p>
      </div>

      <section aria-label="Dealer" className="flex flex-col items-center gap-3">
        <h2 className="font-display text-xl text-bj-muted">
          The dealer{round.dealer.total !== undefined && <span className="font-mono"> · {round.dealer.total}</span>}
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {round.dealer.cards.map((card, i) => (
            <PlayingCard key={i} card={card} />
          ))}
        </div>
      </section>

      <section aria-label="Your hands" className="flex flex-wrap justify-center gap-10">
        {round.hands.map((hand) => (
          <Hand key={hand.handId} hand={hand} active={hand.handId === round.activeHandId} />
        ))}
      </section>

      {active && (
        <div className="flex flex-wrap justify-center gap-3">
          {active.allowedActions.map((action) => (
            <button
              key={action}
              type="button"
              disabled={disabled || !onAction}
              onClick={() => onAction?.(active.handId, action)}
              className="bj-button min-w-24"
            >
              {ACTION_LABEL[action]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Hand({ hand, active }: { hand: HandView; active: boolean }) {
  const result = hand.outcome && (
    <span className={hand.outcome === "loss" ? "text-bj-ember" : hand.outcome === "push" ? "text-bj-muted" : "text-bj-moss"}>
      {OUTCOME_LABEL[hand.outcome]}
      {hand.payout !== undefined && <span className="font-mono"> · +{hand.payout}</span>}
    </span>
  );

  return (
    <div
      data-testid="hand"
      className={`flex flex-col items-center gap-3 rounded p-3 ${active ? "outline outline-1 outline-bj-candle/60" : ""}`}
    >
      <div className="flex flex-wrap justify-center gap-2">
        {hand.cards.map((card, i) => (
          <PlayingCard key={i} card={card} />
        ))}
      </div>
      <p className="text-center">
        <span className="font-mono text-lg">{hand.total}</span>
        {hand.soft && <span className="text-sm italic text-bj-muted"> soft</span>}
        {hand.status === "busted" && <span className="text-bj-ember"> · bust</span>}
        <span className="block text-sm text-bj-muted">
          Stake <span className="font-mono text-bj-text">{hand.stake}</span>
        </span>
        {result && <span className="block font-display">{result}</span>}
      </p>
    </div>
  );
}
