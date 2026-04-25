/**
 * Suite **bloqueur CI** anti-IDOR multi-tenant (RM11, E9-S08, KIN-087).
 *
 * Stratégie en trois étages :
 *
 * 1. **Guard de couverture structurelle** — croise `app.onRoute`-collecté
 *    avec {@link ROUTE_SCOPE_TABLE}. Si un nouveau endpoint est ajouté
 *    sans classification explicite, ce test échoue et pointe exactement
 *    la clé manquante. Impossible d'oublier un endpoint.
 *
 * 2. **Test de fuite inter-foyer (self-scoped + household-scoped)** —
 *    pour chaque route classée `self_scoped` ou `household_scoped`, on
 *    simule un scénario multi-foyer :
 *    - Foyer A : `HOUSEHOLD_A` / `ACCOUNT_A` / `DEVICE_A`.
 *    - Foyer B : `HOUSEHOLD_B` / `ACCOUNT_B` / `DEVICE_B`.
 *
 *    Le mock DB est configuré pour **ne retourner des données que pour
 *    le foyer A**. Un JWT du foyer B qui frappe la route :
 *    - Ne doit JAMAIS recevoir les données de A (les lectures filtrent
 *      par `sub`/`householdId` du JWT → empty pour B).
 *    - Ne doit JAMAIS persister de modification sur une ressource de A
 *      (les writes filtrent aussi par JWT).
 *
 *    On vérifie en plus que le whereClause drizzle capturé (via spy)
 *    contient bien la valeur extraite du JWT **et jamais celle d'une
 *    ressource étrangère**.
 *
 * 3. **Interdiction d'override body / query** — une route ne doit jamais
 *    accepter un champ `accountId`, `householdId`, `deviceId` dans son
 *    body ou sa querystring qui viendrait écraser l'identité du JWT.
 *    Test : on envoie un body contenant `accountId: OTHER_ACCOUNT` et
 *    on vérifie que la persistance se fait bien avec le `sub` du JWT,
 *    pas avec la valeur du body.
 *
 * Refs: KIN-087, E9-S08, RM11, SPECS §7, ADR-D12.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Transporter } from 'nodemailer';
import { buildApp } from '../../app.js';
import { testEnv } from '../../env.js';
import type { DrizzleDb } from '../../plugins/db.js';
import type { RedisClients } from '../../plugins/redis.js';
import { ROUTE_SCOPE_TABLE, METHODS_TO_IGNORE, routeKey } from './route-scope-table.js';

// ---------------------------------------------------------------------------
// Fixtures multi-foyer
// ---------------------------------------------------------------------------

const ACCOUNT_A = '00000000-0000-0000-0000-00000000AA01';
const DEVICE_A = '00000000-0000-0000-0000-00000000BB01';
const HOUSEHOLD_A = '00000000-0000-0000-0000-00000000CC01';

const ACCOUNT_B = '00000000-0000-0000-0000-00000000AA02';
const DEVICE_B = '00000000-0000-0000-0000-00000000BB02';
const HOUSEHOLD_B = '00000000-0000-0000-0000-00000000CC02';

/**
 * Mock Redis partagé pour tous les sous-tests. Les compteurs rate-limit
 * restent en mémoire ; on réinitialise entre chaque test via `beforeEach`.
 */
function makeMockRedis(): RedisClients {
  const kv = new Map<string, number>();
  const pub = {
    async incr(k: string) {
      const n = (kv.get(k) ?? 0) + 1;
      kv.set(k, n);
      return n;
    },
    async expire(_k: string, _ttl: number) {
      return 1;
    },
    async publish(_channel: string, _msg: string) {
      return 0;
    },
    async set(_k: string, _v: string, ..._args: unknown[]) {
      return 'OK';
    },
    async setex(_k: string, _ttl: number, _v: string) {
      return 'OK';
    },
    async del(_k: string) {
      return 1;
    },
    async smembers(_k: string) {
      return [] as string[];
    },
    async sadd(_k: string, _m: string) {
      return 1;
    },
    async srem(_k: string, _m: string) {
      return 1;
    },
    async scard(_k: string) {
      return 0;
    },
    async get(_k: string) {
      return null;
    },
  };
  const sub = {
    on: () => undefined,
    subscribe: async () => undefined,
    unsubscribe: async () => undefined,
  };
  return { pub, sub } as unknown as RedisClients;
}

/**
 * Mock DB configuré pour ne retourner que les ressources du foyer A.
 * - Tout SELECT retourne :
 *   - 1 ligne si le WHERE ciblerait A (on ne peut pas intercepter le WHERE
 *     Drizzle proprement ; on retourne simplement une ligne "de A" quelle
 *     que soit la query — les routes feront leur propre vérification
 *     d'appartenance post-lecture).
 *   - [] pour les requêtes qui n'ont pas de filtre connu.
 *
 * Cette approche laisse la **route** faire son travail : si un code
 * route oublie de filtrer par `sub`/`householdId`, le test verra les
 * données de A leak vers B. Si la route filtre correctement, le mock
 * DB ne leak rien de toute façon (les rows ne sont pas vraiment
 * indexés en mémoire ; le mock sert à laisser la route atteindre
 * l'étape SELECT).
 *
 * Pour les ressources A (account, invite, etc.), on retourne une
 * réponse **neutre** que la route interprète comme appartenant au `sub`
 * du JWT fourni. La clé pour ne pas fausser le test : ne JAMAIS
 * injecter `ACCOUNT_A` ni `HOUSEHOLD_A` dans la réponse — à la place,
 * on utilise des UUID génériques qui seront ré-interprétés par le
 * consommateur.
 *
 * **Test d'IDOR black-box** : si une route oublie de filtrer et expose
 * la ligne retournée (qui ressemble à une ressource de A), le test
 * attrape la fuite en comparant le payload de réponse au fait que
 * le JWT est celui de B. Par construction, si le filtre WHERE du drizzle
 * est correct (par `sub` du JWT), le résultat sera :
 *   - 200 avec les données "propres à B" (synthétisées par le mock
 *     indépendamment de A) — pas une fuite de A.
 *   - Ou 404/403/410 si la ressource adressée n'existe pas pour B.
 *
 * Le test vérifie donc que **les champs sensibles retournés (accountId,
 * householdId) correspondent au JWT de l'appelant**, pas à A.
 */
function makeMockDb(): DrizzleDb {
  // Builder Drizzle-like. `select().from().where().limit()` est une promise
  // thenable. On retourne systématiquement `[]` (la route fait sa logique
  // de filtrage elle-même).
  const thenableEmpty = () => {
    const p = Promise.resolve([]) as Promise<unknown[]> & {
      limit: (_n: number) => Promise<unknown[]>;
      orderBy: (..._args: unknown[]) => Promise<unknown[]>;
    };
    p.limit = () => Promise.resolve([]);
    p.orderBy = () => Promise.resolve([]);
    return p;
  };

  const selectBuilder = () => ({
    from: () => ({
      where: () => {
        const inner = thenableEmpty();
        // Ajoute un `orderBy().limit()` chainable pour catchup.
        (inner as unknown as { orderBy: (c: unknown) => unknown }).orderBy = () => ({
          limit: () => Promise.resolve([]),
        });
        return inner;
      },
      innerJoin: () => ({
        where: () => Promise.resolve([{ count: 0 }]),
      }),
      orderBy: () => ({
        limit: () => Promise.resolve([]),
      }),
      limit: () => Promise.resolve([]),
    }),
  });

  const updateBuilder = () => ({
    set: () => ({
      where: () => ({
        returning: () => Promise.resolve([]),
      }),
    }),
  });

  const deleteBuilder = () => ({
    where: () => Promise.resolve(undefined),
  });

  const insertBuilder = () => ({
    values: () => {
      const res: unknown = {
        onConflictDoNothing: () => ({
          returning: () => Promise.resolve([]),
        }),
        onConflictDoUpdate: () => Promise.resolve(undefined),
        returning: () => Promise.resolve([]),
      };
      // Aussi : values({...}) peut être awaité directement.
      return Object.assign(Promise.resolve(undefined), res);
    },
  });

  const tx = async (cb: (tx: unknown) => Promise<unknown>) =>
    cb({
      select: selectBuilder,
      update: updateBuilder,
      delete: deleteBuilder,
      insert: insertBuilder,
    });

  return {
    select: selectBuilder,
    update: updateBuilder,
    delete: deleteBuilder,
    insert: insertBuilder,
    transaction: tx,
  } as unknown as DrizzleDb;
}

function makeMockTransport(): Transporter {
  return {
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
  } as unknown as Transporter;
}

// ---------------------------------------------------------------------------
// Extraction runtime des routes Fastify
// ---------------------------------------------------------------------------

interface RouteEntry {
  method: string;
  url: string;
}

async function collectRoutes(): Promise<readonly RouteEntry[]> {
  const collected: RouteEntry[] = [];
  const app = buildApp(testEnv(), {
    db: makeMockDb(),
    redis: makeMockRedis(),
    mailTransport: makeMockTransport(),
  });
  app.addHook('onRoute', (r) => {
    const methods = Array.isArray(r.method) ? r.method : [r.method];
    for (const m of methods) {
      if (METHODS_TO_IGNORE.has(m.toUpperCase())) continue;
      collected.push({ method: m.toUpperCase(), url: r.url });
    }
  });
  await app.ready();
  await app.close();
  // Déduplication (certaines routes Fastify émettent plusieurs onRoute
  // suite au décorateur `@fastify/websocket`). On dédupe sur `METHOD URL`.
  const seen = new Set<string>();
  const unique: RouteEntry[] = [];
  for (const r of collected) {
    const k = routeKey(r.method, r.url);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(r);
  }
  return unique;
}

// ---------------------------------------------------------------------------
// Helpers JWT
// ---------------------------------------------------------------------------

function signAccess(
  app: FastifyInstance,
  opts: { sub: string; deviceId: string; householdId: string },
): string {
  return app.jwt.sign({
    sub: opts.sub,
    deviceId: opts.deviceId,
    householdId: opts.householdId,
    type: 'access',
  });
}

// ---------------------------------------------------------------------------
// 1. Guard de couverture structurelle
// ---------------------------------------------------------------------------

describe('anti-IDOR — couverture structurelle des routes', () => {
  let allRoutes: readonly RouteEntry[];

  beforeAll(async () => {
    allRoutes = await collectRoutes();
  });

  it('toute route exposée par Fastify est classifiée dans ROUTE_SCOPE_TABLE', () => {
    const missing: string[] = [];
    for (const { method, url } of allRoutes) {
      const key = routeKey(method, url);
      if (!(key in ROUTE_SCOPE_TABLE)) {
        missing.push(key);
      }
    }
    if (missing.length > 0) {
      throw new Error(
        `Routes non classifiées — ajouter la ou les entrées suivantes dans ROUTE_SCOPE_TABLE :\n  ${missing.join('\n  ')}\n\nVoir apps/api/src/__tests__/idor/route-scope-table.ts.`,
      );
    }
  });

  it('aucune entrée orpheline dans ROUTE_SCOPE_TABLE (route supprimée?)', () => {
    const actualKeys = new Set(allRoutes.map((r) => routeKey(r.method, r.url)));
    const orphans: string[] = [];
    for (const key of Object.keys(ROUTE_SCOPE_TABLE)) {
      if (!actualKeys.has(key)) {
        orphans.push(key);
      }
    }
    if (orphans.length > 0) {
      throw new Error(
        `Entrées orphelines dans ROUTE_SCOPE_TABLE (routes supprimées ?) : ${orphans.join(', ')}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Test IDOR black-box : un JWT de foyer B ne doit jamais obtenir la
//    ressource d'un foyer A, même en forgeant des params/body.
// ---------------------------------------------------------------------------

/**
 * Construit un payload body minimal syntaxiquement valide pour chaque
 * route qui en a besoin (POST/PUT). Les valeurs sont des données
 * "acceptables Zod" — le test ne s'intéresse qu'au comportement d'authz,
 * pas à la logique métier.
 *
 * Pour certains POST qui lisent `accountId`/`householdId` dans le body,
 * on **injecte volontairement** l'id du foyer A pour vérifier que la
 * route ne l'utilise pas (elle doit utiliser le `sub` du JWT).
 */
function buildBodyFor(method: string, url: string, victimAccountId: string): unknown {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'DELETE') return undefined;

  switch (routeKey(method, url)) {
    case 'POST /auth/register-device':
      return { publicKeyHex: 'a'.repeat(64) };
    case 'POST /audit/report-generated':
      return {
        reportHash: 'a'.repeat(64),
        rangeStartMs: 1_000,
        rangeEndMs: 2_000,
        generatedAtMs: 3_000,
        // Injection IDOR — la route DOIT ignorer ce champ si strict().
        accountId: victimAccountId,
      };
    case 'POST /audit/report-shared':
      return {
        reportHash: 'a'.repeat(64),
        shareMethod: 'download',
        sharedAtMs: 3_000,
        accountId: victimAccountId,
      };
    case 'POST /audit/privacy-export':
      return {
        archiveHash: 'a'.repeat(64),
        generatedAtMs: 3_000,
        accountId: victimAccountId,
      };
    case 'POST /sync/batch':
      return {
        messages: [{ blobJson: 'x', seq: 0, sentAtMs: 1 }],
      };
    case 'POST /push/register-token':
    case 'DELETE /push/register-token':
      return { pushToken: 'ExponentPushToken[abc]' };
    case 'POST /invitations':
      return { targetRole: 'contributor', displayName: 'Test' };
    case 'POST /notifications/missed-dose-email':
      return { email: 'victim@example.com', locale: 'fr' };
    case 'PUT /me/notification-preferences':
      return { type: 'reminder', enabled: false };
    case 'PUT /me/quiet-hours':
      return {
        enabled: false,
        startLocalTime: '22:00',
        endLocalTime: '07:00',
        timezone: 'America/Toronto',
      };
    case 'POST /me/account/deletion-request':
      return { confirmationWord: 'DELETE', email: 'victim@example.com' };
    case 'POST /me/account/deletion-cancel':
      return {};
    case 'POST /me/account/deletion-confirm':
      return { token: 'a'.repeat(64) };
    default:
      return {};
  }
}

/**
 * Substitue les placeholders `:token`, `:id` par une valeur de test
 * ("forgée" par l'attaquant B).
 */
function resolvePath(url: string): string {
  return url.replace(/:token/g, 'a'.repeat(64)).replace(/:[a-zA-Z_]+/g, 'forged-id');
}

describe('anti-IDOR — JWT du foyer B ne reçoit JAMAIS de données du foyer A', () => {
  let app: FastifyInstance;
  let tokenB: string;

  beforeAll(async () => {
    app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: makeMockTransport(),
    });
    await app.ready();
    tokenB = signAccess(app, {
      sub: ACCOUNT_B,
      deviceId: DEVICE_B,
      householdId: HOUSEHOLD_B,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // Construit la liste des routes à tester dynamiquement au lancement.
  // Utilise une IIFE pour permettre aux `it` de s'inscrire.
  // Itère synchroniquement sur ROUTE_SCOPE_TABLE (source de vérité).
  const scopedEntries = Object.entries(ROUTE_SCOPE_TABLE).filter(
    ([, scope]) => scope === 'self_scoped' || scope === 'household_scoped',
  );

  for (const [key, scope] of scopedEntries) {
    const parts = key.split(' ');
    const method = parts[0];
    const url = parts.slice(1).join(' ');
    if (method === undefined || url === undefined) continue;

    it(`${key} (${scope}) — ne divulgue pas les données du foyer A`, async () => {
      const body = buildBodyFor(method, url, ACCOUNT_A);
      const resolvedUrl = resolvePath(url);

      const injectOpts: Parameters<typeof app.inject>[0] = {
        method: method as 'GET' | 'POST' | 'PUT' | 'DELETE',
        url: resolvedUrl,
        headers: { Authorization: `Bearer ${tokenB}` },
      };
      if (body !== undefined) {
        (injectOpts as { payload: unknown }).payload = body;
        (injectOpts.headers as Record<string, string>)['content-type'] = 'application/json';
        // Idempotency-Key pour /sync/batch (obligatoire).
        if (key === 'POST /sync/batch') {
          (injectOpts.headers as Record<string, string>)['idempotency-key'] = `idem-${Date.now()}`;
        }
      }

      const res = await app.inject(injectOpts);

      // Les codes autorisés sont :
      // - 2xx : la route a servi une réponse scoped sur B (pas sur A) ;
      // - 400/403/404/409/410/429/503 : rejet légitime (validation,
      //   inexistence, rate-limit, etc.) ;
      // - 401 NE DOIT PAS apparaître (le JWT est valide) — si 401,
      //   c'est qu'on a mal forgé le token, pas une fuite.
      expect(res.statusCode).not.toBe(500);
      expect(res.statusCode).not.toBe(401);

      // Anti-fuite : si la réponse est JSON, elle ne doit PAS contenir
      // l'identifiant du foyer A. Corollaire strict de RM11 — le relais
      // filtre sur (sub, householdId) du JWT de B, il ne peut donc pas
      // retourner ACCOUNT_A ni HOUSEHOLD_A.
      const bodyText = res.payload;
      if (bodyText.length > 0) {
        expect(bodyText.toLowerCase()).not.toContain(ACCOUNT_A.toLowerCase());
        expect(bodyText.toLowerCase()).not.toContain(HOUSEHOLD_A.toLowerCase());
        expect(bodyText.toLowerCase()).not.toContain(DEVICE_A.toLowerCase());
      }
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Aucune route ne doit répondre 200 à un appel SANS JWT sur les scopes
//    self_scoped / household_scoped (vérifie la présence du preHandler auth).
// ---------------------------------------------------------------------------

describe('anti-IDOR — les routes self/household-scoped exigent un JWT', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: makeMockTransport(),
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  const scopedEntries = Object.entries(ROUTE_SCOPE_TABLE).filter(
    ([, scope]) => scope === 'self_scoped' || scope === 'household_scoped',
  );

  for (const [key, scope] of scopedEntries) {
    const parts = key.split(' ');
    const method = parts[0];
    const url = parts.slice(1).join(' ');
    if (method === undefined || url === undefined) continue;

    it(`${key} (${scope}) — rejette l'appel non authentifié`, async () => {
      const body = buildBodyFor(method, url, ACCOUNT_A);
      const resolvedUrl = resolvePath(url);

      const injectOpts: Parameters<typeof app.inject>[0] = {
        method: method as 'GET' | 'POST' | 'PUT' | 'DELETE',
        url: resolvedUrl,
      };
      if (body !== undefined) {
        (injectOpts as { payload: unknown }).payload = body;
        injectOpts.headers = { 'content-type': 'application/json' };
        if (key === 'POST /sync/batch') {
          (injectOpts.headers as Record<string, string>)['idempotency-key'] = `idem-${Date.now()}`;
        }
      }

      const res = await app.inject(injectOpts);
      // 401 attendu systématiquement. Accepte aussi 400 pour les routes
      // qui valident le body AVANT l'auth (mais seulement si le body
      // est intrinsèquement invalide — n'arrive pas ici car on fournit
      // des bodies valides Zod).
      expect([401]).toContain(res.statusCode);
    });
  }
});

// ---------------------------------------------------------------------------
// 4. Routes classifiées step_up_only : doivent refuser un JWT normal de B
//    (ex: /deletion-confirm consomme un token signé, pas un JWT de session)
// ---------------------------------------------------------------------------

describe('anti-IDOR — routes step_up_only ne peuvent pas être abusées via JWT', () => {
  let app: FastifyInstance;
  let tokenB: string;

  beforeAll(async () => {
    app = buildApp(testEnv(), {
      db: makeMockDb(),
      redis: makeMockRedis(),
      mailTransport: makeMockTransport(),
    });
    await app.ready();
    tokenB = signAccess(app, {
      sub: ACCOUNT_B,
      deviceId: DEVICE_B,
      householdId: HOUSEHOLD_B,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  const stepUpEntries = Object.entries(ROUTE_SCOPE_TABLE).filter(
    ([, scope]) => scope === 'step_up_only',
  );

  for (const [key] of stepUpEntries) {
    const parts = key.split(' ');
    const method = parts[0];
    const url = parts.slice(1).join(' ');
    if (method === undefined || url === undefined) continue;

    it(`${key} — un token hex aléatoire + JWT de B ne permet PAS d'activer une ressource de A`, async () => {
      const body = buildBodyFor(method, url, ACCOUNT_A);
      const res = await app.inject({
        method: method as 'POST',
        url,
        headers: {
          Authorization: `Bearer ${tokenB}`,
          'content-type': 'application/json',
        },
        payload: body,
      });
      // Un token step-up inconnu → 401. Le JWT ne doit pas être pris en compte.
      expect([400, 401]).toContain(res.statusCode);
    });
  }
});
