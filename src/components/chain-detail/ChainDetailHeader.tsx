import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { HeaderProps } from './types';
import { BackButton } from '../BackButton';

export const ChainDetailHeader: React.FC<HeaderProps> = ({
  chainName,
  tr,
  onBack,
  onEdit,
  onDeleteClick,
}) => (
  <header className="mb-8 flex animate-fade-in flex-col items-stretch gap-4 sm:mb-12 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex min-w-0 items-center space-x-3 sm:space-x-4">
      <BackButton
        onClick={onBack}
        label={tr('返回', 'Back')}
        className="rounded-2xl p-3 text-gray-400 transition-colors hover:bg-white/50 hover:text-[#161615] dark:hover:bg-slate-700/50 dark:hover:text-slate-200"
      />
      <div className="min-w-0">
        <h1 className="mb-2 break-words font-chinese text-3xl font-bold text-[#161615] dark:text-slate-100 sm:text-4xl md:text-5xl">
          {chainName}
        </h1>
        <p className="font-mono text-sm uppercase tracking-wider text-gray-500">
          {tr('链条详情', 'CHAIN DETAILS')}
        </p>
      </div>
    </div>
    <div className="flex w-full gap-3 sm:w-auto">
      <button
        onClick={onEdit}
        className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-primary-500 px-4 py-3 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:bg-primary-600 sm:flex-none sm:px-6"
      >
        <Edit size={16} />
        <span>{tr('编辑链条', 'Edit')}</span>
      </button>
      <button
        onClick={onDeleteClick}
        className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-red-500 px-4 py-3 font-chinese font-medium text-white shadow-lg transition duration-300 hover:scale-105 hover:bg-red-600 sm:flex-none sm:px-6"
      >
        <Trash2 size={16} />
        <span>{tr('删除', 'Delete')}</span>
      </button>
    </div>
  </header>
);
