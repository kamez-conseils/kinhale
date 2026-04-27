import React from 'react';
import { screen, fireEvent, act } from '@testing-library/react';
import SettingsPage from '../page';
import { renderWithProviders } from '../../../test-utils/render';

// ──────────────────────────────────────────────────────────────────────────
// Mocks Next.js + auth + doc-store + sync.
// ──────────────────────────────────────────────────────────────────────────

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

let mockAccessToken: string | null = 'tok-valid';
const mockClearAuth = jest.fn();
jest.mock('../../../stores/auth-store', () => ({
  useAuthStore: Object.assign(
    jest.fn((selector: (s: { accessToken: string | null; clearAuth: () => void }) => unknown) =>
      selector({ accessToken: mockAccessToken, clearAuth: mockClearAuth }),
    ),
    {
      getState: () => ({ accessToken: mockAccessToken, clearAuth: mockClearAuth }),
    },
  ),
}));

jest.mock('../../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { doc: null }) => unknown) => selector({ doc: null })),
}));

jest.mock('@kinhale/sync', () => ({
  projectChild: () => null,
}));

// ──────────────────────────────────────────────────────────────────────────
// Helpers.
// ──────────────────────────────────────────────────────────────────────────

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * Force le breakpoint « desktop » à false pour rendre la variante mobile
 * (plus simple à requêter — pas de sidebar).
 */
function mockMobileViewport(): () => void {
  const original = window.matchMedia;
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
  return () => {
    window.matchMedia = original;
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Tests.
// ──────────────────────────────────────────────────────────────────────────

describe('SettingsPage (hub clinical-calm — fix wiring)', () => {
  jest.setTimeout(15000);

  let restoreViewport: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-valid';
    window.localStorage.clear();
    restoreViewport = mockMobileViewport();
  });

  afterEach(() => {
    restoreViewport();
  });

  it('redirige vers /auth sans token', async () => {
    mockAccessToken = null;
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsPage />);
      await act(async () => {
        await flushPromises();
      });
      expect(mockReplace).toHaveBeenCalledWith('/auth');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche le titre Réglages', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsPage />);
      await act(async () => {
        await flushPromises();
      });
      expect(screen.getAllByText(/réglages|settings/i).length).toBeGreaterThan(0);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('ne rend AUCUN switch dans la section Notifications (toggles convertis en liens)', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsPage />);
      await act(async () => {
        await flushPromises();
      });
      // Anti-régression : la stratégie « hybride » exige que le hub
      // ne contienne aucun toggle de notification — tout passe par
      // /settings/notifications.
      const notifLabels = [
        /rappel du matin|morning reminder/i,
        /rappel du soir|evening reminder/i,
        /alerte si dose manquée|alert if dose missed/i,
        /stock faible|low stock/i,
        /heures de silence|quiet hours/i,
      ];
      for (const label of notifLabels) {
        const switches = screen.queryAllByRole('switch', { name: label });
        expect(switches).toHaveLength(0);
      }
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('cliquer sur une rangée de notification route vers /settings/notifications', async () => {
    // Pattern Tamagui Jest (cf. feedback_tamagui_jest_pattern) :
    // fakeTimers + getByText + act(Promise×4) — pas de waitFor après clic.
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsPage />);
      // Flush des effets (isDesktop + hydratation appearance) avant la
      // recherche DOM.
      await act(async () => {
        await flushPromises();
      });
      const morningLabel = screen.getByText(/rappel du matin|morning reminder/i);
      // Le label est un <Text> à l'intérieur du XStack pressable. On remonte
      // jusqu'au parent button via closest.
      const morningRow = morningLabel.closest('[role="button"]');
      expect(morningRow).not.toBeNull();
      await act(async () => {
        if (morningRow !== null) {
          fireEvent.click(morningRow);
        }
        await flushPromises();
      });
      expect(mockPush).toHaveBeenCalledWith('/settings/notifications');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche « Bientôt disponible » pour les analytics anonymes (endpoint absent)', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsPage />);
      await act(async () => {
        await flushPromises();
      });
      expect(screen.getByText(/bientôt disponible|coming soon/i)).toBeTruthy();
      // La row n'est plus un switch.
      const analyticsSwitches = screen.queryAllByRole('switch', {
        name: /statistiques anonymes|anonymous analytics/i,
      });
      expect(analyticsSwitches).toHaveLength(0);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('persiste le choix de thème dans localStorage', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsPage />);
      await act(async () => {
        await flushPromises();
      });
      const darkRadio = screen.getByRole('radio', { name: /sombre|dark/i });
      await act(async () => {
        fireEvent.click(darkRadio);
        await flushPromises();
      });
      expect(window.localStorage.getItem('kinhale-settings-appearance-theme')).toBe('dark');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("n'écrase pas localStorage au mount (hydratation non destructive)", async () => {
    // Pré-charge la valeur AVANT le mount.
    window.localStorage.setItem('kinhale-settings-appearance-theme', 'dark');
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsPage />);
      await act(async () => {
        await flushPromises();
      });
      // On vérifie que le composant a bien été rendu (option « Dark » présente).
      expect(screen.getByRole('radio', { name: /sombre|dark/i })).toBeTruthy();
      // L'effet d'hydratation est synchrone après mount → la valeur reste
      // « dark » dans localStorage (pas écrasée par défaut).
      expect(window.localStorage.getItem('kinhale-settings-appearance-theme')).toBe('dark');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('persiste le choix de taille de texte dans localStorage', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsPage />);
      await act(async () => {
        await flushPromises();
      });
      const largeRadio = screen.getByRole('radio', { name: /A\+/ });
      await act(async () => {
        fireEvent.click(largeRadio);
        await flushPromises();
      });
      expect(window.localStorage.getItem('kinhale-settings-appearance-text-size')).toBe('l');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('cliquer sur « Exporter mes données » route vers /settings/privacy', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsPage />);
      await act(async () => {
        await flushPromises();
      });
      const exportLabel = screen.getByText(/exporter mes données|export my data/i);
      const exportRow = exportLabel.closest('[role="button"]');
      expect(exportRow).not.toBeNull();
      await act(async () => {
        if (exportRow !== null) {
          fireEvent.click(exportRow);
        }
        await flushPromises();
      });
      expect(mockPush).toHaveBeenCalledWith('/settings/privacy');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('cliquer sur « Supprimer le compte » route vers /account/deletion-confirm', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsPage />);
      await act(async () => {
        await flushPromises();
      });
      const deleteLabel = screen.getByText(/supprimer le compte|delete account/i);
      const deleteRow = deleteLabel.closest('[role="button"]');
      expect(deleteRow).not.toBeNull();
      await act(async () => {
        if (deleteRow !== null) {
          fireEvent.click(deleteRow);
        }
        await flushPromises();
      });
      expect(mockPush).toHaveBeenCalledWith('/account/deletion-confirm');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('ne rend pas la rangée « anonymize » comme un bouton (readOnly)', async () => {
    // Garde anti-régression : la row analytics anonymes est explicitement
    // marquée `readOnly` pour ne PAS apparaître comme un faux bouton (curseur,
    // hover, role=button) tant qu'aucun endpoint n'est câblé.
    jest.useFakeTimers();
    try {
      renderWithProviders(<SettingsPage />);
      await act(async () => {
        await flushPromises();
      });
      const comingSoon = screen.getByText(/bientôt disponible|coming soon/i);
      const row = comingSoon.closest('[role="button"]');
      expect(row).toBeNull();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
