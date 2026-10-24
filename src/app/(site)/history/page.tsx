"use client";

import { useEffect, useState } from "react";
import type { TxKind } from "@/contracts/types";
import { useRequireAccount } from "@/web/account-context";
import { messageOf } from "@/web/engine-client";
import type { Run, Transaction } from "@/web/engine-types";
import { engineClient } from "@/web/engine";

const DEBITS: TxKind[] = ["BET", "DOUBLE", "SPLIT"];

export default function HistoryPage() {
  const account = useRequireAccount();
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [runs, setRuns] = useState<Run[] | null>(null);
  const [errors, setErrors] = useState<{ transactions?: string; runs?: string }>({});

  const balance = account?.balance;
  useEffect(() => {
    if (balance === undefined) return;
    engineClient
      .transactions()
      .then(setTransactions)
      .catch((e) => setErrors((prev) => ({ ...prev, transactions: messageOf(e) })));
    engineClient
      .runs()
      .then(setRuns)
      .catch((e) => setErrors((prev) => ({ ...prev, runs: messageOf(e) })));
  }, [balance]);

  if (!account) return null;

  const best = runs?.reduce<Run | null>((top, r) => (!top || r.roundsSurvived > top.roundsSurvived ? r : top), null);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 p-6">
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Transactions</h1>
        {errors.transactions && <p className="text-sm text-red-400">{errors.transactions}</p>}
        {transactions?.length === 0 && <p className="text-neutral-400">No transactions yet.</p>}
        {transactions && transactions.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-neutral-400">
                <tr>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Hand</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.transactionId} className="border-t border-neutral-800">
                    <td className="py-2 pr-4">{new Date(t.createdAt).toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      {t.kind}
                      {t.outcome && ` (${t.outcome})`}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{t.handId ?? ""}</td>
                    <td className="py-2 pr-4 text-right">
                      {DEBITS.includes(t.kind) ? "-" : "+"}
                      {t.amount}
                    </td>
                    <td className="py-2 text-right">{t.balanceAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-2xl font-semibold">Candle runs</h2>
        {errors.runs && <p className="text-sm text-red-400">{errors.runs}</p>}
        {runs?.length === 0 && <p className="text-neutral-400">No finished runs yet.</p>}
        {best && (
          <p className="mb-3">
            Best run: <strong>{best.roundsSurvived}</strong> rounds survived
          </p>
        )}
        <ul className="flex flex-col gap-1 text-sm">
          {runs?.map((r) => (
            <li key={r.runId}>
              {new Date(r.endedAt).toLocaleString()} · {r.roundsSurvived} rounds · net {r.net > 0 ? "+" : ""}
              {r.net}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
