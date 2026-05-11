export type MatchStatus =
  | 'matched'
  | 'amount_mismatch'
  | 'multi_candidate'
  | 'unmatched'
  | 'manual_override';

export type { BankTransaction, ReconciliationMatch } from '@/lib/db/schema';

export interface MatchSummary {
  batchId: string;
  totalTransactions: number;
  matched: number;
  amountMismatch: number;
  multiCandidate: number;
  unmatched: number;
}
