"use client";

import { useRequireAccount } from "@/web/account-context";

export default function PlayPage() {
  const account = useRequireAccount();
  if (!account) return null;

  // Heriberto's game component mounts here and calls the account refresh after every money change (AC-14.2, AC-14.3).
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="rounded border border-dashed border-neutral-600 p-10 text-center text-neutral-400">
        The table opens soon.
      </div>
    </main>
  );
}
