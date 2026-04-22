import { renderHook, waitFor } from '@testing-library/react-native';

jest.mock('expo-notifications');
jest.mock('expo-device');

const mockApiPost = jest.fn();
jest.mock('../lib/api-client', () => ({
  apiClient: {
    post: (...args: unknown[]) => mockApiPost(...args),
    delete: jest.fn().mockResolvedValue({ ok: true }),
  },
}));

const mockRequestPushPermission = jest.fn();
jest.mock('../lib/notifications', () => ({
  requestPushPermission: (...args: unknown[]) => mockRequestPushPermission(...args),
}));

let mockAccessToken: string | null = 'fake-jwt-token';

jest.mock('../stores/auth-store', () => ({
  useAuthStore: (selector: (s: { accessToken: string | null }) => unknown) =>
    selector({ accessToken: mockAccessToken }),
}));

describe('usePushRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'fake-jwt-token';
    mockApiPost.mockResolvedValue({ ok: true });
    mockRequestPushPermission.mockResolvedValue('ExponentPushToken[test-token-mock]');
  });

  it('enregistre le token via POST /push/register-token avec le JWT', async () => {
    const { usePushRegistration } =
      require('../hooks/use-push-registration') as typeof import('../hooks/use-push-registration');

    renderHook(() => usePushRegistration());

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/push/register-token',
        { pushToken: 'ExponentPushToken[test-token-mock]' },
        { token: 'fake-jwt-token' },
      );
    });
  });

  it("n'appelle pas apiClient.post si accessToken est null", async () => {
    mockAccessToken = null;

    const { usePushRegistration } =
      require('../hooks/use-push-registration') as typeof import('../hooks/use-push-registration');

    const { unmount } = renderHook(() => usePushRegistration());

    // Flush microtasks — hook doit retourner immédiatement sans appeler post
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockApiPost).not.toHaveBeenCalled();
    unmount();
  });

  it('ne plante pas si la permission est refusée', async () => {
    mockRequestPushPermission.mockResolvedValue(null);

    const { usePushRegistration } =
      require('../hooks/use-push-registration') as typeof import('../hooks/use-push-registration');

    const { unmount } = renderHook(() => usePushRegistration());

    // Flush microtasks — requestPushPermission returns null, so post should never be called
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockApiPost).not.toHaveBeenCalled();
    unmount();
  });

  it('ne plante pas si POST échoue (erreur réseau)', async () => {
    mockApiPost.mockRejectedValue(new Error('Network error'));

    const { usePushRegistration } =
      require('../hooks/use-push-registration') as typeof import('../hooks/use-push-registration');

    const { unmount } = renderHook(() => usePushRegistration());

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalled();
    });

    unmount();
  });
});
