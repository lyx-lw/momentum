import type { Dispatch, SetStateAction } from 'react';
import type { SplitDraftItem } from './rsipViewHelpers';

interface RSIPSplitModeSectionProps {
  splitMode: boolean;
  setSplitMode: (value: boolean) => void;
  splitGoal: string;
  setSplitGoal: (value: string) => void;
  splitItems: SplitDraftItem[];
  setSplitItems: Dispatch<SetStateAction<SplitDraftItem[]>>;
  splitTemplateKeys: string[];
  onApplySplitTemplate: (templateKey: string) => void;
  onAddSplitRow: () => void;
  onSubmitSplit: () => void;
  canAddToday: boolean;
  tr: (zh: string, en: string) => string;
}

function getTemplateLabel(
  templateKey: string,
  tr: (zh: string, en: string) => string,
): string {
  if (templateKey === 'sleep') {
    return tr('作息模板', 'Sleep template');
  }
  if (templateKey === 'exercise') {
    return tr('运动模板', 'Exercise template');
  }
  if (templateKey === 'diet') {
    return tr('饮食模板', 'Diet template');
  }
  return templateKey;
}

export function RSIPSplitModeSection({
  splitMode,
  setSplitMode,
  splitGoal,
  setSplitGoal,
  splitItems,
  setSplitItems,
  splitTemplateKeys,
  onApplySplitTemplate,
  onAddSplitRow,
  onSubmitSplit,
  canAddToday,
  tr,
}: RSIPSplitModeSectionProps) {
  const updateSplitItem = (itemId: string, patch: Partial<SplitDraftItem>) => {
    setSplitItems((currentItems) =>
      currentItems.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    );
  };

  return (
    <div className="bento-card mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          {tr(
            '拆分模式（零散牛皮糖）',
            'Split mode (shatter oversized policies)',
          )}
        </h3>
        <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={splitMode}
            onChange={(event) => setSplitMode(event.target.checked)}
          />
          {tr('启用', 'Enable')}
        </label>
      </div>

      {splitMode && (
        <div className="space-y-3">
          <input
            value={splitGoal}
            onChange={(event) => setSplitGoal(event.target.value)}
            placeholder={tr(
              '目标，例如：早睡早起',
              'Goal, e.g. Sleep early and wake early',
            )}
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {splitTemplateKeys.map((templateKey) => (
              <button
                key={templateKey}
                type="button"
                onClick={() => onApplySplitTemplate(templateKey)}
                className="min-h-11 whitespace-nowrap rounded-lg bg-gray-100 px-3 py-1.5 text-xs text-gray-700 dark:bg-slate-700 dark:text-slate-200"
              >
                {getTemplateLabel(templateKey, tr)}
              </button>
            ))}
            <button
              type="button"
              onClick={onAddSplitRow}
              className="min-h-11 whitespace-nowrap rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white"
            >
              {tr('新增子国策', 'Add sub-policy')}
            </button>
          </div>

          {splitItems.map((item) => (
            <div
              key={item.id}
              className="grid grid-cols-1 gap-2 rounded-xl border border-gray-200 p-3 dark:border-slate-700 md:grid-cols-12"
            >
              <input
                value={item.title}
                onChange={(event) =>
                  updateSplitItem(item.id, { title: event.target.value })
                }
                placeholder={tr('子国策标题', 'Sub-policy title')}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 md:col-span-4"
              />
              <input
                value={item.rule}
                onChange={(event) =>
                  updateSplitItem(item.id, { rule: event.target.value })
                }
                placeholder={tr('子国策规则', 'Sub-policy rule')}
                className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 md:col-span-6"
              />
              <label className="inline-flex items-center justify-center gap-2 text-xs text-gray-600 dark:text-slate-300 md:col-span-2">
                <input
                  type="checkbox"
                  checked={item.isPassive}
                  onChange={(event) =>
                    updateSplitItem(item.id, {
                      isPassive: event.target.checked,
                    })
                  }
                />
                {tr('被动', 'Passive')}
              </label>
            </div>
          ))}

          <button
            type="button"
            onClick={onSubmitSplit}
            disabled={!canAddToday || splitItems.length === 0}
            className={`min-h-11 w-full whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium sm:w-auto ${
              !canAddToday || splitItems.length === 0
                ? 'cursor-not-allowed bg-gray-200 text-gray-500 dark:bg-slate-700 dark:text-slate-500'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {tr('批量创建拆分国策', 'Create split policies')}
          </button>
        </div>
      )}
    </div>
  );
}
