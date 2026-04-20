# Kinhale

> _Un journal de suivi des pompes d'asthme pour enfant, chiffré de bout en bout et local d'abord — pensé par des aidants, pour les aidants._

[![Licence : AGPL v3](https://img.shields.io/badge/Licence-AGPL_v3-blue.svg)](./LICENSE)
[![Statut](https://img.shields.io/badge/statut-pré--alpha-orange.svg)]()
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

Kinhale est en **pré-alpha**. Le développement actif commence au Sprint 0 du plan de livraison Kamez Conseils.

## Démarrer

La documentation développeur arrive dans `/docs/` dès l'ouverture du Sprint 0. Pour l'instant :

- Vue d'architecture : `docs/architecture/` *(à venir)*
- Guide de contribution : [CONTRIBUTING.md](./CONTRIBUTING.md)
- Workflow Git (Gitflow) : `docs/contributing/GITFLOW.md`
- Politique de divulgation de vulnérabilités : [SECURITY.md](./SECURITY.md)
- Code de conduite : [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

## Licence

Kinhale est publié sous la **GNU Affero General Public License v3.0** — voir [LICENSE](./LICENSE).

Nous avons choisi l'AGPL v3 parce que nous voulons que Kinhale reste un bien commun : toute version dérivée — y compris une version SaaS — doit garder son code source ouvert pour ses utilisateurs.

## Remerciements

- Mainteneur : Martial Kaljob
- Soutenu par : [Kamez Conseils](https://github.com/kamez-conseils)
- Chaque famille qui contribue un rapport de bug, une traduction ou un correctif : **merci**.

---

**_Les données de santé de votre enfant ne quittent jamais vos appareils. Même nous ne pouvons pas les lire._**
