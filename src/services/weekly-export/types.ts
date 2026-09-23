import type { ChainType } from '../../types';

export interface WeeklyChainContext {
  id: string;
  parentId?: string;
  name: string;
  description: string;
  type: ChainType;
  trigger: string;
  createdAt: string;
}

export interface WeeklyActivityRecord {
  chainId: string;
  completedAt: string;
  wasSuccessful: boolean;
  description?: string;
  notes?: string;
  reasonForFailure?: string;
  duration: number;
  actualDuration?: number;
  isForwardTimed?: boolean;
}

export interface WeeklyExportWarning {
  code: 'CHAIN_PATH_CYCLE';
  chainId: string;
}

export interface WeeklyChainGroup {
  chain: WeeklyChainContext;
  chainPath: Array<{ id: string; name: string }>;
  chainState: 'active' | 'deleted';
  records: WeeklyActivityRecord[];
}

export interface WeeklyExportData {
  format: 'momentum-weekly-activity';
  schemaVersion: 1;
  exportedAt: string;
  timezone: string;
  period: { start: string; endExclusive: string };
  dataThrough: string;
  isPartialPeriod: boolean;
  chains: WeeklyChainGroup[];
  unresolvedRecords: WeeklyActivityRecord[];
  warnings: WeeklyExportWarning[];
}

export type BuildWeeklyExportResult =
  | {
      ok: true;
      data: WeeklyExportData;
      chainCount: number;
      recordCount: number;
    }
  | { ok: false; reason: 'empty' | 'invalid-date' };
