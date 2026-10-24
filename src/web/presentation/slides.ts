import type { Slide } from "./types";

// The five-slide project presentation. Numbers measured on the repo on 2026-10-24.
export const SLIDES: Slide[] = [
  {
    id: "challenge",
    kicker: "01 · The challenge",
    title: "Blackjack, your way",
    points: [
      "One casino with fictional credits, played end to end",
      "Sign in, add credits, bet, play, see the result, the new balance and the history",
      "Three owners: the engine, the game and the website",
      "One twist of our own, in a candlelit cabin mood",
    ],
  },
  {
    id: "architecture",
    kicker: "02 · How it is built",
    title: "Three parts, one contract",
    points: [
      "One Next.js app: engine by Edgar, game by Heriberto, website by David",
      "Contract first: IDs, payloads and errors agreed in src/contracts/ before code",
      "Money moves only through the engine; the game sends outcomes, never amounts",
      "The hidden card and the deck never leave the server",
      "Local SQLite storage: no accounts, no credentials, one command to start",
    ],
  },
  {
    id: "twist",
    kicker: "03 · Our twist",
    title: "Candles and Omens",
    points: [
      "Candles: every run starts with three; each lost round snuffs one, and at zero the dealer claims you",
      "Omens: a daily ladder of three tiers, the same for every player",
      "Rewards are sigils, titles and a spare candle for your next run",
      "They reward how you play, never how much you bet: no credits, no deposits, no penalties",
    ],
  },
  {
    id: "ai",
    kicker: "04 · How we worked with AI",
    title: "Different agents, one rulebook",
    points: [
      "One AGENTS.md for every agent and model, with each owner's folder rules",
      "/grill-me to settle open questions in rounds, written straight into requirements",
      "Contract first, with fakes, so nobody waited for anybody",
      "Tests named by acceptance criterion, each broken once before we trusted it",
      "Caught: browser tests on the real engine found a session race the fake never showed",
    ],
  },
  {
    id: "proven",
    kicker: "05 · Proven",
    title: "Checks we can run",
    points: [
      "68 of 78 acceptance criteria covered by tests named with their ID",
      "pnpm check: typecheck, lint and 120 unit and integration tests, also in CI",
      "pnpm e2e: 12 browser journeys at desktop and phone width, 24 of 24 green",
      "Known limitations listed in the README",
    ],
    note: "pnpm install · pnpm dev · open localhost:3000",
  },
];
