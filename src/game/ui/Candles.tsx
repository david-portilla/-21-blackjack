import { STARTING_CANDLES } from "../rules/run";

/** The player's candles (AC-16.3); `total` is 4 with a spare candle (AC-18.5). Snuffed candles stay, unlit. */
export function Candles({ lit, total = STARTING_CANDLES }: { lit: number; total?: number }) {
  return (
    <div role="img" aria-label={`${lit} of ${total} candles lit`} className="flex items-end gap-3">
      {Array.from({ length: total }, (_, i) => (
        <Candle key={i} lit={i < lit} />
      ))}
    </div>
  );
}

function Candle({ lit }: { lit: boolean }) {
  return (
    <svg width="22" height="56" viewBox="0 0 22 56" aria-hidden>
      {lit ? (
        <path className="bj-candle-glow" d="M11 2 C16 10 15 16 11 18 C7 16 6 10 11 2 Z" fill="var(--bj-candle)" />
      ) : (
        <path d="M11 18 C9 13 13 10 10 5" stroke="var(--bj-muted)" strokeWidth="1" fill="none" opacity="0.6" />
      )}
      <line x1="11" y1="18" x2="11" y2="22" stroke="var(--bj-ink)" strokeWidth="1.5" />
      <rect x="5" y="22" width="12" height="32" rx="1.5" fill="var(--bj-paper)" opacity={lit ? 1 : 0.55} />
    </svg>
  );
}
