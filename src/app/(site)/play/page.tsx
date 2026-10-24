"use client";

import { BlackjackTable } from "@/game/ui/BlackjackTable";
import { useAccount, useRequireAccount } from "@/web/account-context";

export default function PlayPage() {
  const account = useRequireAccount();
  const { refresh } = useAccount();
  if (!account) return null;

  // Heriberto's game component; it calls refresh after every money change (AC-14.2, AC-14.3).
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 items-center justify-center p-6">
      <BlackjackTable onMoneyChanged={refresh} />
    </main>
  );
}
