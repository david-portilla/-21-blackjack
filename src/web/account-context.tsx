"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { messageOf } from "./engine-client";
import type { Account } from "./engine-types";
import { engineClient } from "./engine";

type AccountState = {
  account: Account | null;
  loading: boolean;
  error: string | null;
  setAccount: (account: Account) => void;
  refresh: () => Promise<void>;
};

const AccountContext = createContext<AccountState | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    () =>
      engineClient
        .me()
        .then((me) => {
          setAccount(me);
          setError(null);
        })
        .catch((e) => setError(messageOf(e)))
        .finally(() => setLoading(false)),
    [],
  );

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
