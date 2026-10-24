// Shared visual pieces of the theme. Visual only: no game logic. The game UI may import them.
import type { CardView, Suit } from "@/contracts/types";

const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_NAME: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };

export function PlayingCard({ card }: { card: CardView }) {
  if ("hidden" in card) {
    return (
      <div
        role="img"
        aria-label="Hidden card"
        className="h-24 w-16 shrink-0 rounded-[3px] border border-bj-line bg-bj-wood-light shadow-[0_8px_18px_rgb(0_0_0/0.5)] [background-image:repeating-linear-gradient(45deg,transparent_0_6px,rgb(0_0_0/0.25)_6px_7px)] sm:h-28 sm:w-20"
      >
        <div className="flex h-full items-center justify-center font-display text-2xl text-bj-blood/80">✶</div>
      </div>
    );
  }

  const red = card.suit === "H" || card.suit === "D";
  const symbol = SUIT_SYMBOL[card.suit];
  return (
    <div
      role="img"
      aria-label={`${card.rank} of ${SUIT_NAME[card.suit]}`}
      className={`bj-paper relative h-24 w-16 shrink-0 select-none sm:h-28 sm:w-20 ${red ? "text-bj-blood" : "text-bj-ink"}`}
    >
      <span className="absolute left-1.5 top-1 font-display text-lg leading-none">
        {card.rank}
        <span className="block text-sm">{symbol}</span>
      </span>
      <span className="flex h-full items-center justify-center text-3xl">{symbol}</span>
      <span className="absolute bottom-1 right-1.5 rotate-180 font-display text-lg leading-none">
        {card.rank}
        <span className="block text-sm">{symbol}</span>
      </span>
    </div>
  );
}
