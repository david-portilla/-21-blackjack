// One slide of the project presentation (/presentation). Content lives in slides.ts, layout in deck.tsx.
export type Slide = {
  id: string;
  /** Small line above the title, e.g. "01 · The challenge". */
  kicker: string;
  title: string;
  /** 3 to 5 short points. */
  points: string[];
  /** Optional closing line, e.g. a command or a quote. */
  note?: string;
};
