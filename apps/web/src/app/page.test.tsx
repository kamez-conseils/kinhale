import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '../test-utils/render';
import HomePage from './page';

const replaceMock = jest.fn();
const pushMock = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const authStoreMock = jest.fn();

jest.mock('../stores/auth-store', () => ({
  useAuthStore: (selector: (s: { accessToken: string | null }) => unknown): unknown =>
    selector(authStoreMock()),
}));

const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('HomePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirige vers /auth quand l'utilisateur n'est pas authentifié", async () => {
    authStoreMock.mockReturnValue({ accessToken: null });
    renderWithProviders(<HomePage />);
    await flush();
    expect(replaceMock).toHaveBeenCalledWith('/auth');
  });

  it('affiche le tableau de bord quand authentifié', async () => {
    authStoreMock.mockReturnValue({ accessToken: 'token-fake' });
    renderWithProviders(<HomePage />);
    await flush();
    // Le HomeDashboard rend le titre du programme du jour, signature
    // visuelle fiable que le composant de dashboard est bien monté.
    expect(screen.getByText(/Programme du jour|Today's schedule/i)).toBeInTheDocument();
    // Disclaimer médical RM27 toujours présent.
    expect(
      screen.getByText(/remplace pas un avis médical|substitute for medical advice/i),
    ).toBeInTheDocument();
  });
});

jest.setTimeout(15000);
