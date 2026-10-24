// Engine types: Account and Transaction come from Edgar's contract. Run is still a proposal (R16), mirrored here.
export type { Account, Transaction } from "@/contracts/engine";

export type Run = {
  runId: string;
  accountId: string;
  roundsSurvived: number;
  net: number;
  endedAt: string;
};
