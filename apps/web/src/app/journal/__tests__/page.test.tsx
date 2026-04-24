import { screen } from '@testing-library/react';
import JournalPage from '../page';
import { renderWithProviders } from '../../../test-utils/render';
import type { ProjectedDose } from '@kinhale/sync';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockProjectDoses = jest.fn<ProjectedDose[], any[]>(() => []);
jest.mock('@kinhale/sync', () => ({
  projectDoses: (doc: unknown) => mockProjectDoses(doc),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../../stores/auth-store', () => ({
  useAuthStore: jest.fn(
    (selector: (s: { accessToken: string | null; householdId: string | null }) => unknown) =>
      selector({ accessToken: 'tok-1', householdId: 'hh-1' }),
  ),
}));

jest.mock('../../../stores/doc-store', () => ({
  useDocStore: jest.fn((selector: (s: { doc: null; initDoc: jest.Mock }) => unknown) =>
    selector({ doc: null, initDoc: jest.fn() }),
  ),
}));

describe('JournalPage', () => {
  it('affiche le titre Journal', () => {
    renderWithProviders(<JournalPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('affiche un message vide quand aucune dose', () => {
    renderWithProviders(<JournalPage />);
    expect(screen.getByText(/aucune prise|no doses/i)).toBeInTheDocument();
  });

  it('affiche le bouton ajouter', () => {
    renderWithProviders(<JournalPage />);
    expect(screen.getByRole('button', { name: /ajouter|add/i })).toBeInTheDocument();
  });

  it('affiche les doses quand doc contient des événements DoseAdministered', () => {
    const { useDocStore } = jest.requireMock('../../../stores/doc-store') as {
      useDocStore: jest.Mock;
    };

    const fakeDose: ProjectedDose = {
      eventId: 'e1',
      occurredAtMs: 1_700_000_000_000,
      deviceId: 'dev-1',
      doseId: 'd1',
      pumpId: 'pump-1',
      childId: 'child-1',
      caregiverId: 'dev-1',
      administeredAtMs: 1_700_000_000_000,
      doseType: 'maintenance',
      dosesAdministered: 1,
      symptoms: [],
      circumstances: [],
      freeFormTag: null,
      status: 'recorded',
    };

    mockProjectDoses.mockReturnValueOnce([fakeDose]);

    useDocStore.mockImplementation(
      (selector: (s: { doc: object; initDoc: jest.Mock }) => unknown) =>
        selector({
          doc: { householdId: 'hh-1', events: [] },
          initDoc: jest.fn(),
        }),
    );

    renderWithProviders(<JournalPage />);
    // doseType === 'maintenance' → t('journal.maintenance') → 'Fond'
    expect(screen.getByText(/fond|maintenance/i)).toBeInTheDocument();
  });
});
