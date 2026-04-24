import React from 'react';
import { screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QuietHoursSection } from '../QuietHoursSection';
import { renderWithProviders } from '../../test-utils/render';
import { getQuietHours, updateQuietHours } from '../../lib/quiet-hours/client';

jest.mock('../../lib/quiet-hours/client', () => ({
  getQuietHours: jest.fn(),
  updateQuietHours: jest.fn(),
  detectLocalTimezone: () => 'America/Toronto',
}));

const mockGet = getQuietHours as jest.MockedFunction<typeof getQuietHours>;
const mockUpdate = updateQuietHours as jest.MockedFunction<typeof updateQuietHours>;

describe('QuietHoursSection (mobile)', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({
      enabled: false,
      startLocalTime: '22:00',
      endLocalTime: '07:00',
      timezone: 'UTC',
    });
    mockUpdate.mockResolvedValue(undefined);
  });

  it('affiche le titre et la note de sécurité', async () => {
    renderWithProviders(<QuietHoursSection />);
    await waitFor(() => {
      // Le titre "Heures silencieuses" apparaît plusieurs fois
      // (header + meta title React), on accepte au moins une occurrence.
      expect(screen.getAllByText(/heures silencieuses|quiet hours/i).length).toBeGreaterThan(0);
    });
    expect(
      screen.getByText(
        /dose manquée restent émises|missed-dose notifications are still delivered/i,
      ),
    ).toBeTruthy();
  });

  it('hydrate le formulaire avec les valeurs serveur', async () => {
    mockGet.mockResolvedValue({
      enabled: true,
      startLocalTime: '23:00',
      endLocalTime: '06:30',
      timezone: 'America/Toronto',
    });
    renderWithProviders(<QuietHoursSection />);
    const startInput = await screen.findByDisplayValue('23:00');
    expect(startInput).toBeTruthy();
    expect(screen.getByDisplayValue('06:30')).toBeTruthy();
  });

  it("remplace timezone 'UTC' par le fuseau détecté au premier chargement", async () => {
    renderWithProviders(<QuietHoursSection />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('America/Toronto')).toBeTruthy();
    });
  });

  it('émet un PUT au clic sur Enregistrer', async () => {
    renderWithProviders(<QuietHoursSection />);
    const saveBtn = await screen.findByLabelText(/enregistrer|save/i);

    await act(async () => {
      fireEvent.press(saveBtn);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith({
        enabled: false,
        startLocalTime: '22:00',
        endLocalTime: '07:00',
        timezone: 'America/Toronto',
      });
    });
  });

  it('affiche une erreur i18n si heure au mauvais format (validation client)', async () => {
    mockGet.mockResolvedValue({
      enabled: true,
      startLocalTime: '7:00', // pas de zéro padding
      endLocalTime: '22:00',
      timezone: 'America/Toronto',
    });
    renderWithProviders(<QuietHoursSection />);
    const saveBtn = await screen.findByLabelText(/enregistrer|save/i);

    await act(async () => {
      fireEvent.press(saveBtn);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/format invalide|invalid format/i)).toBeTruthy();
    });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('affiche une erreur i18n si le chargement initial échoue', async () => {
    mockGet.mockRejectedValue(new Error('DB down'));
    renderWithProviders(<QuietHoursSection />);
    await waitFor(() => {
      expect(screen.getByText(/impossible de charger|could not load/i)).toBeTruthy();
    });
  });
});
