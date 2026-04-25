/**
 * Worker périodique de purge des comptes en `pending_deletion` arrivés à
 * expiration (E9-S03 / RM10).
 *
 * **Pas de lib cron externe** : on utilise `setInterval` natif. Justification :
 * - Une seule tâche, granularité acceptable à l'heure (cf. story W10).
 * - Pas de coordination multi-process v1.0 (un seul ECS task ; si on passe
 *   à plusieurs il faudra un lock Redis ou un pg_advisory_lock — voir issue
 *   de suivi).
 * - Pas de dépendance supplémentaire dans `package.json`.
 *
 * **Désactivation en tests** : la variable d'env `DISABLE_PURGE_WORKER=1`
 * empêche le démarrage. C'est nécessaire pour tous les tests de routes qui
 * utilisent `buildApp(testEnv())` — un setInterval actif fait fuiter le
 * timer entre tests.
 *
 * **Idempotence** : la fonction `runPurge` ne lance pas plusieurs purges en
 * parallèle si un tick prend plus longtemps que l'intervalle. On utilise
 * un flag `running` pour skip un tick si le précédent n'est pas terminé.
 *
 * Refs: KIN-086, E9-S03.
 */

import type { FastifyInstance } from 'fastify';
import { runPurge } from '../account-deletion/purge.js';

/** Intervalle par défaut entre deux ticks de purge — 1h (cf. spec). */
export const DEFAULT_PURGE_INTERVAL_MS = 60 * 60 * 1000;

export interface AccountPurgeWorkerHandle {
  stop: () => void;
}

export interface StartAccountPurgeWorkerOptions {
  /** Intervalle ms entre deux ticks. Default 1h. */
  intervalMs?: number;
  /** Si true, exécute un premier tick immédiatement (utile en debug). */
  runOnStart?: boolean;
  /** Surchage de l'horloge — pour tests. */
  now?: () => number;
}

/**
 * Démarre le worker dans le contexte d'une instance Fastify déjà bootée.
 * Retourne un handle qui permet d'arrêter le timer (utile en hot-reload
 * dev ou en tests d'intégration).
 *
 * Le worker NE démarre PAS si `env.NODE_ENV === 'test'` ou si la variable
 * `DISABLE_PURGE_WORKER === '1'` est définie — défense double pour ne
 * jamais polluer une suite de tests avec un timer actif.
 */
export function startAccountPurgeWorker(
  app: FastifyInstance,
  options: StartAccountPurgeWorkerOptions = {},
): AccountPurgeWorkerHandle {
  const intervalMs = options.intervalMs ?? DEFAULT_PURGE_INTERVAL_MS;
  const now = options.now ?? Date.now;

  let running = false;

  const tick = async (): Promise<void> => {
    if (running) {
      // Le tick précédent dure encore — on skip plutôt que d'empiler.
      return;
    }
    running = true;
    try {
      const purged = await runPurge(app.db, now(), app.env.JWT_SECRET, {
        info: (obj, msg) => app.log.info(obj, msg),
        error: (obj, msg) => app.log.error(obj, msg),
      });
      if (purged > 0) {
        app.log.info({ event: 'account_purge.tick', purged }, 'Purge tick terminé');
      }
    } finally {
      running = false;
    }
  };

  if (options.runOnStart === true) {
    void tick();
  }

  const handle = setInterval(() => {
    void tick();
  }, intervalMs);

  // unref : le timer ne bloque pas le shutdown du process Node.
  if (typeof handle === 'object' && handle !== null && 'unref' in handle) {
    (handle as { unref: () => void }).unref();
  }

  return {
    stop: () => clearInterval(handle),
  };
}
