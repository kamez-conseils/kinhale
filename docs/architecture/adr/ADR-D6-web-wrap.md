# ADR-D6 — Wrap Web : Next.js 15 (App Router) + React Native Web vs Vite SPA + React Native Web

**Date** : 2026-04-20
**Statut** : Accepté
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

Kinhale cible trois plateformes : iOS, Android, et Web. La cible web remplit deux rôles distincts qui ont des exigences techniques différentes :

1. **Landing page et pages statiques** : page d'accueil présentant le produit, pages légales (`/privacy`, `/terms`), page de téléchargement (`/download`), guide self-hosting. Ces pages doivent être indexées par les moteurs de recherche (SEO) pour que les familles cherchant "application asthme enfant gratuite" puissent trouver Kinhale. Elles sont majoritairement du contenu statique avec peu d'interactivité.

2. **Application web PWA** : l'application Kinhale elle-même, accessible depuis un navigateur sans installation. Utilisée par des aidants qui n'ont pas de smartphone ou qui accèdent depuis un ordinateur. Doit être installable comme PWA. Cette partie est une SPA React Native Web à part entière, avec les mêmes composants que l'app mobile.

Ces deux rôles peuvent théoriquement être servis par le même framework web ou par des solutions différentes. Le choix du framework impacte le SEO, la performance perçue (Time to First Byte), la complexité du build, la compatibilité avec React Native Web, et le niveau de configuration requis.

La compatibilité entre React Native Web et le framework web choisi est un point de vigilance : React Native Web génère du CSS-in-JS et des composants qui s'attendent à un environnement DOM standard, mais les rendus serveur (SSR) de ces composants nécessitent une configuration spécifique pour éviter les erreurs d'hydratation.

## Options évaluées

### Option A — Next.js 15 (App Router) + React Native Web

**Description** : Next.js 15 avec l'App Router est utilisé comme framework web. Les pages statiques (`/`, `/privacy`, `/download`) sont rendues en SSR/SSG côté serveur pour le SEO. L'application Kinhale elle-même est rendue comme une SPA React Native Web imbriquée dans le layout Next.js, avec `'use client'` pour tous les composants React Native Web (qui ne peuvent pas être rendus côté serveur sans configuration spécifique).

**Avantages** :
- **SEO natif pour les pages publiques** : la landing page, les pages légales, et la page de téléchargement sont rendues côté serveur (SSR/SSG), indexées immédiatement par les moteurs de recherche. Pour un produit open source en quête d'adoption organique, c'est un avantage non négligeable.
- **PWA installable** : Next.js + `next-pwa` permet de configurer le Service Worker pour l'installation PWA et le cache offline de l'app shell.
- **Routing unifié** : un seul système de routing (Next.js App Router) gère à la fois les pages marketing et l'app. Pas de proxy, pas de domaine séparé.
- **Cohérence TypeScript** : Next.js 15 est entièrement TypeScript, avec les Server Components et les Server Actions qui permettent des patterns stricts.
- **Déploiement simplifié** : la même app Next.js est déployée sur CloudFront + S3 (export statique) ou sur ECS Fargate si du SSR dynamique est requis. Le pipeline CI/CD est unique.
- **Middleware Next.js** : utile pour la gestion des redirections, les headers de sécurité (CSP, HSTS, X-Frame-Options), et la géolocalisation des utilisateurs (redirection `/fr` vs `/en`).

**Inconvénients** :
- **Friction React Native Web + App Router** : React Native Web crée des composants `View`, `Text`, `TouchableOpacity` qui ne peuvent pas être rendus côté serveur sans une configuration d'alias (`react-native` → `react-native-web`) dans le build Next.js. Cette configuration est documentée mais demande 0.5-1 jour de setup. Les erreurs d'hydratation ("Hydration mismatch") sont un risque si un composant React Native Web a un comportement différent entre SSR et CSR.
- **Bundle size plus lourd** : Next.js ajoute son propre runtime (~75Ko gzippé) en plus de React Native Web (~50Ko gzippé). Pour l'app shell, cela reste dans les limites acceptables mais est à surveiller.
- **App Router est encore en maturité** : l'App Router de Next.js 15 est stable mais certains patterns avancés (notamment les Server Components imbriqués avec des Client Components React Native Web) ont des cas limites documentés dans les issues GitHub. Il faut être prêt à contourner certains bugs.
- **Complexité de la configuration Tamagui** : Tamagui doit être configuré pour fonctionner à la fois côté serveur (SSR) et côté client, avec des CSS variables et des style sheets générés différemment. La documentation Tamagui + Next.js App Router est disponible mais dense.

**Risques** :
- Risque de blocage sur la compatibilité React Native Web + App Router SSR. Mitigé par le fait que ce problème est connu et documenté (solution : `'use client'` sur tous les composants RNW + configuration des alias de module).
- Risque d'overhead de maintenance si Next.js évolue rapidement (App Router a eu 3 versions majeures en 18 mois).

### Option B — Vite SPA + React Native Web

**Description** : Vite est utilisé comme bundler pour produire une Single Page Application (SPA) React Native Web. Pas de SSR. La landing page et les pages légales sont soit des routes SPA (rendues côté client), soit un site statique séparé (simple HTML/CSS) servi via CloudFront.

**Avantages** :
- **Configuration la plus simple pour React Native Web** : Vite avec le plugin `vite-plugin-react` + les alias `react-native` → `react-native-web` est la configuration la plus documentée et la plus testée pour React Native Web. Pas de friction SSR.
- **Build ultra-rapide** : Vite HMR est quasi-instantané (< 100ms de feedback en développement). Next.js App Router a un temps de compilation plus long (~2-5s pour les changements).
- **Moins de dépendances** : Vite seul ajoute peu de poids. Pas de runtime Next.js, pas de Node.js serveur requis (deploy purement statique sur CloudFront/S3).
- **Pas d'erreurs d'hydratation** : une SPA pure est entièrement rendue côté client — aucun risque d'écart SSR/CSR.
- **Compatible avec toutes les librairies React** sans se préoccuper de la distinction Server/Client Component.

**Inconvénients** :
- **SEO inexistant pour les pages publiques** : une SPA rendue côté client n'est pas indexée par les moteurs de recherche (les crawlers Google comprennent le JS mais avec un délai et une couverture incomplète). La landing page, les pages légales, et la page de téléchargement ne seraient pas indexées correctement.
- **PWA possible mais plus complexe** : Vite PWA via `vite-plugin-pwa` fonctionne mais demande plus de configuration manuelle pour les Service Workers qu'avec `next-pwa`.
- **Deux systèmes de déploiement** : si on veut une landing page avec SEO, il faut un site statique séparé (un simple HTML/CSS ou un autre framework léger). On se retrouve à gérer deux projets web au lieu d'un.
- **Routing SPA moins puissant** : sans SSR, les deep links (`kinhale.health/foyer/abc123`) ne fonctionnent que si le serveur est configuré pour rediriger toutes les routes vers `index.html`. Gérable avec CloudFront, mais à configurer.
- **Pas de middleware** : sans couche serveur, les redirections de langue, les headers de sécurité custom, et la détection de géolocalisation doivent être gérés via CloudFront Functions ou Lambda@Edge — une complexité supplémentaire côté infra.

**Risques** :
- Risque de perte d'adoption organique si le SEO de la landing page est insuffisant. Pour un produit open source gratuit qui cherche à être découvert par des familles, le SEO est un canal d'acquisition non-négligeable.

## Critères de décision

1. **SEO des pages publiques** — la landing page et les pages légales doivent être indexées correctement.
2. **Compatibilité React Native Web** — l'app Kinhale utilise des composants RNW partagés avec le mobile.
3. **PWA installable** — l'application web doit être installable comme PWA.
4. **Complexité de build acceptable** — le setup initial doit être réalisable en < 2 jours.
5. **Déploiement unifié** — un seul projet web à déployer et maintenir.
6. **Performance perçue** — TTFB des pages publiques < 200ms.

## Décision

**Choix retenu : Option A — Next.js 15 (App Router) + React Native Web**

Le SEO de la landing page est un critère déterminant. Kinhale est un produit open source gratuit dont l'acquisition repose principalement sur la découverte organique (recherches Google, partage entre parents, recommandations de pneumo-pédiatres). Sans SEO, une famille cherchant "application suivi asthme enfant gratuite open source" ne trouvera pas Kinhale. Avec Next.js SSR/SSG sur les pages publiques, les pages sont indexées dès J1.

La friction React Native Web + App Router est réelle mais connue et documentée. La stratégie est claire : tous les composants qui utilisent des primitives React Native Web portent `'use client'` et sont rendus uniquement côté client. Les pages marketing (`/`, `/privacy`) sont des Server Components purs avec du HTML/CSS standard, sans React Native Web. L'app elle-même (`/app/**`) est un Client Component React Native Web intégral.

Cette séparation claire entre pages marketing (SSR pur) et app (CSR React Native Web) évite les problèmes d'hydratation tout en préservant les bénéfices SEO des pages publiques.

Ce qui invaliderait ce choix : si le PoC Sprint 0 révèle des incompatibilités bloquantes entre Tamagui + React Native Web + App Router que les contournements documentés ne résolvent pas. Dans ce cas, le fallback est Vite SPA + un site statique HTML minimal pour la landing page.

## Conséquences

**Positives :**
- SEO immédiat sur la landing page, `/privacy`, `/terms`, `/download` — pages générées en SSG au build time.
- PWA installable via `next-pwa` avec Service Worker configuré pour le cache offline de l'app shell.
- Un seul projet web, un seul déploiement, un seul pipeline CI/CD.
- Middleware Next.js pour les headers de sécurité (CSP, HSTS) et les redirections de langue.
- Les pages légales et de conformité sont des Server Components avec du Markdown rendu côté serveur — accessibles aux crawlers d'accessibilité et de conformité.

**Négatives / compromis acceptés :**
- Configuration d'alias module (`react-native` → `react-native-web`) dans `next.config.ts` — 0.5 jour de setup.
- Tous les composants React Native Web portent `'use client'` — pattern verbeux mais explicite et compréhensible.
- La configuration Tamagui SSR (CSS variables, style sheets serveur) ajoute de la complexité au `next.config.ts`.
- Build time légèrement plus long qu'une Vite SPA pure (Next.js compile les Server Components séparément).

**Plan de fallback** : Si la compatibilité React Native Web + App Router crée des blocages au Sprint 0, le fallback est : pages marketing en HTML statique pur (simple et rapide, ~1 jour), app Kinhale en Vite SPA React Native Web. Un proxy CloudFront route `/` et les pages statiques vers le bucket S3 marketing, et `/app` vers le bucket S3 Vite SPA. Coût de cette séparation : ~1 jour supplémentaire de configuration CloudFront.

## Révision prévue

Après le Sprint 0 (validation de la compatibilité React Native Web + App Router). À réévaluer si React Native Web atteint une compatibilité native avec les Server Components (hypothèse : horizon 2027+).
