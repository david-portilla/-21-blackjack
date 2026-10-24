"use client";

import { OMENS, type OmenStatus } from "@/contracts/omens";
import { useOmen } from "./use-omen";

const TIER_NAME = { 1: "I", 2: "II", 3: "III" } as const;

// What to do next on today's ladder (AC-18.1, AC-18.7).
function goalOf(status: OmenStatus): string {
  const { next, signs } = status.ladder;
  if (next === 1) return status.omen.title;
  if (next === 2) return "Fulfil one more omen today";
  if (next === 3) return `Fulfil all four omens today (${signs.length} of 4)`;
  return "All four signs are yours today";
}

// Today's omen ladder in the lobby (R17, R18): goal, signs fulfilled, streak, sigils and title. No credits involved.
export function OmenPanel() {
  const { omen, unavailable } = useOmen();

  if (unavailable) return <p className="text-center italic text-bj-muted">The omens are silent today.</p>;
  if (!omen) return null;

  const { tier, next } = omen.ladder;
  return (
    <section aria-label="Today's omen" className="rounded border border-bj-line p-5 text-center">
      <h2 className="font-display text-sm tracking-widest text-bj-muted">
        Today&apos;s omen{next ? ` · tier ${TIER_NAME[next]}` : ""}
      </h2>
      <p className="mt-2 font-display text-2xl">{goalOf(omen)}</p>
      <p className="mt-2" data-testid="omen-state">
        {tier > 0 ? (
          <span className="bj-candle-glow">✶ The omen is fulfilled</span>
        ) : (
          <span className="italic text-bj-muted">Not yet fulfilled</span>
        )}
      </p>

      <ul aria-label="Signs today" className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
        {OMENS.map((o) => {
          const done = omen.ladder.signs.includes(o.id);
          return (
            <li key={o.id} className={`rounded border px-2 py-0.5 ${done ? "border-bj-candle text-bj-candle" : "border-bj-line text-bj-muted"}`}>
              {done ? "✶ " : ""}
              {o.title}
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-sm text-bj-muted">
        Streak: <span className="font-mono text-bj-text">{omen.streak}</span> {omen.streak === 1 ? "day" : "days"} · Sigils:{" "}
        <span className="font-mono text-bj-text" data-testid="sigils">
          I×{omen.sigils[1]} II×{omen.sigils[2]} III×{omen.sigils[3]}
        </span>
      </p>
      {omen.title && <p className="mt-1 font-display text-bj-candle">Title: {omen.title}</p>}
      {tier === 3 && <p className="mt-1 text-sm italic text-bj-muted">Tier III earns a spare candle for your next run.</p>}
    </section>
  );
}
