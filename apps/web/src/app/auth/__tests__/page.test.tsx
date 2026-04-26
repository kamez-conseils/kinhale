import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthPage from '../page';
import { renderWithProviders } from '../../../test-utils/render';

jest.mock('../../../lib/api-client', () => ({
  apiFetch: jest.fn(),
  ApiError: class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => ({ get: jest.fn().mockReturnValue(null) }),
}));

jest.mock('../../../lib/invitations/client', () => ({
  getInvitationPublic: jest.fn(),
}));

// Pattern projet : Tamagui en CI Docker exige un pump act() après les
// interactions pour laisser les effets se propager. cf. memory feedback
// `tamagui_jest_pattern.md`.
const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('AuthPage — état initial (enter)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('affiche le titre de bienvenue et le champ email', async () => {
    renderWithProviders(<AuthPage />);
    await flush();
    expect(screen.getByText(/Bienvenue/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/famille\.ca|family\.ca/i)).toBeInTheDocument();
  });

  it('affiche le disclaimer non-dispositif-médical (RM27)', async () => {
    renderWithProviders(<AuthPage />);
    await flush();
    // auth.notMedical (FR) = "Ne remplace pas un avis médical."
    // auth.notMedical (EN) = "Not a substitute for medical advice."
    expect(
      screen.getByText(/remplace pas un avis médical|substitute for medical advice/i),
    ).toBeInTheDocument();
  });

  it('désactive le bouton tant que le format email est invalide', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderWithProviders(<AuthPage />);
    await flush();
    const button = screen.getByRole('button', { name: /Envoyer le lien/i });
    expect(button).toBeDisabled();
    await user.type(screen.getByPlaceholderText(/famille\.ca|family\.ca/i), 'pasvalide');
    await flush();
    expect(button).toBeDisabled();
    expect(screen.getByText(/Adresse courriel invalide/i)).toBeInTheDocument();
  });

  it('appelle apiFetch /auth/magic-link puis bascule sur l’état sent', async () => {
    const { apiFetch } = jest.requireMock('../../../lib/api-client') as { apiFetch: jest.Mock };
    apiFetch.mockResolvedValue({ message: 'ok' });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderWithProviders(<AuthPage />);
    await flush();
    await user.type(screen.getByPlaceholderText(/famille\.ca|family\.ca/i), 'parent@famille.ca');
    await flush();
    await user.click(screen.getByRole('button', { name: /Envoyer le lien/i }));
    await flush();
    expect(apiFetch).toHaveBeenCalledWith(
      '/auth/magic-link',
      expect.objectContaining({ method: 'POST' }),
    );
    // Le SentBlock est l'unique porteur du bouton resend → c'est le marqueur
    // fiable que la machine d'état est bien passée à 'sent'.
    expect(
      await screen.findByTestId('auth-resend', undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
  });
});

describe('AuthPage — état sent', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  async function getToSentState(): Promise<void> {
    const { apiFetch } = jest.requireMock('../../../lib/api-client') as { apiFetch: jest.Mock };
    apiFetch.mockResolvedValue({ message: 'ok' });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    renderWithProviders(<AuthPage />);
    await flush();
    await user.type(screen.getByPlaceholderText(/famille\.ca|family\.ca/i), 'parent@famille.ca');
    await flush();
    await user.click(screen.getByRole('button', { name: /Envoyer le lien/i }));
    // Plus de pumps act() pour absorber la cascade : setState submit →
    // apiFetch resolved → setState sent → render SentBlock + démarrage timer.
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  it('démarre le compte à rebours du resend après envoi', async () => {
    await getToSentState();
    const resendBtn = await screen.findByTestId('auth-resend', undefined, { timeout: 5000 });
    expect(resendBtn.textContent).toMatch(/Renvoyer dans/i);
  });

  it('permet de revenir à la saisie via "Changer l\'adresse"', async () => {
    await getToSentState();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const changeBtn = await waitFor(() => screen.getByTestId('auth-change-email'));
    await user.click(changeBtn);
    await flush();
    expect(screen.getByPlaceholderText(/famille\.ca|family\.ca/i)).toBeInTheDocument();
  });
});

describe('AuthPage — mode invitation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('affiche un titre personnalisé quand un invite token est présent', async () => {
    const navigation = jest.requireMock('next/navigation') as {
      useSearchParams: () => { get: jest.Mock };
    };
    const get = jest.fn().mockReturnValue('inv-token-abc');
    navigation.useSearchParams = (): { get: jest.Mock } => ({ get });

    const invitations = jest.requireMock('../../../lib/invitations/client') as {
      getInvitationPublic: jest.Mock;
    };
    invitations.getInvitationPublic.mockResolvedValue({
      targetRole: 'contributor',
      displayName: 'Maman',
    });

    renderWithProviders(<AuthPage />);
    await flush();
    // Format maquette : "Invité·e par {who} en tant que {role}"
    // Le titre h1 contient déjà la déclinaison complète "...Co-parent" donc
    // on vérifie l'expression entière dans un seul findByText.
    expect(
      await screen.findByText(/Invité·e par Maman en tant que Co-parent/i),
    ).toBeInTheDocument();
  });
});

jest.setTimeout(15000);
