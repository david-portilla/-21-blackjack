import { STARTING_CANDLES } from "../rules/run";

/** The player's candles (AC-16.3). Snuffed candles stay on the table, unlit. */
export function Candles({ lit }: { lit: number }) {
  return (
    <div role="img" aria-label={`${lit} of ${STARTING_CANDLES} candles lit`} className="flex items-end gap-3">
      {Array.from({ length: STARTING_CANDLES }, (_, i) => (
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
