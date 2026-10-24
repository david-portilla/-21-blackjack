"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "./account-context";
import { messageOf } from "./engine-client";
import { engineClient } from "./engine";
import { useOmen } from "./use-omen";

export function SiteHeader() {
  const { account, error, setAccount } = useAccount();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const { omen } = useOmen();

  // Clearing the account sends private pages back to sign-in (useRequireAccount).
  async function onSignOut() {
    try {
      await engineClient.signOut();
      setAccount(null);
    } catch (e) {
      setSignOutError(messageOf(e));
    }
  }

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
            {omen?.fulfilled && (
              <span className="bj-candle-glow" title="Marked by today's omen" aria-label="Marked by today's omen">
                ✶{" "}
              </span>
            )}
            {account.username} ·{" "}
            <strong data-testid="balance" className="bj-candle-glow font-mono">
              {account.balance}
            </strong>{" "}
            credits
          </span>
          <button type="button" onClick={onSignOut} className="hover:text-bj-text">
            Leave
          </button>
        </nav>
      )}
      {(error ?? signOutError) && <p className="w-full text-sm text-bj-ember">{error ?? signOutError}</p>}
    </header>
  );
}
