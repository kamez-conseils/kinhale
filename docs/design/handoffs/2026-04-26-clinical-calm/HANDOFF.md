# Handoff design Kinhale — direction « clinical-calm »

**Reçu le** : 2026-04-26  
**Source** : Claude Design (claude.ai/design) — bundle exporté par Martial Kaljob  
**Direction visuelle** : « clinical-calm » (palette douce neutre + accent slate-blue, typographie Inter Tight + Inter, animation breath orb)

## Pourquoi ce dossier existe

Ce bundle est conservé dans le dépôt comme **source de vérité** pour l'implémentation Kinhale. Quand on hésite sur un détail (espacement, gradient, hauteur d'un composant, libellé), c'est la maquette HTML qui tranche, pas l'interprétation d'un développeur. Les agents de revue (`kz-review`, `kz-design-review`) doivent pouvoir comparer le rendu produit avec la référence sans dépendre d'un lien externe.

## Comment lire ce bundle

1. **`README.md`** — note d'origine de Claude Design.
2. **`chats/chat1.md`** — transcript complet de la conversation produit. Lit-le en premier : il révèle où l'utilisateur a hésité, les choix retenus, les écrans ajoutés en cours de route. La maquette finale est l'output, le chat est l'intent.
3. **`project/*.html`** — 17 prototypes HTML autonomes. Chacun embarque son DesignCanvas, ses tokens CSS, ses frames iOS/Android, et ses composants spécifiques. Le composant à reproduire dans l'app est généralement nommé `Kinhale<Page>Mobile` et `Kinhale<Page>Web`.
4. **`project/tokens.css`** — palette OKLCH source, partagée entre tous les écrans. Sert de référence aux tokens Tamagui dans `packages/ui/src/theme/colors.ts`.

## Inventaire des écrans

| Écran HTML | Équivalent applicatif | Statut |
|---|---|---|
| `Kinhale Auth.html` | `apps/web/src/app/auth/` + `apps/mobile/app/auth/` | KIN-098 PR1 mergée — divergences fonts/gradient à corriger |
| `Kinhale Home.html` | `apps/web/src/app/page.tsx` (web) + équivalent mobile | À implémenter |
| `Kinhale Onboarding.html` | `apps/web/src/app/onboarding/*` + `apps/mobile/app/onboarding/*` | À redesigner |
| `Kinhale Mes pompes.html` | route à créer (`/pumps`) | À implémenter |
| `Kinhale Ajouter pompe.html` | `apps/web/src/app/onboarding/pump/` ou nouvelle route | À redesigner |
| `Kinhale Aidants.html` | `apps/web/src/app/caregivers/` | À redesigner |
| `Kinhale Inviter aidant.html` | `apps/web/src/app/caregivers/invite/` | À redesigner |
| `Kinhale Profil enfant.html` | route à créer (`/child`) | À implémenter |
| `Kinhale Plan d action.html` | route à créer (`/action-plan`) | À implémenter |
| `Kinhale Detail episode.html` | route à créer (`/journal/[id]`) | À implémenter |
| `Kinhale Historique.html` | `apps/web/src/app/journal/` | À redesigner |
| `Kinhale Notifications.html` | `apps/web/src/app/settings/notifications/` | À redesigner |
| `Kinhale Rapports.html` | `apps/web/src/app/reports/` | À redesigner |
| `Kinhale Partage medecin.html` | route à créer (`/share/[token]`) | À implémenter |
| `Kinhale Reglages.html` | `apps/web/src/app/settings/` | À redesigner |
| `Kinhale Erreurs.html` | pages 404, lien expiré, lien déjà utilisé | À implémenter |

## Tokens partagés (extrait — cf. `project/tokens.css`)

```
--k-bg            oklch(98.5% 0.005 90)   // off-white chaud
--k-surface       oklch(100% 0 0)         // blanc pur
--k-surface-2     oklch(96.5% 0.006 90)   // gris très doux
--k-line          oklch(90% 0.008 90)
--k-line-strong   oklch(82% 0.01 90)

--k-ink           oklch(22% 0.012 250)    // ink primaire
--k-ink-2         oklch(38% 0.012 250)
--k-ink-3         oklch(55% 0.012 250)
--k-ink-4         oklch(70% 0.012 250)

--k-maint         oklch(56% 0.07 235)     // accent maintenance / fond
--k-rescue        oklch(58% 0.115 35)     // rescue / secours (terracotta)
--k-amber         oklch(72% 0.115 75)     // alertes
--k-ok            oklch(60% 0.09 155)     // confirmé
```

Tous les accents partagent un chroma proche (≈ 0.07–0.12) — la palette ne crie jamais. Toute couleur ajoutée à l'app **doit** respecter cette discipline.

## Typographie

```
--k-display       "Inter Tight" 500, letter-spacing -0.02em à -0.025em (titres)
--k-text          "Inter" 400/500 (UI courante)
--k-mono          "JetBrains Mono" 400/500 (pills d'e-mail, hash, codes)
```

Variantes tweakables (panneau Tweaks sur le canvas) :
- `serif` : Source Serif 4 + Inter
- `humanist` : DM Sans + DM Sans

Pour la v1.0 on s'aligne sur **`grotesk`** (Inter Tight + Inter), choisi par l'utilisateur dans le chat.

## Comment matcher le design dans le code

1. **Les composants `@kinhale/ui` doivent reproduire le visuel HTML**, pas la structure JSX du prototype. Le prototype mélange `<div>` et hooks React parce qu'il est livré en un fichier autonome — l'app doit utiliser Tamagui + nos conventions.
2. **Les `data-density`, `data-theme`, `data-type`, `data-layout`** du prototype correspondent aux tweaks utilisateur (à exposer à terme dans Réglages).
3. **`color-mix(in oklch, ...)`** est utilisé partout dans les gradients et nuances. CSS moderne accepté côté web (Tamagui le passe tel quel). Côté mobile React Native, recalculer manuellement.
4. **Les animations CSS** (`@keyframes k-breath`) ne fonctionnent qu'en web. Côté mobile : Reanimated v3.

## Mise à jour

Quand un nouveau handoff design arrive :
1. Décompresser dans `docs/design/handoffs/YYYY-MM-DD-<thème>/`
2. Ne pas écraser l'ancien — conserver l'historique des intentions design.
3. Ajouter une note dans ce `HANDOFF.md` pointant vers la nouvelle référence.
