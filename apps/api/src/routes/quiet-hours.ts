import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, inArray } from 'drizzle-orm';
import { parseLocalTime, type QuietHours } from '@kinhale/domain/quiet-hours';
import { userQuietHours } from '../db/schema.js';
import type { SessionJwtPayload } from '../plugins/jwt.js';
import type { DrizzleDb } from '../plugins/db.js';
import type { QuietHoursStore } from '../push/push-dispatch.js';

/**
 * Défaut retourné quand l'utilisateur n'a jamais configuré ses quiet hours.
 *
 * - `enabled: false` : pas de filtrage silencieux implicite (principe de
 *   moindre surprise — une nouvelle install ne devrait pas silencier par défaut).
 * - Plage `22:00 → 07:00` en UTC : valeurs d'amorce purement cosmétiques,
 *   l'UI permet à l'utilisateur de les ajuster au premier passage.
 *
 * Le timezone `"UTC"` n'est **pas** le défaut client (l'UI auto-détecte le
 * fuseau local via `Intl.DateTimeFormat().resolvedOptions().timeZone`) — il
 * sert uniquement de placeholder avant le premier PUT.
 */
const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  startLocalTime: '22:00',
  endLocalTime: '07:00',
  timezone: 'UTC',
};

/**
 * Valide une chaîne IANA via `Intl.DateTimeFormat`. Node 20 full ICU connaît
 * l'intégralité de la base tz officielle — on délègue pour ne pas maintenir
 * une liste en dur qui deviendrait obsolète.
 *
 * Note sécurité : cette validation protège contre des valeurs arbitraires
 * stockées en DB qui pourraient ensuite faire lever une exception dans le
 * dispatcher push (et donc empêcher l'envoi de notifs à d'autres aidants).
 */
function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Schéma Zod du body PUT. On valide strictement :
 * - `startLocalTime` et `endLocalTime` au format HH:mm (via `parseLocalTime`).
 * - `timezone` : string IANA reconnue par `Intl.DateTimeFormat`.
 *
 * `z.refine` plutôt que regex pure pour partager la sémantique avec le
 * domaine (`parseLocalTime`) et éviter une divergence silencieuse.
 */
const LocalTimeSchema = z.string().refine(
  (v) => {
    try {
      parseLocalTime(v);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'invalid_local_time' },
);

const TimezoneSchema = z
  .string()
  .transform((v) => v.trim())
  .pipe(z.string().min(1).refine(isValidTimeZone, { message: 'invalid_timezone' }));

const PutBody = z.object({
  enabled: z.boolean(),
  startLocalTime: LocalTimeSchema,
  endLocalTime: LocalTimeSchema,
  timezone: TimezoneSchema,
});

const quietHoursRoute: FastifyPluginAsync = async (app) => {
  /**
   * GET /me/quiet-hours
   *
   * Retourne la config quiet hours de l'aidant courant (selon le JWT). En
   * l'absence de ligne persistée, retourne {@link DEFAULT_QUIET_HOURS}.
   */
  app.get('/me/quiet-hours', { preHandler: [app.authenticate] }, async (request) => {
    const { sub: accountId } = request.user as SessionJwtPayload;

    const rows = await app.db
      .select({
        enabled: userQuietHours.enabled,
        startLocalTime: userQuietHours.startLocalTime,
        endLocalTime: userQuietHours.endLocalTime,
        timezone: userQuietHours.timezone,
      })
      .from(userQuietHours)
      .where(eq(userQuietHours.accountId, accountId));

    const row = rows[0];
    if (row === undefined) {
      return DEFAULT_QUIET_HOURS;
    }
    const response: QuietHours = {
      enabled: row.enabled,
      startLocalTime: row.startLocalTime,
      endLocalTime: row.endLocalTime,
      timezone: row.timezone,
    };
    return response;
  });

  /**
   * PUT /me/quiet-hours
   *
   * Upsert de la config pour l'aidant courant. Rejette 400 sur tout format
   * invalide (heure hors plage, timezone IANA inconnue). Aucune distinction
   * de type sanctuarisé ici : les quiet hours **ne désactivent pas** de
   * type — le filtrage se fait au moment du dispatch (voir
   * `push-dispatch.ts` + `isWithinQuietHours`).
   */
  app.put('/me/quiet-hours', { preHandler: [app.authenticate] }, async (request, reply) => {
    const parse = PutBody.safeParse(request.body);
    if (!parse.success) {
      return reply.status(400).send({ error: 'invalid_body' });
    }
    const { enabled, startLocalTime, endLocalTime, timezone } = parse.data;

    const { sub: accountId } = request.user as SessionJwtPayload;

    await app.db
      .insert(userQuietHours)
      .values({ accountId, enabled, startLocalTime, endLocalTime, timezone })
      .onConflictDoUpdate({
        target: [userQuietHours.accountId],
        set: { enabled, startLocalTime, endLocalTime, timezone, updatedAt: new Date() },
      });

    return reply.status(204).send();
  });
};

export default quietHoursRoute;

/**
 * Store quiet hours exposé au dispatcher push (injecté par la route push).
 *
 * Contrat : rend une `Map<accountId, QuietHours>` pour un lot d'accountIds.
 * Les comptes **absents** sont considérés comme n'ayant pas de config
 * (équivalent à `enabled: false`) — le dispatcher n'applique aucun
 * filtrage silencieux.
 */
export function createDrizzleQuietHoursStore(db: DrizzleDb): QuietHoursStore {
  return {
    async findQuietHoursByAccount(accountIds) {
      if (accountIds.length === 0) return new Map();
      const rows = await db
        .select({
          accountId: userQuietHours.accountId,
          enabled: userQuietHours.enabled,
          startLocalTime: userQuietHours.startLocalTime,
          endLocalTime: userQuietHours.endLocalTime,
          timezone: userQuietHours.timezone,
        })
        .from(userQuietHours)
        .where(inArray(userQuietHours.accountId, [...accountIds]));
      const map = new Map<string, QuietHours>();
      for (const r of rows) {
        map.set(r.accountId, {
          enabled: r.enabled,
          startLocalTime: r.startLocalTime,
          endLocalTime: r.endLocalTime,
          timezone: r.timezone,
        });
      }
      return map;
    },
  };
}
