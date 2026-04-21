import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthPage from '../page';
import { renderWithProviders } from '../../../test-utils/render';

jest.mock('../../../lib/api-client', () => ({
  apiFetch: jest.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

describe('AuthPage', () => {
  it('affiche le titre et le champ email', () => {
    renderWithProviders(<AuthPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
  });

  it('appelle apiFetch /auth/magic-link au clic sur soumettre', async () => {
    const { apiFetch } = jest.requireMock('../../../lib/api-client') as { apiFetch: jest.Mock };
    apiFetch.mockResolvedValue({ message: 'ok' });
    renderWithProviders(<AuthPage />);
    const input = screen.getByPlaceholderText(/email/i);
    await userEvent.type(input, 'test@example.com');
    const button = screen.getByRole('button', { name: /lien magique|magic link/i });
    await userEvent.click(button);
    expect(apiFetch).toHaveBeenCalledWith(
      '/auth/magic-link',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('affiche le message de confirmation après envoi', async () => {
    const { apiFetch } = jest.requireMock('../../../lib/api-client') as { apiFetch: jest.Mock };
    apiFetch.mockResolvedValue({ message: 'ok' });
    renderWithProviders(<AuthPage />);
    await userEvent.type(screen.getByPlaceholderText(/email/i), 'test@example.com');
    await userEvent.click(screen.getByRole('button', { name: /lien magique|magic link/i }));
    expect(await screen.findByText(/lien envoyé|link sent/i)).toBeInTheDocument();
  });
});
