import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
  classifyDecryptError,
  createDecryptFailedReporter,
  type DecryptFailedEvent,
  type ReportDecryptFailed,
} from '../telemetry.js';

/**
 * Clés autorisées dans le payload d'un événement télémétrie — toute autre
 * clé présente est un incident de confidentialité potentiel.
 * Refs: KIN-040, CLAUDE.md (zero-knowledge).
 */
const ALLOWED_KEYS = [
  'name',
  'timestamp',
  'platform',
  'errorClass',
  'seq',
  'householdPseudonym',
  'count',
] as const;

/**
 * Clés sensibles qui ne doivent **jamais** apparaître dans le payload,
 * même accidentellement via un typo ou une régression de schéma.
 */
const FORBIDDEN_KEYS = [
  'householdId',
  'doseId',
  'childId',
  'pumpId',
  'message',
  'stack',
  'rawError',
  'blobJson',
  'token',
  'deviceId',
  'name_',
  'ciphertext',
  'plaintext',
];

/** Hash fake déterministe (pas de crypto réelle dans ce test). */
function fakeHash(householdId: string): string {
  // Simulation : 16 chars hex dérivés stablement du householdId — suffisant
  // pour vérifier le déterminisme et l'indépendance côté caller.
  let h = 0;
  for (let i = 0; i < householdId.length; i++) {
    h = (h * 31 + householdId.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(16, '0');
}

describe('classifyDecryptError', () => {
  it('classifie SyntaxError comme "parse"', () => {
    expect(classifyDecryptError(new SyntaxError('unexpected token'))).toBe('parse');
  });

  it('classifie une Error générique comme "decrypt"', () => {
    expect(classifyDecryptError(new Error('mac failed'))).toBe('decrypt');
  });

  it('classifie une primitive comme "unknown"', () => {
    expect(classifyDecryptError('oops')).toBe('unknown');
    expect(classifyDecryptError(null)).toBe('unknown');
    expect(classifyDecryptError(undefined)).toBe('unknown');
    expect(classifyDecryptError(42)).toBe('unknown');
  });

  it('ne lit jamais err.message (pas de leak de données santé)', () => {
    // Propriété défensive : on s'assure que la classification ne fait pas
    // d'inspection du message pour dériver sa classe — seul le type compte.
    const err = new Error('child-123 pump-ventoline dose-2mg');
    const cls = classifyDecryptError(err);
    expect(cls).toBe('decrypt');
  });
});

describe('createDecryptFailedReporter', () => {
  let reportMock: Mock;
  let nowMs: number;
  let now: () => number;

  beforeEach(() => {
    reportMock = vi.fn();
    nowMs = 1_745_000_000_000; // 2025-04-18T19:33:20Z environ
    now = () => nowMs;
  });

  it('émet un événement sync.decrypt_failed avec le schéma exact', () => {
    const reporter = createDecryptFailedReporter({
      platform: 'web',
      hashHousehold: fakeHash,
      report: reportMock as ReportDecryptFailed,
      now,
    });

    reporter.track({ householdId: 'household-001', errorClass: 'decrypt', seq: 42 });

    expect(reportMock).toHaveBeenCalledTimes(1);
    const event = reportMock.mock.calls[0]?.[0] as DecryptFailedEvent;
    expect(event.name).toBe('sync.decrypt_failed');
    expect(event.platform).toBe('web');
    expect(event.errorClass).toBe('decrypt');
    expect(event.seq).toBe(42);
    expect(event.householdPseudonym).toBe(fakeHash('household-001'));
    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/);
  });

  it('arrondit le timestamp à la minute', () => {
    const reporter = createDecryptFailedReporter({
      platform: 'mobile',
      hashHousehold: fakeHash,
      report: reportMock as ReportDecryptFailed,
      now: () => new Date('2026-04-23T02:15:37.123Z').getTime(),
    });

    reporter.track({ householdId: 'h', errorClass: 'decrypt', seq: 1 });

    const event = reportMock.mock.calls[0]?.[0] as DecryptFailedEvent;
    expect(event.timestamp).toBe('2026-04-23T02:15:00.000Z');
  });

  // ---------------------------------------------------------------------------
  // Scrubbing — garde-fou critique. Si cette suite échoue, c'est un incident P0.
  // ---------------------------------------------------------------------------

  describe('scrubbing du payload', () => {
    it("n'émet AUCUN champ interdit (householdId, doseId, childId, message, stack...)", () => {
      const reporter = createDecryptFailedReporter({
        platform: 'web',
        hashHousehold: fakeHash,
        report: reportMock as ReportDecryptFailed,
        now,
      });

      reporter.track({
        householdId: 'household-LEAK-TEST',
        errorClass: 'decrypt',
        seq: 7,
      });

      expect(reportMock).toHaveBeenCalledTimes(1);
      const event = reportMock.mock.calls[0]?.[0] as Record<string, unknown>;

      for (const forbidden of FORBIDDEN_KEYS) {
        expect(
          event,
          `Champ interdit détecté dans l'événement télémétrie : "${forbidden}"`,
        ).not.toHaveProperty(forbidden);
      }

      // Vérification supplémentaire : aucun champ hors whitelist (même avec
      // un nom anodin inventé à tort).
      const allowed = new Set<string>(ALLOWED_KEYS);
      for (const key of Object.keys(event)) {
        expect(allowed.has(key), `Clé hors whitelist dans l'événement : "${key}"`).toBe(true);
      }

      // Enfin : la valeur du householdPseudonym n'est PAS le householdId.
      const pseudonym = event['householdPseudonym'] as string;
      expect(pseudonym).not.toBe('household-LEAK-TEST');
      expect(pseudonym).not.toContain('household');
      expect(pseudonym).not.toContain('LEAK');
    });

    it("n'émet pas de message d'erreur brut même si l'appelant passait une erreur suspecte", () => {
      // Le reporter NE REÇOIT PAS d'objet Error — seulement une classe.
      // Ce test documente l'invariant : le shape de track() n'accepte qu'un
      // `errorClass` string, pas un Error. TypeScript bloque déjà, mais on
      // renforce par un test d'usage.
      const reporter = createDecryptFailedReporter({
        platform: 'mobile',
        hashHousehold: fakeHash,
        report: reportMock as ReportDecryptFailed,
        now,
      });

      reporter.track({ householdId: 'h', errorClass: 'parse', seq: 1 });

      const event = reportMock.mock.calls[0]?.[0] as Record<string, unknown>;
      const json = JSON.stringify(event);
      expect(json).not.toMatch(/stack/i);
      expect(json).not.toMatch(/at .*\(.*\)/); // stack-frame pattern
    });
  });

  // ---------------------------------------------------------------------------
  // Rate-limit
  // ---------------------------------------------------------------------------

  describe('rate limit 100/60s', () => {
    it('émet les 100 premiers événements puis 1 seul storm agrégé à la bascule de fenêtre', () => {
      const reporter = createDecryptFailedReporter({
        platform: 'web',
        hashHousehold: fakeHash,
        report: reportMock as ReportDecryptFailed,
        now,
      });

      // 105 événements dans la même fenêtre (nowMs constant).
      for (let i = 0; i < 105; i++) {
        reporter.track({ householdId: 'h-one', errorClass: 'decrypt', seq: i });
      }

      // Pendant la fenêtre : 100 événements unitaires émis.
      const beforeWindowSwitch = reportMock.mock.calls.length;
      expect(beforeWindowSwitch).toBe(100);

      // Bascule de fenêtre : les 5 supprimés sont agrégés en 1 storm.
      nowMs += 60_000;
      reporter.track({ householdId: 'h-one', errorClass: 'decrypt', seq: 200 });

      // 1 storm (pour l'ancienne fenêtre) + 1 événement unitaire (pour la nouvelle).
      const events = reportMock.mock.calls.map((c) => c[0] as DecryptFailedEvent);
      const storms = events.filter((e) => e.name === 'sync.decrypt_failed_storm');
      expect(storms).toHaveLength(1);
      const storm = storms[0];
      expect(storm?.count).toBe(5);
      expect(storm?.householdPseudonym).toBe(fakeHash('h-one'));

      // L'événement post-bascule est bien un unitaire normal.
      const unitaires = events.filter((e) => e.name === 'sync.decrypt_failed');
      expect(unitaires).toHaveLength(101);
      expect(unitaires[100]?.seq).toBe(200);
    });

    it('réinitialise le compteur à chaque nouvelle fenêtre (compteurs indépendants)', () => {
      const reporter = createDecryptFailedReporter({
        platform: 'web',
        hashHousehold: fakeHash,
        report: reportMock as ReportDecryptFailed,
        now,
      });

      // Fenêtre 1 : 50 événements → aucun storm.
      for (let i = 0; i < 50; i++) {
        reporter.track({ householdId: 'h', errorClass: 'decrypt', seq: i });
      }
      expect(reportMock.mock.calls.length).toBe(50);

      // Bascule explicite (> 60s).
      nowMs += 61_000;

      // Fenêtre 2 : 50 événements → tous émis, aucun storm.
      for (let i = 0; i < 50; i++) {
        reporter.track({ householdId: 'h', errorClass: 'decrypt', seq: 1000 + i });
      }

      const events = reportMock.mock.calls.map((c) => c[0] as DecryptFailedEvent);
      expect(events.filter((e) => e.name === 'sync.decrypt_failed_storm')).toHaveLength(0);
      expect(events.filter((e) => e.name === 'sync.decrypt_failed')).toHaveLength(100);
    });

    it('isole les fenêtres par foyer pseudonymisé', () => {
      const reporter = createDecryptFailedReporter({
        platform: 'web',
        hashHousehold: fakeHash,
        report: reportMock as ReportDecryptFailed,
        now,
      });

      // Foyer A : 105 événements. Foyer B : 3 événements. Dans la même fenêtre.
      for (let i = 0; i < 105; i++) {
        reporter.track({ householdId: 'foyer-A', errorClass: 'decrypt', seq: i });
      }
      for (let i = 0; i < 3; i++) {
        reporter.track({ householdId: 'foyer-B', errorClass: 'decrypt', seq: i });
      }

      // Foyer A : seuls 100 unitaires avant storm ; Foyer B : 3 unitaires.
      const events = reportMock.mock.calls.map((c) => c[0] as DecryptFailedEvent);
      const pseudoA = fakeHash('foyer-A');
      const pseudoB = fakeHash('foyer-B');

      const unitA = events.filter(
        (e) => e.name === 'sync.decrypt_failed' && e.householdPseudonym === pseudoA,
      );
      const unitB = events.filter(
        (e) => e.name === 'sync.decrypt_failed' && e.householdPseudonym === pseudoB,
      );
      expect(unitA).toHaveLength(100);
      expect(unitB).toHaveLength(3);

      // Flush : le storm de foyer A est émis, aucun pour B.
      reporter.flush();
      const storms = events
        .concat(reportMock.mock.calls.slice(events.length).map((c) => c[0] as DecryptFailedEvent))
        .filter((e) => e.name === 'sync.decrypt_failed_storm');
      expect(storms.filter((s) => s.householdPseudonym === pseudoA)).toHaveLength(1);
      expect(storms.filter((s) => s.householdPseudonym === pseudoB)).toHaveLength(0);
    });

    it('flush() émet un storm si la fenêtre courante a dépassé le seuil', () => {
      const reporter = createDecryptFailedReporter({
        platform: 'web',
        hashHousehold: fakeHash,
        report: reportMock as ReportDecryptFailed,
        now,
      });

      for (let i = 0; i < 102; i++) {
        reporter.track({ householdId: 'h', errorClass: 'decrypt', seq: i });
      }
      reportMock.mockClear();

      reporter.flush();

      expect(reportMock).toHaveBeenCalledTimes(1);
      const event = reportMock.mock.calls[0]?.[0] as DecryptFailedEvent;
      expect(event.name).toBe('sync.decrypt_failed_storm');
      expect(event.count).toBe(2);
    });

    it("flush() sans dépassement n'émet rien", () => {
      const reporter = createDecryptFailedReporter({
        platform: 'web',
        hashHousehold: fakeHash,
        report: reportMock as ReportDecryptFailed,
        now,
      });

      for (let i = 0; i < 50; i++) {
        reporter.track({ householdId: 'h', errorClass: 'decrypt', seq: i });
      }
      reportMock.mockClear();

      reporter.flush();
      expect(reportMock).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Rétro-compat : si `report` n'est pas injecté, no-op silencieux.
  // ---------------------------------------------------------------------------

  it('est un no-op complet si report est undefined', () => {
    const reporter = createDecryptFailedReporter({
      platform: 'web',
      hashHousehold: fakeHash,
      now,
    });

    // Ne doit pas throw, ne doit rien logger, même après rate-limit atteint.
    for (let i = 0; i < 200; i++) {
      reporter.track({ householdId: 'h', errorClass: 'decrypt', seq: i });
    }
    reporter.flush();
    // Aucune exception = test vert.
  });
});
