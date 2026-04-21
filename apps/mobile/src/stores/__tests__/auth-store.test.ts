import AsyncStorage from '@react-native-async-storage/async-storage';

describe('useAuthStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.resetModules();
  });

  it('starts with null values', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../auth-store') as typeof import('../auth-store');
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.deviceId).toBeNull();
    expect(state.householdId).toBeNull();
  });

  it('setAuth updates all fields', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../auth-store') as typeof import('../auth-store');
    useAuthStore.getState().setAuth('tok', 'dev-1', 'hh-1');
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('tok');
    expect(state.deviceId).toBe('dev-1');
    expect(state.householdId).toBe('hh-1');
  });

  it('clearAuth resets to null', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { useAuthStore } = require('../auth-store') as typeof import('../auth-store');
    useAuthStore.getState().setAuth('tok', 'dev-1', 'hh-1');
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });
});
