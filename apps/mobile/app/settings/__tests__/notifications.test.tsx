import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import NotificationPreferencesScreen from '../notifications';
import { renderWithProviders } from '../../../src/test-utils/render';
import {
  listNotificationPreferences,
  updateNotificationPreference,
} from '../../../src/lib/notification-preferences/client';

jest.mock('../../../src/lib/notification-preferences/client', () => ({
  listNotificationPreferences: jest.fn(),
  updateNotificationPreference: jest.fn(),
}));

// Mock du client quiet hours — l'écran Notifications intègre désormais la
// section « Heures silencieuses » (E5-S08) qui ferait un appel réseau réel
// dans jsdom sans mock.
jest.mock('../../../src/lib/quiet-hours/client', () => ({
  getQuietHours: jest.fn().mockResolvedValue({
    enabled: false,
    startLocalTime: '22:00',
    endLocalTime: '07:00',
    timezone: 'America/Toronto',
  }),
  updateQuietHours: jest.fn().mockResolvedValue(undefined),
  detectLocalTimezone: () => 'America/Toronto',
}));

const mockList = listNotificationPreferences as jest.MockedFunction<
  typeof listNotificationPreferences
>;
const mockUpdate = updateNotificationPreference as jest.MockedFunction<
  typeof updateNotificationPreference
>;

const SAMPLE_PREFS = [
  { type: 'reminder' as const, enabled: true, alwaysEnabled: false },
  { type: 'missed_dose' as const, enabled: true, alwaysEnabled: true },
  { type: 'peer_dose_recorded' as const, enabled: false, alwaysEnabled: false },
  { type: 'security_alert' as const, enabled: true, alwaysEnabled: true },
];

describe('NotificationPreferencesScreen (mobile)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue(SAMPLE_PREFS);
    mockUpdate.mockResolvedValue(undefined);
  });

  it('affiche le titre et la description i18n', async () => {
    renderWithProviders(<NotificationPreferencesScreen />);
    await waitFor(() => {
      expect(screen.getByRole('header')).toBeTruthy();
    });
    expect(screen.getByText(/choisissez les types|choose which notification/i)).toBeTruthy();
  });

  it('charge les préférences et affiche un switch par type', async () => {
    renderWithProviders(<NotificationPreferencesScreen />);
    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByLabelText(/rappels de prise|dose reminders/i)).toBeTruthy();
    });
    expect(screen.getByLabelText(/dose manquée|missed dose/i)).toBeTruthy();
  });

  it('appelle updateNotificationPreference quand on toggle un type togglable', async () => {
    renderWithProviders(<NotificationPreferencesScreen />);
    const switchEl = await screen.findByLabelText(/rappels de prise|dose reminders/i);

    fireEvent(switchEl, 'checkedChange', false);

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('reminder', false);
    });
  });

  it("affiche un message d'erreur localisé quand le chargement échoue", async () => {
    mockList.mockRejectedValue(new Error('Network down'));
    renderWithProviders(<NotificationPreferencesScreen />);
    await waitFor(() => {
      expect(screen.getByText(/impossible de charger|could not load/i)).toBeTruthy();
    });
  });

  it('ne déclenche pas de PUT quand on tente de toggler un type sanctuarisé', async () => {
    renderWithProviders(<NotificationPreferencesScreen />);
    const missedDoseSwitch = await screen.findByLabelText(/dose manquée|missed dose/i);

    fireEvent(missedDoseSwitch, 'checkedChange', false);

    // Aucun appel PUT attendu (le switch est disabled + garde-fou dans le handler).
    await new Promise((r) => setTimeout(r, 50));
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
