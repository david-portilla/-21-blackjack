"use client";

import { useAccount, useRequireAccount } from "@/web/account-context";
import { fakeGame } from "@/web/engine";
import { FakeTable } from "@/web/fake-game/fake-table";
import { TablePreview } from "@/web/ui/table-preview";

export default function PlayPage() {
  const account = useRequireAccount();
  const { refresh } = useAccount();
  if (!account) return null;

  // Heriberto's game component mounts here and calls the account refresh after every money change (AC-14.2, AC-14.3).
  // Until then: the in-browser emulation with the fake engine, the static preview otherwise.
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center p-6">
      {fakeGame ? <FakeTable game={fakeGame} onMoneyChanged={refresh} /> : <TablePreview />}
    </main>
  );
}
