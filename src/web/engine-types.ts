// Mirror of the engine section of src/contracts/README.md, until Edgar publishes the engine types.
import type { Outcome, TxKind } from "@/contracts/types";

export type Account = { accountId: string; username: string; balance: number };

export type Transaction = {
  transactionId: string;
  accountId: string;
  kind: TxKind;
  amount: number;
  roundId?: string;
  handId?: string;
  outcome?: Outcome;
  balanceAfter: number;
  createdAt: string;
};

export type Run = {
  runId: string;
  accountId: string;
  roundsSurvived: number;
  net: number;
  endedAt: string;
};
