"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { messageOf } from "./engine-client";
import type { Account } from "./engine-types";
import { engineClient } from "./engine";

type AccountState = {
  account: Account | null;
  loading: boolean;
  error: string | null;
  setAccount: (account: Account | null) => void;
  refresh: () => Promise<void>;
};

const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccountState] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every account change, so a slow /me answer that started earlier (e.g. the signed-out
  // check on page load) cannot overwrite a sign-in or sign-out that happened meanwhile.
  const latest = useRef(0);

  const setAccount = useCallback((next: Account | null) => {
    latest.current++;
    setAccountState(next);
    setLoading(false);
  }, []);

  // Only the latest call may settle the state, `loading` included: a discarded call ending "not loading,
  // no account" would bounce a signed-in player to sign-in (seen on reload, where dev runs effects twice).
  const refresh = useCallback(() => {
    const call = ++latest.current;
    return engineClient
      .me()
      .then((me) => {
        if (call !== latest.current) return;
        setAccountState(me);
        setError(null);
        setLoading(false);
      })
      .catch((e) => {
        if (call !== latest.current) return;
        setError(messageOf(e));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AccountContext.Provider value={{ account, loading, error, setAccount, refresh }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount(): AccountState {
  const state = useContext(AccountContext);
  if (!state) throw new Error("useAccount must be used inside AccountProvider");
  return state;
}

// Sends signed-out players back to the sign-in page.
export function useRequireAccount(): Account | null {
  const { account, loading } = useAccount();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !account) router.replace("/");
  }, [loading, account, router]);
  return account;
}
