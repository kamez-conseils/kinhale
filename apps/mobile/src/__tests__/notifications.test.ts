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
    const { requestPushPermission } =
      require('../lib/notifications') as typeof import('../lib/notifications');
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

    const { requestPushPermission } =
      require('../lib/notifications') as typeof import('../lib/notifications');
    const token = await requestPushPermission();
    expect(token).toBeNull();
  });

  it('retourne null sur simulateur (isDevice = false)', async () => {
    jest.doMock('expo-device', () => ({ isDevice: false }));
    const { requestPushPermission } =
      require('../lib/notifications') as typeof import('../lib/notifications');
    const token = await requestPushPermission();
    expect(token).toBeNull();
  });
});

describe('scheduleLocalNotification', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('expo-notifications');
    jest.mock('expo-device');
  });

  it('retourne un identifiant de notification', async () => {
    const { scheduleLocalNotification } =
      require('../lib/notifications') as typeof import('../lib/notifications');
    const id = await scheduleLocalNotification('Rappel pompe', 'Il est temps', 300);
    expect(id).toBe('notification-id-mock');
    const mockNotif = jest.requireMock('expo-notifications') as {
      scheduleNotificationAsync: jest.Mock;
    };
    expect(mockNotif.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: { title: 'Rappel pompe', body: 'Il est temps' },
        trigger: expect.objectContaining({ seconds: 300 }),
      }),
    );
  });
});

describe('cancelLocalNotification', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.mock('expo-notifications');
    jest.mock('expo-device');
  });

  it('annule une notification par identifiant', async () => {
    const { cancelLocalNotification } =
      require('../lib/notifications') as typeof import('../lib/notifications');
    await cancelLocalNotification('some-id');
    const mockNotif = jest.requireMock('expo-notifications') as {
      cancelScheduledNotificationAsync: jest.Mock;
    };
    expect(mockNotif.cancelScheduledNotificationAsync).toHaveBeenCalledWith('some-id');
  });
});
