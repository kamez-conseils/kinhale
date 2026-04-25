import { parseEnv } from './env.js';
import { buildApp } from './app.js';
import { startAccountPurgeWorker } from './workers/account-purge.js';

const env = parseEnv();
const app = buildApp(env);

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Kinhale API démarrée sur http://0.0.0.0:${env.PORT}`);

  // Worker de purge des comptes en `pending_deletion` (KIN-086, E9-S03).
  // Désactivable via `DISABLE_PURGE_WORKER=1` (utilisé en CI / staging
  // partagé).
  if (env.NODE_ENV !== 'test' && process.env['DISABLE_PURGE_WORKER'] !== '1') {
    startAccountPurgeWorker(app);
    app.log.info(
      { event: 'account_purge_worker.started' },
      'Worker de purge des comptes démarré (intervalle 1 h)',
    );
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
