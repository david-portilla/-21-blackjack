"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAccount } from "@/web/account-context";
import { messageOf } from "@/web/engine-client";
import { engineClient } from "@/web/engine";

const USERNAME = /^[A-Za-z0-9_]{3,20}$/;

export default function SignInPage() {
  const { account, loading, setAccount } = useAccount();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && account) router.replace("/lobby");
  }, [loading, account, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const name = username.trim();
    if (!USERNAME.test(name)) {
      setError("Use 3 to 20 letters, digits or _");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setAccount(await engineClient.signIn(name));
    } catch (err) {
      setError(messageOf(err));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="font-display text-4xl text-bj-candle">Blackjack, your way</h1>
        <p className="mt-2 italic text-bj-muted">The dealer has been waiting for you.</p>
      </div>
      <form onSubmit={onSubmit} className="bj-paper flex flex-col gap-3 p-8">
        <label htmlFor="username" className="italic">
          Sign the book with your name
        </label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="bj-input"
        />
        <button type="submit" disabled={busy} className="bj-button mt-2">
          {busy ? "Signing..." : "Enter"}
        </button>
        {error && <p className="text-sm text-bj-blood">{error}</p>}
      </form>
      <Link href="/presentation" className="text-center text-sm italic text-bj-muted hover:text-bj-text">
        View the presentation
      </Link>
    </main>
  );
}
