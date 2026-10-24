import { describe, expect, it } from "vitest";
import type { Transaction } from "./engine";
import { OMENS, isFulfilled, omenFor, omenStatus, tier3Days, type OmenId } from "./omens";

let seq = 0;
const tx = (day: string, fields: Partial<Transaction>): Transaction => ({
  transactionId: `t${seq++}`,
  accountId: "a",
  kind: "DEPOSIT",
  amount: 10,
  balanceAfter: 0,
  createdAt: `${day}T12:00:00.000Z`,
  ...fields,
});

// Ledger entries that fulfil each omen on a given day.
const fulfil = (id: OmenId, day: string): Transaction[] => {
  switch (id) {
    case "split":
      return [tx(day, { kind: "SPLIT", handId: `${day}:1` })];
    case "blackjack":
      return [tx(day, { kind: "PAYOUT", outcome: "blackjack", handId: `${day}:0` })];
    case "push":
      return [tx(day, { kind: "PAYOUT", outcome: "push", handId: `${day}:0` })];
    case "double-win":
      return [
        tx(day, { kind: "DOUBLE", handId: `${day}:0` }),
        tx(day, { kind: "PAYOUT", outcome: "win", handId: `${day}:0` }),
      ];
  }
};

const days = ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24"];
const at = (day: string) => new Date(`${day}T18:00:00.000Z`);

describe("omens", () => {
  it("AC-17.1 everyone gets the same omen on a day, and it rotates daily", () => {
    expect(omenFor("2026-10-24")).toEqual(omenFor("2026-10-24"));
    expect(new Set(days.map((d) => omenFor(d).id)).size).toBe(OMENS.length);
  });

  it("AC-17.2 each omen is fulfilled by how you play, not by how much", () => {
    for (const { id } of OMENS) expect(isFulfilled(id, fulfil(id, "2026-10-24"))).toBe(true);
    const bigBets = [tx("2026-10-24", { kind: "BET", amount: 10_000 }), tx("2026-10-24", { kind: "DEPOSIT", amount: 10_000 })];
    for (const { id } of OMENS) expect(isFulfilled(id, bigBets)).toBe(false);
  });

  it("AC-17.2 a doubled hand that loses does not fulfil double-win", () => {
    const lost = [
      tx("2026-10-24", { kind: "DOUBLE", handId: "h" }),
      tx("2026-10-24", { kind: "PAYOUT", outcome: "loss", handId: "h" }),
      tx("2026-10-24", { kind: "PAYOUT", outcome: "win", handId: "other" }),
    ];
    expect(isFulfilled("double-win", lost)).toBe(false);
  });

  it("AC-17.3 the streak counts consecutive fulfilled days ending today", () => {
    const ledger = days.flatMap((d) => fulfil(omenFor(d).id, d));
    expect(omenStatus(ledger, at("2026-10-24"))).toMatchObject({ date: "2026-10-24", fulfilled: true, streak: 4 });
  });

  it("AC-17.3 an open today keeps yesterday's streak; a missed day resets it", () => {
    const upToYesterday = days.slice(0, 3).flatMap((d) => fulfil(omenFor(d).id, d));
    expect(omenStatus(upToYesterday, at("2026-10-24"))).toMatchObject({ fulfilled: false, streak: 3 });
    const gap = [...fulfil(omenFor(days[0]).id, days[0]), ...fulfil(omenFor(days[2]).id, days[2])];
    expect(omenStatus(gap, at("2026-10-23")).streak).toBe(1);
  });

  it("AC-17.2 fulfilling another day's omen does not count today", () => {
    const wrong = OMENS.find((o) => o.id !== omenFor("2026-10-24").id)!;
    expect(omenStatus(fulfil(wrong.id, "2026-10-24"), at("2026-10-24"))).toMatchObject({ fulfilled: false, streak: 0 });
  });
});

describe("omens ladder (R18)", () => {
  const day = "2026-10-24"; // the day's omen is blackjack
  const others = OMENS.map((o) => o.id).filter((id) => id !== omenFor(day).id);

  it("AC-18.1 AC-18.7 tier I is the day's omen, II adds any other, III is all four", () => {
    expect(omenStatus(fulfil(omenFor(day).id, day), at(day)).ladder).toMatchObject({ tier: 1, next: 2 });
    const two = [...fulfil(omenFor(day).id, day), ...fulfil(others[0], day)];
    expect(omenStatus(two, at(day)).ladder).toMatchObject({ tier: 2, next: 3 });
    const all = OMENS.flatMap((o) => fulfil(o.id, day));
    expect(omenStatus(all, at(day)).ladder).toMatchObject({ tier: 3, next: null });
    expect(omenStatus(all, at(day)).ladder.signs).toHaveLength(4);
  });

  it("AC-18.1 tiers come in order: other omens without the day's one reach no tier", () => {
    const withoutToday = others.flatMap((id) => fulfil(id, day));
    expect(omenStatus(withoutToday, at(day))).toMatchObject({ fulfilled: false, ladder: { tier: 0, next: 1 } });
  });

  it("AC-18.3 AC-18.4 one sigil per tier per day; titles from tier III sigils", () => {
    const allOn = (d: string) => OMENS.flatMap((o) => fulfil(o.id, d));
    const three = ["2026-10-20", "2026-10-21", "2026-10-22"].flatMap(allOn);
    const status = omenStatus([...three, ...fulfil(omenFor(day).id, day)], at(day));
    expect(status.sigils).toEqual({ 1: 4, 2: 3, 3: 3 });
    expect(status.title).toBe("Seer");
    expect(omenStatus(allOn(day), at(day)).title).toBe("Marked");
    expect(omenStatus([], at(day)).title).toBeNull();
  });

  it("AC-18.5 tier3Days counts the days with all four omens", () => {
    const ledger = [...OMENS.flatMap((o) => fulfil(o.id, "2026-10-22")), ...fulfil(omenFor(day).id, day)];
    expect(tier3Days(ledger)).toBe(1);
  });
});
