import { sha256HexFromString } from '@kinhale/crypto';
import { DomainError } from '../errors';

/**
 * RM24 — Intégrité rapport (SPECS §4 RM24 + §10).
 *
 * Chaque PDF exporté par Kinhale embarque en pied de page trois éléments
 * permettant de détecter une falsification a posteriori :
 * 1. un **hash SHA-256** du contenu canonique du rapport ;
 * 2. un **timestamp ISO-8601 UTC** de génération ;
 * 3. le **nom + version** du générateur (ex: `kinhale-api/0.1.0`).
 *
 * Ce module produit la structure typée `ReportIntegrityFooter` à partir
 * d'une représentation canonique du rapport (liste ordonnée de blocs).
 * Aucune I/O : la génération réelle du PDF est faite en dehors, côté
 * `apps/api` ; RM24 lui fournit seulement les données à imprimer.
 *
 * ## Encodage canonique anti-collision
 *
 * Le hash est calculé sur une chaîne UTF-8 construite en concaténant,
 * pour chaque bloc, le motif :
 *
 * ```text
 * [kind:<byteLength>]\n<text>\n
 * ```
 *
 * où `byteLength` est la longueur **en octets UTF-8** du `text`. Chaque
 * bloc est ainsi **auto-délimité** — un bloc ne peut pas en simuler
 * deux, quels que soient les caractères de son `text` (même s'il
 * contient `\n`, `---`, ou un motif `[kind:N]` en clair). La longueur
 * dénombrée en octets évite l'ambiguïté des surrogate pairs UTF-16.
 *
 * Ce choix est plus simple qu'un préfixe de longueur binaire pur
 * (JSON canonique / TLV) tout en étant démontrablement injectif : deux
 * listes de blocs différentes produisent des chaînes différentes, donc
 * (sous hypothèse SHA-256) des hashs différents.
 *
 * ## Portée du hash
 *
 * Le `contentHash` couvre **uniquement le contenu** (ordre + kind +
 * text des blocs). Il ne couvre pas `generatedAtUtc` ni `generator` :
 * deux rapports identiques générés à deux dates distinctes partagent le
 * même `contentHash`. Cette séparation simplifie l'audit : on peut
 * regénérer le même rapport plus tard et comparer son hash sans se
 * soucier du timestamp. Timestamp et générateur sont imprimés dans le
 * pied de page en clair, signés implicitement par la stack de signature
 * de l'API (hors périmètre RM24).
 *
 * ## Modèle de menace
 *
 * RM24 protège contre la **falsification non détectée** : un tiers qui
 * modifie le contenu du PDF (ex: changer une dose) sans recalculer le
 * hash est immédiatement détectable en re-hashant le contenu. Le hash
 * n'est **pas signé cryptographiquement** : un attaquant qui maîtrise
 * le pipeline de génération peut produire un rapport arbitraire avec
 * un hash cohérent. Une signature Ed25519 par clé de foyer viendra en
 * v1.1+ (hors périmètre v1.0).
 *
 * ## Normalisation Unicode
 *
 * La chaîne canonique est hachée **telle quelle en UTF-8**, sans
 * normalisation NFC/NFD préalable. Conséquence : `"é"` composé (U+00E9)
 * et `"é"` décomposé (U+0065 + U+0301) produisent deux hashs distincts
 * même s'ils s'affichent identiquement. Choix délibéré : injectivité
 * stricte + simplicité, pas de sur-normalisation qui pourrait cacher
 * une modification. Les producteurs de rapports (Kinhale API, futurs
 * clients) doivent émettre en NFC par défaut via
 * `String.prototype.normalize('NFC')` avant d'appeler cette règle.
 *
 * ## Règle monorepo
 *
 * Le hash transite par `@kinhale/crypto` (SubtleCrypto) — AUCUN import
 * direct de `node:crypto` ni `globalThis.crypto` ici. Conformément à
 * CLAUDE.md §Principes : « Primitives crypto : uniquement via
 * `packages/crypto` ».
 */

/** Version du format de pied d'intégrité. Incrémentée si l'encodage change. */
export const REPORT_INTEGRITY_FOOTER_VERSION = '1';

/** Catégorie d'un bloc de contenu du rapport. Ordre d'apparition = sémantique. */
export type ReportBlockKind = 'dose' | 'plan' | 'caregiver' | 'metadata' | 'disclaimer';

/**
 * Un bloc atomique du rapport. Le `text` est la représentation textuelle
 * canonique du bloc, pas son rendu visuel (les styles PDF ne sont pas
 * hachés — on signe le fait, pas sa mise en forme).
 */
export interface ReportContentBlock {
  readonly kind: ReportBlockKind;
  readonly text: string;
}

/**
 * Pied d'intégrité imprimé en bas de chaque PDF exporté. Structure stable,
 * versionnée via {@link REPORT_INTEGRITY_FOOTER_VERSION}.
 */
export interface ReportIntegrityFooter {
  /** SHA-256 du contenu canonique (64 caractères hex minuscules). */
  readonly contentHash: string;
  /** Timestamp UTC ISO-8601 de génération du rapport (incl. millisecondes). */
  readonly generatedAtUtc: string;
  /** Identifiant du générateur (ex: `kinhale-api/0.1.0`). */
  readonly generator: string;
  /** Version du format de pied. Cf. {@link REPORT_INTEGRITY_FOOTER_VERSION}. */
  readonly version: typeof REPORT_INTEGRITY_FOOTER_VERSION;
}

/**
 * Encodage canonique d'une liste de blocs. Chaque bloc est préfixé par
 * `[kind:byteLength]\n` (où byteLength = longueur UTF-8 du text) puis
 * suivi du `text` et d'un `\n` final. Injectif : deux listes différentes
 * produisent deux chaînes différentes (voir discussion dans le JSDoc du
 * module).
 */
function canonicalize(content: ReadonlyArray<ReportContentBlock>): string {
  const encoder = new TextEncoder();
  let out = '';
  for (const block of content) {
    const byteLength = encoder.encode(block.text).byteLength;
    out += `[${block.kind}:${byteLength}]\n${block.text}\n`;
  }
  return out;
}

/**
 * RM24 — calcule le pied d'intégrité d'un rapport exporté.
 *
 * @throws {DomainError} `RM24_INVALID_GENERATOR` si `generator` est vide ou
 *   composé uniquement de whitespace.
 */
export async function computeReportIntegrityFooter(options: {
  readonly content: ReadonlyArray<ReportContentBlock>;
  readonly generatedAtUtc: Date;
  readonly generator: string;
}): Promise<ReportIntegrityFooter> {
  if (options.generator.trim().length === 0) {
    throw new DomainError(
      'RM24_INVALID_GENERATOR',
      'generator must be a non-empty, non-whitespace string (ex: "kinhale-api/0.1.0").',
    );
  }

  const canonical = canonicalize(options.content);
  const contentHash = await sha256HexFromString(canonical);

  return {
    contentHash,
    generatedAtUtc: options.generatedAtUtc.toISOString(),
    generator: options.generator,
    version: REPORT_INTEGRITY_FOOTER_VERSION,
  };
}

/**
 * RM24 — vérifie qu'un pied d'intégrité correspond bien à un contenu.
 *
 * Ne lève jamais : retourne `false` pour toute divergence (hash qui ne
 * matche pas, format hex invalide, bloc ajouté/retiré, ordre altéré).
 * Utilisé côté re-lecture d'un rapport archivé ou côté CI snapshot.
 */
export async function verifyReportIntegrityFooter(options: {
  readonly content: ReadonlyArray<ReportContentBlock>;
  readonly footer: ReportIntegrityFooter;
}): Promise<boolean> {
  try {
    const canonical = canonicalize(options.content);
    const expected = await sha256HexFromString(canonical);
    return expected === options.footer.contentHash;
  } catch {
    return false;
  }
}
