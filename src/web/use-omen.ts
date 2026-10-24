"use client";

import { useEffect, useState } from "react";
import type { OmenStatus } from "@/contracts/omens";
import { useAccount } from "./account-context";
import { engineClient } from "./engine";

// Today's omen (R17). Refetched whenever the balance moves, since only played hands can fulfil it.
// `unavailable` is true when the engine does not serve omens (yet).
export function useOmen(): { omen: OmenStatus | null; unavailable: boolean } {
  const { account } = useAccount();
  const [omen, setOmen] = useState<OmenStatus | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  const balance = account?.balance;
  useEffect(() => {
    if (balance === undefined) return;
    engineClient
      .omens()
      .then((status) => {
        setOmen(status);
        setUnavailable(false);
      })
      .catch(() => setUnavailable(true));
  }, [balance]);

  return { omen: account ? omen : null, unavailable };
}
