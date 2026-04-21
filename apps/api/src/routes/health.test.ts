import { describe, it, expect } from 'vitest';
import { buildApp } from '../app.js';
import { testEnv } from '../env.js';
import type { BuildAppOverrides } from '../app.js';

const mockDb = {} as BuildAppOverrides['db'];

describe('GET /health', () => {
  it('retourne 200 avec status ok', async () => {
    const app = buildApp(testEnv(), { db: mockDb });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json<{ status: string }>().status).toBe('ok');
    await app.close();
  });

  it('retourne version et timestamp', async () => {
    const app = buildApp(testEnv(), { db: mockDb });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/health' });
    const body = res.json<{ status: string; version: string; timestamp: string }>();
    expect(body.version).toBe('0.1.0');
    expect(new Date(body.timestamp).getTime()).toBeGreaterThan(0);
    await app.close();
  });

  it('retourne 404 sur une route inconnue', async () => {
    const app = buildApp(testEnv(), { db: mockDb });
    await app.ready();
    const res = await app.inject({ method: 'GET', url: '/not-found' });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});
