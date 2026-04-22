# ADR-D5 — Monorepo Tooling : Turborepo vs Nx

**Date** : 2026-04-20
**Statut** : Accepté
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

Kinhale est organisé en monorepo avec une structure claire : `apps/` (mobile React Native, web Next.js, api Fastify) et `packages/` (crypto, sync, domain, ui, i18n, eslint-config, tsconfig, test-utils). Cette organisation permet de partager le code TypeScript, les types, les primitives crypto et les composants UI entre les applications, ce qui est essentiel pour maintenir la cohérence entre plateformes.

Un outil de build monorepo est indispensable pour trois raisons :
1. **Orchestration des tâches** : `pnpm test` dans le repo racine doit lancer les tests de tous les packages dans le bon ordre (les packages dont dépendent d'autres packages doivent être buildés en premier).
2. **Cache des builds** : un changement dans `packages/i18n` ne doit pas rebuilder `apps/mobile` si l'API publique de `i18n` n'a pas changé. Sans cache intelligent, les temps de build en CI deviennent prohibitifs.
3. **Pipeline CI/CD** : les GitHub Actions doivent savoir quels packages ont changé dans une PR pour lancer seulement les tests pertinents, pas la suite complète.

Pour un solo dev, le choix de l'outil de build monorepo a un impact direct sur la vitesse de feedback (temps entre un changement de code et le résultat des tests), la complexité de configuration (temps perdu à déboguer l'outil de build plutôt que le produit), et le cache distant en CI (qui peut réduire le temps de CI de 10-15 min à 2-3 min sur les PRs courantes).

## Options évaluées

### Option A — Turborepo (par Vercel)

**Description** : Turborepo est un outil d'orchestration de tâches de build pour monorepos JavaScript/TypeScript. Il s'occupe du graphe de dépendances entre packages, du cache local et distant des sorties de build, et de l'exécution parallèle des tâches. Il est configuré via un fichier `turbo.json` minimal.

**Avantages** :
- **Configuration minimale** : un `turbo.json` de ~30 lignes suffit pour démarrer. La convention par défaut (chaque package a ses scripts `build`, `test`, `lint` dans son `package.json`) est respectée sans configuration supplémentaire.
- **Cache intelligent** : Turborepo hache les inputs (fichiers source, variables d'environnement, dépendances) et skipe les tâches dont le cache est valide. Sur un monorepo de taille moyenne, les gains sont de 60-80% sur les runs CI suivants.
- **Cache distant** : Turborepo Remote Cache (via Vercel) ou un cache S3 custom (`turbo.json` `remoteCache`) permettent de partager le cache entre développeurs et CI. Pour un solo dev avec CI GitHub Actions, le Vercel Remote Cache est gratuit sur le plan Hobby.
- **Parallelisme natif** : Turborepo exécute les tâches en parallèle en respectant le graphe de dépendances. Sur un CI avec 4 vCPUs, les builds parallèles divisent les temps par ~3.
- **Intégration pnpm workspaces** : Turborepo s'intègre nativement avec pnpm, qui est le package manager choisi pour Kinhale. Pas de configuration d'intégration.
- **Légèreté** : Turborepo est un binaire Go (< 20Mo). Il n'ajoute aucune surcouche conceptuelle au projet.
- **Communauté active** : maintenu par Vercel, bien documenté, nombreux exemples avec Next.js + React Native.

**Inconvénients** :
- **Pas de générateurs de code intégrés** : créer un nouveau package implique de copier manuellement la structure d'un package existant. Turborepo n'a pas de générateur de scaffolding intégré comparable à `nx generate`.
- **Pas d'analyse d'impact automatisée** : Turborepo ne génère pas de rapport "ces packages sont affectés par ce changement" aussi lisible que Nx. En CI, on peut déduire les packages affectés via `turbo run --filter=...[HEAD~1]` mais c'est moins intuitif.
- **Pas de gestion de plugins** : Turborepo n'a pas d'écosystème de plugins au sens Nx. Tout ce qui n'est pas une tâche de build doit être scripté manuellement.

**Risques** :
- Faible. Turborepo est utilisé en production par Vercel eux-mêmes et par de nombreux projets open source de référence.

### Option B — Nx (par Nrwl)

**Description** : Nx est une plateforme complète de développement monorepo. Il combine la gestion des tâches de build (comme Turborepo), des générateurs de code (scaffolding de nouveaux apps/libs), des plugins pour les frameworks courants (React, Next.js, React Native, Node.js), une interface graphique (Nx Console VS Code), et une gestion fine de l'impact des changements.

**Avantages** :
- **Générateurs intégrés** : `nx generate @nx/react-native:library` crée automatiquement un nouveau package avec la bonne structure, le `tsconfig.json` hérité, les scripts `package.json`, et les references nécessaires. Pour un monorepo avec 8+ packages, cela fait gagner du temps à chaque nouveau package.
- **Analyse d'impact précise** : `nx affected:test` lance exactement les tests des packages affectés par les changements (et leurs dépendants). Plus granulaire que `turbo run --filter=...[HEAD~1]`.
- **Nx Console** : extension VS Code qui visualise le graphe de dépendances et permet de lancer des tâches ciblées depuis l'IDE.
- **Cache distant Nx Cloud** : plus configurable que Turbo Remote Cache, avec des statistiques détaillées de hit rate.
- **Plugins maturés** : `@nx/react-native`, `@nx/next`, `@nx/node` configurent automatiquement les outils (Jest, ESLint, TypeScript) pour chaque type de projet.

**Inconvénients** :
- **Surcouche conceptuelle importante** : Nx introduit ses propres concepts (Workspace, Project, Target, Executor, Generator) qui s'ajoutent à la complexité du projet. Un solo dev passe du temps à comprendre et configurer Nx plutôt qu'à développer le produit.
- **`project.json` par package** : Nx remplace les scripts `package.json` par des fichiers `project.json` Nx-spécifiques. Cela crée une couche d'abstraction supplémentaire et rend le repo moins portable (un contributeur sans expérience Nx aura du mal à s'y retrouver).
- **Configuration initiale lourde** : bootstrapper un monorepo Nx est significativement plus complexe que Turborepo. La compatibilité avec pnpm workspaces et la configuration de chaque plugin prend 1-2 jours.
- **Taille des dépendances** : Nx et ses plugins ajoutent ~200-400Mo de dépendances de développement. Sur un CI où `pnpm install` est dans le critical path, cela rallonge les temps.
- **Risque de sur-ingénierie** : un monorepo avec 3 apps et 8 packages est de taille moyenne. La valeur ajoutée des générateurs Nx ne justifie pas la complexité supplémentaire à ce stade.

**Risques** :
- Risque de frustration pour les contributeurs open source non familiers avec Nx — barrière à la contribution.
- Risque de dépendance aux plugins Nx qui peuvent prendre du retard sur les nouvelles versions de React Native ou Next.js.

## Critères de décision

1. **Temps de configuration initial** — minimiser le temps perdu sur l'outillage en Sprint 0.
2. **Cache distant fonctionnel en CI** — réduire les temps de CI sur les PRs récurrentes.
3. **Compatibilité pnpm workspaces** — le package manager est fixé à pnpm.
4. **Complexité pour les contributeurs open source** — le repo est AGPL v3 et vise des contributions externes.
5. **Valeur ajoutée réelle pour un monorepo de cette taille** — 3 apps + 8 packages.
6. **Maintenance à long terme** — l'outil doit être stable et bien maintenu.

## Décision

**Choix retenu : Option A — Turborepo**

Pour un monorepo de taille moyenne (3 apps + 8 packages) géré par un solo dev, Turborepo est le bon choix. Il résout exactement le problème — cache de build, parallélisme, dépendances entre packages — sans introduire de concepts supplémentaires, sans remplacer les `package.json` scripts, et sans créer une barrière à la contribution pour les développeurs open source.

La complexité de Nx est valorisée dans de grands monorepos (10+ apps, 50+ libs, 5+ développeurs) où les générateurs et l'analyse d'impact économisent des heures par semaine. Pour Kinhale v1.0, le retour sur investissement de la complexité Nx est négatif : on passe du temps à configurer des générateurs pour créer 2-3 nouveaux packages sur tout le projet.

Le Vercel Remote Cache de Turborepo est gratuit pour un usage solo et s'intègre en 5 minutes avec GitHub Actions via `TURBO_TOKEN` en secret. Le gain attendu : les PRs qui ne touchent pas `packages/crypto` ou `packages/sync` skiperont ~70% des tâches de test/build grâce au cache.

Ce qui invaliderait ce choix : si l'équipe passe à 5+ développeurs en v2.0 et que la création de nouveaux packages devient une tâche récurrente (> 1 par semaine), réévaluer Nx. La migration Turborepo → Nx est documentée et faisable en 1-2 jours.

## Conséquences

**Positives :**
- `turbo.json` de ~30 lignes, compréhensible par tout contributeur TypeScript sans formation préalable.
- Cache local et distant opérationnel dès le Sprint 0, sans configuration complexe.
- Les scripts `package.json` standard (`build`, `test`, `lint`, `typecheck`) sont préservés — chaque package reste autonome et testable sans Turborepo.
- `turbo run test --filter=packages/domain...` pour tester un package et ses dépendants : syntaxe simple à documenter dans le CONTRIBUTING.md.
- Compatible avec le pipeline GitHub Actions existant via `TURBO_TOKEN` secret.

**Négatives / compromis acceptés :**
- Pas de générateurs de scaffolding : créer un nouveau package = copier un package existant et adapter. Documenté dans `docs/contributing/NEW_PACKAGE.md` (une page, 5 étapes).
- `turbo run --filter=...[HEAD~1]` pour les pipelines "affected" est moins intuitif que `nx affected` — documenté dans le `CONTRIBUTING.md`.
- Pas d'interface graphique pour le graphe de dépendances (Nx Console VS Code). Contourné par `turbo run build --graph` qui génère un DOT graph visualisable.

**Plan de fallback** : Si Turborepo Remote Cache est indisponible ou trop lent (latence Vercel CDN depuis Montréal), le fallback est un cache S3 `ca-central-1` custom via l'option `remoteCache.apiUrl` de Turborepo. Coût : négligeable (quelques MB de cache dans S3).

## Révision prévue

À réévaluer si : (1) l'équipe dépasse 5 contributeurs actifs, (2) la création de nouveaux packages dépasse 1/semaine, ou (3) Nx sort une version avec une configuration pnpm-native aussi simple que Turborepo. Horizon probable : v2.0 (6-12 mois post-lancement).
