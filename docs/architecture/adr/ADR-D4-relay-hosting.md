# ADR-D4 — Hébergement du relais : Hostinger + Coolify (v1.0) → migration progressive

**Date** : 2026-04-20
**Statut** : Accepté — révisé 2026-04-20
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

Le relais Kamez est le backbone opérationnel de Kinhale : il gère les comptes, les mailboxes de synchronisation chiffrée, le routage des blobs E2EE entre devices, les WebSockets temps réel, et les push notifications. Bien qu'il soit zero-knowledge pour les données santé, sa disponibilité et sa conformité sont critiques : une panne de 2 heures empêche la synchronisation entre aidants, une fuite de logs peut révéler des métadonnées sensibles.

Deux contraintes structurantes pèsent sur ce choix :

**Data residency Canada (Loi 25 + PIPEDA)** : les métadonnées de compte (email hashé, device_id, consentements) sont des données à caractère personnel. La Loi 25 du Québec et PIPEDA imposent que les données des résidents québécois soient hébergées au Canada ou dans une juridiction offrant une protection équivalente. Même si le relais est zero-knowledge pour les données santé, les métadonnées de compte restent des données personnelles soumises à cette exigence. L'hébergeur doit être capable de signer un DPA (Data Processing Agreement) couvrant explicitement la résidence Canada.

**Scrubbing santé des logs** : une exigence non-négociable est qu'aucun champ santé ne doit apparaître dans les logs ou les métriques. La configuration des logs côté hébergeur doit être maîtrisée — pas de logging automatique des payloads qui pourrait capurer accidentellement des données en clair.

Pour un solo dev, la complexité opérationnelle est un facteur de risque réel : une infrastructure complexe à maintenir = des erreurs de configuration, des incidents de production non diagnostiqués rapidement, et une charge mentale qui détourne du développement produit.

## Options évaluées

### Option A — AWS natif, région ca-central-1, CDK TypeScript

**Description** : L'infrastructure complète est déployée sur AWS en région `ca-central-1` (Montréal), gérée via AWS CDK en TypeScript (cohérence avec le reste du monorepo). Les services utilisés sont : ECS Fargate (runtime Fastify), RDS PostgreSQL 16 Multi-AZ, ElastiCache Redis 7, S3 (blobs chiffrés), CloudFront (CDN web), ALB, Route 53, WAF, Secrets Manager, KMS, CloudWatch.

**Avantages** :
- **Data residency Canada garantie** : `ca-central-1` est physiquement à Montréal. AWS signe des DPA (Business Associate Agreements / Data Processing Addendums) couvrant explicitement la résidence des données. Aucun doute sur la conformité Loi 25/PIPEDA.
- **Contrôle total des logs** : CloudWatch Logs est entièrement configurable. Le scrubbing des logs santé passe par des filtres CloudWatch + la configuration du logger Fastify. Aucun tier ne voit les logs bruts.
- **Isolation réseau** : VPC, Security Groups, NACL permettent une isolation réseau stricte entre les composants. Aucun accès public direct aux RDS ou Redis.
- **KMS pour le chiffrement at rest** : toutes les données at rest (RDS, S3, ElastiCache, Secrets Manager) sont chiffrées avec des clés KMS gérées par Kamez — pas par AWS.
- **WAF inclus** : protection OWASP Top 10, rate limiting, règles custom (ex : bloquer les requêtes contenant des payloads JSON > 1Mo sur les endpoints non-blob).
- **CDK TypeScript** : le code d'infrastructure est dans le même langage que le reste du projet, dans le même monorepo, avec le même pipeline CI/CD. Les PRs d'infra passent par la même review que le code applicatif.
- **Scalabilité maîtrisée** : ECS Fargate scale automatiquement sur CPU > 70%. Pour la v1.0 (100-5000 foyers), 2 tasks 0.5 vCPU / 1 Gio RAM sont largement suffisantes.
- **Crédibilité enterprise** : pour les futurs clients B2B (cliniques, CPE), "hébergé sur AWS Canada" est plus rassurant que "hébergé sur un service SaaS tiers".

**Inconvénients** :
- **Complexité de setup initiale** : déployer une stack AWS CDK complète (VPC, RDS Multi-AZ, ECS, ALB, CloudFront...) prend 3-5 jours-homme pour la première fois.
- **Courbe d'apprentissage CDK** : CDK a ses propres abstractions et comportements (`Aspects`, `CfnOutput`, `CrossStack references`) qui surprennent même un dev TypeScript expérimenté.
- **Coût mensuel plus élevé** qu'une solution SaaS managée.
- **Pas de dashboard out-of-the-box** : CloudWatch n'a pas l'ergonomie de Supabase Studio ou Retool.

**Estimation de coût mensuel (v1.0, ~100-500 foyers actifs)** :
| Service | Config | Coût estimé/mois |
|---|---|---|
| ECS Fargate | 2 tasks × 0.5 vCPU × 1 Gio RAM | ~$15 |
| RDS PostgreSQL | db.t4g.small Multi-AZ, 20 Gio gp3 | ~$55 |
| ElastiCache Redis | cache.t4g.micro, 1 node | ~$15 |
| S3 | ~10 Gio blobs + lifecycle | ~$2 |
| ALB | 1 ALB | ~$20 |
| CloudFront | CDN web | ~$5 |
| Route 53 | 1 zone | ~$0.50 |
| CloudWatch | Logs + métriques | ~$10 |
| KMS | 3 CMK | ~$3 |
| WAF | Règles managées | ~$10 |
| **TOTAL estimé** | | **~$135/mois (~180 CAD)** |

Croissance à ~5000 foyers actifs : ~$300-400/mois (RDS scale-up, trafic S3/CloudFront).

**Risques** :
- Risque opérationnel si Martial n'a pas d'expérience AWS CDK — mitigé par la documentation abondante et le fait que CDK TypeScript est dans la zone de confort du profil.
- Risque de dérive des coûts si les tailles RDS ou ECS sont mal calibrées — mitigé par les alarmes CloudWatch.

### Option B — Supabase (Postgres managé + Auth + Storage + Realtime)

**Description** : Supabase est une plateforme BaaS (Backend-as-a-Service) qui fournit PostgreSQL managé, authentification, stockage de fichiers, et WebSockets temps réel (via son API Realtime basée sur Elixir/Phoenix). Le code Fastify serait simplifié ou remplacé par des API Supabase directes.

**Avantages** :
- **Setup ultra-rapide** : un projet Supabase est opérationnel en < 2h. La console web, les migrations, les logs sont accessibles sans configuration.
- **Postgres managé** : pas de gestion de RDS Multi-AZ, de snapshots, de paramètres de connexion.
- **Auth intégré** : le module Supabase Auth gère magic links, JWT, sessions — réduisant le code à écrire dans Fastify.
- **Storage intégré** : Supabase Storage peut remplacer S3 pour les blobs chiffrés.
- **Coût mensuel plus bas en démarrage** : plan Pro Supabase ~$25/mois pour les premiers foyers.
- **Realtime intégré** : les WebSockets Supabase Realtime peuvent remplacer le duo Redis pub/sub + ws.

**Inconvénients** :
- **Data residency Canada incertaine** : Supabase propose des régions AWS us-east-1, eu-west-1, ap-southeast-1... mais **pas de région ca-central-1 en avril 2026**. Les données des utilisateurs québécois seraient hébergées aux US ou en Europe, en violation potentielle de la Loi 25/PIPEDA. Ce point est rédhibitoire.
- **DPA Supabase insuffisant pour des données de santé** : le DPA de Supabase (GDPR DPA disponible, HIPAA BAA en cours) ne couvre pas explicitement la résidence Canada. Pour des données de santé d'enfants, ce vide est inacceptable.
- **Contrôle des logs limité** : Supabase log les requêtes SQL et les appels API pour son propre monitoring. La garantie que des métadonnées sensibles ne soient jamais loggées côté Supabase est impossible à obtenir contractuellement.
- **Vendor lock-in** : migrer de Supabase vers AWS natif post-v1.0 est coûteux (réécriture de la couche Auth, migration des données, remplacement du Storage).
- **Opacité de la couche Realtime** : le Realtime Supabase est basé sur les triggers Postgres et Elixir Phoenix Channels — difficile à auditer pour garantir qu'aucune donnée chiffrée n'est exposée dans les canaux.
- **Moins adapté aux WebSockets custom** : le protocole mailbox de Kinhale (envoi de blobs chiffrés dans des mailboxes, notification push des devices destinataires) ne correspond pas aux patterns Supabase Realtime (qui diffuse des events de DB).

**Estimation de coût mensuel** :
| Plan | Config | Coût |
|---|---|---|
| Supabase Pro | Postgres 8 Gio, 100k MAU | ~$25/mois |
| (mais sans région Canada — non conforme) | | |

**Risques** :
- **Risque légal critique** : absence de région Canada = non-conformité Loi 25/PIPEDA dès le premier utilisateur québécois.
- **Risque de migration forcée** si Supabase change sa politique de prix ou décide d'ouvrir/fermer une région.

### Option C — PaaS intermédiaire (Railway, Render, Fly.io)

Brièvement évaluée. Railway/Render/Fly.io offrent des Postgres managés et des runtimes Node.js avec des régions qui n'incluent pas `ca-central-1` de façon fiable. Les mêmes problèmes de data residency que Supabase s'appliquent. Non retenu.

## Critères de décision

1. **Data residency Canada (ca-central-1)** — exigence légale bloquante Loi 25/PIPEDA.
2. **DPA signable couvrant les données de santé de mineurs** — requis avant mise en production.
3. **Contrôle complet des logs** — aucun payload santé ne peut apparaître dans les logs d'un tiers.
4. **Coût opérationnel acceptable pour la v1.0** — budget infra < $500 CAD/mois jusqu'à 5000 foyers.
5. **Complexité opérationnelle acceptable pour un solo dev** — la configuration initiale doit être faisable en < 1 semaine.
6. **Cohérence technologique avec le monorepo** — TypeScript CDK dans le même repo, même CI/CD.

## Décision

**Choix retenu : Hostinger existant + Coolify (v1.0) → migration progressive selon traction**

### Contexte de la décision révisée (2026-04-20)

La décision initiale ciblait AWS natif (`ca-central-1`). Après analyse, la contrainte opérationnelle est réelle : Martial dispose déjà d'un serveur Hostinger actif géré via Coolify. Créer une infrastructure AWS dédiée uniquement pour Kinhale v1.0 représente un coût fixe de ~$135-180 CAD/mois + 3-5 jours de setup pour un projet en phase de validation (0-500 foyers). Ce ratio coût/bénéfice n'est pas justifié à ce stade.

**Hostinger ne dispose pas de data center au Canada.** Les régions disponibles sont USA, UK, Pays-Bas, Singapour, Inde, Brésil. La conformité stricte Loi 25 (`ca-central-1`) ne peut donc pas être garantie nativement.

### Mitigation légale retenue : clause de protection équivalente (USA)

La Loi 25 et PIPEDA autorisent le transfert de données personnelles hors Canada à condition de :

1. **Documenter le transfert** dans la politique de confidentialité avec mention explicite de la juridiction de l'hébergeur (USA) et des mesures de protection en place.
2. **Signer un contrat de traitement** avec Hostinger couvrant : finalité du traitement, mesures de sécurité, interdiction de sous-traitement non autorisé, notification de violation de données.
3. **Appliquer des mesures techniques compensatoires** : chiffrement E2EE zero-knowledge (les données santé ne quittent jamais les devices en clair), chiffrement at rest de la base PostgreSQL, TLS 1.3 en transit.
4. **Informer les utilisateurs** dès l'onboarding que les métadonnées de compte sont hébergées aux USA sur infrastructure sécurisée.

> **Note importante** : cette mitigation est acceptable car le relais Kinhale est zero-knowledge. Les données de santé (prises, symptômes, plans) ne transitent jamais en clair sur le serveur — seules les métadonnées opaques (email hashé, device_id, blobs chiffrés) y résident. Le risque légal résiduel est faible mais documenté.

### Stack complète retenue pour v1.0

Hostinger + Coolify + Cloudflare (proxy + R2) couvrent l'ensemble des besoins infrastructure :

| Brique | Équivalent AWS | Solution retenue |
|---|---|---|
| Runtime API Fastify | ECS Fargate | Container Docker via Coolify |
| PostgreSQL | RDS | PostgreSQL via Coolify (volume persistant) |
| Redis | ElastiCache | Redis via Coolify |
| SSL / Reverse proxy | ALB + ACM | Caddy automatique via Coolify (Let's Encrypt) |
| Stockage blobs chiffrés | S3 | **Cloudflare R2** |
| CDN web statique | CloudFront | **Cloudflare CDN** (inclus dans le proxy) |
| WAF / DDoS | AWS WAF | **Cloudflare WAF** (plan gratuit) |
| Variables d'environnement | Secrets Manager | Coolify Env vars (chiffrées) |
| Déploiement CD | CodePipeline | GitHub webhook → Coolify auto-deploy |
| Backups PostgreSQL | RDS automated | `pg_dump` cron → **Cloudflare R2** |

**Pourquoi Cloudflare R2 pour les blobs chiffrés :**

- **API S3-compatible** : le code Fastify utilise le SDK AWS S3 (`@aws-sdk/client-s3`) avec l'endpoint R2 — zéro changement de code lors d'une migration future vers S3.
- **Zéro frais d'egress** : S3 facture la sortie de données (~$0.09/Go). R2 = $0 d'egress. Pour des blobs Automerge téléchargés fréquemment par les devices, c'est un avantage significatif à l'échelle.
- **Plan gratuit très généreux** : 10 Go de stockage/mois + 1 million d'opérations Class A + 10 millions Class B — couvre largement la v1.0.
- **Déjà utilisé par Martial** : compte, facturation et DPA déjà en place. Zéro onboarding.
- **Chiffrement at rest natif** : R2 chiffre toutes les données au repos (AES-256). Les blobs Kinhale sont déjà chiffrés côté client — double couche de chiffrement sans effort.

**Configuration R2 pour Kinhale :**
```
Bucket : kinhale-relay-blobs
Région : auto (Cloudflare distribue globalement)
Lifecycle : purge des blobs après 90 jours (via R2 lifecycle rules)
Accès : clé API R2 avec permission write-only depuis Fastify, read depuis les devices authentifiés
```

**Cloudflare CDN pour l'app web :**
- Le proxy Cloudflare (déjà en place pour le WAF) sert également de CDN pour les assets statiques Next.js.
- Cache automatique des assets immutables (`/_next/static/`).
- Remplace CloudFront sans configuration supplémentaire.

**Ce que Coolify + Cloudflare ne remplacent pas :**
- Monitoring applicatif → Sentry (déjà prévu) + UptimeRobot

**Estimation de coût mensuel v1.0 :**

| Poste | Coût |
|---|---|
| Hostinger VPS (partagé avec autres projets) | ~$0 additionnel |
| Cloudflare proxy + WAF + CDN | Gratuit |
| Cloudflare R2 (≤ 10 Go + opérations v1.0) | **Gratuit** |
| Resend (≤ 3 000 emails/mois) | **Gratuit** |
| Sentry (plan gratuit ≤ 5k erreurs/mois) | Gratuit |
| UptimeRobot | Gratuit |
| **TOTAL v1.0** | **~$0 CAD/mois** |

### Seuils de migration déclencheurs

La migration est planifiée selon la traction réelle :

| Seuil | Action |
|---|---|
| **> 200 foyers actifs** | Évaluer migration vers VPS canadien dédié (OVH Canada, ~$20-40 CAD/mois) — data residency Canada native, même stack Coolify |
| **> 500 foyers actifs** | Migration vers AWS `ca-central-1` (stack CDK TypeScript documentée ci-dessus) — scalabilité, Multi-AZ, WAF managed |
| **Premiers clients B2B (cliniques)** | Migration AWS obligatoire — les cliniques exigent contractuellement la résidence Canada et un BAA/DPA signé |

Le code applicatif (Fastify, Drizzle, Redis) est identique dans les trois scénarios — seul le `docker-compose` de production change. La migration est une opération d'infrastructure, pas une réécriture.

## Conséquences

**Positives :**
- Démarrage immédiat sans setup d'infrastructure — Sprint 0 raccourci de 3-4 jours.
- Coût mensuel quasi nul pendant la phase de validation (0-200 foyers).
- Coolify est open source et aligné avec les valeurs AGPL de Kinhale — cohérence de posture.
- Le `docker-compose` local de dev est identique au `docker-compose` de prod Coolify — zéro friction dev/prod.
- Migration progressive non-destructive : le code ne change pas, seule l'infra évolue.

**Négatives / compromis acceptés :**
- Data residency Canada non native en v1.0 — mitigée par E2EE zero-knowledge + clause contractuelle + information utilisateur.
- Pas de Multi-AZ — disponibilité single-node. Acceptable pour une pré-alpha / beta publique.
- Backups PostgreSQL manuels (`pg_dump` cron → R2) — risque opérationnel si le script échoue silencieusement. Mitigation : alerte UptimeRobot sur le timestamp du dernier backup R2.
- Partage du serveur avec d'autres projets Wonupshop — isolation via Docker networks, pas de risque de fuite inter-projets, mais ressources CPU/RAM partagées.

**Plan de fallback :**
Si le serveur Hostinger est saturé avant d'atteindre le seuil de 200 foyers (pic de trafic, autre projet Wonupshop gourmand), provisionner un VPS OVH Canada (~$20 CAD/mois) avec la même stack Coolify en < 2 heures.

## Révision prévue

- **À 200 foyers actifs** : décision VPS Canada dédié vs maintien Hostinger.
- **À 500 foyers actifs ou premier client B2B** : migration AWS `ca-central-1` obligatoire.
- **Revue trimestrielle** : vérifier que Coolify et les containers sont à jour (sécurité).
