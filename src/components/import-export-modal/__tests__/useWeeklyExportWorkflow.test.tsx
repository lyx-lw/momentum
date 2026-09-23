import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompletionHistory, UnitChain } from '../../../types';
import { useWeeklyExportWorkflow } from '../useWeeklyExportWorkflow';

const useStorageMock = vi.hoisted(() => vi.fn());
const storageGetChainsMock = vi.hoisted(() => vi.fn());
const saveFileMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastInfoMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const loggerErrorMock = vi.hoisted(() => vi.fn());

vi.mock('../../../storage/useStorage', () => ({
  useStorage: useStorageMock,
}));

vi.mock('../../../i18n', () => ({
  useI18n: () => ({
    tr: (_zh: string, en: string) => en,
  }),
}));

vi.mock('../../../utils/platform-capabilities/center', () => ({
  getPlatformCapabilityCenter: () => ({
    file: { saveFile: saveFileMock },
  }),
}));

vi.mock('../../../utils/toast', () => ({
  toast: {
    success: toastSuccessMock,
    info: toastInfoMock,
    error: toastErrorMock,
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: { error: loggerErrorMock },
}));

function makeChain(): UnitChain {
  return {
    id: 'chain-1',
    type: 'unit',
    sortOrder: 0,
    name: 'Weekly export',
    trigger: 'Start',
    duration: 30,
    description: 'Build weekly export',
    currentStreak: 0,
    auxiliaryStreak: 0,
    totalCompletions: 0,
    totalFailures: 0,
    auxiliaryFailures: 0,
    exceptions: [],
    auxiliaryExceptions: [],
    auxiliarySignal: '',
    auxiliaryDuration: 0,
    auxiliaryCompletionTrigger: '',
    timeLimitExceptions: [],
    createdAt: new Date(2026, 0, 1),
  };
}

function makeRecord(completedAt: Date): CompletionHistory {
  return {
    chainId: 'chain-1',
    completedAt,
    duration: 30,
    wasSuccessful: true,
    description: 'Implemented the export',
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 8, 23, 12));
  vi.clearAllMocks();
  storageGetChainsMock.mockResolvedValue([makeChain()]);
  useStorageMock.mockReturnValue({ getChains: storageGetChainsMock });
  saveFileMock.mockResolvedValue(true);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useWeeklyExportWorkflow', () => {
  it('reads all chains on demand and saves pretty weekly JSON', async () => {
    const { result } = renderHook(() =>
      useWeeklyExportWorkflow({ history: [makeRecord(new Date(2026, 8, 22))] }),
    );

    expect(storageGetChainsMock).not.toHaveBeenCalled();
    await act(async () => {
      await result.current('current');
    });

    expect(storageGetChainsMock).toHaveBeenCalledOnce();
    expect(saveFileMock).toHaveBeenCalledWith(
      expect.stringContaining('"format": "momentum-weekly-activity"'),
      'momentum-weekly-2026-09-21_2026-09-27.json',
    );
    expect(toastSuccessMock).toHaveBeenCalledWith(
      'Exported 1 task chain and 1 execution record.',
    );
  });

  it('uses previous natural-week boundaries in the filename', async () => {
    const { result } = renderHook(() =>
      useWeeklyExportWorkflow({ history: [makeRecord(new Date(2026, 8, 15))] }),
    );

    await act(async () => {
      await result.current('previous');
    });

    expect(saveFileMock).toHaveBeenCalledWith(
      expect.any(String),
      'momentum-weekly-2026-09-14_2026-09-20.json',
    );
  });

  it('does not save an empty period and shows an informational toast', async () => {
    const { result } = renderHook(() =>
      useWeeklyExportWorkflow({ history: [] }),
    );

    await act(async () => {
      await result.current('current');
    });

    expect(saveFileMock).not.toHaveBeenCalled();
    expect(toastInfoMock).toHaveBeenCalledWith(
      'This calendar week has no completed or interrupted records to export.',
    );
  });

  it('blocks invalid dates and shows an error toast', async () => {
    const { result } = renderHook(() =>
      useWeeklyExportWorkflow({
        history: [makeRecord(new Date(Number.NaN))],
      }),
    );

    await act(async () => {
      await result.current('current');
    });

    expect(saveFileMock).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledWith(
      'Weekly export contains invalid date data and was not saved.',
    );
  });

  it('shows an error when the platform cannot save the file', async () => {
    saveFileMock.mockResolvedValue(false);
    const { result } = renderHook(() =>
      useWeeklyExportWorkflow({ history: [makeRecord(new Date(2026, 8, 22))] }),
    );

    await act(async () => {
      await result.current('current');
    });

    expect(toastErrorMock).toHaveBeenCalledWith(
      'Could not save the weekly export file.',
    );
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it('logs unexpected failures and shows an error toast', async () => {
    storageGetChainsMock.mockRejectedValue(new Error('storage unavailable'));
    const { result } = renderHook(() =>
      useWeeklyExportWorkflow({ history: [makeRecord(new Date(2026, 8, 22))] }),
    );

    await act(async () => {
      await result.current('current');
    });

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'IMPORT_EXPORT',
      'Weekly export failed',
      undefined,
      expect.any(Error),
    );
    expect(toastErrorMock).toHaveBeenCalledWith(
      'Weekly export failed. Please try again.',
    );
  });
});
