import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startAccountPurgeWorker, DEFAULT_PURGE_INTERVAL_MS } from '../account-purge.js';
import type { FastifyInstance } from 'fastify';

/**
 * Worker tests — on évite toute connexion DB / Redis. Le worker reçoit
 * une instance Fastify minimale (`db`, `env.JWT_SECRET`, `log`). On
 * mock `runPurge` indirectement via `app.db` qui retourne 0 résultat.
 */
function makeFakeApp(): FastifyInstance & {
  _logs: { info: object[]; error: object[] };
} {
  const logs = { info: [] as object[], error: [] as object[] };
  return {
    db: {
      // Notre `findAccountsDueForPurge` appelle `db.select().from().where()`
      // — on retourne toujours [] pour simuler "rien à faire".
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      }),
    },
    env: { JWT_SECRET: 'test-pepper-32-characters-min-aaa' },
    log: {
      info: (obj: object) => logs.info.push(obj),
      error: (obj: object) => logs.error.push(obj),
    },
    _logs: logs,
  } as unknown as FastifyInstance & { _logs: { info: object[]; error: object[] } };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('startAccountPurgeWorker', () => {
  it('renvoie un handle stoppable', () => {
    const app = makeFakeApp();
    const handle = startAccountPurgeWorker(app, { intervalMs: 1000 });
    expect(handle.stop).toBeDefined();
    handle.stop();
  });

  it('exécute un premier tick si runOnStart=true', async () => {
    const app = makeFakeApp();
    const handle = startAccountPurgeWorker(app, { runOnStart: true, intervalMs: 60_000 });
    // Stop immédiat avant d'avancer les timers — on veut juste vérifier
    // que le tick initial s'exécute proprement (sans attendre le suivant).
    handle.stop();
    // Laisse une microtask passer pour le `void tick()` initial
    await Promise.resolve();
    await Promise.resolve();
    expect(app._logs.error).toHaveLength(0);
  });

  it("n'exécute pas de tick si runOnStart=false (par défaut)", async () => {
    const app = makeFakeApp();
    const handle = startAccountPurgeWorker(app, { intervalMs: 60_000 });
    // Pas d'avancée du temps — aucun tick
    handle.stop();
    expect(app._logs.info).toHaveLength(0);
  });

  it('configure un setInterval avec le bon intervalMs', () => {
    const app = makeFakeApp();
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const handle = startAccountPurgeWorker(app, { intervalMs: 5000 });
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    handle.stop();
    setIntervalSpy.mockRestore();
  });

  it("utilise l'intervalle par défaut (1h) si non précisé", () => {
    const app = makeFakeApp();
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    const handle = startAccountPurgeWorker(app);
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), DEFAULT_PURGE_INTERVAL_MS);
    handle.stop();
    setIntervalSpy.mockRestore();
  });
});
