"use client";

import Link from "next/link";
import { useAccount } from "./account-context";

export function SiteHeader() {
  const { account, error } = useAccount();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-700 px-6 py-4">
      <Link href="/lobby" className="text-lg font-semibold">
        Blackjack
      </Link>
      {account && (
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/lobby">Lobby</Link>
          <Link href="/play">Play</Link>
          <Link href="/history">History</Link>
          <span>
            {account.username} · <strong data-testid="balance">{account.balance}</strong> credits
          </span>
        </nav>
      )}
      {error && <p className="w-full text-sm text-red-400">{error}</p>}
    </header>
  );
}
