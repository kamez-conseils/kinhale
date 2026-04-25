/**
 * Builder du `README.txt` bilingue inclus dans l'archive de portabilité.
 *
 * Le README a deux rôles :
 * 1. **Conformité RGPD/Loi 25** : informer l'utilisateur du contenu, du
 *    contexte et de ses droits. Il sert aussi de preuve d'exercice du
 *    droit à la portabilité.
 * 2. **Intégrité** : énumère le hash SHA-256 individuel de chaque autre
 *    fichier de l'archive. Un consommateur tiers peut recalculer ces hashes
 *    et vérifier qu'aucun fichier n'a été altéré pendant le transit.
 *
 * Le README ne contient **aucune** donnée santé, **aucune** interprétation
 * médicale (RM27 — disclaimer), **aucune** clé cryptographique.
 *
 * Refs: ADR-D14, KIN-085, RM27.
 */

/**
 * Métadonnées passées au builder. Pas d'i18next ici — on inline les deux
 * langues pour garder cette fonction pure et facilement testable. C'est
 * cohérent avec le critère d'acceptation E9-S02 (i18n FR + EN).
 */
export interface BuildReadmeArgs {
  readonly accountId: string;
  readonly householdId: string;
  readonly generatedAtMs: number;
  readonly appVersion: string;
  /** Hashes individuels par nom de fichier — recopiés tels quels dans le README. */
  readonly fileHashes: Readonly<Record<string, string>>;
}

/**
 * Construit la chaîne UTF-8 finale du `README.txt`.
 *
 * Format :
 * - Section FR — disclaimer + contenu + intégrité.
 * - Séparateur visible.
 * - Section EN — symétrique.
 *
 * Pure : pas de `Date.now()` caché, pas d'I/O, retour string déterministe
 * pour des inputs déterministes.
 */
export function buildPrivacyReadme(args: BuildReadmeArgs): string {
  const dateIso = new Date(args.generatedAtMs).toISOString();
  const hashTable = renderHashTable(args.fileHashes);

  const fr = [
    '=============================================================',
    'Kinhale — Archive de portabilité (RGPD art. 20 / Loi 25 art. 30)',
    '=============================================================',
    '',
    `Date d'export      : ${dateIso}`,
    `Version Kinhale    : ${args.appVersion}`,
    `Identifiant compte : ${args.accountId}`,
    `Identifiant foyer  : ${args.householdId}`,
    '',
    '--- À propos de cette archive ---------------------------------',
    '',
    "Cette archive contient l'intégralité des données personnelles que",
    'vous avez saisies dans Kinhale, ainsi que les métadonnées techniques',
    'que le service relais Kamez Conseils détient à votre sujet.',
    '',
    "Le service relais n'a JAMAIS accès à vos données de santé. Cette",
    'archive a été produite intégralement sur votre appareil ; le serveur',
    "n'a fourni que les métadonnées non-santé qui vous concernent",
    '(devices enregistrés, audit trail, préférences de notification).',
    '',
    "--- Contenu de l'archive --------------------------------------",
    '',
    '- health-data.json     : journal complet des prises, pompes, plan,',
    '                         enfant et aidants (format JSON).',
    '- health-data.csv      : même journal en format CSV (compatible',
    '                         tableurs).',
    '- health-report.html   : rapport synthétique (à imprimer en PDF).',
    '- relay-metadata.json  : métadonnées non-santé du serveur Kamez.',
    '- README.txt           : le présent fichier.',
    '',
    '--- Disclaimer ------------------------------------------------',
    '',
    'Kinhale est un outil de suivi et de coordination. Il ne remplace pas',
    'un avis médical. Cette archive ne contient aucune interprétation',
    'médicale, aucune recommandation de dose, aucun diagnostic.',
    '',
    '--- Intégrité (SHA-256) ---------------------------------------',
    '',
    hashTable,
    '',
    '--- Vos droits ------------------------------------------------',
    '',
    "Vous pouvez demander à tout moment l'effacement de vos données",
    'depuis l\'écran "Paramètres → Confidentialité → Supprimer mon',
    'compte". L\'effacement est effectif sous 30 jours maximum (délai',
    'technique de purge des sauvegardes rotatives).',
    '',
    'Pour toute question : security@kinhale.health',
    '',
  ].join('\n');

  const en = [
    '=============================================================',
    'Kinhale — Data portability archive (GDPR art. 20 / Quebec Law 25 art. 30)',
    '=============================================================',
    '',
    `Export date    : ${dateIso}`,
    `Kinhale version: ${args.appVersion}`,
    `Account ID     : ${args.accountId}`,
    `Household ID   : ${args.householdId}`,
    '',
    '--- About this archive ----------------------------------------',
    '',
    'This archive contains all the personal data you entered into',
    'Kinhale, as well as the technical metadata held about you by',
    'the Kamez Conseils relay service.',
    '',
    'The relay service NEVER accesses your health data. This archive',
    'was generated entirely on your device; the server only provided',
    'the non-health metadata that concerns you (registered devices,',
    'audit trail, notification preferences).',
    '',
    '--- Archive contents -----------------------------------------',
    '',
    '- health-data.json    : complete journal of doses, pumps, plan,',
    '                        child and caregivers (JSON format).',
    '- health-data.csv     : same journal in CSV format (spreadsheet',
    '                        compatible).',
    '- health-report.html  : summary report (printable to PDF).',
    '- relay-metadata.json : non-health metadata from the Kamez relay.',
    '- README.txt          : this file.',
    '',
    '--- Disclaimer -----------------------------------------------',
    '',
    'Kinhale is a tracking and coordination tool. It does not replace',
    'medical advice. This archive contains no medical interpretation,',
    'no dose recommendation, no diagnosis.',
    '',
    '--- Integrity (SHA-256) --------------------------------------',
    '',
    hashTable,
    '',
    '--- Your rights ----------------------------------------------',
    '',
    'You can request deletion of your data at any time from the',
    'in-app screen "Settings → Privacy → Delete my account". Deletion',
    'is effective within 30 days maximum (technical delay for rolling',
    'backup purges).',
    '',
    'For any question: security@kinhale.health',
    '',
  ].join('\n');

  return `${fr}\n\n${en}`;
}

/**
 * Tableau aligné `nom_de_fichier  hash`. Trie par nom de fichier pour la
 * reproductibilité.
 */
function renderHashTable(fileHashes: Readonly<Record<string, string>>): string {
  const entries = Object.keys(fileHashes)
    .sort()
    .map((name): [string, string] => [name, fileHashes[name] ?? '']);
  if (entries.length === 0) {
    return '(aucun fichier / no file)';
  }
  const maxNameLen = Math.max(...entries.map(([name]) => name.length));
  return entries.map(([name, hash]) => `${name.padEnd(maxNameLen, ' ')}  ${hash}`).join('\n');
}
