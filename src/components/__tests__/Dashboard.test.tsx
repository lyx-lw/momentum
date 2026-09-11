import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Dashboard } from '../Dashboard';
import { I18nProvider } from '../../i18n';
import { StorageProvider } from '../../storage/StorageContext';
import { createUnitChain } from '../../test/factories';

describe('Dashboard', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('language', 'en');
    vi.clearAllMocks();
  });

  it('never falls back to the in-memory check-in demo', async () => {
    const storage = {
      kind: 'local',
      getDeletedChains: vi.fn().mockResolvedValue([]),
    };

    render(
      <I18nProvider>
        <StorageProvider storage={storage as any}>
          <Dashboard
            chains={[]}
            scheduledSessions={[]}
            onCreateChain={vi.fn()}
            onCreateTaskGroup={vi.fn()}
            onOpenRSIP={vi.fn()}
            onStartChain={vi.fn()}
            onScheduleChain={vi.fn()}
            onViewChainDetail={vi.fn()}
            onCancelScheduledSession={vi.fn()}
            onCompleteBooking={vi.fn()}
            onDeleteChain={vi.fn()}
            onImportChains={vi.fn().mockResolvedValue(undefined)}
            onRestoreChains={vi.fn()}
            onPermanentDeleteChains={vi.fn()}
          />
        </StorageProvider>
      </I18nProvider>,
    );

    expect(
      await screen.findByText('Daily check-in unavailable'),
    ).toBeInTheDocument();
    expect(screen.queryByText('🚀 Demo mode')).not.toBeInTheDocument();
    expect(screen.queryByText('Demo notes')).not.toBeInTheDocument();
  });

  it('renders chain section and shows recycle bin count for non-empty chains', async () => {
    const chain = createUnitChain({ id: 'chain-1', name: 'Primary Chain' });
    const storage = {
      kind: 'local',
      getDeletedChains: vi
        .fn()
        .mockResolvedValue([{ id: 'deleted-1' }, { id: 'deleted-2' }]),
    };

    render(
      <I18nProvider>
        <StorageProvider storage={storage as any}>
          <Dashboard
            chains={[chain]}
            chainsRevision={1}
            scheduledSessions={[]}
            onCreateChain={vi.fn()}
            onCreateTaskGroup={vi.fn()}
            onOpenRSIP={vi.fn()}
            onStartChain={vi.fn()}
            onScheduleChain={vi.fn()}
            onViewChainDetail={vi.fn()}
            onCancelScheduledSession={vi.fn()}
            onCompleteBooking={vi.fn()}
            onDeleteChain={vi.fn()}
            onImportChains={vi.fn().mockResolvedValue(undefined)}
            onRestoreChains={vi.fn()}
            onPermanentDeleteChains={vi.fn()}
          />
        </StorageProvider>
      </I18nProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Recycle bin' }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(storage.getDeletedChains).toHaveBeenCalledTimes(1);
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('keeps rendering when recycle bin stats loading fails', async () => {
    const chain = createUnitChain({ id: 'chain-2', name: 'Secondary Chain' });
    const storage = {
      kind: 'local',
      getDeletedChains: vi.fn().mockRejectedValue(new Error('stats failed')),
    };

    render(
      <I18nProvider>
        <StorageProvider storage={storage as any}>
          <Dashboard
            chains={[chain]}
            chainsRevision={1}
            scheduledSessions={[]}
            onCreateChain={vi.fn()}
            onCreateTaskGroup={vi.fn()}
            onOpenRSIP={vi.fn()}
            onStartChain={vi.fn()}
            onScheduleChain={vi.fn()}
            onViewChainDetail={vi.fn()}
            onCancelScheduledSession={vi.fn()}
            onCompleteBooking={vi.fn()}
            onDeleteChain={vi.fn()}
            onImportChains={vi.fn().mockResolvedValue(undefined)}
            onRestoreChains={vi.fn()}
            onPermanentDeleteChains={vi.fn()}
          />
        </StorageProvider>
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(storage.getDeletedChains).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByRole('button', { name: 'Recycle bin' }),
    ).toBeInTheDocument();
  });
});
