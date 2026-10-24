// Omens (R17, proposed by David, pending Edgar): one daily challenge about how you play, never how much.
// Pure rules over the engine ledger, shared so the engine route and the site's fake cannot disagree.
// The reward is cosmetic; omens never move credits and never require a deposit or a bet size.
import type { Transaction } from "./engine";

export type OmenId = "double-win" | "split" | "blackjack" | "push";
export type Omen = { id: OmenId; title: string };

export const OMENS: Omen[] = [
  { id: "double-win", title: "Win a hand you doubled" },
  { id: "split", title: "Split a pair" },
  { id: "blackjack", title: "Draw a natural blackjack" },
  { id: "push", title: "Tie the dealer" },
];

/** What GET /api/engine/omens returns. Days are UTC dates (`YYYY-MM-DD`). */
export type OmenStatus = { date: string; omen: Omen; fulfilled: boolean; streak: number };

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
 * Today's omen, whether it is fulfilled, and the streak: consecutive days with the day's omen fulfilled,
 * ending today, or yesterday while today is still open. Missing a day only resets the count; nothing is lost.
 */
export function omenStatus(transactions: Transaction[], now: Date): OmenStatus {
  const byDay = new Map<string, Transaction[]>();
  for (const t of transactions) {
    const day = dayOf(t.createdAt);
    byDay.set(day, [...(byDay.get(day) ?? []), t]);
  }
  const done = (day: string) => isFulfilled(omenFor(day).id, byDay.get(day) ?? []);

  const today = dayOf(now);
  const fulfilled = done(today);
  let streak = 0;
  for (let at = Date.parse(today) - (fulfilled ? 0 : DAY_MS); done(dayOf(new Date(at))); at -= DAY_MS) streak++;

  return { date: today, omen: omenFor(today), fulfilled, streak };
}
