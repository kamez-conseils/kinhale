# Design System — Kinhale v1.0

> Rédigé par **kz-design-system** le 2026-04-20 — Client : Martial (martial@wonupshop.com)
> Amont : `00-kz-branding.md`, `00-kz-ux-research.md`, `00-kz-designer.md`, `00-kz-conformite.md`, `00-kz-conformite-qr-onboarding.md`, `00-kz-architecture.md`
> Aval : kz-frontend (implémentation `packages/ui`), kz-copywriting (microcopie), kz-qa (tests visuels + a11y), kz-design-review (conformité visuelle)

---

## Préambule

Ce livrable définit **le design system Kinhale v1.0**, directement exploitable par l'équipe frontend. Il traduit :

- L'identité de marque (cf. `00-kz-branding.md` §5) — palette vert sauge `#2F6B5A`, ambre miel, terracotta secours strict, ardoise chaude, Inter + Fraunces + JetBrains Mono.
- Les 10 principes d'interaction non-négociables (cf. `00-kz-ux-research.md` §8 et `00-kz-designer.md` §1) — test Lise, non-célébration, calme systématique, non-DM.
- Les 10 décisions design validées 2026-04-20 et les 6 ajustements conformité bloquants (cf. `00-kz-designer.md` en-tête).
- Les 51 écrans et 20+ composants récurrents spécifiés par kz-designer.

Le système cible une **parité parfaite mobile + web** via **Tamagui 1.x** (tokens compilés à la build, primitive design system partagée entre React Native 0.74+ et Next.js 15 + React Native Web — cf. `00-kz-architecture.md` §1). Le fallback StyleSheet natif + tokens maison est acté en cas d'échec Sprint 0 sur le build Tamagui.

**Ce livrable n'est pas négociable sur cinq points** :

1. **Parité WCAG 2.1 AA clair + sombre** sur chaque token couleur, chaque composant, chaque état.
2. **Touch targets ≥ 44 × 44 pt** sur tout élément interactif, même au prix du design.
3. **Aucune composante prescriptive ni célébratoire** — la ligne rouge dispositif médical et le principe DP9 priment sur toute considération esthétique.
4. **Bilinguisme FR-CA, FR-FR, EN-CA, EN-INT** dès le commit #1 — tous les composants doivent accepter des longueurs de texte variables (FR ≈ +25 % vs EN).
5. **Terracotta `#B94A3E` strictement réservée au flow pompe de secours**. Son utilisation décorative, destructive ou marketing est un incident P1.

---

## Table des matières

1. Philosophie et principes directeurs
2. Tokens de design (Tamagui-ready)
3. Composants — spécifications complètes
4. Règles d'accessibilité opérationnelles
5. Règles i18n opérationnelles
6. Gestion du mode sombre
7. Motion guidelines
8. Conventions de nommage et structure de package
9. Stratégie de test du design system
10. Roadmap d'implémentation et effort estimatif
11. Documentation exploitable
12. Risques résiduels et points à valider

---

## 1. Philosophie et principes directeurs

### 1.1. Les 10 principes d'interaction traduits en règles de conception

Chaque principe UX (DP1–DP10 ref `00-kz-designer.md` §1) est ici **opérationnalisé à l'échelle composant**. Tout composant livré doit pouvoir être passé en revue selon cette checklist.

| # | Principe | Règle de conception composant |
|---|---|---|
| **DP1** | Test Lise — lisible en 5 secondes, d'une main | Tout composant interactif : touch target ≥ 44 × 44 pt, texte d'action ≥ 18 px, contraste AAA souhaitable. `Button` primaire ≥ 56 px hauteur, icône minimum 24 × 24 pt dans IconButton. |
| **DP2** | Recovery seed = moment de confiance | `SeedCell`, `SeedGrid`, `SeedConfirmation` isolés dans `kinhale/` avec typographie Fraunces (titre) + JetBrains Mono (mots). Jamais `seed`, `BIP39`, `mnemonic` dans les props, labels ou variants — uniquement `SeedCell`, `SeedGrid`, `recoveryWord`. |
| **DP3** | Ni peur ni minimisation | Aucune variante `error` ne doit utiliser de `!` dans ses defaults i18n. Couleur d'erreur = terracotta **uniquement** via `color.action.emergency` (réservé secours) — l'état destructif générique utilise `color.action.destructive` = terracotta désaturée (`#A16456`) pour éviter la confusion. |
| **DP4** | Une action principale | `Button` propose `variant="primary"` unique par écran dans Storybook ; ESLint custom rule recommandée — détection de deux `<Button variant="primary">` dans un même `Screen`. Tab bar limitée à 3 items max (pas de variante `TabBar size="large"` à 5 tabs). |
| **DP5** | Hors-ligne = mode, pas erreur | `OfflineBadge` = `variant="chip"` discret, jamais modale. État offline tokenisé via `color.status.offline` = ardoise `#6B7280`, pas de rouge. `Banner` `variant="offline"` disponible pour messages sync rassurants. |
| **DP6** | Vocabulaire = sécurité juridique | Props `intent` évitent `warning-critical`, `danger-severe`, `emergency-medical`. Vocabulaire contrôlé : `intent: primary \| secondary \| ghost \| destructive \| emergency`. `emergency` = uniquement flow pompe de secours. |
| **DP7** | Notifications opaques en contenu, expressives en design | `NotificationOpaque` (in-app) peut nommer l'aidant et la pompe. Token `motion.notificationEnter` dédié, doux. Push OS = payload statique géré en dehors du DS. |
| **DP8** | WCAG 2.1 AA prérequis | Tous les tokens couleur sémantiques passent AA ; AAA visé sur `color.text.primary` et `color.action.emergency`. Le bundle CI bloque le merge si un composant introduit un ratio < 4.5:1. |
| **DP9** | Zéro gamification, zéro célébration | Interdiction absolue dans le DS : pas de `<Confetti>`, pas de `variant="celebration"`, pas de token `motion.celebrate`. Tests unitaires bloquent l'import de librairies de célébration (`react-canvas-confetti`, `lottie-react-native` pour animations décoratives). |
| **DP10** | L'app s'efface | `EmptyState` propose des illustrations neutres (pas d'emoji). Aucune variante `Toast intent="upsell"`. Aucune modale d'onboarding post-usage. |

### 1.2. Règles d'arbitrage visuel

Quand deux solutions design sont possibles, l'arbitrage suit cette hiérarchie (du plus fort au moins fort) :

1. **Sécurité juridique (non-DM, Loi 25/RGPD)** > toutes autres considérations. Si un composant ouvre un risque de prescription, on le supprime.
2. **Accessibilité WCAG AA** > esthétique. Un contraste insuffisant n'est jamais compensé par un effet visuel.
3. **Test Lise** (DP1) > densité d'information. En cas de doute, on agrandit le touch target et on supprime un élément secondaire.
4. **Calme** (valeur *Calme* §1.3 branding) > expressivité. Un composant animé par défaut doit justifier pourquoi.
5. **Bilinguisme FR/EN** > compacité visuelle. On prévoit +25 % de largeur pour un libellé FR, jamais de troncature sur `...`.
6. **Parité mobile + web** > fidélité native. Si un composant existe en natif (ex : `BottomSheet` iOS) mais pas en web, on priorise l'homologue cross-plateforme (Dialog plein écran mobile → Modal centrée desktop).
7. **Cohérence de tokens** > pixel perfection. Un token `space.4` (16 px) est toujours préféré à une valeur magique `15 px`.

### 1.3. Accessibilité comme défaut, pas option

L'accessibilité n'est jamais un mode additionnel. Chaque composant du DS :

- **Démarre** sur une base accessible (rôle ARIA, focus ring, touch target, contraste AAA si possible).
- **Ne peut pas** désactiver l'accessibilité (pas de prop `accessibilityHidden` sur un bouton d'action critique, pas de prop `focusable={false}` sur un `Input`).
- **Est testé** avec `jest-axe` + `@testing-library/react-native` + Playwright + axe-core en CI sur chaque écran composé (cf. §9).
- **Est documenté** avec un example Storybook d'usage VoiceOver / TalkBack attendu.

Conséquence pratique : un `IconButton` sans `aria-label` obligatoire **ne passe pas la compilation TypeScript**. Un `Banner` sans `role="status"` ou `role="alert"` explicite est un bug bloquant.

---

## 2. Tokens de design (Tamagui-ready)

Tous les tokens sont définis dans `packages/ui/src/tokens/` en TypeScript strict. Ils alimentent `createTokens()` de Tamagui et sont exportés comme types utilisables dans les composants applicatifs.

### 2.1. Couleurs — primitifs (9 niveaux par famille)

Les tokens primitifs sont **communs** clair et sombre ; la bascule se fait au niveau sémantique (§2.2). Chaque échelle est conçue pour produire, à partir de la couleur signature, des variantes utilisables pour fonds, textes, états et bordures — en respectant les contraintes de contraste.

#### Sauge (signature Kinhale — routine, actions primaires)

| Token | Hex | Usage recommandé |
|---|---|---|
| `sage.50` | `#F1F6F3` | Fond très subtil, hover léger clair |
| `sage.100` | `#DDEAE1` | Fond cartes routine |
| `sage.200` | `#B8D4C2` | Bordures douces, séparateurs actifs |
| `sage.300` | `#8FB8A2` | Icônes secondaires |
| `sage.400` | `#5C9580` | Hover button primary clair |
| `sage.500` | `#2F6B5A` | **Signature Kinhale — button primary par défaut** |
| `sage.600` | `#25584A` | Pressed state button primary |
| `sage.700` | `#1C4539` | Text on sage light bg |
| `sage.800` | `#14342B` | Fond card sombre |
| `sage.900` | `#0C201B` | Fond écran sombre extrême |

#### Amber miel (attention douce, jamais alarmiste)

| Token | Hex | Usage |
|---|---|---|
| `amber.50` | `#FAF4E8` | Fond banner attention clair |
| `amber.100` | `#F4E5C4` | Fond chip dose non confirmée |
| `amber.200` | `#EBD298` | Bordures attention |
| `amber.300` | `#DBB56A` | Icônes chip attention |
| `amber.400` | `#C9883C` | **Attention douce par défaut** — rappel à venir, seuil bas pompe |
| `amber.500` | `#B17430` | Hover attention |
| `amber.600` | `#8E5B25` | Pressed / text on amber light |
| `amber.700` | `#6B441C` | Text on amber bg |
| `amber.800` | `#4A2F13` | Fond sombre attention |
| `amber.900` | `#2A1A0B` | — |

#### Terracotta (secours **uniquement**)

| Token | Hex | Usage |
|---|---|---|
| `terracotta.50` | `#FAF0EE` | Fond carte secours historique, light |
| `terracotta.100` | `#F5DBD6` | Fond chip rescue |
| `terracotta.200` | `#E8B2A8` | — |
| `terracotta.300` | `#D78778` | — |
| `terracotta.400` | `#C5573A` | **Hover button emergency** |
| `terracotta.500` | `#B94A3E` | **Signature secours — button emergency par défaut** |
| `terracotta.600` | `#9C3D33` | Pressed button emergency |
| `terracotta.700` | `#7D3028` | Text on terracotta light bg |
| `terracotta.800` | `#5E241E` | Fond carte secours sombre |
| `terracotta.900` | `#3F1813` | — |

> **Règle stricte** : cette échelle est utilisable **exclusivement** dans les composants `kinhale/Emergency*`, `kinhale/DoseCard variant="rescue"`, `kinhale/SymptomsGrid`, `kinhale/PumpCard variant="rescue"`. Son usage dans `Button`, `Banner`, `Toast` génériques est interdit et contrôlé par une règle ESLint custom (`@kinhale/no-emergency-color-outside-rescue`).

#### Ardoise chaude (neutre, historique, désactivé)

| Token | Hex | Usage |
|---|---|---|
| `slate.50` | `#F4F3F0` | Fond désactivé clair |
| `slate.100` | `#E5E2DA` | Bordures subtiles |
| `slate.200` | `#CDC8BB` | Bordures default |
| `slate.300` | `#A8A295` | Text tertiary |
| `slate.400` | `#7F7A6C` | Text secondary |
| `slate.500` | `#6B7280` | **Passé neutre — historique, dose manquée confirmée** |
| `slate.600` | `#4F5863` | Text primary light bg |
| `slate.700` | `#3A4049` | — |
| `slate.800` | `#262B32` | Fond sombre secondaire |
| `slate.900` | `#14181D` | Fond sombre primaire |

#### Neutres (surfaces chaudes)

| Token | Hex | Usage |
|---|---|---|
| `neutral.50` | `#FAF8F4` | **Fond écran clair** (ivoire chaud) |
| `neutral.100` | `#F0ECE4` | Fond card clair |
| `neutral.200` | `#E0DAC9` | — |
| `neutral.300` | `#D9D2C4` | Bordure default clair |
| `neutral.400` | `#B8AF9A` | — |
| `neutral.500` | `#8A8373` | — |
| `neutral.600` | `#5A5345` | — |
| `neutral.700` | `#3F3A2E` | — |
| `neutral.800` | `#2C3E37` | Bordure default sombre |
| `neutral.850` | `#1C2B26` | **Fond card sombre** |
| `neutral.900` | `#14201C` | **Fond écran sombre** (forêt nuit) |
| `neutral.950` | `#0A100E` | — |

#### Vert doux (succès discret)

| Token | Hex | Usage |
|---|---|---|
| `success.400` | `#6BA68A` | Hover succès clair |
| `success.500` | `#4B8B6E` | **Confirmation prise, sync réussie** |
| `success.600` | `#3A6E56` | Text on success bg |

### 2.2. Couleurs — tokens sémantiques

Les tokens sémantiques sont **ce que consomment les composants**. Ils résolvent automatiquement en fonction du thème actif (clair ou sombre).

| Token sémantique | Clair | Sombre | Ratio contraste avec texte principal |
|---|---|---|---|
| **Backgrounds** | | | |
| `color.bg.default` | `neutral.50` `#FAF8F4` | `neutral.900` `#14201C` | base |
| `color.bg.elevated` | `#FFFFFF` | `neutral.850` `#1C2B26` | base |
| `color.bg.subtle` | `neutral.100` `#F0ECE4` | `neutral.800` via `#22332D` | base |
| `color.bg.inverse` | `neutral.900` `#14201C` | `neutral.50` `#FAF8F4` | — |
| `color.bg.overlay` | `rgba(20,32,28,0.48)` | `rgba(0,0,0,0.64)` | — |
| **Textes** | | | |
| `color.text.primary` | `#1A2420` (graphite forêt) | `#F0ECE4` (crème) | **13.1:1 / 14.8:1 — AAA** |
| `color.text.secondary` | `#5A6560` | `#B8BFB9` | **6.3:1 / 7.5:1 — AAA** |
| `color.text.tertiary` | `#7F7A6C` | `slate.300` `#A8A295` | **4.9:1 / 5.1:1 — AA** |
| `color.text.inverse` | `#F0ECE4` | `#1A2420` | — |
| `color.text.disabled` | `slate.300` | `slate.400` | 3.2:1 (non-interactive) |
| **Bordures** | | | |
| `color.border.default` | `neutral.300` `#D9D2C4` | `neutral.800` `#2C3E37` | 3.1:1 |
| `color.border.strong` | `slate.400` `#7F7A6C` | `slate.300` `#A8A295` | 4.6:1 |
| `color.border.focus` | `sage.500` `#2F6B5A` | `sage.300` `#8FB8A2` | 4.8:1 / 3.3:1 |
| **Actions** | | | |
| `color.action.primary` | `sage.500` `#2F6B5A` | `sage.400` `#5C9580` | 6.8:1 / 5.0:1 — AA / AAA texte blanc |
| `color.action.primary-hover` | `sage.400` `#5C9580` | `sage.300` `#8FB8A2` | — |
| `color.action.primary-pressed` | `sage.600` `#25584A` | `sage.500` `#2F6B5A` | — |
| `color.action.secondary` | `neutral.100` avec bordure `sage.500` | `neutral.800` avec bordure `sage.400` | — |
| `color.action.emergency` | `terracotta.500` `#B94A3E` | `terracotta.400` `#C5573A` | **5.4:1 / 4.7:1 — AA + visé AAA** |
| `color.action.emergency-hover` | `terracotta.400` | `terracotta.300` | — |
| `color.action.emergency-pressed` | `terracotta.600` | `terracotta.500` | — |
| `color.action.destructive` | `#A16456` (terracotta désaturée, **distincte** emergency) | `#C58874` | 4.5:1 / 4.6:1 — AA |
| **Statuts** | | | |
| `color.status.success` | `success.500` `#4B8B6E` | `success.400` `#6BA68A` | 4.5:1 / 4.0:1 |
| `color.status.warning` | `amber.400` `#C9883C` | `amber.300` `#DBB56A` | 3.5:1 (UI) / 4.0:1 |
| `color.status.error` | `color.action.destructive` | `color.action.destructive` dark | 4.5:1 |
| `color.status.info` | `sage.500` | `sage.300` | 6.8:1 / 3.3:1 |
| `color.status.offline` | `slate.500` `#6B7280` | `slate.400` `#7F7A6C` | 4.5:1 / 4.3:1 — **pas de rouge** |

**Vérification contraste obligatoire** : tous les tokens sont passés au Sprint 0 par un script `pnpm tokens:verify` utilisant `@adobe/leonardo-contrast-colors` ou équivalent. Le pipeline CI échoue si un ratio tombe sous AA.

> **Note destructive** : `color.action.destructive` est **volontairement distincte** de `color.action.emergency` pour respecter la règle d'usage exclusif de la terracotta secours. Destructive = terracotta désaturée (+ teinte brune), Emergency = terracotta pleine saturation. L'œil humain les distingue peu en usage normal mais la distinction est **sémantique et codée**. Un bouton *« Retirer l'aidant »* utilise `destructive`, un bouton *« Pompe de secours »* utilise `emergency`. Ils ne se mélangent **jamais**.

### 2.3. Typographie

#### Familles

```ts
// packages/ui/src/tokens/typography.ts
export const fontFamily = {
  body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  display: 'Fraunces, Georgia, serif',
  mono: 'JetBrainsMono, "SF Mono", Menlo, Consolas, monospace',
} as const;
```

- **Inter** : 99 % de l'UI. Chargement par défaut dans `apps/mobile` (expo-font) et `apps/web` (next/font).
- **Fraunces** : H1 marketing, wordmark, H1 écran onboarding mots de sécurité uniquement. Chargé par défaut dans `apps/web` (pour landing) ; chargé à la demande (`expo-font loadAsync`) dans `apps/mobile` uniquement sur l'écran recovery seed.
- **JetBrains Mono** : **uniquement** écrans recovery seed (E1.08, E7.03, E7.06) et horodatages détaillés dans `DoseCard` si activé. Chargement à la demande — jamais dans le bundle initial.

#### Échelle modulaire

| Token | Taille | Line-height | Letter-spacing | Usage conseillé |
|---|---|---|---|---|
| `text.xs` | 12 px | 1.4 (17 px) | 0.02em | Captions **non critiques** — timestamps secondaires |
| `text.sm` | 14 px | 1.5 (21 px) | 0 | Labels, metadata |
| `text.md` | 16 px | 1.6 (26 px) | 0 | **Taille de base UI (minimum WCAG)** — body par défaut |
| `text.lg` | 18 px | 1.55 (28 px) | 0 | Body confortable, onboarding |
| `text.xl` | 20 px | 1.5 (30 px) | 0 | H3 |
| `text.2xl` | 24 px | 1.4 (34 px) | 0 | H2 |
| `text.3xl` | 30 px | 1.35 (40 px) | -0.01em | H1 applicatif |
| `text.4xl` | 36 px | 1.3 (47 px) | -0.02em | Display onboarding |
| `text.5xl` | 48 px | 1.2 (58 px) | -0.02em | Display landing |
| `text.6xl` | 60 px | 1.15 (69 px) | -0.02em | Hero marketing |

#### Poids

| Token | Valeur | Usage |
|---|---|---|
| `weight.regular` | 400 | Body, descriptions |
| `weight.medium` | 500 | Labels, captions small-caps |
| `weight.semibold` | 600 | Titres, CTA primaires |
| `weight.bold` | 700 | Réservé wordmark, H1 marketing |

#### Composants typographiques pré-définis

Exposés depuis `packages/ui/src/primitives/Typography/`. Chaque composant gère Dynamic Type iOS, Font Scaling Android, et wrapping FR/EN.

| Composant | Famille | Taille | Weight | Usage |
|---|---|---|---|---|
| `Display` | Fraunces | `text.5xl` / `text.6xl` | 600 | Landing hero, onboarding slide 1 |
| `H1` | Fraunces (marketing) / Inter (app) | `text.3xl` / `text.4xl` | 600 | Titre d'écran principal |
| `H2` | Inter | `text.2xl` | 600 | Sections |
| `H3` | Inter | `text.xl` | 600 | Sous-sections |
| `Body` | Inter | `text.md` | 400 | Texte courant — **défaut UI** |
| `BodyLarge` | Inter | `text.lg` | 400 | Onboarding, disclaimers, écrans Lise |
| `Label` | Inter | `text.sm` | 500 | Libellés de formulaires, chips |
| `Caption` | Inter | `text.xs` | 500 | **Usage parcimonieux** — jamais pour info santé |
| `Mono` | JetBrains Mono | `text.md` / `text.lg` | 500 | Mots de récupération, horodatages |

**Dynamic Type — contraintes** :

- iOS : `allowFontScaling: true` par défaut, testé jusqu'à `accessibilityXXXLarge` (~200 %).
- Android : `includeFontPadding: false`, `allowFontScaling: true`, testé jusqu'à `fontScale=2.0`.
- Web : tailles en `rem` couplées à `font-size: 100%` root, media query `@supports` sur `font-size-adjust`, test Playwright à `zoom 200 %`.
- Aucune troncature : ellipsis uniquement sur noms d'aidants dans `CaregiverChip` avec `numberOfLines=1` et fallback tooltip. Tout autre composant texte **wrappe** sur plusieurs lignes.

### 2.4. Espacement

Échelle 4 px, cohérente avec `00-kz-designer.md` §6.3.

| Token | Valeur | Usage type |
|---|---|---|
| `space.0` | 0 | — |
| `space.1` | 4 px | Gap inter-icône/texte |
| `space.2` | 8 px | **Espacement minimal** entre cibles tactiles |
| `space.3` | 12 px | Padding intra-chip |
| `space.4` | 16 px | **Gutter mobile standard** |
| `space.5` | 20 px | Padding mobile md/lg |
| `space.6` | 24 px | Padding card, gutter desktop |
| `space.7` | 32 px | Section gap |
| `space.8` | 40 px | — |
| `space.9` | 48 px | Hero gap mobile |
| `space.10` | 64 px | Hero gap desktop |
| `space.11` | 80 px | — |
| `space.12` | 96 px | Sections marketing |

**Règle > 16 px entre CTA fond et CTA secours** (mandat branding §5.2) : `EmergencyDoseButton` a toujours un `marginTop` ≥ `space.4` par rapport à toute action primaire. Enforcé par le composant lui-même (props `above?: ReactNode` qui injecte un séparateur).

### 2.5. Rayons

| Token | Valeur | Usage |
|---|---|---|
| `radius.none` | 0 | Séparateurs, divisions rigides |
| `radius.sm` | 4 px | Chips petits, tags |
| `radius.md` | 8 px | Inputs, boutons secondaires |
| `radius.lg` | 12 px | **Boutons primaires, cards** |
| `radius.xl` | 16 px | Modales, bottom sheets |
| `radius.2xl` | 24 px | Cartes FAB, illustrations |
| `radius.full` | 9999 px | Avatars, pills, IconButton circulaire |

### 2.6. Élévation (5 niveaux, parité clair + sombre)

En mode sombre, l'élévation se matérialise par **un léger éclaircissement de la surface** (surface tinting Material 3) plutôt que par une ombre ; les ombres restent présentes mais plus douces pour éviter l'effet *« nuages noirs »*.

| Token | Usage | Clair (boxShadow) | Sombre (boxShadow + surface tint) |
|---|---|---|---|
| `elevation.0` | Surface plate | `none` | `none` |
| `elevation.1` | Card, list item | `0 1px 2px rgba(20,32,28,0.06), 0 1px 3px rgba(20,32,28,0.04)` | `0 1px 2px rgba(0,0,0,0.4)` + `surface +2%` |
| `elevation.2` | Menu flottant, popover | `0 4px 8px rgba(20,32,28,0.08), 0 2px 4px rgba(20,32,28,0.04)` | `0 4px 8px rgba(0,0,0,0.5)` + `surface +4%` |
| `elevation.3` | Modale, bottom sheet | `0 12px 24px rgba(20,32,28,0.12), 0 4px 8px rgba(20,32,28,0.06)` | `0 12px 24px rgba(0,0,0,0.6)` + `surface +6%` |
| `elevation.4` | Toast, notification | `0 16px 32px rgba(20,32,28,0.16), 0 8px 16px rgba(20,32,28,0.08)` | `0 16px 32px rgba(0,0,0,0.7)` + `surface +8%` |

Implémentation React Native : `shadowColor`, `shadowOffset`, `shadowOpacity`, `shadowRadius` sur iOS ; `elevation` sur Android. Les deux sont tokenisés dans `shadows.ts`.

### 2.7. Breakpoints

Alignés sur `00-kz-designer.md` §6.1 et la norme Tamagui.

| Token | Largeur min | Devices cibles |
|---|---|---|
| `bp.xs` | 0 | iPhone SE 1re gén. (min supporté) |
| `bp.sm` | 375 | iPhone 13 mini, Android compacts |
| `bp.md` | 768 | iPad mini, tablettes 7-8" |
| `bp.lg` | 1024 | iPad, iPad Pro 11", laptops compacts |
| `bp.xl` | 1280 | Laptops standard |
| `bp.2xl` | 1440 | Écrans externes |

### 2.8. Z-index

| Token | Valeur | Usage |
|---|---|---|
| `z.base` | 0 | Contenu normal |
| `z.sticky` | 10 | Header collant, tab bar |
| `z.dropdown` | 100 | Menus déroulants, autocomplete |
| `z.overlay` | 1000 | Scrim modale |
| `z.modal` | 1100 | Modale, bottom sheet |
| `z.popover` | 1200 | Popover, tooltip contextuel |
| `z.toast` | 1400 | Toast, banner critique |
| `z.debug` | 9999 | Dev only — jamais en prod |

### 2.9. Motion

#### Durées

| Token | Valeur | Usage |
|---|---|---|
| `motion.instant` | 0 ms | `prefers-reduced-motion` ou transitions élémentaires |
| `motion.fast` | 150 ms | Hover, press, micro-state changes |
| `motion.standard` | 200 ms | Transitions par défaut, toasts |
| `motion.moderate` | 300 ms | Modales, bottom sheets |
| `motion.slow` | 400 ms | Progress bar, entrées emphasis |
| `motion.onboarding` | 600 ms | Cinématique onboarding, reveal seed — **max absolu** |

#### Easings

| Token | Courbe | Usage |
|---|---|---|
| `ease.default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Ease-out par défaut |
| `ease.enter` | `cubic-bezier(0.0, 0, 0.2, 1)` | Entrée d'élément |
| `ease.exit` | `cubic-bezier(0.4, 0, 1, 1)` | Sortie d'élément |
| `ease.emphasis` | `cubic-bezier(0.2, 0, 0, 1)` | Reveal onboarding |

**Règle `prefers-reduced-motion`** : chaque composant motion-aware consulte le hook `useReducedMotion()` (détaillé §8) et **désactive translate/scale/rotate** au profit de `opacity` seule. Les durées sont conservées (pour la continuité perceptive) ou divisées par deux selon le contexte.

**Interdictions absolues** (DP9 + branding §5.6) :

- `bounce`, `spring` avec `overshoot > 1`
- Confettis, particules, célébrations
- Animation infinie sans action utilisateur (sauf skeleton shimmer, désactivable)
- Pulse persistant sur un élément d'information santé

---

## 3. Composants — spécifications complètes

Chaque composant est livré dans `packages/ui/src/<category>/<ComponentName>/`. Structure canonique :

```
ComponentName/
├── ComponentName.tsx        # Implémentation Tamagui
├── ComponentName.types.ts   # Props TypeScript
├── ComponentName.styles.ts  # Variants Tamagui
├── ComponentName.test.tsx   # Vitest + RNTL + jest-axe
├── ComponentName.stories.tsx # Storybook
└── index.ts                 # Export public
```

Les sections ci-dessous précisent l'API, les variantes, les règles d'accessibilité et d'usage. Elles sont **prescriptives** : l'implémentation doit respecter la signature, pas la réinventer.

### 3.1. Primitives (21 composants)

#### `Button`

Fichier : `packages/ui/src/primitives/Button/`. Base de toutes les actions.

**API** :

```ts
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'emergency';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  variant: ButtonVariant;
  size?: ButtonSize; // default 'md'
  children: ReactNode | string;
  onPress: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  accessibilityLabel?: string; // requis si children n'est pas une string
  accessibilityHint?: string;
  testID?: string;
  fullWidth?: boolean;
}
```

**Hauteurs minimales** :

- `sm` : 40 px (réservé actions tertiaires non critiques)
- `md` : 48 px (par défaut)
- `lg` : 56 px (CTA principaux écran d'accueil — respect DP1)

**États** :

| État | Effet visuel |
|---|---|
| default | `color.action.primary` bg, `color.text.inverse` text |
| hover (web) | `color.action.primary-hover` bg (sage.400) |
| pressed | `color.action.primary-pressed` bg (sage.600), scale 0.98 (si motion OK) |
| focus | ring 2 px `color.border.focus` offset 2 px |
| disabled | `slate.200` bg, `slate.400` text, opacity 0.7, `cursor: not-allowed` |
| loading | spinner `color.text.inverse` centré, children cachés, clic ignoré |

**Variants** :

| Variant | Fond | Texte | Usage |
|---|---|---|---|
| `primary` | `color.action.primary` | `color.text.inverse` | CTA dominant, une seule par écran |
| `secondary` | transparent + bordure `color.border.strong` | `color.text.primary` | Action secondaire |
| `ghost` | transparent | `color.action.primary` | Actions tertiaires, liens-like |
| `destructive` | `color.action.destructive` | `color.text.inverse` | Retirer aidant, supprimer pompe |
| `emergency` | `color.action.emergency` | `color.text.inverse` | **Uniquement flow secours** |

**Accessibilité** :

- `role="button"` (implicite HTML), `accessibilityRole="button"` (RN).
- `accessibilityLabel` obligatoire si `children` contient des icônes ou si le label à l'écran est ambigu.
- `accessibilityState={{ disabled, busy: isLoading }}`.
- Support `onKeyDown` web : `Enter` et `Space` déclenchent `onPress`.
- Focus visible sur `:focus-visible` en web.

**i18n** : wrapper vertical au-delà de `size.lg` + 2 lignes, wrap natif via `numberOfLines={2}` (si FR dépasse). Jamais d'ellipsis.

**Règles d'usage** :

- Une seule `variant="primary"` par écran (ESLint rule `@kinhale/single-primary-button`).
- `emergency` **uniquement** dans des composants du dossier `kinhale/Emergency*` — vérifié par lint custom.
- Jamais combinaison `iconLeft + iconRight` (ambiguïté visuelle).

---

#### `IconButton`

Fichier : `packages/ui/src/primitives/IconButton/`.

**API** :

```ts
interface IconButtonProps {
  icon: ReactNode; // Phosphor ou Lucide
  accessibilityLabel: string; // OBLIGATOIRE — compile error si absent
  onPress: () => void;
  variant?: 'default' | 'subtle' | 'ghost';
  size?: 'sm' | 'md' | 'lg'; // 32, 44, 56 px
  isDisabled?: boolean;
  tooltip?: string; // web : affichage hover
  testID?: string;
}
```

**Tailles minimales** : `sm` = 32 px (**réservé toolbar dense hors chemins critiques, avec marge invisible de 12 px atteignant 44 pt**), `md` = 44 px, `lg` = 56 px. Le `sm` n'est jamais autorisé sur un écran couvrant un parcours J1-J7.

**Accessibilité** : `accessibilityLabel` **requis au niveau TypeScript** (pas `?: string`). Focus ring 2 px.

---

#### `Link`

Texte cliquable. Support web (natif `<a>`) + mobile (`Pressable` avec underline).

**API** :

```ts
interface LinkProps {
  href?: string; // external
  onPress?: () => void; // internal router
  children: ReactNode;
  variant?: 'default' | 'subtle';
  external?: boolean; // affiche icône flèche
  accessibilityLabel?: string;
}
```

Couleur : `color.action.primary` ; underline sur hover et focus uniquement (pas de default underline pour éviter bruit visuel dans une liste).

---

#### `Input`

Fichier : `packages/ui/src/primitives/Input/`. Base des saisies.

**API** :

```ts
type InputType = 'text' | 'number' | 'password' | 'search' | 'email' | 'tel';

interface InputProps {
  value: string;
  onChange: (value: string) => void;
  type?: InputType;
  label: string; // OBLIGATOIRE
  description?: string;
  error?: string;
  placeholder?: string;
  isRequired?: boolean;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  autoComplete?: string;
  maxLength?: number;
  secureTextEntry?: boolean;
  testID?: string;
}
```

**Hauteur** : 48 px (md), 56 px (lg), pour répondre touch targets + confort.

**États** :

- default : bordure `color.border.default`, label above input.
- focus : bordure `color.border.focus` 2 px, `boxShadow 0 0 0 3px rgba(47,107,90,0.15)`.
- error : bordure `color.status.error`, texte `error` en dessous en `text.sm` rouge désaturé, icône `!` en `trailingIcon`.
- disabled : bg `slate.100`, opacity 0.7.

**Accessibilité** : `aria-describedby` lie description + erreur. `aria-invalid={!!error}`. Label toujours visible (jamais placeholder-only).

**i18n** : label wrap sur 2 lignes si FR dépasse. Description wrap illimité.

---

#### `Textarea`

Extension de `Input`. `rows={4}` par défaut, `autoExpand` optionnel. Hauteur min 96 px pour confort mobile.

---

#### `Select`

**API** :

```ts
interface SelectOption<T> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SelectProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  label: string;
  placeholder?: string;
  error?: string;
  testID?: string;
}
```

Mobile : bottom sheet `BottomSheet` natif à la tap. Web : `<select>` natif OS (pour accessibilité) ou `Popover` custom Tamagui si UI enrichie requise.

---

#### `Checkbox`

**API** :

```ts
interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  isDisabled?: boolean;
  accessibilityLabel?: string;
}
```

Taille : 24 × 24 px visuel + zone tactile 44 × 44 pt. Coche dessinée en 200 ms (motion OK) avec `ease.enter`.

**Règle Loi 25 (ajustement conformité §5.4)** : **jamais pré-coché** ; les cases de consentement sont **proscrites** au profit d'un bouton `Button variant="primary"` explicite dans `ConsentScreen`. Ce composant est utilisé pour préférences utilisateur non-consentementielles uniquement (ex : activer notif son, option technique).

---

#### `Radio` / `RadioGroup`

**API** `RadioGroup` :

```ts
interface RadioOption<T> {
  value: T;
  label: string;
  description?: string;
}
interface RadioGroupProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: RadioOption<T>[];
  name: string;
  orientation?: 'vertical' | 'horizontal'; // default vertical
}
```

Cercle 24 × 24 visuel + zone 44 × 44. Variante étendue `RadioCard` : option affichée comme une card cliquable avec icône + titre + description (usage : choix du rôle invité `Famille proche` / `Garderie ou nounou` E3.03).

---

#### `Switch`

Toggle. 44 × 24 px minimum, animation thumb 150 ms opacity (reduced-motion OFF → translate). Couleur ON : `color.action.primary`. Couleur OFF : `slate.300`.

---

#### `Slider`

**API** : `min`, `max`, `step`, `value`, `onChange`. Réservé à préférences (ex : niveau son notification). Ne pas utiliser pour saisir une dose — interdiction DP6.

---

#### `Chip`

**API** :

```ts
type ChipVariant = 'default' | 'sage' | 'amber' | 'slate' | 'success';
interface ChipProps {
  children: string;
  variant?: ChipVariant;
  leadingIcon?: ReactNode;
  onPress?: () => void; // clicable si défini
  onDismiss?: () => void; // x à droite
  size?: 'sm' | 'md';
}
```

Variant `terracotta` volontairement absent — interdit hors `DoseStatusChip` du dossier `kinhale/`.

---

#### `Tag`

Chip en lecture seule, plus compact (24 px hauteur). Usage : tags de pompes (ex : *"Salbutamol"*, *"Ventolin"*). Aucun onPress.

---

#### `Badge`

Numérique ou indicateur de statut. Taille 16 × 16 ou 20 × 20. Couleur par défaut `color.status.info` ; variantes `amber`, `slate`. **Pas de badge terracotta** — les événements de secours ne s'affichent pas en badge numérique mais dans `DoseCard variant="rescue"`.

---

#### `Avatar`

Image ronde, tailles `xs` 24, `sm` 32, `md` 40, `lg` 56, `xl` 80. Fallback sur `AvatarPastille` si pas de photo (cf. A5 — photo enfant absente par défaut).

---

#### `AvatarPastille`

**Ajustement A5 validé** : pastille initiale colorée, défaut sans photo.

**API** :

```ts
interface AvatarPastilleProps {
  initial: string; // 1-2 caractères
  colorKey: 'sage' | 'amber' | 'slate' | 'neutral' | 'success'; // NE PAS proposer 'terracotta'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  accessibilityLabel: string;
}
```

Le `colorKey` est déterminé par hash stable du nom de l'aidant (à calculer dans la couche domain, pas dans le DS), garantissant une couleur cohérente par aidant sans collision avec la sémantique des actions.

Texte : `Body` weight 600 centré, couleur `color.text.inverse`. Fond : token `sage.500` / `amber.400` / `slate.500` / `neutral.500` / `success.500`.

---

#### `Divider`

Ligne 1 px, `color.border.default`. Variante `Divider variant="section"` épaisseur 4 px, 40 px de marge verticale.

---

#### `Spinner`

Cercle en rotation. **Taille** `sm` 16, `md` 24, `lg` 32. Couleur : `color.action.primary` ou `color.text.inverse` (sur boutons primaires). Animation rotation 1000 ms linéaire, **désactivée** en `prefers-reduced-motion` au profit d'un simple triangle statique + aria-live `polite` "Chargement en cours".

---

#### `ProgressBar`

Barre de progression. Hauteur 4 px (`sm`) / 8 px (`md`). Couleur fond `slate.200`, couleur avance `color.action.primary`. Animation fill 400 ms `ease.emphasis`.

**Variante `ProgressBar variant="pump-level"`** : utilise `PumpLevelBar` (composant Kinhale) qui bascule de `sage` à `amber` à `terracotta` selon seuils (cf. §3.3). **Seul cas d'usage légitime de terracotta en progress bar** — parce que le seuil critique d'une pompe de secours doit être visible.

---

#### `Skeleton`

Placeholder de chargement. Shimmer 1200 ms loop (désactivé en reduced-motion → statique gris clair). Variants `text`, `card`, `avatar`, `circle`.

---

### 3.2. Composition (14 composants)

#### `Card`

Conteneur. `elevation.1` par défaut, padding `space.5` / `space.6`. Variants `Card variant="flat"` (bordure 1 px, pas d'élévation), `Card variant="interactive"` (hover `elevation.2`, cursor pointer).

---

#### `ListItem`

Ligne d'une liste verticale. Slots : `leading` (icône/avatar), `primary` (texte principal), `secondary` (description), `trailing` (icône action ou chip), `onPress` optionnel. Hauteur min 56 px (double-line) ou 48 px (single-line). Séparateur bas `Divider` par défaut, désactivable.

Focus visible web : ring + background subtle. Pressed mobile : `opacity 0.6` ou `backgroundColor = color.bg.subtle`.

---

#### `NavBar`

Header haut d'écran. 56 px mobile, 64 px desktop. Slots : `leading` (back button), `title`, `trailing` (1-2 IconButton max).

Variants :
- `default` : bg `color.bg.default`
- `elevated` : bg `color.bg.elevated` + `elevation.1`
- `transparent` : réservé onboarding hero

---

#### `TabBar`

Tabs de navigation principale. **Max 3 tabs** (DP4 — enforcé par ESLint custom). Hauteur 64 px + safe area bottom iOS. Chaque tab : icône 24 × 24 + label `text.xs` `weight.medium`. Actif : couleur `color.action.primary`, indicateur 2 px au-dessus du label.

Desktop (≥ `bp.lg` 1024 px) : la `TabBar` bascule automatiquement en `SideNav` 240 px (pas composant séparé — comportement interne tokenisé).

---

#### `BottomSheet`

Mobile natif. Snap points `small` (25 %), `medium` (50 %), `large` (90 %). Handle en haut 36 × 4 px. Scrim `color.bg.overlay`. Animation entrée 300 ms `ease.enter`.

Desktop (≥ `bp.md`) : bascule automatiquement en `Modal` centré.

**Accessibilité** : `role="dialog"`, `aria-modal="true"`, focus trap, escape pour fermer, bouton close en haut à droite obligatoire.

---

#### `Modal`

Dialog centré. Max-width 560 px desktop, full-width - 32 px mobile. Scrim `color.bg.overlay`. Animation fade 200 ms + scale 0.98 → 1 (si motion OK, opacity only sinon).

**Slots** : `header` (titre + close), `body`, `footer` (1-2 buttons).

---

#### `ConfirmationModal`

Extension de `Modal` spécialisée actions destructives. Design différencié du branding §6 : **sans dark pattern** (conformité §5.5).

**API** :

```ts
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  intent?: 'default' | 'destructive';
  requireTextConfirm?: string; // pour actions irréversibles
}
```

Variante `intent="destructive"` : bouton confirm `variant="destructive"`. **Jamais** `variant="emergency"` — la terracotta secours n'est pas une couleur d'alerte générique (DP6).

`requireTextConfirm` : pour "Supprimer le cercle" (hors v1.0 mais préparé), demande de retaper un mot. À utiliser avec parcimonie.

---

#### `Dialog`

Alias sémantique de `Modal` pour les contextes non-action (ex : afficher un QR). Offre un footer vide par défaut.

---

#### `Tooltip`

Web uniquement (mobile → ignorer, prefer inline help text). `role="tooltip"`. Déclenché sur hover + focus. Délai 500 ms. Position auto. Max-width 240 px. Fond `color.bg.inverse`, texte `color.text.inverse`, `text.sm`.

---

#### `Popover`

Contenu contextuel positionné. Web + mobile. Déclenché par tap/click. Fermeture clavier `Escape`, tap outside. Portal via `Portal` Tamagui.

---

#### `Dropdown`

Menu d'actions positionné. Variante de `Popover`. Slots : `ListItem` empilés. Touche `ArrowUp`/`ArrowDown` pour naviguer. `Enter` pour sélectionner. Hauteur items ≥ 44 px.

---

#### `Toast`

Notification éphémère. Position `bottom-center` mobile, `top-right` desktop. Auto-dismiss 5 s (10 s pour actions), pausable au hover/focus. Animation slide + fade 250 ms ease-out (opacity only en reduced-motion).

**API** :

```ts
interface ToastProps {
  title: string;
  description?: string;
  intent?: 'info' | 'success' | 'warning' | 'error';
  action?: { label: string; onPress: () => void };
  durationMs?: number;
}
```

Pas de variant `emergency`. L'intent `error` utilise `color.action.destructive` (terracotta désaturée), pas la terracotta secours.

**Accessibilité** : `role="status"` (info/success) ou `role="alert"` (warning/error). `aria-live="polite"` par défaut.

---

#### `Banner`

Bandeau persistant haut de page ou intra-écran. Variants `info`, `warning`, `error`, `offline`, `success`. Léger (`color.bg.subtle` + bordure gauche 4 px couleur intent).

`Banner variant="offline"` = `color.status.offline` (ardoise) + icône `WifiSlash`. Message par défaut : *« Mode hors-ligne. Vos saisies seront synchronisées dès la reconnexion. »* (i18n).

`role="status"` pour info/offline/success, `role="alert"` pour warning/error.

---

#### `EmptyState`

Écran ou zone vide. Slots : `illustration` (neutre, pas d'emoji), `title`, `description`, `action?`. Illustration max 160 × 160 px. Contenu centré vertical, max-width 320 px.

Illustrations par défaut (créer SVG dans `packages/ui/src/assets/empty/`) :
- `journal-empty` : carnet stylisé ouvert
- `caregivers-empty` : cercle ouvert
- `reminders-empty` : horloge au repos

---

#### `ErrorState`

Variante `EmptyState` avec illustration erreur neutre (ardoise). CTA "Réessayer" par défaut. Jamais de langage anxiogène — message factuel (*« Impossible de charger pour l'instant »*, jamais *« Erreur critique »*).

---

#### `LoadingState`

Skeleton ou spinner selon contexte. Accessible `aria-busy="true"` + `aria-live="polite"` "Chargement en cours".

---

### 3.3. Kinhale-spécifiques (20 composants)

#### `DoseCard`

Carte de prise enregistrée, affichée dans le journal et le flux d'accueil.

**API** :

```ts
type DoseVariant = 'routine' | 'rescue' | 'missed' | 'voided';

interface DoseCardProps {
  variant: DoseVariant;
  pumpName: string; // affiché après déchiffrement local
  caregiverName: string;
  caregiverAvatarProps: AvatarPastilleProps | AvatarProps;
  timestamp: Date;
  isLocal: boolean; // non encore synchronisé
  onPress?: () => void;
  onEdit?: () => void;
  testID?: string;
}
```

**Variants visuels** :

| Variant | Fond | Accent | Icône pompe |
|---|---|---|---|
| `routine` | `sage.50` clair / `sage.800` sombre | `sage.500` gauche 4 px | pompe en sage |
| `rescue` | `terracotta.50` / `terracotta.800` | `terracotta.500` gauche 4 px | pompe terracotta + éclair stylisé |
| `missed` | `amber.50` / `amber.800` | `amber.400` gauche 4 px | pompe ambre barré |
| `voided` | `slate.100` / `slate.800` | `slate.500` gauche 4 px | pompe gris avec barre diagonale |

**Accessibilité** : `aria-label="Prise de {pumpKind} confirmée par {caregiver} le {date} à {time}"` (cf. designer §7.2). `role="article"`.

**Offline indicator** : si `isLocal=true`, badge coin haut droit `Chip variant="slate" size="sm"` *"En attente de synchro"*.

**Règles d'usage** : jamais de timestamp sans AvatarPastille/Avatar correspondant — l'humain avant le produit (branding §4.1).

---

#### `DoseQuickEntry`

FAB d'enregistrement rapide — geste < 10 s (ref UX research §3 J2).

**API** :

```ts
interface DoseQuickEntryProps {
  nextScheduledDose?: { label: string; time: string };
  onQuickRecordRoutine: () => void;
  onOpenRescueFlow: () => void;
  testID?: string;
}
```

Design : deux zones distinctes visuellement.
- **Zone principale** (80 % visuel) : `Button variant="primary" size="lg"` *« Je viens de donner la pompe de fond »*
- **Zone secours** (20 % visuel, séparée par `space.4` min) : `EmergencyDoseButton` séparé.

L'écart `space.4` est enforcé par le composant (pas par l'utilisateur consommateur — évite erreurs).

---

#### `EmergencyDoseButton`

CTA secours terracotta, **strict** — respect DP3, DP6, branding §5.2.

**API** :

```ts
interface EmergencyDoseButtonProps {
  onPress: () => void;
  size?: 'md' | 'lg'; // default 'lg'
  testID?: string;
}
```

**Design** :
- Fond : `color.action.emergency` (`terracotta.500`)
- Texte : `color.text.inverse` blanc cassé
- Label i18n : *« Pompe de secours »* / *« Rescue inhaler »* — **jamais** « Urgent », « Alerte », « Crise »
- Hauteur `lg` : 64 px (plus gros que primary standard — pour être trouvé en état de stress sans trembler)
- Icône éclair stylisé à gauche, sobre.
- **Confirmation** : 1 tap → écran `DoseRescueFlow` (pas 2 taps qui ralentit).

**Haptique** : `UIImpactFeedbackStyle.medium` au tap (marqué sans panique). Jamais `notificationFeedback.success` après la saisie (DP9).

**Règle absolue** : ce composant est le **seul** à consommer `color.action.emergency` dans tout le monorepo. Check ESLint + grep CI.

---

#### `PumpCard`

Carte pompe (liste E4.01, détail E4.02).

**API** :

```ts
type PumpRole = 'fond' | 'secours';

interface PumpCardProps {
  name: string; // défini par l'utilisateur
  role: PumpRole;
  dosesRemaining: number;
  dosesTotal: number;
  expiresAt?: Date;
  onPress?: () => void;
}
```

Design : card standard avec `PumpLevelBar` intégré, role indiqué par `Chip variant="sage"` (fond) ou `Chip` *custom secours* (usage exceptionnel permis ici car métier direct).

---

#### `PumpLevelBar`

Jauge niveau pompe. Progression inversée (pleine = 100 %, vide = 0 %).

**API** :

```ts
interface PumpLevelBarProps {
  dosesRemaining: number;
  dosesTotal: number;
  role: PumpRole; // 'fond' | 'secours'
}
```

**Couleurs selon seuil** :

- `> 50 %` : `sage.500`
- `25–50 %` : `amber.400`
- `< 25 %` : `terracotta.500` **uniquement si `role='secours'`**, sinon `amber.500` (plus foncé)

**Usage exceptionnel terracotta** : autorisé ici parce qu'un niveau bas de pompe de secours **est un événement santé critique** côté UX (la famille doit savoir qu'elle peut manquer de secours). Validé par kz-conformite (c'est un statut factuel, pas prescriptif).

Accessibilité : `role="progressbar"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-label` (cf. designer §7.2).

---

#### `CaregiverChip`

Chip aidant inline. Slots : avatar + nom + (optionnel) rôle + (optionnel) dernière activité.

**API** :

```ts
interface CaregiverChipProps {
  name: string;
  avatar: AvatarPastilleProps | AvatarProps;
  role?: 'admin' | 'contributor' | 'restricted';
  lastActivity?: string; // relative time
  onPress?: () => void;
}
```

Taille `sm` pour inclusion dans texte (ex : *"Marc a donné la pompe"*), `md` pour listes.

---

#### `CaregiverListItem`

Ligne liste aidants (E3.01). Extension de `ListItem` : avatar, nom, rôle traduit en langage de cuisine, chevron trailing.

Rôles affichés (copy validé par conformité §5.4 + designer §3.1) :
- `admin` → *« Parent référent »* / *« Primary parent »*
- `contributor` → *« Famille proche »* / *« Close family »*
- `restricted` → *« Garderie ou nounou »* / *« Childcare »*

---

#### `InvitationQRCard`

Affichage du QR + code court 6 caractères + TTL 10 min — ajustement conformité 4 + 5.

**API** :

```ts
interface InvitationQRCardProps {
  qrPayload: string; // base64url déjà prêt
  shortCode: string; // 6 chars alphanum non-ambigus
  expiresAt: Date;
  onExtend?: () => void; // visible à partir de 7 min écoulées
  onRevoke: () => void;
  testID?: string;
}
```

**Design** :
- QR 240 × 240 px, bordure 16 px blanche, elevation.2
- Code court : `Mono` `text.xl`, letterspacing 0.1em, séparateurs optionnels "ABC-D12" pour lisibilité
- **Compte à rebours visible** : `text.lg` `weight.semibold`, passe en `color.status.warning` à partir de 2 min restantes
- Bouton `Button variant="ghost"` *« Annuler cette invitation »*
- Bouton `Button variant="secondary"` *« Prolonger de 10 min »*, **apparition à 7 min écoulées** (pas avant — évite l'abus)

**Accessibilité** : QR décoratif (`aria-hidden`), code court principal pour lecteurs d'écran (`aria-label="Code d'invitation : ABC-D12, expire dans 9 minutes"`). Annonce du compte à rebours via `aria-live="polite"` à chaque minute.

**Aucun prénom enfant, aucune donnée santé n'apparaît dans ce composant** — ajustement conformité 3.

---

#### `ConsentScreen`

Écran de consentement au scan, **non contournable** — ajustement conformité 1.

**API** :

```ts
interface ConsentScreenProps {
  childFirstName: string; // déchiffré localement via MLS
  adminIdentity: { name: string; relationshipLabel: string };
  dataCategories: string[]; // i18n keys
  legalMentions: { locale: string; text: string };
  professionalFlag: boolean;
  onAccept: () => void;
  onDecline: () => void;
  testID?: string;
}
```

**Contraintes design** (conformité §5.4 stricte) :

1. **Bouton primaire désactivé** jusqu'à ce que le `ScrollView` ait atteint le bas (`onEndReached`). Visuellement : `isDisabled` avec info *« Lisez l'ensemble des mentions pour continuer »*.
2. **Aucune case pré-cochée**. Aucune case du tout — le tap sur `Button variant="primary"` *« J'accepte de rejoindre le cercle de soin de {childFirstName} »* **est** le consentement.
3. **Pas d'illustration, pas d'emoji, pas de famille dessinée**. Sobriété totale.
4. **Contraste AAA** sur le texte légal (`color.text.primary` sur `color.bg.elevated`).
5. **H1 Fraunces** lisible à 3 m : *« Rejoindre le cercle de soin de {childFirstName} »*.
6. **Bouton secondaire** *« Non, je ne rejoins pas »* au même niveau visuel mais poids inférieur (`variant="ghost"`, pas caché).

**Accessibilité** : lecture séquentielle VoiceOver : H1 → identité admin → catégories de données → mentions légales → bouton principal → bouton secondaire. `aria-describedby` relie les boutons au texte légal.

**i18n** : 4 locales `fr-CA`, `fr-FR`, `en-CA`, `en-INT`. Le wrapping des catégories de données est vertical 1-par-ligne (pas de chips horizontaux qui rendent illisible en FR).

---

#### `SeedCell`

Cellule d'affichage d'un mot de la recovery seed — DP2.

**API** :

```ts
interface SeedCellProps {
  index: number; // 1 à 12
  word: string; // ou '' si caché (mode confirmation)
  state: 'revealed' | 'hidden' | 'selectable' | 'selected';
  onPress?: () => void;
  testID?: string;
}
```

**Design** :
- Fond : `neutral.100` clair / `neutral.850` sombre, `radius.md`
- Numéro : `text.sm` `weight.medium` en `color.text.secondary`
- Mot : `Mono` `text.lg` `weight.medium` en `color.text.primary`
- État `selectable` : hover `elevation.1`
- État `selected` : bordure 2 px `color.action.primary`
- Jamais `revealed` dans un flow non-intentionnel — composant consomme explicitement le state

**Copy à écrire** : **jamais** "seed", "mnemonic", "BIP39" dans les labels. Toujours *« mots de sécurité »* / *« recovery words »*.

---

#### `SeedGrid`

Grille 12 mots. Layout 2 colonnes × 6 lignes mobile, 3 × 4 tablette+.

**API** :

```ts
interface SeedGridProps {
  words: string[]; // 12 mots
  mode: 'reveal' | 'confirmation';
  hiddenIndices?: number[]; // pour mode confirmation
  onWordTap?: (index: number) => void;
}
```

En mode `reveal`, gap `space.3`. En mode `confirmation`, gap `space.4` (plus aéré pour éviter mistap). 44 × 44 pt minimum par cellule.

---

#### `SeedConfirmation`

Re-saisie de mots aléatoires (principe UX research §8 P2).

**API** :

```ts
interface SeedConfirmationProps {
  indicesToConfirm: number[]; // 3 indices aléatoires 1-12
  expectedWords: string[]; // pour validation locale
  onComplete: (success: boolean) => void;
  onBack: () => void;
}
```

UI : 3 champs `Input` l'un sous l'autre, chacun avec label *« Mot n° {index} »*. Validation en live (case-insensitive, trim). Feedback sobre : check vert sauge si correct, bordure ambre si incorrect (jamais terracotta — ce n'est pas une urgence).

---

#### `OfflineBadge`

Bandeau / chip mode hors-ligne — DP5.

**API** :

```ts
interface OfflineBadgeProps {
  variant?: 'chip' | 'banner'; // default 'chip'
  onPress?: () => void; // ouvre détail synchro
}
```

- `variant="chip"` : positionnement top-right dans NavBar, 24 × 24 px icône + label `"Hors-ligne"` en `text.sm`. Couleur `color.status.offline`.
- `variant="banner"` : bandeau pleine largeur top-screen, uniquement si offline > 1 h.

`role="status"` `aria-live="polite"`.

---

#### `SyncStatusIndicator`

Indicateur détaillé synchronisation (écran paramètres ou bottom sheet depuis OfflineBadge).

Slots : dernière sync timestamp, nombre d'événements en attente, nombre de conflits. Pas de bouton "forcer sync" en v1.0 (géré auto par le moteur).

---

#### `ReminderCard`

Carte rappel (E5.01). Slots : horaire, jours actifs, pompe associée, switch on/off.

---

#### `NotificationOpaque`

Preview in-app d'une notification. Dans l'app, **peut** afficher le prénom aidant + pompe (contenu déjà déchiffré localement) — cf. DP7.

**API** :

```ts
interface NotificationOpaqueProps {
  title: string; // ex. "Marc a donné la pompe"
  body: string; // ex. "il y a 3 minutes"
  type: 'dose-recorded' | 'rescue-dose' | 'missed-dose' | 'invitation-accepted';
  onPress?: () => void;
  onDismiss: () => void;
}
```

Le payload système (APNs/FCM) est géré par `apps/mobile` hors DS et **reste opaque** `{title: "Kinhale", body: "Nouvelle activité dans votre foyer"}`. Ce composant est le rendu **dans** l'app après déchiffrement.

---

#### `CalendarDayCell`

Cellule d'un jour dans la vue calendrier mensuelle (E2.04cal).

**API** :

```ts
interface CalendarDayCellProps {
  date: Date;
  dosesCount: number;
  hasRescue: boolean;
  hasMissed: boolean;
  isToday: boolean;
  isSelected: boolean;
  onPress: (date: Date) => void;
}
```

Indicateurs visuels : point vert sauge (1 dose routine), point ambre (missed), point terracotta (rescue — usage métier direct). Max 3 points par cellule, le reste en chiffre "+2".

Touch target 44 × 44 pt minimum (peut imposer une taille de cellule ≥ 44 px, ce qui force la grille à s'adapter).

---

#### `SymptomsGrid`

Grille saisie symptômes pour prise de secours (non-DM, texte libre + pictogrammes neutres).

**API** :

```ts
type SymptomKey = 'cough' | 'wheeze' | 'breathlessness' | 'tightness' | 'fatigue' | 'other';

interface SymptomsGridProps {
  selected: SymptomKey[];
  onChange: (selected: SymptomKey[]) => void;
  allowCustomText?: boolean;
  customText?: string;
  onCustomTextChange?: (text: string) => void;
}
```

**Design** :
- Grille 3 × 2 de `RadioCard` multi-select
- Chaque card : icône neutre (Phosphor, stroke 1.5 px, **sans rouge ni exclamation**), label
- Selected state : bordure `sage.500` + fond `sage.50` (pas terracotta — on ne valide pas un diagnostic, on note un symptôme)
- Champ texte libre en dessous : `Textarea` `rows={3}`, placeholder *« Autre observation (optionnel) »*

**Conformité** : pas de catégorisation par gravité, pas de tri "modéré/sévère/urgent", pas de message *« Si symptômes > 3, appelez un médecin »* (ligne rouge DM).

---

#### `PDFExportPreview`

Prévisualisation du rapport PDF (E6.03). Image de la première page + bouton `Button variant="primary"` *« Générer le PDF »*. Disclaimer RM27 obligatoire en pied : *« Document non médical, à présenter à votre professionnel de santé. »*

Disponible **uniquement en rôle Admin** (décision A1).

---

#### `ThemeToggle`

Bascule clair / sombre (A4). 3 options : `system` (défaut), `light`, `dark`. Représenté visuellement par `RadioCard` avec preview miniature. Placement : `Settings > Préférences générales`.

---

#### `PhotoToggle`

Activation photo enfant (A5) avec avertissement chiffrement local.

**API** :

```ts
interface PhotoToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}
```

Design : `Switch` + description explicite en dessous (`BodyLarge`) *« La photo de votre enfant est stockée chiffrée sur vos appareils uniquement. Elle ne quitte jamais votre foyer. »*

Si toggle ON : ouvre `ImagePicker` natif. Si photo présente, affiche preview + bouton "Retirer la photo". Aucune photo transmise vers le relais (contrôlé hors DS par la couche `sync`).

---

#### `RoleBadge`

Badge rôle aidant — Admin, Contributeur, Restreint. Copy en langage de cuisine (cf. `CaregiverListItem`).

**API** :

```ts
interface RoleBadgeProps {
  role: 'admin' | 'contributor' | 'restricted';
  size?: 'sm' | 'md';
}
```

Couleurs :
- `admin` : `sage.500` bg + blanc texte
- `contributor` : `neutral.100` bg + `color.text.primary`
- `restricted` : `slate.100` bg + `color.text.secondary`

---

#### `AuditLogEntry`

Entrée du journal local (E3.06). Slots : timestamp, action i18n, acteur (CaregiverChip), cible. Purement en lecture seule. `role="listitem"`.

---

## 4. Règles d'accessibilité opérationnelles

### 4.1. Contrastes

- **Texte courant** : ≥ 4.5:1 — AA. Visé AAA ≥ 7:1 sur `color.text.primary`.
- **Texte large** (≥ 18 px ou 14 px bold) : ≥ 3:1.
- **Composants UI** (icônes actives, bordures, focus ring) : ≥ 3:1.
- **Actions destructives / emergency** : AAA ≥ 7:1 souhaitable. Validé par script `pnpm tokens:verify`.
- **Erreurs de formulaire** : AAA ≥ 7:1 sur le texte d'erreur (il ne doit pas se perdre).

### 4.2. Touch targets

- iOS : ≥ 44 × 44 pt (HIG).
- Android : ≥ 48 × 48 dp (Material Design).
- Web : zone tactile ≥ 44 × 44 pt équivalent (inclut padding invisible si le visuel est plus petit).
- Espacement inter-cibles : ≥ `space.2` (8 px) obligatoire. `space.4` (16 px) recommandé entre zones critiques (ex : fond + secours).

### 4.3. Focus visible

- Ring 2 px `color.border.focus` + offset 2 px (box-shadow `0 0 0 2px color.bg.default, 0 0 0 4px color.border.focus`).
- Visible **uniquement** sur `:focus-visible` (clavier) — jamais au hover souris simple.
- Mobile : focus ring affiché si `keyboard-user` détecté (utile pour les claviers bluetooth iPad).

### 4.4. `prefers-reduced-motion`

- Chaque composant motion-aware consomme `useReducedMotion()`.
- Désactive : `translateX`, `translateY`, `scale`, `rotate`, parallax, auto-scroll.
- Conserve : `opacity`, `color transitions`.
- Skeleton shimmer → statique.
- Toast entrée → `opacity 0 → 1` 200 ms (pas de slide).
- Modale → fade sans scale.

### 4.5. Dynamic Type / Font Scaling

- iOS : `UIContentSizeCategoryDidChangeNotification` respecté automatiquement par `<Text>` RN. Testé jusqu'à `accessibilityXXXLarge` (~200 %).
- Android : `configuration.fontScale` respecté. Testé jusqu'à 2.0.
- Web : tailles en `rem`, zoom navigateur 200 % testé.
- **Aucune troncature** : `numberOfLines` limité à `CaregiverChip size="sm"` (max 1 ligne avec ellipsis + tooltip obligatoire).
- Chaque composant principal a un test Playwright `zoom: 200 %` qui vérifie l'absence de layout broken.

### 4.6. VoiceOver / TalkBack

- `accessibilityLabel` obligatoire sur tout `IconButton`, `Avatar`, `AvatarPastille`, icône porteuse de sens dans un composant.
- `accessibilityHint` optionnel pour clarifier l'action (*"Appuyez deux fois pour ouvrir le détail"*).
- `aria-live="polite"` sur `Banner`, `Toast info/success`, `OfflineBadge`.
- `aria-live="assertive"` réservé à `Toast error` et `Banner warning/error`.
- `role` ARIA explicite sur tous les conteneurs : `article`, `status`, `alert`, `dialog`, `progressbar`, `listitem`.

### 4.7. Navigation clavier web

- Tab / Shift+Tab : navigation séquentielle.
- Enter : activer le bouton/lien focused.
- Space : activer le bouton, cocher `Checkbox`, toggle `Switch`.
- Escape : fermer `Modal`, `BottomSheet`, `Dropdown`, `Popover`.
- ArrowUp/ArrowDown : navigation dans `Dropdown`, `Select`, `RadioGroup`, `TabBar`.
- Home/End : début/fin de liste (optionnel mais recommandé).

### 4.8. Landmarks sémantiques

Chaque écran doit inclure :
- `<header>` → NavBar haut
- `<nav>` → TabBar ou SideNav
- `<main>` → zone principale
- `<aside>` → panneau secondaire desktop
- `<footer>` → pied (disclaimers, liens légaux)

En RN, équivalent via `accessibilityRole` : `"header"`, `"main"`, `"navigation"`, `"complementary"`, `"contentinfo"`.

### 4.9. Tests automatisés et manuels

- **axe-core** intégré en CI Playwright — **bloque le merge** sur violations critiques.
- **jest-axe** sur chaque composant unit-testé — bloquant.
- **Manuel obligatoire** sur les 7 moments de vérité : VoiceOver iOS + TalkBack Android + navigation clavier web. Checklist dans `docs/contributing/a11y-manual-test.md`.

---

## 5. Règles i18n opérationnelles

### 5.1. Locales supportées v1.0

- **`fr-CA`** : Québec (primaire)
- **`fr-FR`** : France (secondaire)
- **`en-CA`** : Canada anglais (secondaire)
- **`en-INT`** : anglais international (US, UK, international)

Structure de fichiers (cf. `00-kz-designer.md` §9.5) :

```
packages/i18n/locales/
├── fr-CA/
│   ├── common.json
│   ├── onboarding.json
│   ├── home.json
│   ├── dose.json
│   ├── circle.json
│   ├── settings.json
│   ├── legal.json
│   └── empty-states.json
├── fr-FR/ ...
├── en-CA/ ...
└── en-INT/ ...
```

### 5.2. Longueur de texte FR vs EN

- **Texte FR** : généralement +20 à +30 % plus long que EN. Prévoir le wrapping.
- **Exemples de contraintes de longueur** :

| Composant | Max conseillé (EN) | Max conseillé (FR) |
|---|---|---|
| `Button` label 1 ligne | 24 chars | 28 chars |
| `Button` label 2 lignes | 48 chars | 56 chars |
| `Chip` label | 16 chars | 20 chars |
| `TabBar` label | 10 chars | 12 chars |
| `Toast` titre | 48 chars | 56 chars |
| `H1` (1 ligne desktop) | 40 chars | 48 chars |

- **Pas d'ellipsis** sauf `CaregiverChip size="sm"` (fallback tooltip obligatoire).
- **Wrap** par défaut ; les boutons wrappent sur 2 lignes si besoin (hauteur ajustée).

### 5.3. Vocabulaire normalisé (A7)

- **"pompe"** universel FR-CA et FR-FR en v1.0. Pas de split `inhaler_term`.
- **"inhaler"** en EN.
- Glossaire maintenu dans `packages/i18n/glossary.md`. Toute nouvelle clé passe par kz-copywriting + kz-conformite.

### 5.4. Vouvoiement universel FR

- Toutes les chaînes FR en **vouvoiement**. Aucune exception.
- Tutoiement interdit même dans les emails marketing.
- Vérifié en CI par une règle custom `i18n-vous-only` (détecte les formes `tu`, `tes`, `ton`, `ta`, `toi` et bloque sauf whitelist — ex : noms propres).

### 5.5. Dates, heures, nombres

- Dates/heures via `Intl.DateTimeFormat(locale)` — jamais de format hardcodé.
- Nombres via `Intl.NumberFormat(locale)` — respecte séparateurs locaux (virgule/point).
- Temps relatifs via `Intl.RelativeTimeFormat(locale)` — *"il y a 3 minutes"*, *"3 minutes ago"*.

### 5.6. RTL (non v1.0 mais tokens prêts)

- Tokens d'espacement logique : `paddingStart` / `paddingEnd` au lieu de `paddingLeft` / `paddingRight`.
- Icônes directionnelles (flèches, chevrons) via `rtl-safe` helper dans `packages/ui/src/utils/rtl.ts`.
- `I18nManager.isRTL` respecté dans tous les composants mobile (RN natif).

### 5.7. Règle `i18next/no-literal-string`

- Activée sur `apps/**/*.{ts,tsx}`.
- **Désactivation interdite** sur `apps/` (règle gravée CLAUDE.md).
- Autorisée uniquement dans `packages/ui/src/**/*.stories.tsx` (exemples Storybook).

---

## 6. Gestion du mode sombre (A4)

### 6.1. Stratégie

- **Parité complète** clair + sombre dès v1.0.
- **Tokens primitifs** communs ; bascule au niveau **tokens sémantiques** (cf. §2.2).
- **Détection automatique** via `prefers-color-scheme` (web) + `useColorScheme()` (RN).
- **Override manuel** disponible dans `Settings > Préférences générales > Thème` (via `ThemeToggle` §3.3), avec 3 choix : `system`, `light`, `dark`.
- **Persistance** : choix stocké localement (SecureStore iOS, EncryptedSharedPreferences Android, IndexedDB chiffré web). Pas de sync entre appareils en v1.0 (simplicité).

### 6.2. Implémentation Tamagui

```ts
// packages/ui/src/themes/index.ts
import { createTheme } from 'tamagui';
import { primitives } from '../tokens/colors';

export const lightTheme = createTheme({
  bg: primitives.neutral[50],
  bgElevated: '#FFFFFF',
  textPrimary: '#1A2420',
  // ...
});

export const darkTheme = createTheme({
  bg: primitives.neutral[900],
  bgElevated: primitives.neutral[850],
  textPrimary: primitives.neutral[100],
  // ...
});
```

### 6.3. Tests de contraste sur les deux modes

- Script `pnpm tokens:verify` vérifie tous les tokens sémantiques en **clair ET sombre**.
- Pipeline CI bloque si un ratio tombe sous AA dans l'un des deux.
- Snapshots visuels Chromatic générés sur chaque composant en clair + sombre.

### 6.4. Gestion des ombres en mode sombre

- Ombres réduites en opacité (cf. §2.6).
- **Surface tinting** : élévations matérialisées par un léger éclaircissement du fond (2 %, 4 %, 6 %, 8 %) — pratique Material 3 pour éviter l'effet *"nuages noirs"*.

### 6.5. Assets

- Logos Kinhale : version claire + version sombre (SVG contenant 2 `<symbol>`).
- Illustrations empty states : variant via CSS variables.
- Photos : pas de variant — priorité à la clarté du message.

---

## 7. Motion guidelines

### 7.1. Tokens — rappel

Cf. §2.9. Durées `motion.instant` → `motion.onboarding`. Easings `ease.default` / `enter` / `exit` / `emphasis`.

### 7.2. Règle d'or DP9

**Une animation ne doit jamais célébrer une prise de secours** (DP9 non-négociable).
- Aucun confetti, aucun spring, aucun bounce.
- Le feedback d'une prise de secours enregistrée est **sobre** : coche `sage.500` 200 ms + texte `"Prise de secours enregistrée"` (pas `"Bravo"`, pas `"Parfait"`).

### 7.3. Règles par composant

| Composant | Animation | Durée | Easing |
|---|---|---|---|
| `Button` pressed | scale 0.98 (motion ok) / opacity 0.85 (motion off) | `motion.fast` | `ease.default` |
| `Toast` enter | slide-up + fade / fade only (motion off) | `motion.standard` | `ease.enter` |
| `Toast` exit | fade | `motion.fast` | `ease.exit` |
| `Modal` enter | fade + scale 0.98→1 / fade only | `motion.moderate` | `ease.enter` |
| `Modal` exit | fade | `motion.standard` | `ease.exit` |
| `BottomSheet` enter | slide-up | `motion.moderate` | `ease.enter` |
| `ProgressBar` fill | width transition | `motion.slow` | `ease.emphasis` |
| `Skeleton` shimmer | loop / statique (motion off) | 1200 ms loop | linear |
| `Checkbox` coche | draw | `motion.standard` | `ease.enter` |
| `Switch` thumb | translateX / opacity | `motion.fast` | `ease.default` |
| Page transition | fade | 250 ms | `ease.default` |
| `SeedCell` reveal | fade + scale 0.95→1 | `motion.onboarding` | `ease.emphasis` |

### 7.4. Haptique (mobile)

Tokens dans `packages/ui/src/utils/haptics.ts` :

- `haptic.light` : UIImpactFeedbackStyle.light (iOS) / VibrationEffect.EFFECT_TICK (Android) — confirmation prise fond, switch on/off.
- `haptic.medium` : UIImpactFeedbackStyle.medium — bouton secours tap, action importante.
- `haptic.soft` : UIImpactFeedbackStyle.soft — ouverture BottomSheet.
- `haptic.warning` : UINotificationFeedbackStyle.warning — double saisie détectée, dose manquée rattrapée.
- `haptic.error` : **INTERDIT** sur événement santé (DP9). Réservé à erreur technique (ex : sync impossible après 10 tentatives).
- `haptic.success` : **INTERDIT** sur prise de secours. Autorisé uniquement sur completion recovery seed (moment de confiance — cf. DP2).

### 7.5. Micro-interactions recovery seed

- `SeedCell` reveal : scale 0.95→1 + fade-in, échelonné 50 ms par cellule (cascade douce).
- `SeedCell` selected (mode confirmation) : bordure animée 2 px + scale 1→1.02 subtle + haptic.light.
- `SeedGrid` completion : pas d'animation de célébration. Juste un `Toast variant="success"` sobre *« Configuration enregistrée »*.

---

## 8. Conventions de nommage et structure de package

### 8.1. Arborescence `packages/ui/src/`

```
packages/ui/src/
├── tokens/
│   ├── colors.ts              # primitifs + sémantiques
│   ├── typography.ts          # families, sizes, weights, line-heights
│   ├── space.ts
│   ├── radius.ts
│   ├── shadows.ts
│   ├── motion.ts
│   ├── breakpoints.ts
│   ├── zindex.ts
│   └── index.ts
├── themes/
│   ├── light.ts
│   ├── dark.ts
│   └── index.ts
├── primitives/
│   ├── Button/
│   ├── IconButton/
│   ├── Link/
│   ├── Input/
│   ├── Textarea/
│   ├── Select/
│   ├── Checkbox/
│   ├── Radio/
│   ├── Switch/
│   ├── Slider/
│   ├── Chip/
│   ├── Tag/
│   ├── Badge/
│   ├── Avatar/
│   ├── AvatarPastille/
│   ├── Divider/
│   ├── Spinner/
│   ├── ProgressBar/
│   ├── Skeleton/
│   ├── Typography/            # Display, H1-H3, Body, Label, Caption, Mono
│   └── index.ts
├── composition/
│   ├── Card/
│   ├── ListItem/
│   ├── NavBar/
│   ├── TabBar/
│   ├── BottomSheet/
│   ├── Modal/
│   ├── ConfirmationModal/
│   ├── Dialog/
│   ├── Tooltip/
│   ├── Popover/
│   ├── Dropdown/
│   ├── Toast/
│   ├── Banner/
│   ├── EmptyState/
│   ├── ErrorState/
│   ├── LoadingState/
│   └── index.ts
├── kinhale/
│   ├── DoseCard/
│   ├── DoseQuickEntry/
│   ├── EmergencyDoseButton/
│   ├── PumpCard/
│   ├── PumpLevelBar/
│   ├── CaregiverChip/
│   ├── CaregiverListItem/
│   ├── InvitationQRCard/
│   ├── ConsentScreen/
│   ├── SeedCell/
│   ├── SeedGrid/
│   ├── SeedConfirmation/
│   ├── OfflineBadge/
│   ├── SyncStatusIndicator/
│   ├── ReminderCard/
│   ├── NotificationOpaque/
│   ├── CalendarDayCell/
│   ├── SymptomsGrid/
│   ├── PDFExportPreview/
│   ├── ThemeToggle/
│   ├── PhotoToggle/
│   ├── RoleBadge/
│   ├── AuditLogEntry/
│   └── index.ts
├── hooks/
│   ├── useTheme.ts
│   ├── useBreakpoint.ts
│   ├── useReducedMotion.ts
│   ├── useColorScheme.ts
│   └── index.ts
├── utils/
│   ├── haptics.ts
│   ├── rtl.ts
│   ├── a11y.ts
│   └── contrast.ts
├── assets/
│   ├── empty/                 # SVG illustrations neutres
│   └── icons-custom/          # pompe de fond, pompe de secours Kinhale
└── index.ts                   # API publique
```

### 8.2. Structure par composant

Exemple `Button/` :

```
Button/
├── Button.tsx                  # Implémentation Tamagui (variants + props)
├── Button.types.ts             # ButtonProps, ButtonVariant, ButtonSize
├── Button.styles.ts            # Variants Tamagui styled
├── Button.test.tsx             # Vitest + RNTL + jest-axe
├── Button.stories.tsx          # Storybook (variants, states, sizes, i18n)
└── index.ts                    # re-export
```

### 8.3. Conventions nommage

- **Composants** : `PascalCase` (`DoseCard`, `EmergencyDoseButton`).
- **Hooks** : `use` prefix camelCase (`useTheme`, `useReducedMotion`).
- **Tokens** : structure `category.role[.variant]` en lowerCamelCase (`color.action.primary`, `motion.standard`).
- **Fichiers** : `PascalCase.tsx` pour composants, `camelCase.ts` pour utilitaires.
- **Tests** : `ComponentName.test.tsx` à côté de `ComponentName.tsx`.
- **Stories** : `ComponentName.stories.tsx`.

### 8.4. Exports publics

`packages/ui/src/index.ts` :

```ts
// Tokens
export * from './tokens';

// Themes
export { lightTheme, darkTheme } from './themes';

// Hooks
export * from './hooks';

// Primitives
export * from './primitives';

// Composition
export * from './composition';

// Kinhale-specific
export * from './kinhale';

// Utils (public API)
export { triggerHaptic } from './utils/haptics';
export { useRTL } from './utils/rtl';
```

Les types `*.types.ts` sont exportés via les barrels `primitives/index.ts`, etc.

---

## 9. Stratégie de test du design system

### 9.1. Tests unitaires

- **Outils** : Vitest + React Native Testing Library (`@testing-library/react-native`) + `@testing-library/jest-dom` (web) + `jest-axe`.
- **Couverture cible** : ≥ 85 % sur `packages/ui` (surcroît par rapport au 80 % monorepo pour un DS critique).
- **Contenu** :
  - Rendu par défaut
  - Chaque variant
  - Chaque état (hover, focus, pressed, disabled, loading)
  - Props accessibilité (`accessibilityLabel`, `aria-*`)
  - `jest-axe` : aucun violation

### 9.2. Tests visuels

- **Outil** : Chromatic (ou Percy en fallback).
- **Stories à snap** : chaque variant × état × taille × thème (clair + sombre) × locale (fr-CA, en-INT minimum).
- **CI bloquante** : toute régression visuelle non approuvée bloque le merge.

### 9.3. Tests d'intégration

- Écrans composés des 7 moments de vérité assemblés dans Storybook (`/stories/flows/`).
- Playwright E2E sur `apps/web` valide le rendu + interactions clavier + axe-core.
- Maestro flows sur `apps/mobile` valide VoiceOver + TalkBack.

### 9.4. Tests d'accessibilité

- **Automatisé** : axe-core (CI Playwright) + jest-axe (unit) — **bloquant sur violations HAUTES**.
- **Manuel** : checklist par moment de vérité dans `docs/contributing/a11y-manual-test.md`.
  - VoiceOver iOS sur MV1, MV2, MV3, MV4, MV5, MV6, MV7
  - TalkBack Android idem
  - Navigation clavier web idem
  - Dynamic Type 200 % idem

### 9.5. Tests i18n

- Snapshots Storybook en 4 locales : `fr-CA`, `fr-FR`, `en-CA`, `en-INT`.
- Textes extrêmes (longueur max + caractères spéciaux) testés pour détecter overflow / troncature.
- CI génère un rapport de diff visuel entre locales.

### 9.6. Tests de motion

- Playwright simulateur `prefers-reduced-motion: reduce` → snapshot sans animation.
- Maestro mobile : test de gesture + haptic en mode reduced-motion OS.

### 9.7. Tests de performance

- Bundle size budget : `packages/ui` dist < 300 kB gzipped (web).
- Frame time budget : 60 fps sur Android milieu de gamme (Pixel 4a, Samsung A52) pour les composants animés.
- Tests via `react-native-performance` + WebPageTest.

---

## 10. Roadmap d'implémentation et effort estimatif

| Phase | Contenu | Effort (j/personne) |
|---|---|---|
| **A — Tokens + thèmes** | Tous les tokens (§2), themes light/dark, hooks utilitaires (`useTheme`, `useReducedMotion`, `useBreakpoint`), script `tokens:verify` contrastes | **5 j** |
| **B — Primitives** | 21 composants §3.1 avec tests unit + stories + jest-axe | **10 j** |
| **C — Composition** | 16 composants §3.2 avec tests + stories + intégration | **8 j** |
| **D — Kinhale-spécifiques** | 23 composants §3.3 avec specs métier + conformité + a11y renforcée | **12 j** |
| **E — Storybook + tests visuels + docs** | Storybook public, Chromatic, README exhaustif, guide contribution | **5 j** |
| **Total** | | **40 j/personne** |

### 10.1. Dépendances

- **A** débloque **B, C, D**.
- **B** débloque **C** (composition consomme primitives).
- **C** débloque **D** (Kinhale-spécifiques composent).
- **E** peut démarrer dès B terminée mais stabilise après D.

### 10.2. Livraison incrémentale

- **Sprint 0 (1 sem)** : Phase A + 3 primitives (Button, Input, Typography).
- **Sprint 1 (2 sem)** : reste des primitives.
- **Sprint 2 (2 sem)** : Composition + premiers Kinhale-spécifiques (DoseCard, EmergencyDoseButton).
- **Sprint 3 (2 sem)** : Kinhale-spécifiques restants.
- **Sprint 4 (1 sem)** : Storybook, tests visuels, docs.

---

## 11. Documentation exploitable

### 11.1. Storybook

- **Local dev** : `pnpm --filter @kinhale/ui storybook` → `http://localhost:6006`.
- **Public** (v1.1) : `kinhale.health/design-system` (déploiement auto sur merge main).
- Chaque composant a :
  - Story "Default"
  - Stories par variant
  - Stories par état
  - Stories i18n (au moins fr-CA + en-INT)
  - Story "Accessibility" avec annotations VoiceOver / TalkBack attendues
  - MDX doc avec API, règles d'usage, anti-patterns

### 11.2. README `packages/ui/README.md`

Contient :
1. Présentation du DS.
2. Quickstart (import, thème, `<TamaguiProvider>`).
3. Exemple d'usage basique (`Button`, `Input`, `DoseCard`).
4. Lien vers Storybook.
5. Guide de contribution (voir §11.3).
6. Matrice de compatibilité (RN 0.74+, Expo SDK 52+, Next 15, React 18+).

### 11.3. Guide de contribution

Tout nouveau composant doit :

1. Respecter les **tokens existants** (pas de valeur magique). Un nouveau token passe par ADR.
2. Avoir :
   - Tests unitaires (Vitest + RNTL + jest-axe)
   - Story Storybook avec variants/états/locales
   - Validation accessibilité (VoiceOver + TalkBack + clavier web)
   - Bilinguisme FR + EN dès le commit #1
   - Vérification contraste AA minimum
3. Suivre la convention `ComponentName/` avec les 5 fichiers canoniques.
4. Passer la review `kz-design-review` + la review `kz-design-system` (un maintainer du DS).
5. Si le composant touche à la conformité (consentement, secours, recovery seed) : review supplémentaire `kz-conformite`.

### 11.4. ADRs DS-related

Emplacement : `docs/architecture/adr/DS-*.md`. Exemples à rédiger au Sprint 0 :

- `DS-001-tamagui-adoption.md`
- `DS-002-color-semantic-tokens.md`
- `DS-003-terracotta-emergency-only.md`
- `DS-004-dark-mode-parity.md`
- `DS-005-dynamic-type-support.md`

---

## 12. Risques résiduels et points à valider

### 12.1. Risques techniques

| Risque | Impact | Mitigation |
|---|---|---|
| **Compatibilité Tamagui + RN 0.74+** sur animations complexes (BottomSheet, SeedCell cascade) | Moyen | Sprint 0 : POC avec les 3 composants les plus animés. Fallback : `react-native-reanimated` + StyleSheet natif avec tokens maison. Coût : -3 à -5 j. |
| **Parité mobile / web** sur `BottomSheet` → Modal web | Faible | Pattern acté : bascule automatique selon breakpoint. Testé en Sprint 2. |
| **Performance Android milieu de gamme** sur Stories animées | Moyen | Tests sur Pixel 4a + Samsung A52 en CI E2E. Budget 60 fps. Désactivation shimmer si perf dégradée. |
| **Dynamic Type 200 %** sur composants denses (`DoseCard`, `CaregiverListItem`) | Moyen | Test Playwright + Maestro en CI. Fallback : wrap vertical forcé si `fontScale > 1.5`. |
| **Chargement Fraunces + JetBrains Mono** alourdit bundle mobile | Faible | Chargement à la demande via `expo-font.loadAsync` uniquement sur écrans recovery seed + onboarding slide 1. |

### 12.2. Risques éditoriaux / conformité

| Risque | Impact | Mitigation |
|---|---|---|
| **Usage accidentel de terracotta hors secours** | Élevé (ligne rouge branding) | Règle ESLint custom `@kinhale/no-emergency-color-outside-rescue` + grep CI. |
| **Microcopie hardcodée qui passe la review** | Moyen | ESLint `i18next/no-literal-string` actif sur `apps/` + tests Storybook qui parcourent les 4 locales. |
| **Composant de célébration ajouté par erreur** | Élevé (DP9) | Interdiction d'import `react-canvas-confetti`, `lottie-react-native` pour animations décoratives — vérifié par `@typescript-eslint/no-restricted-imports`. |
| **ConsentScreen bypassable** | Critique (conformité §5.4) | Test E2E Playwright + Maestro : bouton primaire désactivé jusqu'à scroll complet. |

### 12.3. Points à valider post-Sprint 0

1. **Adoption finale Tamagui** (ADR D7) — après POC animations complexes.
2. **Contraste AAA sur `color.action.emergency`** — à valider visuellement avec public FR-CA + FR-FR (certains trouvent la terracotta trop orange pour être perçue comme "alerte douce" — compromis à tenir).
3. **Tailles de `DoseCard` en mode Dynamic Type 200 %** — test Lise validé ou fallback.
4. **Parité dark mode sur `EmergencyDoseButton`** — la terracotta sombre doit rester lisible sans paraître "brune éteinte".
5. **Variantes `AvatarPastille` couleurs** — collision sémantique potentielle avec chips fonctionnelles ; test avec échantillon utilisateurs.
6. **Performance Storybook builds** — si trop lent, envisager Storybook 8 + Vite.

### 12.4. Points à valider avec kz-estimator et kz-orchestrateur

- Effort 40 j/personne aligné avec l'enveloppe budgetaire v1.0 ?
- Planning des Sprints 0-4 compatible avec la roadmap globale Kinhale ?
- Besoin d'un renfort DS (freelance spécialiste Tamagui) au Sprint 2 ?

---

## 13. Checklist de sortie du livrable

- [x] Tokens primitifs + sémantiques spécifiés (§2)
- [x] Parité clair + sombre documentée avec ratios contraste (§2.2, §6)
- [x] 3 familles typo + échelle + composants pré-définis (§2.3)
- [x] Échelle espacement 4 px complète (§2.4)
- [x] Rayons, élévations, breakpoints, z-index, motion tokenisés (§2.5-2.9)
- [x] 21 primitives + 16 composition + 23 Kinhale-spécifiques spécifiés (§3)
- [x] Règles d'accessibilité opérationnelles (§4)
- [x] Règles i18n opérationnelles (4 locales, vouvoiement, vocab normalisé) (§5)
- [x] Mode sombre parité complète (§6)
- [x] Motion guidelines avec interdictions DP9 (§7)
- [x] Structure de package + conventions nommage (§8)
- [x] Stratégie de test : unit, visuel, a11y, i18n, motion, perf (§9)
- [x] Roadmap 40 j/personne en 5 phases (§10)
- [x] Documentation Storybook + README + guide contribution (§11)
- [x] Risques résiduels identifiés (§12)
- [x] 10 décisions design validées intégrées (A1-A10)
- [x] 6 ajustements conformité QR onboarding intégrés (`InvitationQRCard`, `ConsentScreen`, `SymptomsGrid` non-DM, auto-retrait 2 taps, etc.)
- [x] Ligne rouge DM respectée (aucun composant prescriptif)
- [x] Ligne rouge terracotta respectée (usage exclusif `EmergencyDoseButton`, `DoseCard rescue`, `SymptomsGrid`, `CalendarDayCell rescue`, `PumpLevelBar role=secours`, `PumpCard role=secours`)

---

## 14. Chaînage aval recommandé

```
kz-design-system (livré)
   ↓
kz-copywriting (microcopie + traduction 4 locales)
   ↓
kz-frontend (implémentation packages/ui, Sprint 0-4)
   ↓
kz-qa (tests visuels + a11y)
   ↓
kz-design-review (validation conformité visuelle écrans composés)
```

Dépendances amont résolues :
- Tokens couleur validés par `00-kz-branding.md` §5.2 ✓
- Tokens typo validés par `00-kz-branding.md` §5.3 ✓
- Principes interaction validés par `00-kz-ux-research.md` §8 ✓
- 51 écrans mappés par `00-kz-designer.md` §4 ✓
- 20+ composants récurrents listés par `00-kz-designer.md` §5 ✓
- Contraintes Tamagui + RN validées par `00-kz-architecture.md` §1 ✓
- 6 ajustements conformité QR intégrés via `InvitationQRCard` + `ConsentScreen` ✓

---

*Fin du design system — prêt à être consommé par kz-frontend, kz-copywriting, kz-qa, kz-design-review.*
