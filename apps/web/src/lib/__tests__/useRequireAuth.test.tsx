import { renderHook, act } from '@testing-library/react';
import { useRequireAuth } from '../useRequireAuth';

const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

let mockToken: string | null = null;
jest.mock('../../stores/auth-store', () => ({
  useAuthStore: (selector: (state: { accessToken: string | null }) => unknown) =>
    selector({ accessToken: mockToken }),
}));

describe('useRequireAuth', () => {
  jest.setTimeout(15000);

  beforeEach(() => {
    mockReplace.mockClear();
    mockToken = null;
  });

  it('redirige vers /auth si non authentifié (token null)', async () => {
    mockToken = null;
    await act(async () => {
      renderHook(() => useRequireAuth());
      await Promise.resolve();
    });
    expect(mockReplace).toHaveBeenCalledWith('/auth');
  });

  it('redirige vers /auth si token vide', async () => {
    mockToken = '';
    await act(async () => {
      renderHook(() => useRequireAuth());
      await Promise.resolve();
    });
    expect(mockReplace).toHaveBeenCalledWith('/auth');
  });

  it('ne redirige pas si authentifié', async () => {
    mockToken = 'valid-token';
    await act(async () => {
      renderHook(() => useRequireAuth());
      await Promise.resolve();
    });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('retourne false si non authentifié', () => {
    mockToken = null;
    const { result } = renderHook(() => useRequireAuth());
    expect(result.current).toBe(false);
  });

  it('retourne true si authentifié', () => {
    mockToken = 'valid-token';
    const { result } = renderHook(() => useRequireAuth());
    expect(result.current).toBe(true);
  });
});
