import React from 'react';
import { getRsipTypeLabel, rsipTypeColorMap, rsipTypeEmojiMap } from './rsipUi';

interface RSIPFiltersProps {
  filterType: string | null;
  onFilterTypeChange: (next: string | null) => void;
  language: string;
  tr: (zh: string, en: string) => string;
}

export const RSIPFilters: React.FC<RSIPFiltersProps> = ({
  filterType,
  onFilterTypeChange,
  language,
  tr,
}) => {
  return (
    <div className="bento-card mb-8 overflow-hidden">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <label className="whitespace-nowrap font-chinese text-sm text-gray-700 dark:text-slate-300">
            {tr('按类型筛选：', 'Filter by type:')}
          </label>
          <select
            value={filterType || ''}
            onChange={(e) => onFilterTypeChange(e.target.value || null)}
            className="min-h-11 min-w-28 flex-1 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-gray-900 sm:flex-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="">{tr('全部', 'All')}</option>
            {Object.keys(rsipTypeEmojiMap).map((t) => (
              <option key={t} value={t}>
                {getRsipTypeLabel(language, t)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onFilterTypeChange(null)}
            className="min-h-11 whitespace-nowrap rounded-lg bg-gray-100 px-3 py-2 text-xs dark:bg-slate-700"
          >
            {tr('清除', 'Clear')}
          </button>
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto pb-1 xl:w-auto">
          {Object.keys(rsipTypeColorMap).map((t) => {
            const col = rsipTypeColorMap[t];
            return (
              <div
                key={t}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 ${col.badge} font-chinese text-xs`}
              >
                {getRsipTypeLabel(language, t)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
