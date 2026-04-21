import { screen } from '@testing-library/react';
import JournalPage from '../page';
import { renderWithProviders } from '../../../test-utils/render';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../../../stores/auth-store', () => ({
  useAuthStore: jest.fn((selector: (s: { accessToken: string | null; householdId: string | null }) => unknown) =>
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
    useDocStore.mockImplementation(
      (selector: (s: { doc: { events: { id: string; type: string; occurredAtMs: number }[] }; initDoc: jest.Mock }) => unknown) =>
        selector({
          doc: {
            events: [
              { id: 'e1', type: 'DoseAdministered', occurredAtMs: 1_700_000_000_000 },
            ],
          },
          initDoc: jest.fn(),
        }),
    );
    renderWithProviders(<JournalPage />);
    expect(screen.getByText(/prise de pompe|inhaler dose/i)).toBeInTheDocument();
  });
});
