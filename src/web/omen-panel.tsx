"use client";

import { useOmen } from "./use-omen";

// Today's omen in the lobby (R17): the challenge, whether it is fulfilled, and the streak. Cosmetic only.
export function OmenPanel() {
  const { omen, unavailable } = useOmen();

  if (unavailable) return <p className="text-center italic text-bj-muted">The omens are silent today.</p>;
  if (!omen) return null;

  return (
    <section aria-label="Today's omen" className="rounded border border-bj-line p-5 text-center">
      <h2 className="font-display text-sm tracking-widest text-bj-muted">Today&apos;s omen</h2>
      <p className="mt-2 font-display text-2xl">{omen.omen.title}</p>
      <p className="mt-2" data-testid="omen-state">
        {omen.fulfilled ? (
          <span className="bj-candle-glow">✶ The omen is fulfilled</span>
        ) : (
          <span className="italic text-bj-muted">Not yet fulfilled</span>
        )}
      </p>
      <p className="mt-1 text-sm text-bj-muted">
        Streak: <span className="font-mono text-bj-text">{omen.streak}</span> {omen.streak === 1 ? "day" : "days"}
      </p>
    </section>
  );
}
