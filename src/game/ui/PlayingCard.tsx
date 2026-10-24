import type { CardView, Suit } from "@/contracts/types";

const SUIT_SYMBOL: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const SUIT_NAME: Record<Suit, string> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };

export function PlayingCard({ card }: { card: CardView }) {
  if ("hidden" in card) {
    return (
      <div
        aria-label="Hidden card"
        className="flex h-24 w-16 items-center justify-center rounded-[3px] border border-bj-blood bg-bj-wood-light shadow-lg sm:h-28 sm:w-20"
      >
        <span aria-hidden className="font-display text-2xl text-bj-blood">✠</span>
      </div>
    );
  }
  const red = card.suit === "H" || card.suit === "D";
  const symbol = SUIT_SYMBOL[card.suit];
  return (
    <div
      aria-label={`${card.rank} of ${SUIT_NAME[card.suit]}`}
      className={`bj-paper relative flex h-24 w-16 flex-col justify-between p-1.5 font-mono sm:h-28 sm:w-20 ${red ? "text-bj-blood" : ""}`}
    >
      <span aria-hidden className="leading-none">{card.rank}{symbol}</span>
      <span aria-hidden className="self-center text-3xl leading-none">{symbol}</span>
      <span aria-hidden className="rotate-180 leading-none">{card.rank}{symbol}</span>
    </div>
  );
}
