import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import SettingsActivityPage from '../page';
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

const mockListEvents = jest.fn();
jest.mock('../../../../lib/audit-events/client', () => ({
  listMyAuditEvents: (...args: unknown[]) => mockListEvents(...args),
}));

const SAMPLE_EVENTS = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    eventType: 'report_generated',
    eventData: {
      reportHash: 'a'.repeat(64),
      rangeStartMs: 1_700_000_000_000,
      rangeEndMs: 1_700_500_000_000,
      generatedAtMs: 1_700_500_000_000,
    },
    createdAtMs: 1_700_500_000_000,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    eventType: 'privacy_export',
    eventData: { archiveHash: 'b'.repeat(64), generatedAtMs: 1_700_510_000_000 },
    createdAtMs: 1_700_510_000_000,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    eventType: 'unknown_future_type',
    eventData: {},
    createdAtMs: 1_700_520_000_000,
  },
];

describe('SettingsActivityPage (web, KIN-093)', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-valid';
    mockListEvents.mockResolvedValue(SAMPLE_EVENTS);
  });

  it('affiche le titre et le sous-titre i18n FR', async () => {
    renderWithProviders(<SettingsActivityPage />);
    await waitFor(() => {
      expect(screen.getByText(/activité du foyer|household activity/i)).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText(/90 derniers événements|90 most recent events/i)).toBeTruthy();
    });
  });

  it('redirige vers /auth sans token', async () => {
    mockAccessToken = null;
    renderWithProviders(<SettingsActivityPage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/auth');
    });
  });

  it('affiche les libellés i18n traduits pour chaque type connu', async () => {
    renderWithProviders(<SettingsActivityPage />);
    await waitFor(() => {
      expect(mockListEvents).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/rapport médecin généré|medical report generated/i)).toBeTruthy();
    });
    expect(
      screen.getByText(/export de portabilité téléchargé|portability export downloaded/i),
    ).toBeTruthy();
  });

  it('affiche un libellé fallback pour un type inconnu (forward-compat)', async () => {
    renderWithProviders(<SettingsActivityPage />);
    await waitFor(() => {
      expect(screen.getByText(/autre événement|other event/i)).toBeTruthy();
    });
  });

  it('ne fait JAMAIS apparaître de mot santé (anti-régression zero-knowledge)', async () => {
    renderWithProviders(<SettingsActivityPage />);
    await waitFor(() => {
      expect(mockListEvents).toHaveBeenCalled();
    });
    // L'UI ne rend que le label i18n + la date. Si quelqu'un un jour
    // décidait d'afficher un champ exotique, ce test attraperait la
    // régression.
    const forbidden = ['Léa', 'Ventolin', 'wheezing', 'freeFormTag', 'firstName'];
    for (const w of forbidden) {
      expect(screen.queryByText(new RegExp(w, 'i'))).toBeNull();
    }
  });

  it("affiche l'état vide quand aucun événement n'est retourné", async () => {
    mockListEvents.mockResolvedValue([]);
    renderWithProviders(<SettingsActivityPage />);
    await waitFor(() => {
      expect(screen.getByText(/aucune activité|no activity recorded/i)).toBeTruthy();
    });
  });

  it('affiche un message i18n quand le chargement échoue', async () => {
    mockListEvents.mockRejectedValue(new Error('Network down'));
    renderWithProviders(<SettingsActivityPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/impossible de charger l'historique|could not load activity/i),
      ).toBeTruthy();
    });
  });
});
