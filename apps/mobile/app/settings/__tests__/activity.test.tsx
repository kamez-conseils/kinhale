import React from 'react';
import { screen, waitFor } from '@testing-library/react-native';
import SettingsActivityScreen from '../activity';
import { renderWithProviders } from '../../../src/test-utils/render';
import { listMyAuditEvents } from '../../../src/lib/audit-events/client';

jest.mock('../../../src/lib/audit-events/client', () => ({
  listMyAuditEvents: jest.fn(),
}));

const mockList = listMyAuditEvents as jest.MockedFunction<typeof listMyAuditEvents>;

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

describe('SettingsActivityScreen (mobile, KIN-093)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue(SAMPLE_EVENTS);
  });

  it('affiche le titre et le sous-titre i18n', async () => {
    renderWithProviders(<SettingsActivityScreen />);
    await waitFor(() => {
      expect(screen.getByRole('header')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText(/activité du foyer|household activity/i)).toBeTruthy();
    });
  });

  it('charge la liste et affiche les libellés traduits', async () => {
    renderWithProviders(<SettingsActivityScreen />);
    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.getByText(/rapport médecin généré|medical report generated/i)).toBeTruthy();
    });
    expect(
      screen.getByText(/export de portabilité téléchargé|portability export downloaded/i),
    ).toBeTruthy();
  });

  it('affiche un libellé fallback pour un type inconnu (forward-compat)', async () => {
    renderWithProviders(<SettingsActivityScreen />);
    await waitFor(() => {
      expect(screen.getByText(/autre événement|other event/i)).toBeTruthy();
    });
  });

  it("affiche l'état vide quand aucun événement n'est retourné", async () => {
    mockList.mockResolvedValue([]);
    renderWithProviders(<SettingsActivityScreen />);
    await waitFor(() => {
      expect(screen.getByText(/aucune activité|no activity recorded/i)).toBeTruthy();
    });
  });

  it('affiche un message i18n quand le chargement échoue', async () => {
    mockList.mockRejectedValue(new Error('Network down'));
    renderWithProviders(<SettingsActivityScreen />);
    await waitFor(() => {
      expect(
        screen.getByText(/impossible de charger l'historique|could not load activity/i),
      ).toBeTruthy();
    });
  });

  it('aucune fuite santé dans le rendu (zero-knowledge)', async () => {
    renderWithProviders(<SettingsActivityScreen />);
    await waitFor(() => {
      expect(mockList).toHaveBeenCalled();
    });
    const forbidden = ['Léa', 'Ventolin', 'wheezing', 'freeFormTag', 'firstName'];
    for (const w of forbidden) {
      expect(screen.queryByText(new RegExp(w, 'i'))).toBeNull();
    }
  });
});
