import { useCallback } from 'react';
import type { CompletionHistory } from '../../types';
import { useI18n } from '../../i18n';
import { buildWeeklyExport } from '../../services/weekly-export/buildWeeklyExport';
import {
  formatLocalDate,
  getWeeklyDateRange,
  type WeeklyPeriodPreset,
} from '../../services/weekly-export/dateRange';
import { useStorage } from '../../storage/useStorage';
import { normalizeUnknownError } from '../../utils/errors/normalizeError';
import { logger } from '../../utils/logger';
import { getPlatformCapabilityCenter } from '../../utils/platform-capabilities/center';
import { toast } from '../../utils/toast';

function getTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
function getWeeklyFilename(start: Date, endExclusive: Date): string {
  const endInclusive = new Date(endExclusive);
  endInclusive.setDate(endInclusive.getDate() - 1);
  return `momentum-weekly-${formatLocalDate(start)}_${formatLocalDate(endInclusive)}.json`;
}

export function useWeeklyExportWorkflow(params: {
  history: CompletionHistory[];
}): (preset: WeeklyPeriodPreset) => Promise<void> {
  const storage = useStorage();
  const file = getPlatformCapabilityCenter().file;
  const { tr } = useI18n();

  return useCallback(
    async (preset: WeeklyPeriodPreset) => {
      try {
        const now = new Date();
        const range = getWeeklyDateRange(preset, now);
        const chains = await storage.getChains();
        const result = buildWeeklyExport({
          chains,
          history: params.history,
          range,
          now,
          timezone: getTimeZone(),
        });

        if (!result.ok) {
          if (result.reason === 'empty') {
            toast.info(
              tr(
                '所选自然周没有完成或中断记录，无需导出。',
                'This calendar week has no completed or interrupted records to export.',
              ),
            );
            return;
          }
          toast.error(
            tr(
              '周报导出包含无效日期数据，未保存文件。',
              'Weekly export contains invalid date data and was not saved.',
            ),
          );
          return;
        }

        const saved = await file.saveFile(
          JSON.stringify(result.data, null, 2),
          getWeeklyFilename(range.start, range.endExclusive),
        );
        if (!saved) {
          toast.error(
            tr(
              '无法保存周报原始数据文件。',
              'Could not save the weekly export file.',
            ),
          );
          return;
        }

        toast.success(
          tr(
            `已导出 ${result.chainCount} 条任务链、${result.recordCount} 条执行记录。`,
            `Exported ${result.chainCount} task chain${result.chainCount === 1 ? '' : 's'} and ${result.recordCount} execution record${result.recordCount === 1 ? '' : 's'}.`,
          ),
        );
      } catch (error) {
        logger.error(
          'IMPORT_EXPORT',
          'Weekly export failed',
          undefined,
          normalizeUnknownError(error),
        );
        toast.error(
          tr(
            '周报导出失败，请重试。',
            'Weekly export failed. Please try again.',
          ),
        );
      }
    },
    [file, params.history, storage, tr],
  );
}
