import { act, screen, waitFor } from '@testing-library/react';
import VerifyPage from '../page';
import { renderWithProviders } from '../../../../test-utils/render';

jest.mock('../../../../lib/api-client', () => ({
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

const replaceMock = jest.fn();
const pushMock = jest.fn();
const searchParamsGet = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));

jest.mock('../../../../lib/device', () => ({
  getOrCreateDevice: jest.fn().mockResolvedValue({ publicKeyHex: 'aabbcc' }),
  createGroupKey: jest.fn().mockResolvedValue(undefined),
}));

const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await Promise.resolve();
    });
  }
};

describe('VerifyPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('affiche le bloc "Connexion en cours" pendant la vérification', async () => {
    const { apiFetch } = jest.requireMock('../../../../lib/api-client') as {
      apiFetch: jest.Mock;
    };
    // JWT factice avec payload {sub, deviceId, householdId}
    const fakeJwtPayload = Buffer.from(
      JSON.stringify({ sub: 'u1', deviceId: 'd1', householdId: 'h1' }),
    ).toString('base64');
    apiFetch.mockResolvedValue({ accessToken: `header.${fakeJwtPayload}.sig` });
    searchParamsGet.mockReturnValue('valid-token');

    renderWithProviders(<VerifyPage />);
    await flush();
    expect(await screen.findByText(/Connexion en cours|Signing you in/i)).toBeInTheDocument();
  });

  it('affiche un message d’erreur et un retry quand le token est manquant', async () => {
    searchParamsGet.mockReturnValue(null);
    renderWithProviders(<VerifyPage />);
    await flush();
    expect(
      await screen.findByText(/Lien invalide ou expiré|Link is invalid or expired/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Retour à la connexion|Back to sign in/i)).toBeInTheDocument();
  });

  it('affiche un message d’erreur quand la vérification échoue', async () => {
    const { apiFetch } = jest.requireMock('../../../../lib/api-client') as {
      apiFetch: jest.Mock;
    };
    apiFetch.mockRejectedValue(new Error('boom'));
    searchParamsGet.mockReturnValue('some-token');

    renderWithProviders(<VerifyPage />);
    await flush();
    await waitFor(() => {
      expect(screen.getByText(/Échec de la vérification|Verification failed/i)).toBeInTheDocument();
    });
  });
});

jest.setTimeout(15000);
