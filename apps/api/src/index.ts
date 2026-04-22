import { parseEnv } from './env.js';
import { buildApp } from './app.js';

const env = parseEnv();
const app = buildApp(env);

try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  app.log.info(`Kinhale API démarrée sur http://0.0.0.0:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
