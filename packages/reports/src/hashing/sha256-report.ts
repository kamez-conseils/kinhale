import { sha256HexFromString } from '@kinhale/crypto';

/**
 * Hash SHA-256 du contenu HTML canonique du rapport (RM24).
 *
 * **Contrat** :
 * - L'argument `canonicalContent` est la source textuelle unique servant à
 *   la fois à la génération PDF (via `expo-print` ou `jsPDF.html()`) et au
 *   calcul du hash.
 * - Le hash est recalculable par n'importe quel tiers qui détient la même
 *   source : cela permet au médecin (ou un auditeur interne) de vérifier
 *   l'intégrité en comparant au pied de page du PDF.
 * - Délègue à `@kinhale/crypto.sha256HexFromString` — **aucun** `node:crypto`,
 *   **aucune** ré-implémentation logicielle (CLAUDE.md §Règles de code).
 *
 * Refs: RM24 (intégrité rapport), ADR-D12 (génération client-side).
 */
export async function hashReportContent(canonicalContent: string): Promise<string> {
  return sha256HexFromString(canonicalContent);
}
