jest.mock('expo-notifications');
jest.mock('expo-device');

const mockPost = jest.fn().mockResolvedValue(undefined);
const mockDelete = jest.fn().mockResolvedValue(undefined);

jest.mock('../../lib/api-client', () => ({
  apiClient: {
    post: mockPost,
    delete: mockDelete,
  },
}));

const mockRequestPushPermission = jest.fn().mockResolvedValue('ExponentPushToken[test-device]');

jest.mock('../../lib/notifications', () => ({
  requestPushPermission: mockRequestPushPermission,
}));

let mockAccessToken: string | null = 'test-access-token';

jest.mock('../../stores/auth-store', () => ({
  useAuthStore: jest.fn((selector: (s: { accessToken: string | null }) => unknown) =>
    selector({ accessToken: mockAccessToken }),
  ),
}));

import { renderHook, act } from '@testing-library/react-native';

describe('usePushRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccessToken = 'test-access-token';
    mockRequestPushPermission.mockResolvedValue('ExponentPushToken[test-device]');
    mockPost.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue(undefined);
  });

  it("enregistre le token push quand le token d'acces est present", async () => {
    const { useAuthStore } = jest.requireMock('../../stores/auth-store') as {
      useAuthStore: jest.Mock;
    };
    useAuthStore.mockImplementation(
      (selector: (s: { accessToken: string | null }) => unknown) =>
        selector({ accessToken: 'test-access-token' }),
    );

    const { usePushRegistration } =
      require('../use-push-registration') as typeof import('../use-push-registration');

    renderHook(() => usePushRegistration());

    // Laisser les promesses se resoudre
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPost).toHaveBeenCalledWith(
      '/push/register-token',
      { pushToken: 'ExponentPushToken[test-device]' },
      { token: 'test-access-token' },
    );
  });

  it("n'enregistre pas le token push si accessToken est null", async () => {
    const { useAuthStore } = jest.requireMock('../../stores/auth-store') as {
      useAuthStore: jest.Mock;
    };
    useAuthStore.mockImplementation(
      (selector: (s: { accessToken: string | null }) => unknown) =>
        selector({ accessToken: null }),
    );

    const { usePushRegistration } =
      require('../use-push-registration') as typeof import('../use-push-registration');

    renderHook(() => usePushRegistration());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockPost).not.toHaveBeenCalled();
  });

  it('appelle apiClient.delete lors du demontage si un token a ete enregistre', async () => {
    const { useAuthStore } = jest.requireMock('../../stores/auth-store') as {
      useAuthStore: jest.Mock;
    };
    useAuthStore.mockImplementation(
      (selector: (s: { accessToken: string | null }) => unknown) =>
        selector({ accessToken: 'test-access-token' }),
    );

    const { usePushRegistration } =
      require('../use-push-registration') as typeof import('../use-push-registration');

    const { unmount } = renderHook(() => usePushRegistration());

    // Laisser l'enregistrement async se terminer
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Demonter le hook — doit declencher le cleanup (DELETE)
    unmount();

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockDelete).toHaveBeenCalledWith(
      '/push/register-token',
      { pushToken: 'ExponentPushToken[test-device]' },
      { token: 'test-access-token' },
    );
  });
});
