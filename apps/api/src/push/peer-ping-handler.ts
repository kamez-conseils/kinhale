import { and, eq, ne } from 'drizzle-orm';
import type { Expo } from 'expo-server-sdk';
import type { Redis } from 'ioredis';
import type { DrizzleDb } from '../plugins/db.js';
import { devices, pushTokens } from '../db/schema.js';
import {
  dispatchPush,
  type NotificationPreferenceStore,
  type PushTarget,
  type QuietHoursStore,
} from './push-dispatch.js';

/**
 * TTL de la clé de déduplication Redis en secondes. 10 min couvre :
 * - les retransmissions après reconnexion WS du client émetteur,
 * - les rejeux potentiels par un adversaire qui aurait capturé une frame WS
 *   côté serveur (protégé par TLS en prod, mais défense en profondeur).
 * Refs: ADR-D11 §Décision / §Conséquences.
 */
export const PEER_PING_DEDUP_TTL_SECONDS = 10 * 60;

/**
 * Fenêtre du rate-limit par device en secondes. 60 s + 60 pings max = 1 ping
 * par seconde en moyenne. Un burst de quelques pings est autorisé (saisie
 * rapide de plusieurs prises successives), mais un device qui spamme sera
 * étranglé avant d'atteindre le dispatcher push. Refs: CLAUDE.md §À ne
 * jamais faire (rate-limit sur données sensibles), kz-securite-KIN-081.
 */
export const PEER_PING_RATE_LIMIT_WINDOW_SECONDS = 60;
export const PEER_PING_RATE_LIMIT_MAX = 60;

/**
 * Résultat structuré du handler, utile pour la télémétrie et les tests.
 *
 * - `dispatched` : un push a été programmé (au moins une target valide après
 *   filtrage préférences + quiet hours).
 * - `deduped` : ping déjà vu dans les 10 dernières min — ignoré silencieusement.
 * - `rate_limited` : ce device a dépassé son quota de pings/min — ignoré.
 * - `no_targets` : aucun autre device dans le foyer → rien à dispatcher.
 */
export type PeerPingResult = 'dispatched' | 'deduped' | 'rate_limited' | 'no_targets';

const dedupKey = (householdId: string, doseId: string): string =>
  `peer_ping:dose:${householdId}:${doseId}`;

const rateLimitKey = (deviceId: string): string => `peer_ping:rl:${deviceId}`;

export interface HandlePeerPingArgs {
  readonly db: DrizzleDb;
  readonly redis: Redis;
  readonly expo: Expo;
  /** `householdId` du JWT vérifié — jamais du payload. */
  readonly householdId: string;
  /** `deviceId` du JWT vérifié — jamais du payload. */
  readonly senderDeviceId: string;
  /** UUID opaque, utilisé uniquement comme clé de dédup. */
  readonly doseId: string;
  readonly prefsStore: NotificationPreferenceStore;
  readonly quietStore: QuietHoursStore;
  readonly logger?: {
    warn: (obj: Record<string, unknown>, msg: string) => void;
    info?: (obj: Record<string, unknown>, msg: string) => void;
  };
  /** Horloge injectable — testable. */
  readonly now?: Date;
}

/**
 * Orchestration complète du traitement d'un `peer_ping` entrant côté relais.
 *
 * Ordre des contrôles (critique pour la sécurité) :
 * 1. **Rate-limit par device** (Redis `INCR` + `EXPIRE`) : un device
 *    compromis qui tenterait de spammer est étranglé **avant** le lookup DB
 *    et l'envoi push (économise les ressources + limite la surface d'abus).
 * 2. **Déduplication par `(householdId, doseId)`** : une clé Redis posée par
 *    `SET NX EX 600` empêche un second dispatch pour la même prise, même
 *    après une reconnexion WS. La clé est scope-limitée au foyer pour
 *    éviter toute collision accidentelle.
 * 3. **Lookup des cibles** : devices du foyer **autres** que l'émetteur,
 *    join sur `pushTokens` → on obtient `{ token, accountId }` par device.
 *    Le filtrage `senderDeviceId != devices.id` est appliqué côté SQL pour
 *    ne jamais renvoyer le push à l'auteur lui-même (défense en profondeur).
 * 4. **Dispatch** via `dispatchPush(expo, targets, logger, filter, quietFilter)`
 *    avec `type = 'peer_dose_recorded'`. Les préférences granulaires (E5-S07)
 *    et quiet hours (E5-S08) sont appliquées par le dispatcher.
 *
 * Zero-knowledge (ADR-D11) :
 * - Le handler NE stocke JAMAIS le contenu d'un ping ailleurs qu'en Redis
 *   éphémère.
 * - Le payload push reste opaque (RM16) — le dispatcher construit
 *   `{title: "Kinhale", body: "Nouvelle activité"}` sans aucun champ santé.
 * - Aucun log de `doseId` ni de `householdId` en clair côté logger — les
 *   logs sont scope-limités aux identifiants de compte hash déjà pratiqués
 *   par le dispatcher.
 *
 * Refs: KIN-082, E5-S05, RM5, RM16, ADR-D11.
 */
export async function handlePeerPing(args: HandlePeerPingArgs): Promise<PeerPingResult> {
  const { db, redis, expo, householdId, senderDeviceId, doseId, prefsStore, quietStore } = args;

  // ---------------------------------------------------------------------------
  // 1. Rate-limit Redis par device (fail-closed sur erreur ? non : fail-open
  //    — si Redis plante, on laisse passer plutôt que de perdre des notifs
  //    légitimes. Mitigation : alerting Redis + quota côté dispatchPush).
  // ---------------------------------------------------------------------------
  try {
    const rlKey = rateLimitKey(senderDeviceId);
    const count = await redis.incr(rlKey);
    if (count === 1) {
      await redis.expire(rlKey, PEER_PING_RATE_LIMIT_WINDOW_SECONDS);
    }
    if (count > PEER_PING_RATE_LIMIT_MAX) {
      args.logger?.warn(
        { deviceIdHash: senderDeviceId.slice(0, 8), count },
        'peer_ping rate-limited (device spamming?)',
      );
      return 'rate_limited';
    }
  } catch (err) {
    // Fail-open : Redis indisponible n'empêche pas la livraison.
    args.logger?.warn({ err }, 'peer_ping rate-limit check failed (fallback: allow)');
  }

  // ---------------------------------------------------------------------------
  // 2. Déduplication Redis par (householdId, doseId).
  //    `SET NX EX 600` → atomic : si la clé existe, on reçoit null.
  // ---------------------------------------------------------------------------
  try {
    const setResult = await redis.set(
      dedupKey(householdId, doseId),
      '1',
      'EX',
      PEER_PING_DEDUP_TTL_SECONDS,
      'NX',
    );
    if (setResult === null) {
      // Déjà dispatché dans les 10 min — silent ignore.
      return 'deduped';
    }
  } catch (err) {
    // Fail-open sur erreur Redis : la dédup est un optimum, pas une
    // correction obligatoire. Mieux vaut un double push qu'une notif perdue.
    args.logger?.warn({ err }, 'peer_ping dedup check failed (fallback: allow dispatch)');
  }

  // ---------------------------------------------------------------------------
  // 3. Lookup des cibles : tous les devices du foyer sauf l'émetteur, joint
  //    sur pushTokens. Le filtre `ne(devices.id, senderDeviceId)` assure
  //    qu'on ne re-notifie pas l'auteur — même si plusieurs push tokens sont
  //    enregistrés pour son device.
  // ---------------------------------------------------------------------------
  let targets: PushTarget[];
  try {
    const rows = await db
      .select({
        token: pushTokens.token,
        accountId: devices.accountId,
      })
      .from(pushTokens)
      .innerJoin(devices, eq(pushTokens.deviceId, devices.id))
      .where(
        and(
          eq(pushTokens.householdId, householdId),
          eq(devices.householdId, householdId),
          ne(devices.id, senderDeviceId),
        ),
      );
    targets = rows.map((r) => ({ token: r.token, accountId: r.accountId }));
  } catch (err) {
    args.logger?.warn({ err }, 'peer_ping targets lookup failed');
    return 'no_targets';
  }

  if (targets.length === 0) {
    return 'no_targets';
  }

  // ---------------------------------------------------------------------------
  // 4. Dispatch via le dispatcher existant (préférences + quiet hours
  //    appliquées naturellement). `dispatchPush` ne rejette jamais — erreurs
  //    SDK Expo loggées en warn côté dispatcher.
  // ---------------------------------------------------------------------------
  const quietFilter =
    args.now !== undefined
      ? ({ type: 'peer_dose_recorded', quietStore, now: args.now } as const)
      : ({ type: 'peer_dose_recorded', quietStore } as const);
  await dispatchPush(
    expo,
    targets,
    args.logger,
    { type: 'peer_dose_recorded', prefsStore },
    quietFilter,
  );

  return 'dispatched';
}

// Re-export d'helpers pour les tests sans couplage aux constantes internes.
export const _internals = {
  dedupKey,
  rateLimitKey,
};
