import type React from 'react';
import { CheckCircle, Download } from 'lucide-react';
import type { WeeklyPeriodPreset } from '../../services/weekly-export/dateRange';

export const ExportTab: React.FC<{
  chainsCount: number;
  language: 'zh' | 'en';
  onExport: () => void;
  weeklyPeriod: WeeklyPeriodPreset;
  onWeeklyPeriodChange: (period: WeeklyPeriodPreset) => void;
  onWeeklyExport: () => void;
  tr: (zh: string, en: string) => string;
}> = ({
  chainsCount,
  language,
  onExport,
  weeklyPeriod,
  onWeeklyPeriodChange,
  onWeeklyExport,
  tr,
}) => (
  <div className="space-y-6">
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-700/50 dark:bg-blue-900/20">
      <h3 className="mb-3 font-chinese text-lg font-bold text-blue-900 dark:text-blue-100">
        {tr('导出全部数据', 'Export your data')}
      </h3>
      <p className="mb-4 font-chinese text-sm leading-relaxed text-blue-700 dark:text-blue-300">
        {tr(
          '导出功能将保存您当前的所有数据，包括任务链配置、统计数据、国策树扩展数据、宠物状态和例外规则。',
          'Export saves all your current data, including chains, stats, extended RSIP data, pet state, and exception rules.',
        )}
      </p>
      <div className="space-y-2">
        {[
          tr('任务链配置与统计', 'Chain config & stats'),
          tr('完成历史记录', 'Completion history'),
          tr('国策树（RSIP）完整数据', 'Full RSIP dataset'),
          tr('宠物状态', 'Pet state'),
          tr('例外规则配置', 'Exception rules'),
        ].map((text) => (
          <div
            key={text}
            className="flex items-center space-x-2 text-blue-600 dark:text-blue-400"
          >
            <CheckCircle size={16} />
            <span className="font-chinese text-sm">{text}</span>
          </div>
        ))}
      </div>
    </div>
    <div className="text-center">
      <p className="mb-4 font-chinese text-gray-600 dark:text-slate-400">
        {language === 'zh' ? (
          <>
            当前共有{' '}
            <span className="font-bold text-primary-500">{chainsCount}</span>{' '}
            条任务链
          </>
        ) : (
          <>
            You have{' '}
            <span className="font-bold text-primary-500">{chainsCount}</span>{' '}
            chain{chainsCount === 1 ? '' : 's'}
          </>
        )}
      </p>
      <button
        type="button"
        onClick={onExport}
        aria-label={tr('导出为 JSON 文件', 'Export as JSON')}
        className="gradient-primary mx-auto flex items-center space-x-3 rounded-2xl px-8 py-4 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
      >
        <Download size={20} />
        <span>{tr('导出为 JSON 文件', 'Export as JSON')}</span>
      </button>
    </div>

    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-700/50 dark:bg-violet-900/20">
      <h3 className="mb-3 font-chinese text-lg font-bold text-violet-900 dark:text-violet-100">
        {tr('AI 周报原始数据', 'AI weekly raw data')}
      </h3>
      <p className="mb-5 font-chinese text-sm leading-relaxed text-violet-700 dark:text-violet-300">
        {tr(
          '文件包含任务描述和备注。只有当您主动把下载的文件交给外部 AI 时，数据才会离开此设备。',
          'The file includes task descriptions and notes. Data leaves this device only when you choose to share the downloaded file with an external AI.',
        )}
      </p>

      <fieldset className="mb-5">
        <legend className="mb-2 font-chinese text-sm font-medium text-violet-900 dark:text-violet-100">
          {tr('自然周范围', 'Calendar week')}
        </legend>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ['current', tr('本周', 'Current week')],
              ['previous', tr('上周', 'Previous week')],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-3 font-chinese text-sm text-violet-900 transition-colors has-[:checked]:border-violet-500 has-[:checked]:bg-violet-100 dark:border-violet-700 dark:bg-slate-800 dark:text-violet-100 dark:has-[:checked]:bg-violet-900/50"
            >
              <input
                type="radio"
                name="weekly-export-period"
                value={value}
                checked={weeklyPeriod === value}
                onChange={() => onWeeklyPeriodChange(value)}
                className="accent-violet-600"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="button"
        onClick={onWeeklyExport}
        aria-label={tr(
          '导出 AI 周报原始数据',
          'Export AI weekly raw data',
        )}
        className="mx-auto flex items-center space-x-3 rounded-2xl bg-violet-600 px-6 py-4 font-chinese font-medium text-white shadow-lg transition duration-300 hover:bg-violet-700 hover:shadow-xl"
      >
        <Download size={20} />
        <span>
          {tr('导出 AI 周报原始数据', 'Export AI weekly raw data')}
        </span>
      </button>
    </div>
  </div>
);
