import { DomainError } from '../errors';

/**
 * Enregistrement d'un événement client déjà traité par le serveur (RM15).
 * Sert de mémoire à la déduplication : la clé est `clientEventId`, la valeur
 * est la prise finale (ID + horodatage serveur) qui sera renvoyée au client
 * lors d'un rejeu.
 */
export interface ProcessedEvent {
  readonly clientEventId: string;
  readonly doseId: string;
  readonly recordedAtUtc: Date;
}

/**
 * Registre d'idempotence — vue en lecture seule sur les `clientEventId` déjà
 * traités. Côté domaine on modélise un `Map` immuable ; côté `apps/api`
 * l'implémentation réelle s'appuie sur une contrainte d'unicité Postgres. Le
 * domaine décrit la **décision** sans jamais persister.
 */
export interface IdempotencyRegistry {
  readonly events: ReadonlyMap<string, ProcessedEvent>;
}

/**
 * Décision renvoyée par {@link decideIdempotency} :
 * - `process` : nouvel événement, à traiter normalement ;
 * - `replay` : événement déjà traité, renvoyer la même réponse (pas de nouvelle
 *   insertion, pas d'effet de bord).
 */
export type IdempotencyDecision =
  | { readonly kind: 'process'; readonly clientEventId: string }
  | { readonly kind: 'replay'; readonly existing: ProcessedEvent };

/**
 * Regex UUID v4 (8-4-4-4-12 hex, 13ème caractère = `4`, 17ème caractère dans
 * `[8, 9, a, b]`). Insensible à la casse. On refuse explicitement les autres
 * versions (v1, v3, v5) pour se prémunir d'identifiants prévisibles (v1 basé
 * sur l'horloge + MAC) ou non aléatoires.
 *
 * Référence : RFC 4122 §4.4 (v4 = random).
 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * RM15 — registre vide initial. Pure fabrique, ne mute rien, utile comme
 * valeur de départ pour les tests et pour le code serveur qui rechargerait un
 * cache en mémoire.
 */
export function createEmptyIdempotencyRegistry(): IdempotencyRegistry {
  return { events: new Map<string, ProcessedEvent>() };
}

/**
 * RM15 — décide si un `clientEventId` doit être traité (nouveau) ou rejoué
 * (déjà vu). Pure fonction : ne mute rien, ne persiste rien. Le `clientEventId`
 * est normalisé en minuscules avant recherche pour être robuste aux variations
 * de casse émises par différents clients.
 *
 * @throws {DomainError} `RM15_INVALID_CLIENT_EVENT_ID` si l'ID est vide, du
 *   whitespace pur ou n'est pas un UUID v4 conforme RFC 4122.
 */
export function decideIdempotency(
  registry: IdempotencyRegistry,
  clientEventId: string,
): IdempotencyDecision {
  const normalized = normalizeAndValidate(clientEventId);
  const existing = registry.events.get(normalized);
  if (existing !== undefined) {
    return { kind: 'replay', existing };
  }
  return { kind: 'process', clientEventId: normalized };
}

/**
 * RM15 — ajoute un `ProcessedEvent` au registre. Pure : renvoie un **nouveau**
 * registre, ne mute jamais l'entrée. Idempotente — réenregistrer un événement
 * déjà présent renvoie une copie équivalente (taille inchangée, même valeur).
 *
 * @throws {DomainError} `RM15_INVALID_CLIENT_EVENT_ID` si l'ID est invalide.
 */
export function recordProcessedEvent(
  registry: IdempotencyRegistry,
  event: ProcessedEvent,
): IdempotencyRegistry {
  const normalized = normalizeAndValidate(event.clientEventId);
  const next = new Map(registry.events);
  next.set(normalized, { ...event, clientEventId: normalized });
  return { events: next };
}

function normalizeAndValidate(clientEventId: string): string {
  if (typeof clientEventId !== 'string') {
    throw invalidClientEventId(clientEventId);
  }
  const trimmed = clientEventId.trim();
  if (trimmed.length === 0) {
    throw invalidClientEventId(clientEventId);
  }
  if (!UUID_V4_REGEX.test(trimmed)) {
    throw invalidClientEventId(clientEventId);
  }
  return trimmed.toLowerCase();
}

function invalidClientEventId(raw: unknown): DomainError {
  return new DomainError(
    'RM15_INVALID_CLIENT_EVENT_ID',
    'clientEventId must be a non-empty UUID v4 string (RFC 4122).',
    { clientEventId: raw },
  );
}
