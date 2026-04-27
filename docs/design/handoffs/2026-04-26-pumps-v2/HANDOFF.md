# Handoff design — Pumps v2 (clinical-calm)

**Date** : 2026-04-26
**Source** : `https://api.anthropic.com/v1/design/h/YRdhbpPSfEwWNPqYO0hAkg`
**Page principale** : `Kinhale Mes pompes.html`
**Page secondaire** : `Kinhale Ajouter pompe.html`
**Statut** : implémentation en cours sur `feature/KIN-110-pumps-v2-clinical-calm`

## Périmètre

Refonte des deux pages liées aux inhalateurs pour matcher le design avancé
fourni par Claude Design v2 :

1. **Mes pompes** — layout dashboard (sidebar 224 px + en-tête sticky), sections
   distinctes « Pompes de fond » / « Pompes de secours » avec compteurs, cartes
   riches (badge `PRINCIPALE`, lieu de stockage, jauge de stock colorée, bouton
   `Renouveler` conditionnel), carte pointillée « Ajouter une pompe ».
2. **Ajouter une pompe** — wizard 4 étapes (Identifier → Posologie → Schéma →
   Prêt) avec un panneau d'aperçu temps réel à droite côté desktop.
3. **État vide** — illustration `EmptyInhalerArt`, 3 bénéfices, deux CTA
   (Scanner code-barres + Saisir manuellement), tip code-barres en pied.

## Composants à reproduire

| Source HTML (`Kinhale Mes pompes.html`)        | Cible TS (`packages/ui/src/components/pumps/`) |
| ---------------------------------------------- | ---------------------------------------------- |
| `InhalerCard`                                  | `PumpCard.tsx`                                 |
| `AddInhalerCard`                               | `AddPumpCard.tsx`                              |
| `SectionTitle`                                 | section header local au layout                 |
| `EmptyInhalerArt` + `EmptyBenefit` + `EmptyIcon` | `EmptyState.tsx`                             |
| `PompesWebSidebar`                             | `PumpsSidebar.tsx`                             |
| `PompesMobile`                                 | `PumpsListMobile.tsx`                          |
| `PompesWeb`                                    | `PumpsListWeb.tsx`                             |
| `PompesEmptyMobile` + `PompesEmptyWeb`         | `PumpsEmptyMobile.tsx` + `PumpsEmptyWeb.tsx`   |

| Source HTML (`Kinhale Ajouter pompe.html`)     | Cible TS                                       |
| ---------------------------------------------- | ---------------------------------------------- |
| `Stepper` (4 étapes pastille + ligne)          | `Stepper.tsx`                                  |
| `APField` + `apInputStyle`                     | `Field.tsx` + `Input.tsx`                      |
| `AP_COLORS` (8 dots)                           | `colors.ts`                                    |
| `APStep1` (identifier)                         | `AddPumpStep1.tsx`                             |
| `APStep2` (posologie + dispositif chips)       | `AddPumpStep2.tsx`                             |
| `APStep3` (schéma + escalade)                  | `AddPumpStep3.tsx`                             |
| `APStep4` (résumé)                             | `AddPumpStep4.tsx`                             |
| Recap panel `Aperçu`                           | `AddPumpPreview.tsx`                           |
| `AddPumpFlow` (orchestrateur)                  | `AddPumpFlow.tsx`                              |

## Tokens utilisés (déjà mappés dans `packages/ui/src/theme`)

- Surface : `$background`, `$surface`, `$surface2`
- Lignes : `$borderColor`, `$borderColorStrong`
- Texte : `$color`, `$colorMuted`, `$colorMore`, `$colorFaint`
- Maint : `$maint`, `$maintSoft`, `$maintInk`
- Rescue : `$rescue`, `$rescueSoft`, `$rescueInk`
- Ambre : `$amber`, `$amberSoft`, `$amberInk`
- Radius : 10 / 12 / 14 / 16 / 18 / 24 (utilisés directement en `borderRadius`).

## Règles non-négociables Kinhale

- **i18n FR + EN dès le commit #1** — toute chaîne ajoutée doit être présente
  dans `packages/i18n/src/locales/{fr,en}/common.json` (section `pumps`).
- **WCAG 2.1 AA** — `<h1>` / `<h2>` natifs, contrastes vérifiés, touch targets
  ≥ 44×44 pt sur mobile, navigation clavier complète sur le wizard.
- **Pas d'`any` / `// @ts-ignore`** — TypeScript strict.
- **Aucune chaîne UI hardcodée** dans `apps/` — tout passe par `t()`.
- **Composants `@kinhale/ui` purement présentationnels** — l'état formulaire
  reste interne au composant client `apps/web` ou ressort via `onSubmit`.

## Notes d'adaptation

- Les valeurs `var(--k-maint)` et autres CSS-vars du HTML brut deviennent
  `$maint` etc. côté Tamagui.
- Les `color-mix(in oklch, ...)` et `boxShadow` à valeur dynamique passent
  par `style={{ ... }}` natif (typage strict Tamagui ne supporte pas tous
  les patterns CSS modernes).
- La sidebar 224 px est dupliquée plutôt qu'extraite du composant Home — les
  items de nav sont passés en props pour réutilisation.
- Le wizard côté mobile (sans aperçu) et côté desktop (avec modal 880×720 +
  panneau aperçu) partagent les mêmes étapes via `mode: 'mobile' | 'web'`.

## Fichiers source archivés

```
docs/design/handoffs/2026-04-26-pumps-v2/
├── HANDOFF.md              ← ce fichier
├── README.md               ← consigne d'origine de Claude Design
├── chats/chat1.md          ← transcription complète des échanges
└── project/                ← prototype HTML/CSS/JS complet
    ├── Kinhale Mes pompes.html
    ├── Kinhale Ajouter pompe.html
    ├── tokens.css
    └── ... (autres écrans, non concernés par cette PR)
```
