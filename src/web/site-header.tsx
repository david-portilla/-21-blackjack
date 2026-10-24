"use client";

import Link from "next/link";
import { useAccount } from "./account-context";

export function SiteHeader() {
  const { account, error } = useAccount();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-bj-line bg-bj-night/60 px-6 py-4">
      <Link href="/lobby" className="font-display text-2xl tracking-wide text-bj-candle">
        Blackjack
      </Link>
      {account && (
        <nav className="flex flex-wrap items-center gap-6 font-display text-bj-muted">
          <Link href="/lobby" className="hover:text-bj-text">Lobby</Link>
          <Link href="/play" className="hover:text-bj-text">Play</Link>
          <Link href="/history" className="hover:text-bj-text">History</Link>
          <span className="text-bj-text">
            {account.username} ·{" "}
            <strong data-testid="balance" className="bj-candle-glow font-mono">
              {account.balance}
            </strong>{" "}
            credits
          </span>
        </nav>
      )}
      {error && <p className="w-full text-sm text-bj-ember">{error}</p>}
    </header>
  );
}
