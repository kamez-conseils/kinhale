import { screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/render';
import HomePage from './page';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('../stores/auth-store', () => ({
  useAuthStore: jest.fn((selector: (s: { accessToken: null }) => unknown) =>
    selector({ accessToken: null }),
  ),
}));

describe('HomePage', () => {
  it('affiche le titre Kinhale', () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByText('Kinhale')).toBeInTheDocument();
  });

  it('affiche le sous-titre en français par défaut', () => {
    renderWithProviders(<HomePage />);
    expect(screen.getByText('Coordonnez les soins de votre enfant')).toBeInTheDocument();
  });
});
