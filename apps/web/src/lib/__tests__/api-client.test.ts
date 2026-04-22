import { apiFetch, ApiError } from '../api-client';

describe('apiFetch', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('envoie Content-Type application/json', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'ok' }),
    });
    await apiFetch('/test');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
  });

  it('ajoute Authorization Bearer quand token fourni', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    await apiFetch('/auth/test', { token: 'tok123' });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
      }),
    );
  });

  it("n'ajoute pas Authorization sans token", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    await apiFetch('/test');
    const call = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    const headers = call[1].headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('lève ApiError avec le status HTTP sur réponse non-ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Token invalide' }),
    });
    await expect(apiFetch('/test')).rejects.toBeInstanceOf(ApiError);
    await expect(apiFetch('/test')).rejects.toMatchObject({ status: 401 });
  });

  it('retourne le JSON parsé sur succès', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: 'jwt-abc' }),
    });
    const result = await apiFetch<{ accessToken: string }>('/auth/verify');
    expect(result.accessToken).toBe('jwt-abc');
  });
});
