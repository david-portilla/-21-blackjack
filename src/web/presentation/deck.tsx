"use client";

import { useCallback, useEffect, useState } from "react";
import { SLIDES } from "./slides";

// The project presentation: one slide at a time, buttons and arrow keys. Content lives in slides.ts.
export function Deck() {
  const [index, setIndex] = useState(0);
  const last = SLIDES.length - 1;
  const go = useCallback((step: number) => setIndex((i) => Math.min(last, Math.max(0, i + step))), [last]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const slide = SLIDES[index];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-between gap-8 p-6 sm:p-10">
      <section
        key={slide.id}
        aria-label={slide.title}
        className="flex flex-1 flex-col justify-center gap-6 rounded border border-bj-line bg-bj-night/40 p-6 shadow-2xl motion-safe:animate-[bj-fade_300ms_ease-out] sm:p-12"
      >
        <p className="font-display text-sm tracking-widest text-bj-muted">{slide.kicker}</p>
        <h1 className="font-display text-3xl text-bj-candle sm:text-5xl">{slide.title}</h1>
        <ul className="flex flex-col gap-3 text-lg sm:text-xl">
          {slide.points.map((point) => (
            <li key={point} className="flex gap-3">
              <span aria-hidden className="bj-candle-glow">
                ✶
              </span>
              <span className="min-w-0 break-words">{point}</span>
            </li>
          ))}
        </ul>
        {slide.note && <p className="break-words font-mono text-sm text-bj-muted">{slide.note}</p>}
      </section>

      <nav aria-label="Slides" className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => go(-1)} disabled={index === 0} className="bj-button">
          Previous
        </button>
        <p className="font-mono text-bj-muted" data-testid="slide-counter">
          {index + 1} / {SLIDES.length}
        </p>
        <button type="button" onClick={() => go(1)} disabled={index === last} className="bj-button">
          Next
        </button>
      </nav>
    </div>
  );
}
