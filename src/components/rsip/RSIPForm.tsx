import React, { useMemo } from 'react';
import { Clock, Plus } from 'lucide-react';
import type { RSIPMeta, RSIPNodeGroup, RSIPTreeNode } from '../../types';
import { getRsipTypeLabel, rsipTypeEmojiMap } from './rsipUi';

interface RSIPFormProps {
  tree: RSIPTreeNode[];
  meta: RSIPMeta;
  canAddToday: boolean;
  selectedParentId: string | undefined;
  setSelectedParentId: (id: string | undefined) => void;
  title: string;
  setTitle: (title: string) => void;
  rule: string;
  setRule: (rule: string) => void;
  createUseTimer: boolean;
  setCreateUseTimer: (enabled: boolean) => void;
  createTimerMinutes: number;
  setCreateTimerMinutes: (minutes: number) => void;
  createType: string;
  setCreateType: (type: string) => void;
  setCreateEmoji: (emoji: string) => void;
  groups?: RSIPNodeGroup[];
  selectedGroupId?: string;
  setSelectedGroupId?: (groupId: string | undefined) => void;
  createIsPassive?: boolean;
  setCreateIsPassive?: (isPassive: boolean) => void;
  onCreateGroup?: () => void;
  onAdd: () => void;
  language: string;
  tr: (zh: string, en: string) => string;
}

export const RSIPForm: React.FC<RSIPFormProps> = ({
  tree,
  meta,
  canAddToday,
  selectedParentId,
  setSelectedParentId,
  title,
  setTitle,
  rule,
  setRule,
  createUseTimer,
  setCreateUseTimer,
  createTimerMinutes,
  setCreateTimerMinutes,
  createType,
  setCreateType,
  setCreateEmoji,
  groups,
  selectedGroupId,
  setSelectedGroupId,
  createIsPassive,
  setCreateIsPassive,
  onCreateGroup,
  onAdd,
  language,
  tr,
}) => {
  const parentOptions = useMemo(() => {
    const res: RSIPTreeNode[] = [];
    const walk = (n: RSIPTreeNode) => {
      res.push(n);
      n.children.forEach(walk);
    };
    tree.forEach(walk);
    return res;
  }, [tree]);

  const isAddDisabled = !canAddToday || !title.trim() || !rule.trim();

  return (
    <div className="bento-card mb-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-1">
          <label className="mb-2 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {tr(
              '父节点（可空，表示新分支）',
              'Parent (optional; empty = new branch)',
            )}
          </label>
          <select
            value={selectedParentId || ''}
            onChange={(e) => setSelectedParentId(e.target.value || undefined)}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 transition duration-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            <option value="">
              {tr('（无父节点，建立新根）', '(No parent; create new root)')}
            </option>
            {parentOptions.map((n) => (
              <option key={n.id} value={n.id}>
                {'—'.repeat(n.depth)}
                {n.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-2 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {tr('国策标题', 'Policy title')}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={tr(
              '例如：进门5分钟内开始洗澡',
              'e.g. Start showering within 15 minutes of getting home',
            )}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 placeholder-gray-400 transition duration-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          />
        </div>
        <div>
          <label className="mb-2 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {tr('精准规则', 'Rule')}
          </label>
          <input
            value={rule}
            onChange={(e) => setRule(e.target.value)}
            placeholder={tr(
              '例如：回家即启动15分钟计时，计时内进浴室',
              'e.g. Start a 15-minute timer when home; enter the bathroom before it ends',
            )}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 placeholder-gray-400 transition duration-300 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400"
          />
        </div>
      </div>

      {/* Timer settings */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="bento-subtle flex items-center justify-between rounded-2xl px-4 py-3">
          <div className="flex items-center space-x-2">
            <Clock size={16} className="text-emerald-600" />
            <span className="font-chinese text-sm text-gray-700 dark:text-slate-300">
              {tr('启用计时', 'Enable timer')}
            </span>
          </div>
          <label
            className="relative inline-flex cursor-pointer items-center"
            aria-label={tr('启用计时', 'Enable timer')}
          >
            <input
              type="checkbox"
              checked={createUseTimer}
              onChange={(e) => setCreateUseTimer(e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition after:content-[''] peer-checked:bg-emerald-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-emerald-800"></div>
          </label>
        </div>

        <div className={`${createUseTimer ? '' : 'opacity-60'}`}>
          <label className="mb-2 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {tr('计时分钟数', 'Timer minutes')}
          </label>
          <input
            type="number"
            min={1}
            max={180}
            disabled={!createUseTimer}
            value={createTimerMinutes}
            onChange={(e) =>
              setCreateTimerMinutes(
                Math.max(1, Math.min(180, Number(e.target.value) || 1)),
              )
            }
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 font-chinese text-gray-900 transition duration-300 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          />
        </div>
      </div>

      {/* Type selection */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {tr('节点类型', 'Node type')}
          </label>
          <select
            value={createType}
            onChange={(e) => {
              const t = e.target.value;
              setCreateType(t);
              setCreateEmoji(rsipTypeEmojiMap[t] || '📜');
            }}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 font-chinese text-gray-900 transition duration-200 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
          >
            {Object.entries(rsipTypeEmojiMap).map(([type, emoji]) => (
              <option key={type} value={type}>
                {emoji} {getRsipTypeLabel(language, type)} ({type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block font-chinese text-sm font-medium text-gray-700 dark:text-slate-300">
            {tr('所属国策组', 'Policy group')}
          </label>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <select
              value={selectedGroupId || ''}
              onChange={(e) =>
                setSelectedGroupId?.(e.target.value || undefined)
              }
              className="min-w-0 w-full rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 font-chinese text-gray-900 transition duration-200 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            >
              <option value="">{tr('不分组', 'No group')}</option>
              {(groups ?? []).map((group) => (
                <option key={group.id} value={group.id}>
                  {group.emoji ? `${group.emoji} ` : ''}
                  {group.title} ({tr('容错', 'Tolerance')}{' '}
                  {group.faultTolerance})
                </option>
              ))}
            </select>
            {onCreateGroup && (
              <button
                type="button"
                onClick={onCreateGroup}
                className="min-h-11 w-full shrink-0 whitespace-nowrap rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 transition hover:bg-gray-100 sm:w-auto dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {tr('新建组', 'New group')}
              </button>
            )}
          </div>
        </div>

        <div className="bento-subtle flex items-center justify-between rounded-2xl px-4 py-3">
          <span className="font-chinese text-sm text-gray-700 dark:text-slate-300">
            {tr('被动国策', 'Passive policy')}
          </span>
          <label
            className="relative inline-flex cursor-pointer items-center"
            aria-label={tr('被动国策', 'Passive policy')}
          >
            <input
              type="checkbox"
              checked={Boolean(createIsPassive)}
              onChange={(e) => setCreateIsPassive?.(e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition after:content-[''] peer-checked:bg-indigo-500 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:border-gray-600 dark:bg-gray-700 dark:peer-focus:ring-indigo-800"></div>
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 font-chinese text-sm text-gray-600 dark:text-slate-400">
          {meta.allowMultiplePerDay
            ? tr(
                '已开启“一天可多条”。今日可继续新增。',
                'Multiple per day is enabled. You can add more today.',
              )
            : tr(
                '每天最多新增一个国策。',
                'Add at most one policy per day.',
              )}{' '}
          {!meta.allowMultiplePerDay &&
            (canAddToday
              ? tr('今日可新增。', 'You can add today.')
              : tr(
                  '今日已新增，明日继续。',
                  'Already added today. Try again tomorrow.',
                ))}
        </div>
        <button
          onClick={onAdd}
          disabled={isAddDisabled}
          className={`flex min-h-11 w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-6 py-3 font-medium shadow-lg transition duration-300 sm:w-auto ${isAddDisabled ? 'bg-gray-200 text-gray-400 dark:bg-slate-700 dark:text-slate-500' : 'gradient-primary text-white hover:scale-105 hover:shadow-xl'}`}
        >
          <Plus size={18} />
          <span className="font-chinese">{tr('新增国策', 'Add policy')}</span>
        </button>
      </div>
    </div>
  );
};
