import React from 'react';
import { screen } from '@testing-library/react-native';
import JournalScreen from '../index';
import { renderWithProviders } from '../../../src/test-utils/render';

jest.mock('@kinhale/crypto');
jest.mock('@kinhale/sync');

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('../../../src/stores/auth-store', () => ({
  useAuthStore: jest.fn(
    (
      selector: (s: {
        accessToken: string | null;
        householdId: string | null;
      }) => unknown,
    ) => selector({ accessToken: 'tok-1', householdId: 'hh-1' }),
  ),
}));

jest.mock('../../../src/stores/doc-store', () => ({
  useDocStore: jest.fn(
    (selector: (s: { doc: null; initDoc: jest.Mock }) => unknown) =>
      selector({ doc: null, initDoc: jest.fn() }),
  ),
}));

describe('JournalScreen', () => {
  it('affiche le titre Journal', () => {
    renderWithProviders(<JournalScreen />);
    expect(screen.getByText(/journal/i)).toBeTruthy();
  });

  it('affiche un message vide quand aucune dose', () => {
    renderWithProviders(<JournalScreen />);
    expect(screen.getByText(/aucune prise|no doses/i)).toBeTruthy();
  });

  it('affiche le bouton ajouter une prise', () => {
    renderWithProviders(<JournalScreen />);
    expect(screen.getByRole('button')).toBeTruthy();
  });

  it('affiche les doses quand doc contient des événements DoseAdministered', () => {
    const { useDocStore } = jest.requireMock('../../../src/stores/doc-store') as {
      useDocStore: jest.Mock;
    };
    useDocStore.mockImplementation(
      (
        selector: (s: {
          doc: { events: { id: string; type: string; occurredAtMs: number }[] };
          initDoc: jest.Mock;
        }) => unknown,
      ) =>
        selector({
          doc: {
            events: [{ id: 'e1', type: 'DoseAdministered', occurredAtMs: 1_700_000_000_000 }],
          },
          initDoc: jest.fn(),
        }),
    );
    renderWithProviders(<JournalScreen />);
    expect(screen.getByText(/prise de pompe|inhaler dose/i)).toBeTruthy();
  });
});
