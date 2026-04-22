jest.mock('expo-notifications');
jest.mock('expo-device');

describe('requestPushPermission', () => {
  beforeEach(() => {
    jest.resetModules();
    // Re-apply mocks after resetModules
    jest.mock('expo-notifications');
    jest.mock('expo-device');
  });

  it('retourne le token si permission accordée', async () => {
    const { requestPushPermission } = require('../lib/notifications') as typeof import('../lib/notifications');
    const token = await requestPushPermission();
    expect(token).toBe('ExponentPushToken[test-token-mock]');
  });

  it('retourne null si permission refusée', async () => {
    const mockNotif = jest.requireMock('expo-notifications') as {
      getPermissionsAsync: jest.Mock;
      requestPermissionsAsync: jest.Mock;
    };
    mockNotif.getPermissionsAsync.mockResolvedValue({ status: 'denied' });
    mockNotif.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const { requestPushPermission } = require('../lib/notifications') as typeof import('../lib/notifications');
    const token = await requestPushPermission();
    expect(token).toBeNull();
  });

  it('retourne null sur simulateur (isDevice = false)', async () => {
    jest.doMock('expo-device', () => ({ isDevice: false }));
    const { requestPushPermission } = require('../lib/notifications') as typeof import('../lib/notifications');
    const token = await requestPushPermission();
    expect(token).toBeNull();
  });
});
