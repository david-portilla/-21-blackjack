// Omens (R17, R18; proposed by David, pending Edgar): daily challenges about how you play, never how much.
// Pure rules over the engine ledger, shared so the engine route and any other reader cannot disagree.
// Rewards are sigils, titles and a spare candle; omens never move credits and never depend on a bet size.
import type { Transaction } from "./engine";

export type OmenId = "double-win" | "split" | "blackjack" | "push";
export type Omen = { id: OmenId; title: string };

export const OMENS: Omen[] = [
  { id: "double-win", title: "Win a hand you doubled" },
  { id: "split", title: "Split a pair" },
  { id: "blackjack", title: "Draw a natural blackjack" },
  { id: "push", title: "Tie the dealer" },
];

export type Tier = 1 | 2 | 3;
export type Title = "Marked" | "Seer" | "Prophet";

/** Tier III sigils needed for each title (AC-18.4), highest first. */
export const TITLES: { title: Title; tier3Sigils: number }[] = [
  { title: "Prophet", tier3Sigils: 7 },
  { title: "Seer", tier3Sigils: 3 },
  { title: "Marked", tier3Sigils: 1 },
];

/** What GET /api/engine/omens returns. Days are UTC dates (`YYYY-MM-DD`). */
export type OmenStatus = {
  date: string;
  /** Today's omen: tier I of the ladder. */
  omen: Omen;
  /** Tier I fulfilled today. */
  fulfilled: boolean;
  /** Consecutive days with tier I fulfilled (AC-17.3, AC-18.2). */
  streak: number;
  ladder: {
    /** Highest tier fulfilled today, 0 if none (AC-18.1). */
    tier: 0 | Tier;
    /** Next tier to fulfil, or null when tier III is done. */
    next: Tier | null;
    /** Omens fulfilled today, in OMENS order; tiers II and III are counted on them (AC-18.7). */
    signs: OmenId[];
  };
  /** Sigils earned over all days, one per tier per day (AC-18.3). */
  sigils: Record<Tier, number>;
  title: Title | null;
};

const DAY_MS = 86_400_000;

export const dayOf = (at: string | Date) => new Date(at).toISOString().slice(0, 10);

/** Same omen for everyone on a given day, rotating through OMENS. */
export function omenFor(day: string): Omen {
  return OMENS[Math.floor(Date.parse(day) / DAY_MS) % OMENS.length];
}

/** Whether the day's transactions fulfil the omen. */
export function isFulfilled(id: OmenId, transactions: Transaction[]): boolean {
  switch (id) {
    case "split":
      return transactions.some((t) => t.kind === "SPLIT");
    case "blackjack":
      return transactions.some((t) => t.kind === "PAYOUT" && t.outcome === "blackjack");
    case "push":
      return transactions.some((t) => t.kind === "PAYOUT" && t.outcome === "push");
    case "double-win": {
      const doubled = new Set(transactions.filter((t) => t.kind === "DOUBLE").map((t) => t.handId));
      return transactions.some((t) => t.kind === "PAYOUT" && t.outcome === "win" && doubled.has(t.handId));
    }
  }
}

/**
 * Highest tier reached on a day (AC-18.7): I is the day's omen; II is the day's omen plus any other;
 * III is all four omens. Tiers are reached in order, so II and III need the day's omen too.
 */
export function tierOf(day: string, transactions: Transaction[]): 0 | Tier {
  const signs = OMENS.filter((o) => isFulfilled(o.id, transactions)).map((o) => o.id);
  if (!signs.includes(omenFor(day).id)) return 0;
  if (signs.length === OMENS.length) return 3;
  return signs.length >= 2 ? 2 : 1;
}

function groupByDay(transactions: Transaction[]): Map<string, Transaction[]> {
  const byDay = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const day = dayOf(t.createdAt);
    byDay.set(day, [...(byDay.get(day) ?? []), t]);
  }
  return byDay;
}

/** Days with tier III fulfilled. The engine spends spare candles against this count (AC-18.5, AC-18.8). */
export function tier3Days(transactions: Transaction[]): number {
  let days = 0;
  for (const [day, txs] of groupByDay(transactions)) if (tierOf(day, txs) === 3) days++;
  return days;
}

/**
 * Today's ladder, the streak (consecutive days with tier I, ending today, or yesterday while today is
 * still open), sigils and title. Missing a day only resets the streak; sigils and titles are never lost.
 */
export function omenStatus(transactions: Transaction[], now: Date): OmenStatus {
  const byDay = groupByDay(transactions);
  const tierOn = (day: string) => tierOf(day, byDay.get(day) ?? []);

  const today = dayOf(now);
  const tier = tierOn(today);
  let streak = 0;
  for (let at = Date.parse(today) - (tier > 0 ? 0 : DAY_MS); tierOn(dayOf(new Date(at))) > 0; at -= DAY_MS) streak++;

  const sigils: Record<Tier, number> = { 1: 0, 2: 0, 3: 0 };
  for (const day of byDay.keys()) {
    const reached = tierOn(day);
    for (let t = 1; t <= reached; t++) sigils[t as Tier]++;
  }

  return {
    date: today,
    omen: omenFor(today),
    fulfilled: tier > 0,
    streak,
    ladder: {
      tier,
      next: tier === 3 ? null : ((tier + 1) as Tier),
      signs: OMENS.filter((o) => isFulfilled(o.id, byDay.get(today) ?? [])).map((o) => o.id),
    },
    sigils,
    title: TITLES.find((t) => sigils[3] >= t.tier3Sigils)?.title ?? null,
  };
}
