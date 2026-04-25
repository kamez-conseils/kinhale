/**
 * @jest-environment jsdom
 */
import {
  getDeletionStatus,
  postDeletionRequest,
  postDeletionConfirm,
  postDeletionCancel,
} from '../client';
import { useAuthStore } from '../../../stores/auth-store';
import { ApiError } from '../../api-client';

describe('account-deletion client', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
    useAuthStore.setState({
      accessToken: 'test-token',
      deviceId: 'dev-1',
      householdId: 'hh-1',
    });
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  describe('getDeletionStatus', () => {
    it('GET /me/account/deletion-status avec Bearer', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'active', scheduledAtMs: null }),
      });
      const r = await getDeletionStatus();
      expect(r.status).toBe('active');
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/me/account/deletion-status');
      expect(init.method).toBe('GET');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    });
  });

  describe('postDeletionRequest', () => {
    it('POST /me/account/deletion-request avec body strict', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 202, json: async () => ({ ok: true }) });
      await postDeletionRequest({ confirmationWord: 'SUPPRIMER', email: 'a@b.com' });
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/me/account/deletion-request');
      expect(init.method).toBe('POST');
      expect(init.body).toBe(JSON.stringify({ confirmationWord: 'SUPPRIMER', email: 'a@b.com' }));
    });

    it('relève ApiError sur 409 already_pending', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'already_pending' }),
      });
      await expect(
        postDeletionRequest({ confirmationWord: 'SUPPRIMER', email: 'a@b.com' }),
      ).rejects.toBeInstanceOf(ApiError);
    });
  });

  describe('postDeletionConfirm', () => {
    it('POST /me/account/deletion-confirm SANS Bearer (token-based)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ok: true, scheduledAtMs: 1234 }),
      });
      const r = await postDeletionConfirm('a'.repeat(64));
      expect(r.ok).toBe(true);
      expect(r.scheduledAtMs).toBe(1234);
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      // Aucune Authorization header — pattern step-up
      expect((init.headers as Record<string, string>)['Authorization']).toBeUndefined();
    });
  });

  describe('postDeletionCancel', () => {
    it('POST /me/account/deletion-cancel avec Bearer', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
      await postDeletionCancel();
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/me/account/deletion-cancel');
      expect(init.method).toBe('POST');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    });

    it('relève ApiError sur 410 grace_period_expired', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 410,
        json: async () => ({ error: 'grace_period_expired' }),
      });
      await expect(postDeletionCancel()).rejects.toMatchObject({ status: 410 });
    });
  });
});
