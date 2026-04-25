/**
 * Verrouillage structurel du payload push (RM16, E9-S07, KIN-087).
 *
 * Toute donnée envoyée à Expo (APNs / FCM) DOIT matcher strictement
 * {@link PushPayloadSchema}. Ce schéma est **la dernière barrière** avant la
 * sortie réseau du relais — il agit comme défense en profondeur contre
 * toute régression future qui ferait fuiter :
 * - un prénom d'enfant,
 * - un nom de pompe ou un nom de produit,
 * - une dose (quantité, unité),
 * - un type de prise (rescue / maintenance / secours),
 * - un symptôme,
 * - tout identifiant métier côté client (doseId, pumpId, childId),
 * - toute clé `data` custom qui pourrait véhiculer du santé.
 *
 * Conséquence : `title: literal('Kinhale')` + `body: literal('Nouvelle
 * activité')` — aucune personnalisation du texte, jamais. Le seul signal
 * métier toléré est la **présence** d'une notification ; son sens exact est
 * reconstruit côté client via la mailbox chiffrée (zero-knowledge).
 *
 * Champs de QoS silencieux (RM25 + quiet hours E5-S08) :
 * - `sound: null`
 * - `priority: 'normal'`
 * - `interruptionLevel: 'passive'`
 *
 * Ces trois-là sont tolérés **uniquement** avec leurs valeurs exactes — pas
 * de `sound: 'bip-bip'` qui pourrait servir de canal caché, pas de
 * `interruptionLevel: 'active'` qui réveille l'utilisateur en plein sommeil.
 *
 * **Mode strict Zod** : `.strict()` rejette toute clé supplémentaire. Si un
 * contributeur ajoute un champ `data`, `body: 'Marie a pris Ventolin'`, ou
 * toute autre variante custom, le dispatch lance immédiatement — avant
 * l'appel réseau à Expo.
 *
 * Test anti-régression : `push/__tests__/payload-anti-leak.test.ts` parcourt
 * tous les call sites de `dispatchPush` et vérifie que chaque payload capté
 * passe `.strict()` + matche un keyword-filter anti-santé.
 *
 * Refs: RM16 (payload opaque), RM25 (exceptions sécurité), E5-S08 (quiet
 * hours), E9-S07 (verrouillage), ADR-D11 (peer ping).
 */

import { z } from 'zod';

/**
 * Formats d'un token Expo :
 * - `ExponentPushToken[...]` — format Expo historique (majorité des devices).
 * - `ExpoPushToken[...]` — alias récent (rare, mais accepté par le SDK).
 *
 * Le regex est volontairement permissif **à l'intérieur** des crochets
 * (tout caractère sauf `]`) — l'entropie exacte dépend de la version du
 * service Expo et ne doit pas être bornée côté relais. Longueur 1..200 pour
 * rester cohérent avec la regex de `/push/register-token` dans `routes/push.ts`.
 */
const ExpoTokenRegex = /^Expo(?:nent)?PushToken\[[^\]]{1,200}\]$/;

/**
 * Payload push **normal** (bannière + son standard).
 *
 * Seule forme tolérée : `{to, title, body}` sans clé supplémentaire. Toute
 * forme riche (data, badge, categoryId, subtitle, channelId, ...) est rejetée.
 */
const NormalPushPayloadSchema = z
  .object({
    to: z.string().regex(ExpoTokenRegex, 'token_format_invalid'),
    title: z.literal('Kinhale'),
    body: z.literal('Nouvelle activité'),
  })
  .strict();

/**
 * Payload push **silencieux** (quiet hours E5-S08).
 *
 * Mêmes `title` / `body` + trois flags de QoS à valeurs **figées**. Aucune
 * dérive possible vers un son custom ou un niveau d'interruption agressif.
 */
const SilentPushPayloadSchema = z
  .object({
    to: z.string().regex(ExpoTokenRegex, 'token_format_invalid'),
    title: z.literal('Kinhale'),
    body: z.literal('Nouvelle activité'),
    sound: z.null(),
    priority: z.literal('normal'),
    interruptionLevel: z.literal('passive'),
  })
  .strict();

/**
 * Union discriminée implicite : un payload est soit normal, soit silencieux.
 * Utilisation côté `dispatchPush` :
 *
 * ```ts
 * const parsed = PushPayloadSchema.safeParse(message);
 * if (!parsed.success) {
 *   logger?.warn({ issues: parsed.error.issues }, 'push_payload_lock_violation');
 *   continue; // skip ce message, ne pas envoyer
 * }
 * ```
 *
 * Comportement actuel : **log warn + skip** (ne pas envoyer) plutôt que
 * `throw`. Un échec silencieux sur un seul message est préférable à un
 * crash du dispatcher qui ferait perdre tous les autres messages du
 * chunk. Une violation signale soit un bug critique (régression
 * crypto/privacy) soit une tentative d'injection ; dans les deux cas,
 * **ne pas envoyer ce message** est la bonne réponse — mais les autres
 * messages valides du même chunk doivent continuer.
 */
export const PushPayloadSchema = z.union([NormalPushPayloadSchema, SilentPushPayloadSchema]);

export type PushPayload = z.infer<typeof PushPayloadSchema>;

/**
 * Mots-clés interdits **dans toute chaîne sérialisée du payload** — doublon
 * du schéma pour couvrir les cas où un contributeur renommerait un champ
 * (ex. `title` muté en `'Ventolin rescue'`). Le test anti-leak vérifie que
 * la sérialisation JSON complète ne matche aucun de ces patterns.
 *
 * La liste couvre FR + EN, les noms de familles de pompes les plus répandues,
 * et les marqueurs santé génériques. Elle peut s'enrichir sans rompre le
 * contrat — elle durcit seulement la détection.
 *
 * **Matching par frontière de mot** (`\b...\b`, insensible à la casse) plutôt
 * qu'un simple `includes` : évite les faux positifs type `inhal` matchant
 * `Kinhale`, `dose` matchant `doseé`, etc. Les patterns doivent rester
 * assez stricts pour refléter un usage métier santé, pas une simple
 * coïncidence lexicale.
 */
export const FORBIDDEN_HEALTH_KEYWORDS: readonly string[] = [
  // Doses / prises
  'dose',
  'doses',
  'prise',
  'prises',
  'puff',
  'puffs',
  'bouffée',
  'bouffées',
  'bouffees',
  'inhalation',
  'inhalations',
  'inhaler',
  'inhaleur',
  // Types de pompe (rescue / maintenance)
  'rescue',
  'secours',
  'maintenance',
  'controller',
  'pompe',
  'pompes',
  'pump',
  'pumps',
  // Symptômes / médical
  'symptom',
  'symptome',
  'symptôme',
  'crise',
  'asthme',
  'asthma',
  'wheezing',
  'wheeze',
  'cough',
  'toux',
  // Noms de molécules / marques répandues
  'ventolin',
  'salbutamol',
  'flovent',
  'fluticasone',
  'symbicort',
  'pulmicort',
  'budesonide',
  'seretide',
  'qvar',
  'airomir',
  // Marqueurs identité
  'enfant',
  'enfants',
  'child',
  'children',
  'patient',
];

/**
 * Allowlist de chaînes **connues-safe** qui contiennent un mot-clé santé
 * comme sous-chaîne (faux positifs documentés). Le matcher les retire
 * avant de chercher une fuite.
 *
 * - `Kinhale` : nom du produit, contient `inhal`. Retiré volontairement.
 * - `Nouvelle activité` : body RM16 figé — aucun mot-clé dedans, mais on
 *   le whiteliste pour documenter que ce texte passe le filtre.
 */
const SAFE_SUBSTRINGS: readonly string[] = ['Kinhale', 'Nouvelle activité'];

/**
 * Détecte un mot-clé santé via matching **substring insensible à la casse**,
 * mais en retirant d'abord les {@link SAFE_SUBSTRINGS} connues-safe pour
 * éviter les faux positifs (ex: `Kinhale` contient `inhal`).
 *
 * Ce matching tolérant (substring plutôt que `\b`) permet de détecter les
 * formes camelCase (`childName`, `doseAmount`) et snake_case (`pump_id`)
 * qui fuiteraient du santé via des clés JSON custom.
 */
export function containsForbiddenHealthKeyword(payload: unknown): string | null {
  let serialized = JSON.stringify(payload).toLowerCase();
  for (const safe of SAFE_SUBSTRINGS) {
    serialized = serialized.split(safe.toLowerCase()).join('');
  }
  for (const kw of FORBIDDEN_HEALTH_KEYWORDS) {
    if (serialized.includes(kw.toLowerCase())) {
      return kw;
    }
  }
  return null;
}
