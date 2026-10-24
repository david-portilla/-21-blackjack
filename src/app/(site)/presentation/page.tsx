"use client";

import { Deck } from "@/web/presentation/deck";

// Public on purpose: the presentation is shown before anyone signs in.
export default function PresentationPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Deck />
    </main>
  );
}
