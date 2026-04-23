/**
 * Télémétrie pseudonymisée pour les échecs de déchiffrement côté client sync.
 *
 * Objectif : lever la zone aveugle opérationnelle identifiée dans
 * `kz-securite-KIN-038.md` §M2 (try/catch silencieux autour de
 * `consumeSyncMessage`) sans jamais émettre la moindre donnée santé.
 *
 * Contraintes non négociables (cf. issue #191 et CLAUDE.md) :
 * - **Aucune donnée santé** dans le payload : pas de `householdId` en clair,
 *   pas de message d'erreur brut, pas de trace d'exécution, pas de content.
 * - **Pseudonymisation du foyer** : `householdPseudonym = BLAKE2b(householdId,
 *   app_secret, 8 bytes)`. Le `app_secret` est un sel applicatif injecté par
 *   l'app hôte, jamais stocké côté relai. Voir `blake2bHex` dans `@kinhale/crypto`.
 * - **Rate limit** : 100 événements / 60 s par `householdPseudonym`. Au-delà,
 *   un seul événement agrégé `sync.decrypt_failed_storm` est émis avec le
 *   compteur des événements supprimés.
 * - **Pas de persistance** : la fenêtre de rate limit vit en mémoire uniquement
 *   (reset au remontage du hook, à la fermeture de l'onglet, au restart mobile).
 *
 * Refs: KIN-040, KIN-038 (§M2), ADR-D9.
 */

/** Classes d'erreur coarses exposées en télémétrie. */
export type DecryptErrorClass = 'decrypt' | 'parse' | 'unknown';

/** Nom d'événement émis. */
export type DecryptFailedEventName = 'sync.decrypt_failed' | 'sync.decrypt_failed_storm';

/**
 * Schéma **exhaustif** de l'événement émis en télémétrie.
 *
 * ⚠️ **Invariant sécurité** : aucun autre champ ne doit jamais être ajouté
 * sans passer par une revue `kz-securite`. Un test dédié vérifie qu'aucune
 * clé hors whitelist n'apparaît dans l'événement émis.
 */
export interface DecryptFailedEvent {
  /** Nom discriminant — permet au backend de router unitaire vs agrégé. */
  readonly name: DecryptFailedEventName;
  /** ISO 8601 arrondi à la minute (réduction d'entropie temporelle). */
  readonly timestamp: string;
  /** Plateforme émettrice — utile pour corréler côté ops. */
  readonly platform: 'web' | 'mobile';
  /** Classe d'erreur coarse — pas de message brut. */
  readonly errorClass: DecryptErrorClass;
  /** Numéro de séquence monotone du message. */
  readonly seq: number;
  /** BLAKE2b keyed du householdId — non réversible côté relai / Sentry. */
  readonly householdPseudonym: string;
  /**
   * Uniquement présent sur `sync.decrypt_failed_storm` : compteur agrégé
   * des événements supprimés pendant la fenêtre.
   */
  readonly count?: number;
}

/** Fonction d'émission injectée (Sentry, CloudWatch, console, etc.). */
export type ReportDecryptFailed = (event: DecryptFailedEvent) => void;

/** Fonction de pseudonymisation injectée (BLAKE2b keyed avec app_secret). */
export type HashHousehold = (householdId: string) => string;

/** Fenêtre de rate limit — **privée au module**, pas persistée. */
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;

/** État par foyer pseudonymisé. */
interface WindowState {
  windowStartMs: number;
  /** Nombre total d'événements observés dans la fenêtre (y compris supprimés). */
  total: number;
}

/**
 * Classifie une exception en catégorie coarse.
 *
 * ⚠️ **Ne jamais inclure `err.message` ou `err.stack`** — risque de leak de
 * données santé si le message embarque un contexte (type de pompe, ID enfant).
 *
 * Heuristique : on inspecte **uniquement** `err.name` (valeur connue du code)
 * et le type de l'objet. On ne lit jamais `err.message`.
 *
 * Robustesse cross-realm : le check `instanceof SyntaxError` casse si l'erreur
 * provient d'un autre realm JS (WebWorker, iframe, bridge React Native) car le
 * constructeur `SyntaxError` est distinct d'un realm à l'autre. On ajoute un
 * fallback sur `err.name === 'SyntaxError'` qui est préservé au travers des
 * bridges (simple string, sérialisée tel quel).
 */
export function classifyDecryptError(err: unknown): DecryptErrorClass {
  if (!(err instanceof Error)) {
    return 'unknown';
  }
  if (err instanceof SyntaxError || err.name === 'SyntaxError') {
    // JSON.parse côté consumeSyncMessage → payload mal formé.
    return 'parse';
  }
  // Tout le reste tombe sous "decrypt" : MAC invalide, clé incorrecte,
  // nonce rejoué, etc. — comportement attendu en cas d'attaque MITM ou
  // de désynchronisation de clé.
  return 'decrypt';
}

/** Arrondit un timestamp à la minute (réduction d'entropie). */
function isoMinute(nowMs: number): string {
  const rounded = Math.floor(nowMs / 60_000) * 60_000;
  return new Date(rounded).toISOString();
}

/**
 * Crée un rapporteur d'événements `sync.decrypt_failed` avec rate-limit
 * glissant en mémoire.
 *
 * Le rapporteur retourné est **autonome** : il gère sa propre fenêtre.
 * Il faut en créer un nouveau par instance de hook (fait dans `useRelaySync`
 * via `useRef`).
 */
export function createDecryptFailedReporter(deps: {
  readonly platform: 'web' | 'mobile';
  readonly hashHousehold: HashHousehold;
  readonly report?: ReportDecryptFailed;
  /** Horloge injectable pour tests. Par défaut `Date.now`. */
  readonly now?: () => number;
}): {
  readonly track: (params: {
    householdId: string;
    errorClass: DecryptErrorClass;
    seq: number;
  }) => void;
  /**
   * À appeler au démontage : flush l'événement `_storm` en cours si le
   * compteur de fenêtre contient encore des suppressions non reportées.
   */
  readonly flush: () => void;
} {
  const now = deps.now ?? Date.now;
  const windows = new Map<string, WindowState>();

  function maybeEmitStorm(pseudonym: string, state: WindowState): void {
    if (deps.report === undefined) return;
    const suppressed = state.total - RATE_LIMIT_MAX;
    if (suppressed <= 0) return;
    deps.report({
      name: 'sync.decrypt_failed_storm',
      timestamp: isoMinute(state.windowStartMs),
      platform: deps.platform,
      errorClass: 'unknown',
      // `seq: -1` sentinelle explicite : un storm agrège N événements dont les
      // `seq` individuels ont été volontairement omis. Ne jamais confondre avec
      // un vrai numéro de séquence (qui est toujours >= 0 côté buildSyncMessage).
      seq: -1,
      householdPseudonym: pseudonym,
      count: suppressed,
    });
  }

  return {
    track({ householdId, errorClass, seq }): void {
      // Pseudonymise AVANT tout traitement — le householdId ne doit pas
      // exister en clair au-delà de cette ligne dans le module télémétrie.
      const pseudonym = deps.hashHousehold(householdId);
      const currentMs = now();

      let state = windows.get(pseudonym);
      if (state === undefined || currentMs - state.windowStartMs >= RATE_LIMIT_WINDOW_MS) {
        // Si la fenêtre précédente avait dépassé le seuil, on flushe son
        // storm aggregate avant de la remplacer.
        if (state !== undefined) {
          maybeEmitStorm(pseudonym, state);
        }
        state = { windowStartMs: currentMs, total: 0 };
        windows.set(pseudonym, state);
      }

      state.total += 1;

      if (state.total <= RATE_LIMIT_MAX) {
        if (deps.report === undefined) return;
        deps.report({
          name: 'sync.decrypt_failed',
          timestamp: isoMinute(currentMs),
          platform: deps.platform,
          errorClass,
          seq,
          householdPseudonym: pseudonym,
        });
      }
      // Au-delà de RATE_LIMIT_MAX, on ne fait rien de plus ici : le storm
      // sera émis à la bascule de fenêtre (ou au flush).
    },
    flush(): void {
      for (const [pseudonym, state] of windows) {
        maybeEmitStorm(pseudonym, state);
      }
      windows.clear();
    },
  };
}
