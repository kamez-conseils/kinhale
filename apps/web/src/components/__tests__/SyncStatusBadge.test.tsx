import React from 'react';
import { screen, act } from '@testing-library/react';
import { SyncStatusBadge } from '../SyncStatusBadge';
import { renderWithProviders } from '../../test-utils/render';

// État du store — ré-assigné par chaque test avant renderWithProviders.
let mockConnected = false;
let mockPulling = false;

jest.mock('../../stores/sync-status-store', () => ({
  useSyncStatusStore: jest.fn(
    (selector: (s: { connected: boolean; pulling: boolean }) => unknown) =>
      selector({ connected: mockConnected, pulling: mockPulling }),
  ),
}));

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('SyncStatusBadge', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnected = false;
    mockPulling = false;
  });

  it('affiche le badge "Hors-ligne" quand déconnecté', async () => {
    jest.useFakeTimers();
    try {
      mockConnected = false;
      mockPulling = false;
      renderWithProviders(<SyncStatusBadge />);
      await act(async () => {
        await flushPromises();
      });
      expect(screen.getByTestId('sync-status-badge-offline')).toBeTruthy();
      expect(screen.getByText(/hors.ligne|offline/i)).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche le badge "Synchronisation…" quand connecté et en cours de pull', async () => {
    jest.useFakeTimers();
    try {
      mockConnected = true;
      mockPulling = true;
      renderWithProviders(<SyncStatusBadge />);
      await act(async () => {
        await flushPromises();
      });
      expect(screen.getByTestId('sync-status-badge-pulling')).toBeTruthy();
      expect(screen.getByText(/synchronisation|syncing/i)).toBeTruthy();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("n'affiche rien quand connecté et calme (pas de pull en cours)", async () => {
    jest.useFakeTimers();
    try {
      mockConnected = true;
      mockPulling = false;
      renderWithProviders(<SyncStatusBadge />);
      await act(async () => {
        await flushPromises();
      });
      expect(screen.queryByTestId('sync-status-badge-offline')).toBeNull();
      expect(screen.queryByTestId('sync-status-badge-pulling')).toBeNull();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
