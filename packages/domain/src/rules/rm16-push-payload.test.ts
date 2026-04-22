import { describe, expect, it } from 'vitest';
import { DomainError } from '../errors';
import {
  buildSafePushPayload,
  ensurePushPayloadSafe,
  FORBIDDEN_PUSH_KEYWORDS_EN,
  FORBIDDEN_PUSH_KEYWORDS_FR,
  PUSH_BODY_GENERIC,
  PUSH_BODY_MAX_LENGTH,
  PUSH_TITLE_GENERIC,
  type SafePushPayload,
  validatePushPayload,
} from './rm16-push-payload';

const HOUSEHOLD_ID = '11111111-1111-4111-8111-111111111111';
const NOTIFICATION_ID = '22222222-2222-4222-8222-222222222222';

describe('RM16 — buildSafePushPayload', () => {
  it('retourne un payload avec title/body génériques par défaut', () => {
    const payload = buildSafePushPayload({
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    });

    expect(payload.title).toBe(PUSH_TITLE_GENERIC);
    expect(payload.body).toBe(PUSH_BODY_GENERIC);
    expect(payload.householdId).toBe(HOUSEHOLD_ID);
    expect(payload.notificationId).toBe(NOTIFICATION_ID);
  });

  it('rejette un householdId non-UUIDv4', () => {
    expect(() =>
      buildSafePushPayload({
        householdId: 'not-a-uuid',
        notificationId: NOTIFICATION_ID,
      }),
    ).toThrow(DomainError);
  });

  it('rejette un notificationId non-UUIDv4', () => {
    expect(() =>
      buildSafePushPayload({
        householdId: HOUSEHOLD_ID,
        notificationId: 'xxx',
      }),
    ).toThrow(DomainError);
  });

  it('garantit par construction que le payload est safe (aucune violation)', () => {
    const payload = buildSafePushPayload({
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    });

    expect(validatePushPayload(payload)).toEqual([]);
  });
});

describe('RM16 — validatePushPayload (chemin nominal)', () => {
  it('payload safe construit → 0 violation', () => {
    const payload = buildSafePushPayload({
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    });

    expect(validatePushPayload(payload)).toEqual([]);
  });

  it('ne mute pas le payload', () => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body: PUSH_BODY_GENERIC,
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };
    const snapshot = JSON.stringify(payload);

    validatePushPayload(payload, ['Mia']);

    expect(JSON.stringify(payload)).toBe(snapshot);
  });
});

describe('RM16 — validatePushPayload (détection mots-clés FR)', () => {
  it.each([
    'Dose à prendre',
    'Secours activé',
    'Nouvelle pompe',
    'Inhalateur rechargé',
    'Toux détectée',
    'Essoufflement signalé',
    'Sifflement enregistré',
    'Symptôme observé',
    'Crise probable',
    'Respiration difficile',
    'Allergène présent',
    'Prescription à jour',
    'Posologie révisée',
    'Administré par Maman',
  ])('flag "%s" comme forbidden_keyword', (body) => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body,
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };

    const violations = validatePushPayload(payload);
    expect(violations.some((v) => v.field === 'body' && v.kind === 'forbidden_keyword')).toBe(true);
  });

  it('détection case-insensitive', () => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body: 'DOSE prise',
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };

    const violations = validatePushPayload(payload);
    expect(violations.some((v) => v.kind === 'forbidden_keyword')).toBe(true);
  });
});

describe('RM16 — validatePushPayload (détection mots-clés EN)', () => {
  it.each([
    'Dose due',
    'Rescue used',
    'Pump refilled',
    'Inhaler available',
    'Symptom reported',
    'Attack suspected',
    'Cough observed',
    'Wheezing recorded',
    'Shortness of breath',
    'Allergen alert',
    'Prescription updated',
    'Administered by Dad',
    'Breathing difficulty',
  ])('flag "%s" comme forbidden_keyword', (body) => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body,
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };

    const violations = validatePushPayload(payload);
    expect(violations.some((v) => v.field === 'body' && v.kind === 'forbidden_keyword')).toBe(true);
  });
});

describe('RM16 — validatePushPayload (PII dynamique)', () => {
  it('flag un body contenant le prénom enfant passé en knownForbiddenStrings', () => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body: 'Activité enregistrée pour Mia',
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };

    const violations = validatePushPayload(payload, ['Mia']);
    expect(violations.some((v) => v.field === 'body' && v.kind === 'suspected_pii')).toBe(true);
  });

  it('détection PII case-insensitive', () => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body: 'mia a pris sa dose',
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };

    const violations = validatePushPayload(payload, ['Mia']);
    expect(violations.some((v) => v.kind === 'suspected_pii')).toBe(true);
  });

  it('ignore une knownForbiddenString vide ou whitespace', () => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body: PUSH_BODY_GENERIC,
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };

    expect(validatePushPayload(payload, ['', '   '])).toEqual([]);
  });
});

describe('RM16 — validatePushPayload (titre non générique)', () => {
  it('flag un title différent de Kinhale', () => {
    const payload: SafePushPayload = {
      title: 'Alerte médicale',
      body: PUSH_BODY_GENERIC,
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };

    const violations = validatePushPayload(payload);
    expect(violations.some((v) => v.field === 'title' && v.kind === 'title_not_generic')).toBe(
      true,
    );
  });

  it('accepte title "Kinhale" (générique officiel)', () => {
    const payload: SafePushPayload = {
      title: 'Kinhale',
      body: PUSH_BODY_GENERIC,
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };

    expect(validatePushPayload(payload)).toEqual([]);
  });
});

describe('RM16 — validatePushPayload (longueur excessive)', () => {
  it('flag un body dépassant PUSH_BODY_MAX_LENGTH', () => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body: 'a'.repeat(PUSH_BODY_MAX_LENGTH + 1),
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };

    const violations = validatePushPayload(payload);
    expect(violations.some((v) => v.field === 'body' && v.kind === 'body_length_exceeded')).toBe(
      true,
    );
  });

  it('accepte un body pile à PUSH_BODY_MAX_LENGTH', () => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body: 'a'.repeat(PUSH_BODY_MAX_LENGTH),
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };

    const violations = validatePushPayload(payload);
    expect(violations.some((v) => v.kind === 'body_length_exceeded')).toBe(false);
  });
});

describe('RM16 — validatePushPayload (UUIDv4 IDs)', () => {
  it('flag un householdId non-UUIDv4 (toujours via violation, pas throw)', () => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body: PUSH_BODY_GENERIC,
      householdId: 'bad',
      notificationId: NOTIFICATION_ID,
    };

    const violations = validatePushPayload(payload);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('flag un notificationId non-UUIDv4', () => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body: PUSH_BODY_GENERIC,
      householdId: HOUSEHOLD_ID,
      notificationId: 'bad',
    };

    const violations = validatePushPayload(payload);
    expect(violations.length).toBeGreaterThan(0);
  });
});

describe('RM16 — ensurePushPayloadSafe', () => {
  it('ne lève rien pour un payload safe', () => {
    const payload = buildSafePushPayload({
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    });

    expect(() => ensurePushPayloadSafe(payload)).not.toThrow();
  });

  it('lève RM16_FORBIDDEN_CONTENT si violation détectée', () => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body: 'Dose prise',
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };

    try {
      ensurePushPayloadSafe(payload);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).code).toBe('RM16_FORBIDDEN_CONTENT');
    }
  });

  it("expose les violations via le context de l'erreur", () => {
    const payload: SafePushPayload = {
      title: PUSH_TITLE_GENERIC,
      body: 'Dose prise par Mia',
      householdId: HOUSEHOLD_ID,
      notificationId: NOTIFICATION_ID,
    };

    try {
      ensurePushPayloadSafe(payload, ['Mia']);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const domainErr = err as DomainError;
      expect(domainErr.context).toBeDefined();
      expect(domainErr.context?.['violations']).toBeDefined();
    }
  });

  it("NE FUIT PAS le body, keyword, PII ni les IDs dans le context ou le message d'erreur", () => {
    // Ironie à éviter : une règle anti-fuite push qui fuiterait elle-même
    // dans les logs structurés. Le detail des violations et le message
    // d'erreur doivent être non-révélateurs.
    const childName = 'Mia';
    const pumpLabel = 'Pompe bleue';
    const unsafePayload: SafePushPayload = {
      title: 'Alerte médicale',
      body: `${childName} a pris sa dose avec la ${pumpLabel}`,
      householdId: 'not-a-uuid',
      notificationId: 'not-a-uuid-either',
    };

    try {
      ensurePushPayloadSafe(unsafePayload, [childName, pumpLabel]);
      expect.fail('should have thrown RM16_FORBIDDEN_CONTENT');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      const payload = JSON.stringify({
        message: (err as DomainError).message,
        context: (err as DomainError).context,
      });
      // Aucune valeur offensante ne doit figurer dans une sérialisation
      // du message + context : pas le prénom, pas le label de pompe, pas
      // le mot-clé, pas le body complet, pas l'ID non-UUID.
      expect(payload).not.toContain(childName);
      expect(payload).not.toContain(pumpLabel);
      expect(payload).not.toContain('dose');
      expect(payload).not.toContain('Alerte médicale');
      expect(payload).not.toContain('not-a-uuid');
      expect(payload).not.toContain('a pris sa');
    }
  });
});

describe('RM16 — listes FORBIDDEN_KEYWORDS exposées et non vides', () => {
  it('FORBIDDEN_PUSH_KEYWORDS_FR contient les racines attendues', () => {
    expect(FORBIDDEN_PUSH_KEYWORDS_FR.length).toBeGreaterThan(5);
    // Échantillon obligatoire — détecte toute régression de liste.
    expect(FORBIDDEN_PUSH_KEYWORDS_FR).toContain('dose');
    expect(FORBIDDEN_PUSH_KEYWORDS_FR).toContain('pompe');
    expect(FORBIDDEN_PUSH_KEYWORDS_FR).toContain('secours');
  });

  it('FORBIDDEN_PUSH_KEYWORDS_EN contient les racines attendues', () => {
    expect(FORBIDDEN_PUSH_KEYWORDS_EN.length).toBeGreaterThan(5);
    expect(FORBIDDEN_PUSH_KEYWORDS_EN).toContain('dose');
    expect(FORBIDDEN_PUSH_KEYWORDS_EN).toContain('pump');
    expect(FORBIDDEN_PUSH_KEYWORDS_EN).toContain('rescue');
  });
});
