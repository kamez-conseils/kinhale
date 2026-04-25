import {
  getDeletionStatus,
  postDeletionRequest,
  postDeletionConfirm,
  postDeletionCancel,
  ApiError,
} from '../client';
import { useAuthStore } from '../../../stores/auth-store';

global.fetch = jest.fn();

describe('mobile account-deletion client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      accessToken: 'test-token',
      deviceId: 'dev-1',
      householdId: 'hh-1',
    });
  });

  it('GET /me/account/deletion-status avec Bearer', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ status: 'active', scheduledAtMs: null }),
    });
    const r = await getDeletionStatus();
    expect(r.status).toBe('active');
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/me/account/deletion-status');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
  });

  it('POST deletion-request envoie le body strict', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 202,
      json: async () => ({ ok: true }),
    });
    await postDeletionRequest({ confirmationWord: 'DELETE', email: 'a@b.com' });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ confirmationWord: 'DELETE', email: 'a@b.com' }));
  });

  it('POST deletion-confirm n envoie pas de Bearer', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, scheduledAtMs: 1234 }),
    });
    await postDeletionConfirm('a'.repeat(64));
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
  });

  it('POST deletion-cancel relève ApiError sur 410', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 410,
      json: async () => ({ error: 'grace_period_expired' }),
    });
    await expect(postDeletionCancel()).rejects.toBeInstanceOf(ApiError);
  });
});
