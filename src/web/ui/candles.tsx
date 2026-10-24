// Shared visual piece of the theme: the run's candles (R16). Visual only.
export function Candles({ lit, total = 3 }: { lit: number; total?: number }) {
  return (
    <div role="img" aria-label={`${lit} of ${total} candles lit`} className="flex items-end gap-4">
      {Array.from({ length: total }, (_, i) => {
        const on = i < lit;
        return (
          <div key={i} className="flex flex-col items-center">
            <div
              className={
                on
                  ? "bj-candle-glow h-5 w-2.5 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-bj-candle shadow-[0_0_14px_4px_rgb(233_166_64/0.55)]"
                  : "h-5 w-2.5 opacity-0"
              }
            />
            <div className={`h-1.5 w-px ${on ? "bg-bj-ink" : "bg-bj-muted"}`} />
            <div className={`h-10 w-4 rounded-t-sm ${on ? "bg-bj-paper" : "bg-bj-paper-dark/50"}`} />
          </div>
        );
      })}
    </div>
  );
}
