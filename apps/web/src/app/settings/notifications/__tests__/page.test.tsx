import React from 'react';
import { screen, fireEvent, act, waitFor } from '@testing-library/react';
import NotificationPreferencesPage from '../page';
import { renderWithProviders } from '../../../../test-utils/render';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

let mockAccessToken: string | null = 'tok-valid';
jest.mock('../../../../stores/auth-store', () => ({
  useAuthStore: Object.assign(
    jest.fn((selector: (s: { accessToken: string | null }) => unknown) =>
      selector({ accessToken: mockAccessToken }),
    ),
    {
      getState: () => ({ accessToken: mockAccessToken }),
    },
  ),
}));

const mockListPrefs = jest.fn();
const mockUpdatePref = jest.fn();
jest.mock('../../../../lib/notification-preferences/client', () => ({
  listNotificationPreferences: (...args: unknown[]) => mockListPrefs(...args),
  updateNotificationPreference: (...args: unknown[]) => mockUpdatePref(...args),
}));

// Mock du client quiet hours — la page Notifications intègre désormais la
// section « Heures silencieuses » (E5-S08).
jest.mock('../../../../lib/quiet-hours/client', () => ({
  getQuietHours: jest.fn().mockResolvedValue({
    enabled: false,
    startLocalTime: '22:00',
    endLocalTime: '07:00',
    timezone: 'America/Toronto',
  }),
  updateQuietHours: jest.fn().mockResolvedValue(undefined),
  detectLocalTimezone: () => 'America/Toronto',
}));

const SAMPLE_PREFS = [
  { type: 'reminder', enabled: true, alwaysEnabled: false },
  { type: 'missed_dose', enabled: true, alwaysEnabled: true },
  { type: 'peer_dose_recorded', enabled: false, alwaysEnabled: false },
  { type: 'security_alert', enabled: true, alwaysEnabled: true },
];

describe('NotificationPreferencesPage', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-valid';
    mockListPrefs.mockResolvedValue(SAMPLE_PREFS);
    mockUpdatePref.mockResolvedValue(undefined);
  });

  it('affiche le titre et la description i18n', async () => {
    renderWithProviders(<NotificationPreferencesPage />);
    // Le titre est rendu immédiatement, on l'identifie par son poids (élément unique).
    await waitFor(() => {
      expect(screen.getByText(/choisissez les types|choose which notification/i)).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText(/rappels de prise|dose reminders/i)).toBeTruthy();
    });
  });

  it('redirige vers /auth sans token', async () => {
    mockAccessToken = null;
    jest.useFakeTimers();
    try {
      renderWithProviders(<NotificationPreferencesPage />);
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(mockReplace).toHaveBeenCalledWith('/auth');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('charge les préférences au montage et les affiche', async () => {
    renderWithProviders(<NotificationPreferencesPage />);

    await waitFor(() => {
      expect(mockListPrefs).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/rappels de prise|dose reminders/i)).toBeTruthy();
    });
    // La chaîne "dose manquée" peut apparaître dans le label + description —
    // on valide juste la présence d'au moins une occurrence (via getAllByText).
    expect(screen.getAllByText(/dose manquée|missed dose/i).length).toBeGreaterThanOrEqual(1);
    // Les types sanctuarisés affichent le tooltip d'info.
    expect(screen.getAllByText(/toujours activé|always enabled/i).length).toBeGreaterThanOrEqual(1);
  });

  it("émet un PUT sur toggle d'un type togglable", async () => {
    renderWithProviders(<NotificationPreferencesPage />);

    // Attend que les switches soient rendus (query résolue).
    const reminderSwitch = await screen.findByRole('switch', {
      name: /rappels de prise|dose reminders/i,
    });

    await act(async () => {
      fireEvent.click(reminderSwitch);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockUpdatePref).toHaveBeenCalledWith('reminder', false);
    });
  });

  it('affiche une erreur i18n quand le chargement échoue', async () => {
    mockListPrefs.mockRejectedValue(new Error('Network down'));
    renderWithProviders(<NotificationPreferencesPage />);
    await waitFor(() => {
      expect(screen.getByText(/impossible de charger|could not load/i)).toBeTruthy();
    });
  });
});
