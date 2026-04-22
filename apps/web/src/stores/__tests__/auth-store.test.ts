import { useAuthStore } from '../auth-store';

describe('auth-store', () => {
  beforeEach(() => {
    useAuthStore.setState({ accessToken: null, deviceId: null, householdId: null });
    localStorage.clear();
  });

  it('state initial : accessToken null', () => {
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('setAuth stocke token + deviceId + householdId', () => {
    useAuthStore.getState().setAuth('tok-1', 'dev-1', 'hh-1');
    const state = useAuthStore.getState();
    expect(state.accessToken).toBe('tok-1');
    expect(state.deviceId).toBe('dev-1');
    expect(state.householdId).toBe('hh-1');
  });

  it('clearAuth remet à null', () => {
    useAuthStore.getState().setAuth('tok-1', 'dev-1', 'hh-1');
    useAuthStore.getState().clearAuth();
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.deviceId).toBeNull();
    expect(state.householdId).toBeNull();
  });
});
