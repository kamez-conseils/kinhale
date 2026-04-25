# Kinhale

> _Un journal de suivi des pompes d'asthme pour enfant, chiffré de bout en bout et local d'abord — pensé par des aidants, pour les aidants._

[![Licence : AGPL v3](https://img.shields.io/badge/Licence-AGPL_v3-blue.svg)](./LICENSE)
[![Statut](https://img.shields.io/badge/statut-aperçu_v1.0-orange.svg)]()
[![EN](https://img.shields.io/badge/lang-english-blue.svg)](./README.md)

> **English: [read this README in English →](./README.md)**

---

## Pourquoi Kinhale ?

Quand un enfant reçoit un diagnostic d'asthme, les parents, grands-parents, personnel de garderie et nounous se relaient pour lui administrer les pompes tout au long de la journée. Concrètement, cela donne :

- Des doses oubliées parce que personne ne se rappelle qui a fait quoi
- Aucune visibilité pour les autres aidants quand une pompe de secours est donnée
- Aucun historique fiable à présenter au ou à la pneumo-pédiatre lors du prochain rendez-vous
- Des pompes vides par surprise, impossibles à anticiper

Kinhale existe pour résoudre ce problème — **sans jamais stocker les données de santé de votre enfant sur les serveurs de qui que ce soit**.

## Ce qui distingue Kinhale

**Les données de santé de votre enfant ne quittent jamais vos appareils.**
Chaque dose, chaque symptôme, chaque note est chiffré sur votre appareil et synchronisé uniquement de bout en bout entre les aidants que vous avez explicitement invités. Le relais Kinhale que nous opérons est un canal à *zero-knowledge* : nous pouvons voir qu'un message a été acheminé, mais nous ne pouvons pas lire son contenu — pas même sur réquisition judiciaire.

## Fonctionnalités principales (v1.0)

- Enregistrement des prises de fond et de secours en un seul toucher, en ligne ou hors-ligne
- Saisie des symptômes et circonstances en cas de prise de secours
- Rappels fiables + alertes de dose manquée
- Synchronisation temps réel entre aidants invités — avec deux rôles distincts :
  - *Saisie seule* : peut enregistrer des prises, ne voit pas l'historique médical
  - *Saisie + Historique* : peut enregistrer et consulter l'historique médical complet
- Suivi du niveau de la pompe avec alerte de fin de stock
- Rapports PDF + CSV, imprimables pour votre médecin
- Mode hors-ligne complet — l'app fonctionne sans connexion Internet
- Web + iOS + Android

## Prévu pour la v1.1 (≈ 2 mois après la v1.0)

- Support multi-enfants (fratrie)
- Conformité COPPA pour les utilisateurs américains
- Pack d'améliorations basées sur les retours de la communauté

## Prévu pour la v2.0

- Intégration Apple Health / Google Health Connect
- Portail de consultation pour pneumo-pédiatres
- Offre B2B optionnelle pour cliniques (finance l'hébergement long terme)

## Ce n'est pas un dispositif médical

Kinhale est un **outil de journalisation, de rappel et de partage**. Il ne recommande jamais de dose, ne diagnostique jamais, n'alerte jamais en disant d'appeler un médecin. Si quelque chose vous semble anormal chez votre enfant, appelez un professionnel de santé.

## État du projet

Kinhale est en **aperçu v1.0**. Le code est en développement actif ; une
instance officielle hébergée par Kamez Conseils en `ca-central-1` est prévue
avec la sortie de la v1.0. Le self-hosting est supporté en *best effort* —
voir le guide ci-dessous.

## Démarrage rapide — développement

```bash
git clone https://github.com/kamez-conseils/kinhale.git
cd kinhale
pnpm install
docker compose -f infra/docker/docker-compose.yml up -d
pnpm dev
```

Le compose de développement embarque PostgreSQL, Redis, Mailpit (SMTP) et
MinIO (S3) sur des ports locaux — voir
[`infra/docker/README.md`](./infra/docker/README.md).

## Démarrage rapide — self-hosting

Si vous voulez exécuter votre propre relais (clinique, collectif
d'auto-hébergement, déploiement familial), le guide complet est dans
[`docs/user/SELF_HOSTING.md`](./docs/user/SELF_HOSTING.md). Version courte :

```bash
git clone https://github.com/kamez-conseils/kinhale.git
cd kinhale
git checkout v1.0.0
cp infra/docker/.env.prod.example infra/docker/.env.prod
# éditer infra/docker/.env.prod avec vos secrets et noms d'hôte
docker compose -f infra/docker/docker-compose.prod.yml --env-file infra/docker/.env.prod up -d
```

## Documentation

- Vue d'architecture : [`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md)
- Décisions d'architecture : [`docs/architecture/adr/`](./docs/architecture/adr/)
- Guide de contribution : [CONTRIBUTING.md](./CONTRIBUTING.md)
- Workflow Git (Gitflow) : [`docs/contributing/GITFLOW.md`](./docs/contributing/GITFLOW.md)
- Politique de divulgation de vulnérabilités : [SECURITY.md](./SECURITY.md)
- Code de conduite : [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Guide de self-hosting : [`docs/user/SELF_HOSTING.md`](./docs/user/SELF_HOSTING.md)

## Licence

Kinhale est publié sous la **GNU Affero General Public License v3.0** — voir [LICENSE](./LICENSE).

Nous avons choisi l'AGPL v3 parce que nous voulons que Kinhale reste un bien commun : toute version dérivée — y compris une version SaaS — doit garder son code source ouvert pour ses utilisateurs.

## Remerciements

- Mainteneur : Martial Kaljob
- Soutenu par : [Kamez Conseils](https://github.com/kamez-conseils)
- Chaque famille qui contribue un rapport de bug, une traduction ou un correctif : **merci**.

---

**_Les données de santé de votre enfant ne quittent jamais vos appareils. Même nous ne pouvons pas les lire._**
