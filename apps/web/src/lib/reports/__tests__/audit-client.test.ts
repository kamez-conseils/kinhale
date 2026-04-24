/**
 * @jest-environment jsdom
 */
import { postReportGeneratedAudit } from '../audit-client';
import { useAuthStore } from '../../../stores/auth-store';
import { ApiError } from '../../api-client';

describe('postReportGeneratedAudit', () => {
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

  it('émet POST /audit/report-generated avec les bons headers et body', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ ok: true }),
    });
    await postReportGeneratedAudit({
      reportHash: 'a'.repeat(64),
      rangeStartMs: 1,
      rangeEndMs: 2,
      generatedAtMs: 3,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/audit/report-generated');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-token');
    expect(JSON.parse(init.body as string)).toEqual({
      reportHash: 'a'.repeat(64),
      rangeStartMs: 1,
      rangeEndMs: 2,
      generatedAtMs: 3,
    });
  });

  it('relève une ApiError si le backend répond avec un 4xx', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: 'rate_limited' }),
    });
    await expect(
      postReportGeneratedAudit({
        reportHash: 'a'.repeat(64),
        rangeStartMs: 1,
        rangeEndMs: 2,
        generatedAtMs: 3,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("n'expose aucun autre champ que ceux whitelistés (zero-knowledge)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ ok: true }),
    });
    await postReportGeneratedAudit({
      reportHash: 'b'.repeat(64),
      rangeStartMs: 10,
      rangeEndMs: 20,
      generatedAtMs: 30,
    });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      'generatedAtMs',
      'rangeEndMs',
      'rangeStartMs',
      'reportHash',
    ]);
  });
});
