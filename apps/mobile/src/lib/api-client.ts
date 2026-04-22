const API_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface FetchOptions extends RequestInit {
  token?: string;
}

export async function apiFetch<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...rest } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token !== undefined ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...rest, headers });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({ message: res.statusText }))) as {
      message?: string;
    };
    throw new ApiError(res.status, body.message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

/**
 * Convenience HTTP client wrapping apiFetch.
 * Designed for use in hooks that don't have direct access to an auth token.
 * Token injection is handled at the apiFetch level via options.
 */
export const apiClient = {
  post<T = unknown>(path: string, body: unknown, options: FetchOptions = {}): Promise<T> {
    return apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), ...options });
  },
  delete<T = unknown>(path: string, options: FetchOptions = {}): Promise<T> {
    return apiFetch<T>(path, { method: 'DELETE', ...options });
  },
};
