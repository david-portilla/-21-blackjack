"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAccount, useRequireAccount } from "@/web/account-context";
import { messageOf } from "@/web/engine-client";
import { engineClient } from "@/web/engine";

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
      <section>
        <h1 className="text-2xl font-semibold">Welcome, {account.username}</h1>
        <p className="mt-2 text-lg">
          Balance: <strong>{account.balance}</strong> credits
        </p>
      </section>

      <form onSubmit={onDeposit} className="flex flex-col gap-3">
        <label htmlFor="amount" className="text-sm">
          Add fictional credits
        </label>
        <div className="flex gap-2">
          <input
            id="amount"
            inputMode="numeric"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="w-full rounded border border-neutral-600 bg-transparent px-3 py-2"
          />
          <button type="submit" disabled={busy} className="rounded bg-neutral-200 px-4 py-2 text-neutral-900 disabled:opacity-50">
            Deposit
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      <Link href="/play" className="rounded border border-neutral-500 px-4 py-3 text-center">
        Take a seat at the table
      </Link>
    </main>
  );
}
