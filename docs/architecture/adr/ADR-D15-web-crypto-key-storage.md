# ADR-D15 — Stockage des clés cryptographiques côté web : pattern device-bound (sans PIN v1.0)

**Date** : 2026-04-24
**Statut** : Accepté
**Décideurs** : Martial Kaljob (Kamez Conseils)

> **Note de numérotation** : l'ADR-D14 (privacy export) mentionne un ADR-D15 dédié au pattern wormhole `fragment-as-key`. Au moment de la rédaction de cet ADR, ce pattern wormhole n'a pas encore été ouvert ; il sera renuméroté en **ADR-D16** (mutualisation rapport médecin + privacy export wormhole, v1.1). Le présent ADR-D15 traite du **stockage des clés cryptographiques côté web**, problème distinct identifié par l'audit transverse `kz-securite-AUDIT-TRANSVERSE.md` (BLOQUANTS B1 + B2).

## Contexte

L'audit transverse de sécurité (réalisé par `kz-securite` le 2026-04-23) a identifié **deux bloquants critiques** sur l'application web qui cassent la promesse zero-knowledge du produit :

### B1 — `getGroupKey(householdId)` dérivait la clé symétrique du foyer publiquement

```ts
// Code initial — apps/web/src/lib/device.ts:48-52
export async function getGroupKey(householdId: string): Promise<Uint8Array> {
  const hex = await sha256HexFromString(`${householdId}:kinhale-dev-v1`);
  return new Uint8Array(Buffer.from(hex, 'hex'));
}
```

La clé qui chiffre **tous** les blobs Automerge envoyés au relais (doses, symptômes, pompes, plan, enfant) était calculée comme `SHA-256(householdId || "kinhale-dev-v1")`. Le `householdId` est un claim JWT visible par le relais et tout aidant invité — la clé était donc **calculable par le relais lui-même**. La promesse zero-knowledge était entièrement cassée pour les utilisateurs web. Un opérateur du relais (ou un attaquant qui dump la BDD Postgres + lit l'env) pouvait déchiffrer toutes les mailbox de tous les foyers web.

### B2 — Clé secrète Ed25519 du device stockée en clair dans `localStorage`

```ts
// Code initial — apps/web/src/lib/device.ts:42-44
localStorage.setItem(DEVICE_KEY_STORAGE, JSON.stringify({
  publicKeyHex,
  secretKeyBase64, // <- clé Ed25519 secrète en clair
}));
```

La clé Ed25519 secrète qui signe les `SignedEventRecord` (preuve d'authenticité d'un événement domaine type `DoseAdministered`) était sérialisée en base64 dans `localStorage`, accessible par tout JS du même origin. Une seule XSS, un seul script tiers compromis (analytics, polyfill, dépendance NPM compromise) → vol → forge d'événements (faux historique médical, ligne rouge produit RM18).

Le mobile était **OK** : `apps/mobile/src/lib/device.ts` utilise déjà `expo-secure-store` (Keychain iOS / Android Keystore). La refacto demandée est strictement web.

## Options évaluées

### Option A — PIN/passphrase utilisateur Argon2id (rejetée pour v1.0)

**Description** : l'utilisateur saisit un PIN ou une passphrase au démarrage de l'app. Argon2id (paramètres OWASP 2024) dérive une `wrapping key` AES-GCM 256 bits. Le keypair Ed25519 et la `groupKey` sont chiffrés par cette wrapping key et persistés dans IndexedDB.

**Avantages** :
- Protection forte contre l'attaquant local (vol de profil navigateur).
- Aligné avec le standard de l'industrie (1Password, Bitwarden, etc.).
- Facilement combinable avec la seed BIP39 pour la récupération.

**Inconvénients pour v1.0** :
- **UX rébarbative** : un PIN/passphrase à chaque ouverture d'onglet est un dealbreaker pour le persona « grand-mère 68 ans qui ouvre Kinhale 2× par jour ».
- Risque d'oubli → support overhead → tickets de récupération → exposition légale (Loi 25 art. 30 — droit à la portabilité, mais pas si on a perdu son PIN).
- Coût ingénierie ~3-4 j (UX onboarding + écran déverrouillage + intégration recovery seed BIP39 → wrapper Argon2id).

**Décision** : reporté à v1.1 comme **option** (settings utilisateur sensible) plutôt que défaut.

### Option B — WebAuthn / passkey local (rejetée — immature)

**Description** : utiliser une passkey synchronisée via iCloud/Google Passwords pour wrapper la clé crypto.

**Inconvénients** :
- API `PRF` extension (CTAP2) encore peu répandue sur les navigateurs principaux (Chrome 116+ Beta uniquement à la rédaction).
- Synchronisation iCloud/Google bypass le zero-knowledge (Apple/Google détiennent la passkey).
- Impossible de tester sans environnement mobile (la plupart des passkeys exigent du biométrique device).
- Dépendance sur fournisseurs tiers — incompatible self-hosting AGPL strict.

**Décision** : pas dans v1.0, à réévaluer en 2027 si la spec PRF se stabilise.

### Option C — Device-bound key wrap WebCrypto + IndexedDB (retenue)

**Description** :
1. Au premier démarrage, le navigateur génère une **wrapping key AES-GCM 256 bits non-extractable** via `subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])`.
2. Cette `CryptoKey` est persistée dans **IndexedDB** (qui supporte nativement `structuredClone` des `CryptoKey` non-extractables — la matière de clé reste dans le keystore interne du navigateur).
3. Toute donnée sensible (`secretKey` Ed25519, `groupKey` symétrique foyer) est chiffrée avec cette wrapping key avant persistance dans IndexedDB.

**Avantages** :
- **Zero-knowledge restauré** : la wrapping key n'est jamais sérialisée hors du navigateur, ne quitte jamais le device, n'est pas exfiltrable via `localStorage` (qui ne supporte pas les `CryptoKey` non-extractables).
- **UX simple** : aucun PIN, déverrouillage transparent.
- **Faible coût ingénierie** (~1 j) : uniquement de l'API standard WebCrypto + IndexedDB.
- **Pattern compatible self-hosting AGPL** : ne dépend d'aucun service externe.
- **Anti-régression localStorage** : un test asserte explicitement que `localStorage` reste vide.

**Inconvénients / dette acceptée** :
- **XSS active** : un script malveillant exécuté dans l'origine peut, le temps de la XSS, obtenir une référence au `CryptoKey` et appeler `subtle.decrypt()`. Le pattern borne le risque à la **durée** de la XSS (vs `localStorage` qui exfiltre aussi en post-incident, sur n'importe quel autre device en répliquant le profil).
  - Atténué par : CSP stricte (à durcir en CI, futur ticket), pas d'analytics tiers en v1.0, audit dépendances Snyk + Dependabot.
- **Aucune récupération en cas de purge profil navigateur** : si l'utilisateur efface son profil Chrome, son keypair et sa groupKey sont perdus → il doit réauthentifier (magic link) et ré-rejoindre le foyer via QR invite. Acceptable car ce flux existe déjà en v1.0.
- **Pas de PIN** : un voleur de l'ordinateur déverrouillé peut accéder aux données. Atténuation utilisateur : verrouiller la session OS. Atténuation produit (v1.1) : option PIN.

## Critères de décision

1. **Conformité zero-knowledge** (CLAUDE.md §1) : priorité absolue. A, C cochent. B partiellement (passkey iCloud).
2. **UX v1.0** : C trivial, A pénible, B impossible côté grand-mère.
3. **Coût v1.0** (13 semaines / ~260 k$ CAD) : C ≈ 1 j-dev, A ≈ 3-4 j, B ≈ 5+ j.
4. **Compatible AGPL self-hosting** : C oui, B non.
5. **Anti-XSS** : aucune des trois n'est totalement immune ; C borne dans le temps, A exigerait re-saisie PIN, B passkey idem.

## Décision

**Choix retenu : Option C — device-bound key wrap WebCrypto + IndexedDB, sans PIN, en v1.0.**

Le pattern :
- Module `apps/web/src/lib/secure-store.ts` expose `secureStorePut/Get/Delete` et masque la wrapping key.
- `apps/web/src/lib/device.ts` :
  - `getOrCreateDevice()` lit/écrit `device-keypair-v1` via `secureStore` (plus de `localStorage`).
  - `getGroupKey(householdId)` **throw si absente** (pas de dérivation).
  - `createGroupKey(householdId)` génère une clé aléatoire 32B via libsodium et la persiste via `secureStore` (cas : ce device crée le foyer).
  - `setGroupKey(householdId, key)` accepte une clé reçue (cas : QR invite).
- `apps/web/src/app/auth/verify/page.tsx` appelle `createGroupKey(householdId)` après auth (idempotent).

## Conséquences

**Positives** :
- Zero-knowledge web restauré au niveau du mobile.
- Aucune nouvelle dépendance externe (`idb` et `fake-indexeddb` étaient déjà dans le monorepo pour d'autres usages).
- Tests anti-régression critiques :
  - `localStorage.getItem(DEVICE_KEY_STORAGE)` retourne `null` après refacto.
  - Le ciphertext stocké en IndexedDB ne contient pas les bytes du plaintext.
  - `getGroupKey(householdId)` throw si pas de clé locale (plus de dérivation publique).
- Compatible mobile : la séparation `getGroupKey` (lecture stricte) / `createGroupKey` (création explicite) / `setGroupKey` (réception via QR) reflète le contrat déjà présent côté mobile.

**Négatives / dette acceptée** :
- Pas de PIN/passphrase. Voir ticket v1.1 ci-dessous.
- Pas de récupération automatique. La récupération via seed BIP39 reste à brancher (existe déjà côté `packages/crypto/src/seed/bip39.ts` mais non câblée web v1.0).
- **Flux QR invite côté web non implémenté** : le multi-device sur web nécessite que la `groupKey` du foyer soit transmise du device admin au device invité. En l'état v1.0, chaque aidant qui ouvre l'app web crée sa propre `groupKey` locale via `createGroupKey()` — donc **les aidants web ne se synchronisent pas entre eux** (le mobile reste OK). Tracé en issue de suivi (ci-dessous) comme **bloquant v1.0 multi-aidant web**.

**Plan d'implémentation (couvert par cette PR)** :
- `apps/web/src/lib/secure-store.ts` (nouveau) — wrapper IndexedDB + WebCrypto.
- `apps/web/src/lib/device.ts` (refacto complet) — plus de `localStorage`, plus de dérivation.
- `apps/web/src/lib/sync/index.ts` (helper bootstrap) — `deriveGroupKeyForBootstrap` qui crée si absente, à supprimer dès KIN-025-web livré.
- `apps/web/src/app/auth/verify/page.tsx` — appelle `createGroupKey` après auth.
- `apps/web/src/lib/__tests__/secure-store.test.ts` — round-trip + anti-régression confidentialité.
- `apps/web/src/lib/__tests__/device.test.ts` — anti-régression `localStorage` vide + `getGroupKey` throws.

## Tickets de suivi

- **[v1.0 BLOQUANT multi-aidant web] — flux QR invite côté web**
  Acceptation d'invitation : décryptage du payload E2EE → `setGroupKey(householdId, key)`. Sans cela, deux aidants web ne se synchronisent pas. Le ticket doit être planifié avant le go-live web v1.0.

- **[v1.1] — Option PIN/passphrase Argon2id pour utilisateurs sensibles**
  Branche un PIN (optionnel, désactivé par défaut) qui dérive une 2nd wrapping key Argon2id, superposée à la wrapping key device-bound. Couvre la menace du voleur d'ordinateur.

- **[v1.1] — Recovery via seed BIP39 web**
  Brancher `seedPhraseToBytes` → dérivation déterministe d'un 2nd device keypair pour permettre la restauration sur un nouveau navigateur sans réauthentification e-mail.

- **[v1.1] — Hardening CSP**
  Strict CSP (`script-src 'self'`, `connect-src` limité aux domaines Kamez), sub-resource integrity sur tous les scripts tiers. Atténue le risque XSS résiduel du pattern device-bound.

## Statut futur

ADR **Accepté** pour la v1.0. Revue prévue :
1. Si une CVE majeure touche `crypto.subtle.generateKey` non-extractable sur Chrome/Firefox/Safari (improbable — primitive standardisée depuis 2014).
2. Si l'option PIN v1.1 est livrée, mise à jour pour acter le pattern combiné (device-bound + PIN).
3. Si la spec WebAuthn `PRF` extension devient stable et largement supportée, réévaluer comme alternative à `subtle.generateKey`.
