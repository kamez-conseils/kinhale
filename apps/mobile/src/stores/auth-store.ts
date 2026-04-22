import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    {
      name: 'kinhale-auth',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
