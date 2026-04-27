import React from 'react';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PumpsListPage from '../page';
import { renderWithProviders } from '../../../test-utils/render';

jest.setTimeout(15000);

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

let mockAccessToken: string | null = 'tok-1';
jest.mock('../../../stores/auth-store', () => ({
  useAuthStore: jest.fn(
    (
      selector: (s: {
        accessToken: string | null;
        deviceId: string | null;
        householdId: string | null;
      }) => unknown,
    ) => selector({ accessToken: mockAccessToken, deviceId: 'dev-1', householdId: 'hh-1' }),
  ),
}));

const mockProjectPumps = jest.fn();
jest.mock('@kinhale/sync', () => ({
  projectPumps: (doc: unknown) => mockProjectPumps(doc),
}));

const mockDoc = { householdId: 'hh-1', events: [] };
jest.mock('../../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { doc: typeof mockDoc | null }) => unknown) =>
    selector({ doc: mockDoc }),
  ),
}));

const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('PumpsListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'tok-1';
    mockProjectPumps.mockReturnValue([
      {
        pumpId: 'p1',
        name: 'Fluticasone 50',
        pumpType: 'maintenance',
        totalDoses: 200,
        dosesRemaining: 142,
        expiresAtMs: Date.now() + 1000 * 60 * 60 * 24 * 180,
        isExpired: false,
      },
      {
        pumpId: 'p2',
        name: 'Salbutamol',
        pumpType: 'rescue',
        totalDoses: 200,
        dosesRemaining: 30,
        expiresAtMs: Date.now() + 1000 * 60 * 60 * 24 * 30,
        isExpired: false,
      },
    ]);
  });

  it('redirige vers /auth si non authentifié', async () => {
    mockAccessToken = null;
    jest.useFakeTimers();
    try {
      renderWithProviders(<PumpsListPage />);
      await flush();
      expect(mockReplace).toHaveBeenCalledWith('/auth');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('affiche le titre Mes pompes et la liste segmentée', async () => {
    jest.useFakeTimers();
    try {
      renderWithProviders(<PumpsListPage />);
      await flush();
      // v2 layout : h1 « Mes pompes ». jsdom n'a pas matchMedia desktop
      // par défaut, le composant rend `PumpsListMobile` — un seul h1
      // avec le titre. Sections « Pompes de fond » et « Pompes de secours »
      // exposées via SectionTitle (`tag="h2"`).
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
      const sectionTitles = screen.getAllByRole('heading', { level: 2 });
      expect(sectionTitles.length).toBeGreaterThanOrEqual(2);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("navigue vers /pumps/add via le CTA d'ajout", async () => {
    jest.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderWithProviders(<PumpsListPage />);
      await flush();
      await user.click(screen.getByTestId('pumps-add-cta'));
      await flush();
      expect(mockPush).toHaveBeenCalledWith('/pumps/add');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it("affiche l'état vide enrichi quand aucune pompe n'est enregistrée", async () => {
    mockProjectPumps.mockReturnValue([]);
    jest.useFakeTimers();
    try {
      renderWithProviders(<PumpsListPage />);
      await flush();
      // v2 : empty state riche avec h2 « Ajoutez la première pompe de … »
      // + 3 bénéfices + 2 CTA scan / saisie.
      expect(
        screen.getByText(/Ajoutez la première pompe|Add .*’s first inhaler/i),
      ).toBeInTheDocument();
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
