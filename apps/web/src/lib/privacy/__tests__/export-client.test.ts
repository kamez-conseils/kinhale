/**
 * @jest-environment jsdom
 */
import { getPrivacyExportMetadata, postPrivacyExportAudit } from '../export-client';
import { useAuthStore } from '../../../stores/auth-store';
import { ApiError } from '../../api-client';

describe('getPrivacyExportMetadata', () => {
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

  it('émet GET /me/privacy/export/metadata avec Authorization Bearer', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        accountId: 'acc-1',
        exportedAtMs: 123,
        devices: [],
        auditEvents: [],
        notificationPreferences: [],
        quietHours: null,
        pushTokensCount: 0,
      }),
    });
    const md = await getPrivacyExportMetadata();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/me/privacy/export/metadata');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    expect(md.accountId).toBe('acc-1');
  });

  it('relève une ApiError sur 401', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'unauthorized' }),
    });
    await expect(getPrivacyExportMetadata()).rejects.toBeInstanceOf(ApiError);
  });

  it('relève une ApiError sur 429 (rate-limit)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'rate_limited' }),
    });
    await expect(getPrivacyExportMetadata()).rejects.toMatchObject({
      status: 429,
    });
  });
});

describe('postPrivacyExportAudit', () => {
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

  it('émet POST /audit/privacy-export avec un body strictement minimal', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ ok: true }),
    });
    await postPrivacyExportAudit({
      archiveHash: 'a'.repeat(64),
      generatedAtMs: 1_700_000_000_000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/audit/privacy-export');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({
      archiveHash: 'a'.repeat(64),
      generatedAtMs: 1_700_000_000_000,
    });
    // Aucun champ santé
    expect(Object.keys(body)).toEqual(['archiveHash', 'generatedAtMs']);
  });

  it('ne contient JAMAIS de donnée santé dans le body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ ok: true }),
    });
    await postPrivacyExportAudit({
      archiveHash: 'b'.repeat(64),
      generatedAtMs: 1_700_000_000_000,
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const bodyStr = init.body as string;
    const forbidden = ['childName', 'pumpName', 'symptom', 'firstName', 'birthYear'];
    for (const w of forbidden) {
      expect(bodyStr).not.toContain(w);
    }
  });

  it('relève une ApiError sur 4xx', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'invalid_body' }),
    });
    await expect(
      postPrivacyExportAudit({
        archiveHash: 'a'.repeat(64),
        generatedAtMs: 1,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
