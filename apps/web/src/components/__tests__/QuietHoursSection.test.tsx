import React from 'react';
import { screen, fireEvent, act, waitFor } from '@testing-library/react';
import { QuietHoursSection } from '../QuietHoursSection';
import { renderWithProviders } from '../../test-utils/render';

let mockAccessToken: string | null = 'tok-valid';
jest.mock('../../stores/auth-store', () => ({
  useAuthStore: Object.assign(
    jest.fn((selector: (s: { accessToken: string | null }) => unknown) =>
      selector({ accessToken: mockAccessToken }),
    ),
    {
      getState: () => ({ accessToken: mockAccessToken }),
    },
  ),
}));

const mockGet = jest.fn();
const mockUpdate = jest.fn();
jest.mock('../../lib/quiet-hours/client', () => ({
  getQuietHours: (...args: unknown[]) => mockGet(...args),
  updateQuietHours: (...args: unknown[]) => mockUpdate(...args),
  detectLocalTimezone: () => 'America/Toronto',
}));

describe('QuietHoursSection', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-valid';
    mockGet.mockResolvedValue({
      enabled: false,
      startLocalTime: '22:00',
      endLocalTime: '07:00',
      timezone: 'UTC',
    });
    mockUpdate.mockResolvedValue(undefined);
  });

  it('affiche le titre et la note de sécurité RM25', async () => {
    renderWithProviders(<QuietHoursSection />);
    await waitFor(() => {
      // Le libellé "Heures silencieuses" peut apparaître plusieurs fois
      // (titre Tamagui rendu via 2 nœuds imbriqués).
      expect(screen.getAllByText(/heures silencieuses|quiet hours/i).length).toBeGreaterThan(0);
    });
    // La note de sécurité est rendue dès le chargement.
    expect(
      screen.getByText(
        /dose manquée restent émises|missed-dose notifications are still delivered/i,
      ),
    ).toBeTruthy();
  });

  it('hydrate le formulaire avec les valeurs serveur après chargement', async () => {
    mockGet.mockResolvedValue({
      enabled: true,
      startLocalTime: '23:00',
      endLocalTime: '06:30',
      timezone: 'America/Toronto',
    });
    renderWithProviders(<QuietHoursSection />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('23:00')).toBeTruthy();
    });
    expect(screen.getByDisplayValue('06:30')).toBeTruthy();
    expect(screen.getByDisplayValue('America/Toronto')).toBeTruthy();
  });

  it('remplace timezone UTC par le fuseau auto-détecté au premier chargement', async () => {
    mockGet.mockResolvedValue({
      enabled: false,
      startLocalTime: '22:00',
      endLocalTime: '07:00',
      timezone: 'UTC',
    });
    renderWithProviders(<QuietHoursSection />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('America/Toronto')).toBeTruthy();
    });
  });

  it('émet un PUT avec les bonnes valeurs quand on clique Enregistrer', async () => {
    renderWithProviders(<QuietHoursSection />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('22:00')).toBeTruthy();
    });

    const saveBtn = screen.getByRole('button', { name: /enregistrer|save/i });
    await act(async () => {
      fireEvent.click(saveBtn);
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

  it("affiche une erreur i18n si format d'heure invalide (validation client)", async () => {
    mockGet.mockResolvedValue({
      enabled: true,
      startLocalTime: '7:00', // pas de zéro padding
      endLocalTime: '22:00',
      timezone: 'America/Toronto',
    });
    renderWithProviders(<QuietHoursSection />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('7:00')).toBeTruthy();
    });

    const saveBtn = screen.getByRole('button', { name: /enregistrer|save/i });
    await act(async () => {
      fireEvent.click(saveBtn);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/format invalide|invalid format/i)).toBeTruthy();
    });
    // Aucune requête PUT n'a été émise.
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('affiche une erreur i18n si le serveur rejette la sauvegarde', async () => {
    mockUpdate.mockRejectedValue(new Error('Network down'));
    renderWithProviders(<QuietHoursSection />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('22:00')).toBeTruthy();
    });

    const saveBtn = screen.getByRole('button', { name: /enregistrer|save/i });
    await act(async () => {
      fireEvent.click(saveBtn);
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText(/impossible d'enregistrer|could not save/i)).toBeTruthy();
    });
  });

  it('affiche une erreur i18n si le chargement initial échoue', async () => {
    mockGet.mockRejectedValue(new Error('DB down'));
    renderWithProviders(<QuietHoursSection />);
    await waitFor(() => {
      expect(screen.getByText(/impossible de charger|could not load/i)).toBeTruthy();
    });
  });
});
