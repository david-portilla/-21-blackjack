// Static preview of the table (shape of a RoundView). Nothing is dealt or played here.
import type { RoundView } from "../game-types";
import { TableView } from "./table-view";

const SAMPLE: RoundView = {
  roundId: "preview",
  version: 1,
  status: "player_turn",
  dealer: { cards: [{ rank: "9", suit: "H" }, { hidden: true }] },
  hands: [
    {
      handId: "preview:0",
      cards: [
        { rank: "A", suit: "S" },
        { rank: "7", suit: "D" },
      ],
      total: 18,
      soft: true,
      stake: 10,
      status: "playing",
      allowedActions: ["hit", "stand", "double"],
    },
  ],
  activeHandId: "preview:0",
  run: { runId: "preview", candles: 2, roundsSurvived: 3, ended: false },
};

export function TablePreview() {
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <p className="rounded border border-dashed border-bj-line px-4 py-2 text-center text-sm italic text-bj-muted">
        Preview of the table. The playable table is on its way.
      </p>
      <TableView round={SAMPLE} disabled />
    </div>
  );
}
