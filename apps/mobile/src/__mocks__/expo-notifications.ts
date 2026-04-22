export const getPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const requestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const getExpoPushTokenAsync = jest.fn().mockResolvedValue({
  data: 'ExponentPushToken[test-token-mock]',
});
export const addNotificationReceivedListener = jest.fn().mockReturnValue({ remove: jest.fn() });
export const addNotificationResponseReceivedListener = jest.fn().mockReturnValue({ remove: jest.fn() });
export const scheduleNotificationAsync = jest.fn().mockResolvedValue('notification-id-mock');
export const cancelScheduledNotificationAsync = jest.fn().mockResolvedValue(undefined);
export const setNotificationHandler = jest.fn();

export const AndroidImportance = { MAX: 5 };

export function __resetMocks(): void {
  jest.clearAllMocks();
  getPermissionsAsync.mockResolvedValue({ status: 'granted' });
  requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[test-token-mock]' });
}
