import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  deviceId: string | null;
  householdId: string | null;
  setAuth: (token: string, deviceId: string, householdId: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      deviceId: null,
      householdId: null,
      setAuth: (token, deviceId, householdId) => set({ accessToken: token, deviceId, householdId }),
      clearAuth: () => set({ accessToken: null, deviceId: null, householdId: null }),
    }),
    { name: 'kinhale-auth' },
  ),
);
