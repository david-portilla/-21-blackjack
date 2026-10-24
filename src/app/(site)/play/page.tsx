"use client";

import { useRequireAccount } from "@/web/account-context";
import { TablePreview } from "@/web/ui/table-preview";

export default function PlayPage() {
  const account = useRequireAccount();
  if (!account) return null;

  // Heriberto's game component mounts here and calls the account refresh after every money change (AC-14.2, AC-14.3).
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center p-6">
      <TablePreview />
    </main>
  );
}
