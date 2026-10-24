"use client";

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
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-semibold">Blackjack, your way</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label htmlFor="username" className="text-sm">
          Sign the book with your name
        </label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="rounded border border-neutral-600 bg-transparent px-3 py-2"
        />
        <button type="submit" disabled={busy} className="rounded bg-neutral-200 px-3 py-2 text-neutral-900 disabled:opacity-50">
          {busy ? "Signing..." : "Enter"}
        </button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>
    </main>
  );
}
