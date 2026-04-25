/**
 * Test anti-régression **bloqueur CI** — verrouillage du payload push (RM16,
 * E9-S07, KIN-087).
 *
 * Stratégie : on rejoue chaque **chemin** d'envoi push connu (dispatch
 * direct, peer ping, mode silencieux quiet hours) et on capture les
 * arguments passés à `Expo.sendPushNotificationsAsync`. Pour chaque payload
 * capté, on vérifie :
 *
 * 1. Il passe strictement {@link PushPayloadSchema} (structure figée,
 *    aucune clé supplémentaire tolérée).
 * 2. Il ne contient **aucun** mot-clé santé interdit (couche défense en
 *    profondeur au cas où un contributeur renommerait un champ `body`
 *    sans passer par le schéma).
 * 3. Il n'a pas de clé `data`, `badge`, `categoryId`, `subtitle`,
 *    `channelId`, `mutableContent` (formes Expo riches qui véhiculeraient
 *    du santé sans être couvertes par le filtre de mots-clés).
 *
 * Si ce test échoue, c'est que **du contenu santé fuite via Expo** — c'est
 * un incident P0 qui doit bloquer toute PR. Ne pas `@skip`.
 *
 * Refs: KIN-087, E9-S07, RM16, ADR-D11.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Expo } from 'expo-server-sdk';
import type { Redis } from 'ioredis';
import type { DrizzleDb } from '../../plugins/db.js';
import { dispatchPush, type PushTarget } from '../push-dispatch.js';
import { handlePeerPing } from '../peer-ping-handler.js';
import {
  PushPayloadSchema,
  FORBIDDEN_HEALTH_KEYWORDS,
  containsForbiddenHealthKeyword,
} from '../push-payload-schema.js';
import type { NotificationPreferenceStore, QuietHoursStore } from '../push-dispatch.js';
import { NOTIFICATION_TYPES, type NotificationType } from '@kinhale/domain/notifications';
import type { QuietHours } from '@kinhale/domain/quiet-hours';

vi.mock('expo-server-sdk', () => {
  const MockExpo = vi.fn().mockImplementation(() => ({
    chunkPushNotifications: vi.fn((msgs: unknown[]) => [msgs]),
    sendPushNotificationsAsync: vi.fn().mockResolvedValue([]),
  }));
  (MockExpo as unknown as Record<string, unknown>).isExpoPushToken = vi.fn(
    (t: string) =>
      typeof t === 'string' &&
      (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken[')),
  );
  return { Expo: MockExpo };
});

// ----- helpers de capture ---------------------------------------------------

/**
 * Collecte tous les payloads passés à `sendPushNotificationsAsync` à travers
 * les chunks. Typage `unknown` volontaire — on ne fait confiance à aucune
 * forme présumée avant d'appliquer le Zod.
 */
function captureSentPayloads(expo: Expo): unknown[] {
  const mock = expo.sendPushNotificationsAsync as ReturnType<typeof vi.fn>;
  const all: unknown[] = [];
  for (const call of mock.mock.calls) {
    const chunk = call[0];
    if (Array.isArray(chunk)) {
      for (const msg of chunk) all.push(msg);
    }
  }
  return all;
}

function makePrefs(disabled: Set<string> = new Set()): NotificationPreferenceStore {
  return { findDisabledAccountIds: vi.fn().mockResolvedValue(disabled) };
}
function makeQuiet(map: Map<string, QuietHours> = new Map()): QuietHoursStore {
  return { findQuietHoursByAccount: vi.fn().mockResolvedValue(map) };
}

function makeDb(rows: Array<{ token: string; accountId: string }>): DrizzleDb {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  } as unknown as DrizzleDb;
}

function makeRedis(): Redis {
  return {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
  } as unknown as Redis;
}

/**
 * Vérifie chaque payload capté :
 * - passe `PushPayloadSchema` (.strict())
 * - ne contient aucun mot-clé santé
 * - n'a aucune des clés riches Expo interdites
 *
 * Regroupé dans un helper pour factoriser les 4-5 assertions répétitives
 * de chaque scénario.
 */
function expectNoLeak(payloads: unknown[]) {
  expect(payloads.length).toBeGreaterThan(0);
  for (const p of payloads) {
    const parsed = PushPayloadSchema.safeParse(p);
    if (!parsed.success) {
      throw new Error(
        `Payload rejeté par PushPayloadSchema (fuite structurelle) : ${JSON.stringify(p)} — issues: ${JSON.stringify(parsed.error.issues)}`,
      );
    }
    const leak = containsForbiddenHealthKeyword(p);
    if (leak !== null) {
      throw new Error(
        `Mot-clé santé détecté dans payload : "${leak}" — payload = ${JSON.stringify(p)}`,
      );
    }
    const obj = p as Record<string, unknown>;
    // Clés Expo riches explicitement interdites — doublon du .strict() pour
    // blinder le diagnostic en cas de régression.
    for (const forbidden of [
      'data',
      'badge',
      'categoryId',
      'subtitle',
      'channelId',
      'mutableContent',
      'ttl',
      'expiration',
    ]) {
      expect(obj[forbidden]).toBeUndefined();
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// 1. Couverture exhaustive via dispatchPush (tous les NotificationType)
// ---------------------------------------------------------------------------

describe('anti-leak — dispatchPush pour chaque NotificationType', () => {
  // Iter sur l'intégralité de l'ensemble fermé : tout nouveau NotificationType
  // ajouté côté domain doit obligatoirement passer ce test anti-régression.
  const ALL_TYPES: readonly NotificationType[] = NOTIFICATION_TYPES;

  for (const type of ALL_TYPES) {
    it(`type=${type} : payload conforme RM16 (aucune clé santé)`, async () => {
      const expo = new Expo();
      const targets: PushTarget[] = [
        { token: 'ExponentPushToken[abc]', accountId: 'acc-1' },
        { token: 'ExponentPushToken[def]', accountId: 'acc-2' },
      ];
      await dispatchPush(
        expo,
        targets,
        undefined,
        { type, prefsStore: makePrefs() },
        { type, quietStore: makeQuiet() },
      );
      expectNoLeak(captureSentPayloads(expo));
    });
  }

  it('mode silencieux (quiet hours) : payload conforme + flags QoS exacts', async () => {
    const expo = new Expo();
    const NIGHT: QuietHours = {
      enabled: true,
      startLocalTime: '22:00',
      endLocalTime: '07:00',
      timezone: 'America/Toronto',
    };
    const quietStore = makeQuiet(new Map([['acc-1', NIGHT]]));
    const targets: PushTarget[] = [{ token: 'ExponentPushToken[abc]', accountId: 'acc-1' }];
    await dispatchPush(expo, targets, undefined, undefined, {
      type: 'peer_dose_recorded',
      quietStore,
      now: new Date('2026-01-16T03:00:00Z'),
    });
    const payloads = captureSentPayloads(expo);
    expectNoLeak(payloads);
    // Assertion supplémentaire : QoS silencieux strict (pas de son custom).
    for (const p of payloads) {
      const obj = p as Record<string, unknown>;
      expect(obj['sound']).toBeNull();
      expect(obj['priority']).toBe('normal');
      expect(obj['interruptionLevel']).toBe('passive');
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Couverture via handlePeerPing (chemin réel utilisé par relay.ts)
// ---------------------------------------------------------------------------

describe('anti-leak — handlePeerPing (peer_dose_recorded)', () => {
  it('payload conforme RM16 pour tous les targets du foyer', async () => {
    const expo = new Expo();
    const redis = makeRedis();
    const db = makeDb([
      { token: 'ExponentPushToken[peer1]', accountId: 'acc-1' },
      { token: 'ExponentPushToken[peer2]', accountId: 'acc-2' },
    ]);
    await handlePeerPing({
      db,
      redis,
      expo,
      householdId: 'hh-aaa',
      senderDeviceId: 'dev-sender',
      doseId: '0a7e1b74-8c7d-4b7e-9f8a-1234567890ab',
      prefsStore: makePrefs(),
      quietStore: makeQuiet(),
    });
    expectNoLeak(captureSentPayloads(expo));
  });
});

// ---------------------------------------------------------------------------
// 3. Garde-fou Zod : vérifier que tout payload malveillant est rejeté
// ---------------------------------------------------------------------------

describe('anti-leak — PushPayloadSchema rejette toute dérive', () => {
  it('rejette un payload avec un champ `data`', () => {
    const bad = {
      to: 'ExponentPushToken[abc]',
      title: 'Kinhale',
      body: 'Nouvelle activité',
      data: { doseId: 'd-1' },
    };
    expect(PushPayloadSchema.safeParse(bad).success).toBe(false);
  });

  it('rejette un payload avec un `body` personnalisé santé', () => {
    const bad = {
      to: 'ExponentPushToken[abc]',
      title: 'Kinhale',
      body: 'Marie a pris Ventolin',
    };
    expect(PushPayloadSchema.safeParse(bad).success).toBe(false);
  });

  it('rejette un payload avec un `title` différent', () => {
    const bad = {
      to: 'ExponentPushToken[abc]',
      title: 'Asthma Tracker',
      body: 'Nouvelle activité',
    };
    expect(PushPayloadSchema.safeParse(bad).success).toBe(false);
  });

  it('rejette un payload avec un `subtitle`, `badge`, `channelId`', () => {
    for (const extra of [{ subtitle: 'x' }, { badge: 1 }, { channelId: 'asthma' }]) {
      const bad = {
        to: 'ExponentPushToken[abc]',
        title: 'Kinhale',
        body: 'Nouvelle activité',
        ...extra,
      };
      expect(PushPayloadSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('accepte le payload normal canonique', () => {
    expect(
      PushPayloadSchema.safeParse({
        to: 'ExponentPushToken[abc]',
        title: 'Kinhale',
        body: 'Nouvelle activité',
      }).success,
    ).toBe(true);
  });

  it('accepte le payload silencieux canonique', () => {
    expect(
      PushPayloadSchema.safeParse({
        to: 'ExponentPushToken[abc]',
        title: 'Kinhale',
        body: 'Nouvelle activité',
        sound: null,
        priority: 'normal',
        interruptionLevel: 'passive',
      }).success,
    ).toBe(true);
  });

  it('rejette un payload silencieux avec `sound` custom (défense canal caché)', () => {
    const bad = {
      to: 'ExponentPushToken[abc]',
      title: 'Kinhale',
      body: 'Nouvelle activité',
      sound: 'ventolin.caf',
      priority: 'normal',
      interruptionLevel: 'passive',
    };
    expect(PushPayloadSchema.safeParse(bad).success).toBe(false);
  });

  it('rejette un payload silencieux avec `interruptionLevel: active`', () => {
    const bad = {
      to: 'ExponentPushToken[abc]',
      title: 'Kinhale',
      body: 'Nouvelle activité',
      sound: null,
      priority: 'normal',
      interruptionLevel: 'active',
    };
    expect(PushPayloadSchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Le keyword-filter couvre bien les molécules et symptômes clés
// ---------------------------------------------------------------------------

describe('anti-leak — keyword filter FORBIDDEN_HEALTH_KEYWORDS', () => {
  it('détecte les molécules respiratoires courantes', () => {
    for (const mol of ['Ventolin', 'Salbutamol', 'Symbicort', 'Flovent', 'Qvar']) {
      expect(containsForbiddenHealthKeyword({ body: mol })).not.toBeNull();
    }
  });

  it('détecte les marqueurs de prise / symptôme', () => {
    for (const kw of ['dose', 'puff', 'bouffée', 'rescue', 'secours', 'crise', 'inhalation']) {
      expect(containsForbiddenHealthKeyword({ body: `Voici un ${kw}` })).not.toBeNull();
    }
  });

  it('détecte un champ `data` qui contient du santé', () => {
    // Cas réel d'une régression : une clé `childName` serait filtrée par
    // le matcher `child` ; un `doseAmount` serait filtré par `dose`.
    for (const bad of [
      { title: 'Kinhale', body: 'Nouvelle activité', data: { childName: 'X' } },
      { title: 'Kinhale', body: 'Nouvelle activité', data: { doseAmountPuffs: 2 } },
      { title: 'Kinhale', body: 'Nouvelle activité', data: { pumpId: 'p-1' } },
    ]) {
      expect(containsForbiddenHealthKeyword(bad)).not.toBeNull();
    }
  });

  it('ne produit pas de faux positif sur le payload canonique', () => {
    expect(
      containsForbiddenHealthKeyword({
        to: 'ExponentPushToken[abc]',
        title: 'Kinhale',
        body: 'Nouvelle activité',
      }),
    ).toBeNull();
  });

  it('contient au moins 20 mots-clés (défense en profondeur)', () => {
    expect(FORBIDDEN_HEALTH_KEYWORDS.length).toBeGreaterThanOrEqual(20);
  });
});
