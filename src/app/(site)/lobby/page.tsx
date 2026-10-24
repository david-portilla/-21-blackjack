"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAccount, useRequireAccount } from "@/web/account-context";
import { messageOf } from "@/web/engine-client";
import { engineClient } from "@/web/engine";
import { OmenPanel } from "@/web/omen-panel";

export default function LobbyPage() {
  const account = useRequireAccount();
  const { refresh } = useAccount();
  const [amount, setAmount] = useState("");
  // Same key while the amount is unchanged, so retrying a failed deposit cannot credit twice (AC-2.3).
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!account) return null;

  function onAmountChange(value: string) {
    setAmount(value);
    setIdempotencyKey(crypto.randomUUID());
  }

  async function onDeposit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isInteger(value) || value <= 0) {
      setError("Deposit a positive whole number");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await engineClient.deposit(value, idempotencyKey);
      await refresh();
      onAmountChange("");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 p-6">
      <section className="text-center">
        <h1 className="font-display text-3xl">Welcome, {account.username}</h1>
        <p className="mt-3 text-lg text-bj-muted">
          Balance: <strong className="bj-candle-glow font-mono text-2xl">{account.balance}</strong> credits
        </p>
      </section>

      <form onSubmit={onDeposit} className="bj-paper flex flex-col gap-3 p-6">
        <label htmlFor="amount" className="italic">
          Add fictional credits
        </label>
        <div className="flex gap-2">
          <input
            id="amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="bj-input w-full font-mono"
          />
          <button type="submit" disabled={busy} className="bj-button">
            Deposit
          </button>
        </div>
        {error && <p className="text-sm text-bj-blood">{error}</p>}
      </form>

      <OmenPanel />

      <Link href="/play" className="bj-button py-3 text-center text-lg">
        Take a seat at the table
      </Link>
    </main>
  );
}
