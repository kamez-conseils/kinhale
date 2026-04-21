# ADR-D7 — Design System : Tamagui vs StyleSheet natif + tokens custom (@kinhale/ui)

**Date** : 2026-04-20
**Statut** : Accepté (avec point de contrôle Sprint 0)
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

Kinhale est une application cross-platform (iOS + Android + Web PWA) qui partage ses composants UI entre les trois plateformes via React Native Web. Le design system est la couche qui traduit les décisions de design (couleurs, typographie, espacement, composants) en code réutilisable sur toutes les plateformes.

Deux exigences structurantes pèsent sur ce choix :

**WCAG 2.1 AA dès la v1.0** : les contrastes de texte doivent être ≥ 4:5:1, les composants interactifs ≥ 3:1. Les touch targets doivent être ≥ 44×44pt. La navigation clavier doit être complète sur web. Ces exigences d'accessibilité doivent être vérifiées automatiquement en CI (axe-core sur Playwright, Lighthouse a11y ≥ 95). Un design system qui facilite la vérification automatique des contrastes et des rôles ARIA est un avantage concret.

**Cross-platform via React Native Web** : un `<Button>` Kinhale doit s'afficher correctement sur iOS (native), Android (native), et web (React Native Web → HTML/CSS). Les primitives de style doivent fonctionner sur les trois plateformes sans code conditionnel.

Pour un solo dev, le design system est aussi un investissement en temps : une configuration complexe qui ralentit les builds ou génère des erreurs cryptiques est un multiplicateur de friction quotidien sur 13+ semaines de développement.

## Options évaluées

### Option A — Tamagui

**Description** : Tamagui est un design system et un compilateur de styles pour React Native et React Native Web. Son point différenciant est un compilateur qui évalue statiquement les props de style (couleurs, tailles, espacements) et génère du CSS natif ou des StyleSheets optimisés au moment du build, plutôt qu'au runtime. Cela élimine le coût de calcul de style au render.

**Avantages** :
- **Performance compile-time** : le compilateur Tamagui transforme les composants `<Stack>`, `<Text>`, `<Button>` en styles statiques. Sur mobile, plus de StyleSheet.create au runtime. Sur web, le CSS généré est un fichier statique. Les benchmarks publiés montrent 2-3× d'amélioration sur les renders lourds de listes.
- **Tokens partagés** : les tokens de couleur, de typographie, et d'espacement sont définis une seule fois dans `packages/ui/src/tokens.ts` et utilisés de façon identique sur iOS, Android, et Web. Pas de mapping manuel entre plateformes.
- **Support WCAG natif** : Tamagui expose des helpers de contraste (`$color.contrast`, variants sémantiques `intent: 'primary' | 'destructive' | 'neutral'`) qui facilitent la validation des ratios de contraste.
- **Dark mode natif** : `useTheme()` de Tamagui gère automatiquement les tokens de couleur en dark mode via des CSS variables sur web et des variables Tamagui sur mobile. Pas de code conditionnel.
- **React Native Web compatible** : Tamagui est conçu pour fonctionner identiquement sur React Native et React Native Web. Les composants Tamagui compilent en `View`/`Text` React Native sur mobile et en `div`/`span` sur web via React Native Web.
- **Communauté active** : Tamagui est maintenu par une équipe dédiée (Nate Wienert), utilisé par des apps React Native à grande audience, et documenté activement.

**Inconvénients** :
- **Courbe d'apprentissage** : le modèle mental Tamagui (tokens, variants, themes, compiler) est différent du StyleSheet React Native standard. Un dev React Native habitué aux StyleSheets aura besoin de 1-2 jours d'adaptation.
- **Impact sur le temps de build** : le compilateur Tamagui est un plugin Babel/Metro qui analyse chaque composant. Sur un projet de taille moyenne (100+ composants), cela peut ajouter 30-60s au build initial. Les builds incrémentiels sont mis en cache.
- **Risque de friction avec Next.js App Router** : la configuration Tamagui pour SSR (CSS variables, style sheets serveur via `@tamagui/next-plugin`) ajoute de la complexité. Des erreurs d'hydratation sont possibles si la configuration est incomplète.
- **Version locking** : Tamagui évolue rapidement. Les mises à jour majeures peuvent nécessiter des ajustements dans `packages/ui`. Risque de breaking changes à surveiller.

**Risques** :
- **Risque principal** : le benchmark de build Sprint 0 révèle un temps de build iOS/Android > 5 min avec Tamagui, ce qui impacte la productivité quotidienne. Si ce seuil est dépassé, le fallback s'impose.
- **Risque secondaire** : une mise à jour Tamagui majeure en cours de développement crée une régression sur un composant critique.

### Option B — StyleSheet React Native + tokens custom (@kinhale/ui)

**Description** : Le design system est implémenté "from scratch" avec les primitives natives React Native (`StyleSheet.create`, `View`, `Text`, `TouchableOpacity`) + un package `@kinhale/ui` qui exporte des tokens (couleurs, typographie, espacement) et des composants de base. Pas de compilateur externe.

**Avantages** :
- **Aucune dépendance externe critique** : le design system ne dépend que de React Native lui-même. Pas de risque de breaking change d'un tiers.
- **Compréhensible par tout dev React Native** : `StyleSheet.create` est la primitive universelle. Tout contributeur open source peut contribuer sans apprendre Tamagui.
- **Build time inchangé** : pas de compilateur Babel/Metro supplémentaire. Les temps de build iOS/Android ne sont pas affectés.
- **Contrôle total** : chaque décision de style est explicite et lisible dans le code. Pas de magie de compilation.
- **Configuration SSR triviale** : sur Next.js, React Native Web + StyleSheet fonctionne nativement sans plugin supplémentaire.

**Inconvénients** :
- **Tokens manuels sur chaque plateforme** : les tokens de couleur, typographie, et espacement doivent être adaptés manuellement pour chaque plateforme si leurs représentations diffèrent. Par exemple, les `rem` n'existent pas en React Native — tout est en `px` ou en pourcentage.
- **Dark mode coûteux à implémenter** : sans système de tokens dynamiques, le dark mode nécessite un `useColorScheme()` partout où une couleur est définie, ou une solution custom de theming. Cela représente 2-4 jours-homme supplémentaires.
- **Pas d'optimisation compile-time** : chaque render recalcule les styles (mitigé par `StyleSheet.create` qui fait du caching, mais moins efficace que le compile-time de Tamagui).
- **Couche d'accessibilité manuelle** : les helpers de contraste, les rôles ARIA, et les états d'accessibilité doivent être implémentés manuellement sur chaque composant, sans l'aide d'un système de design.
- **Temps de développement initial plus long** : construire un composant `Button` cross-platform avec variants (primary/secondary/destructive), dark mode, états disabled/pressed, et accessibilité WCAG prend 2-3× plus de temps qu'avec Tamagui.

**Risques** :
- Risque de dette technique si les tokens ne sont pas bien centralisés dès le départ — des couleurs hardcodées apparaissent dans les composants, rendant les changements de theme coûteux.
- Risque de sous-investissement en accessibilité : sans helpers WCAG, il est facile d'oublier un ratio de contraste ou un `accessibilityLabel` sur un composant secondaire.

## Critères de décision

1. **WCAG 2.1 AA dès la v1.0** — helpers de contraste et composants accessibles par défaut.
2. **Cross-platform iOS/Android/Web** — tokens partagés, pas de code conditionnel.
3. **Dark mode natif** — requis dès la v1.0 (exigence produit).
4. **Temps de build iOS/Android < 5 min** — seuil de productivité pour un solo dev.
5. **Courbe d'apprentissage raisonnable** — < 2 jours pour un dev React Native senior.
6. **Maintenance acceptable** — pas de breaking change Tamagui bloquant sur la durée du projet.

## Décision

**Choix retenu : Option A — Tamagui, avec benchmark obligatoire en Sprint 0**

Tamagui résout trois problèmes simultanément que le StyleSheet custom résout moins bien : le cross-platform tokens, le dark mode natif, et les helpers d'accessibilité WCAG. Pour un solo dev qui doit livrer une app WCAG 2.1 AA sur trois plateformes avec dark mode en 13 semaines, Tamagui est un multiplicateur de productivité réel, pas un gadget.

Le risque principal — l'impact sur le temps de build — est mesuré en Sprint 0 avec un projet de test représentatif (5-10 composants Tamagui compilés, build iOS simulateur). Si le seuil de 5 minutes est dépassé, le fallback StyleSheet est activé. La décision est conditionnée par ce benchmark.

Ce qui a fait pencher la balance : le dark mode seul représente 2-4 jours-homme en StyleSheet custom. Les composants WCAG (avec contrastes vérifiables, rôles ARIA, états d'accessibilité) représentent 30-50% du temps de développement UI en StyleSheet custom. Tamagui amortit ces coûts sur l'ensemble des composants.

Ce choix serait invalidé si : le benchmark Sprint 0 révèle > 5 min de build, ou si une incompatibilité bloquante avec Next.js App Router SSR n'est pas résoluble avec le `@tamagui/next-plugin`.

## Conséquences

**Positives :**
- Tokens de couleur, typographie, et espacement définis une seule fois dans `packages/ui/src/tamagui.config.ts` et utilisés identiquement sur iOS, Android, et Web.
- Dark mode sans code conditionnel : `<Text color="$text">` s'adapte automatiquement selon le thème actif.
- Composants accessibles par défaut : `<Button>` Tamagui expose `role`, `aria-label`, `aria-disabled` nativement sur web.
- Benchmark de contraste : les tokens de couleur sont validés contre le ratio WCAG 4.5:1 dès leur définition, pas après coup.
- Styles compile-time sur web : le CSS généré par Tamagui est un fichier statique servi par CloudFront — pas de FOUC (Flash of Unstyled Content).

**Négatives / compromis acceptés :**
- 1-2 jours d'adaptation pour comprendre le modèle Tamagui (variants, themes, compiler).
- Configuration `@tamagui/next-plugin` dans `next.config.ts` — documentation disponible mais dense.
- Mises à jour Tamagui majeures à gérer activement (veille sur le changelog).
- Le compilateur Tamagui analyse tous les composants du projet — les builds from scratch sont plus lents (mitigé par le cache Turborepo).

**Plan de fallback** : Si le benchmark Sprint 0 dépasse 5 min de build iOS, ou si la compatibilité Next.js App Router SSR est bloquante : basculer sur StyleSheet React Native + `@kinhale/ui` custom. Coût de migration estimé : 3-5 jours-homme (les composants sont refactorisés avec des StyleSheets standards). La couche de tokens reste identique (`packages/ui/src/tokens.ts`), seul le mécanisme de consommation change. Le dark mode est alors implémenté via un `ThemeContext` custom (~1 jour).

## Révision prévue

Après le benchmark Sprint 0 (décision définitive : Tamagui confirmé ou fallback). À revisiter si Tamagui sort une v2.0 avec une API significativement différente qui impose une migration coûteuse. Horizon : fin Sprint 2 (validation sur les composants de base produits).
