# ADR-D8 — Email Transactionnel : Resend (retenu) vs Postmark vs AWS SES

**Date** : 2026-04-20
**Statut** : Accepté — révisé 2026-04-20
**Décideurs** : Martial Kaljob (Kamez Conseils)

## Contexte

Kinhale utilise l'email transactionnel pour deux cas d'usage distincts, et seulement deux :

1. **Magic link d'authentification** : l'utilisateur saisit son email, reçoit un lien à usage unique (valable 15 minutes) qui l'authentifie sans mot de passe. C'est le seul mécanisme d'authentification obligatoire de la v1.0. La délivrabilité de cet email est critique : si le magic link n'arrive pas en boîte de réception dans les 30 secondes, l'utilisateur abandonne.

2. **Alerte dose manquée en fallback email** : si une dose planifiée n'est pas confirmée et que le push notification a échoué (device hors-ligne, notifications désactivées), un email de fallback est envoyé au Parent référent. Cet email porte un contenu générique ("Une prise de médicament n'a pas été confirmée dans votre application Kinhale") — jamais de contenu santé en clair (pas de nom de pompe, pas de symptôme, pas de prénom de l'enfant).

Ces deux usages partagent des exigences communes :
- **Délivrabilité élevée** : le magic link doit arriver dans < 30s, en boîte principale (pas en spam).
- **Aucune donnée santé dans les payloads** : le prestataire email ne doit jamais voir de données de santé. Les templates sont purement génériques.
- **Data residency Canada** : idéalement, le prestataire traite les emails depuis des serveurs situés au Canada, ou au moins signe un DPA couvrant la Loi 25/PIPEDA.
- **DPA signable** : un accord de traitement des données est nécessaire avant la mise en production.
- **Volume faible** : la v1.0 cible 100-5000 foyers actifs. Le volume d'emails est estimé à 500-10 000 emails/mois, très loin des seuils de tarification des solutions enterprise.

Un détail important : contrairement à ce que l'on pourrait croire, l'email transactionnel d'authentification est soumis à la réglementation anti-spam (CASL au Canada, CAN-SPAM aux US, RGPD en Europe) même pour les emails déclenchés par l'utilisateur lui-même. Le prestataire doit avoir une bonne réputation d'expéditeur pour garantir la délivrabilité.

## Options évaluées

### Option A — Postmark

**Description** : Postmark est un prestataire d'email transactionnel spécialisé (fondé en 2009, acquis par ActiveCampaign en 2022) dont le positionnement est explicitement orienté vers la délivrabilité des emails transactionnels critiques (magic links, notifications de sécurité, confirmations de commande). Postmark utilise des serveurs SMTP en Europe (Amsterdam, Dublin) et aux US (Ashburn).

**Avantages** :
- **Délivrabilité de référence** : Postmark est reconnu dans l'industrie comme l'un des prestataires avec les meilleurs taux de délivrabilité pour les emails transactionnels. Leur infrastructure de serveurs d'envoi est dédiée aux transactions (ils n'envoient pas d'emails marketing, ce qui préserve la réputation de leurs IPs).
- **API simple** : l'API REST Postmark est la plus simple à intégrer — un POST avec le template ID, les variables, et l'email destinataire. Le SDK TypeScript officiel (`@postmark/postmark`) est maintenu et typé.
- **Templates serveur** : Postmark gère les templates d'email côté serveur (MJML ou HTML). Le magic link template est stocké dans la console Postmark et référencé par ID dans le code — les modifications de template ne nécessitent pas de redéploiement.
- **Dashboard de monitoring** : le dashboard Postmark expose en temps réel les bounces, les opens (optionnel), les délais de livraison. Utile pour diagnostiquer les problèmes de délivrabilité sans fouiller les logs CloudWatch.
- **DPA disponible** : Postmark propose un DPA RGPD standard signable. Depuis l'acquisition par ActiveCampaign, un DPA couvrant les exigences de la Loi 25 québécoise est disponible sur demande. Postmark ne voit jamais le contenu santé (les emails ne contiennent pas de données de santé).
- **Coût prévisible** : tarification à l'email ($1.25/1000 emails + $1.25/mois pour 100 messages/mois minimum). Pour 5000 emails/mois : ~$7/mois.
- **CASL-compliant** : Postmark intègre les unsubscribe links et la gestion des bounces requise par CASL pour les emails transactionnels au Canada.

**Inconvénients** :
- **Pas de région Canada** : Postmark traite et route les emails depuis des serveurs en US/Europe. L'email du magic link transite par des serveurs américains ou européens avant d'arriver dans la boîte du destinataire canadien.
- **Dépendance à un tiers** : si Postmark subit une panne, les magic links ne sont plus délivrés. Mitigé par le fait que Postmark a un SLA de 99.99% de disponibilité et par une file de retry côté Fastify.
- **Acquisition ActiveCampaign** : le rachat de Postmark par ActiveCampaign en 2022 a créé des interrogations sur l'évolution du service. En pratique, Postmark opère toujours de façon indépendante en 2026, mais le risque de changement de politique existe.

**Estimation de coût mensuel** :
- 500 emails/mois (démarrage) : ~$1.50
- 10 000 emails/mois (5000 foyers actifs) : ~$12.50
- Très largement dans le budget.

**Risques** :
- Risque de blocage temporaire des emails Kinhale si un autre client Postmark abuse de leur infrastructure partagée — Postmark isole les expéditeurs sur des IPs dédiées à partir de certains volumes, non pertinent pour la v1.0.

### Option B — AWS SES (Simple Email Service), région ca-central-1

**Description** : AWS SES est le service d'email d'Amazon, disponible depuis 2011. Il est directement intégré à l'infrastructure AWS ca-central-1 déjà choisie pour le relais (ADR-D4). SES ca-central-1 est disponible depuis 2021. Les emails sont envoyés depuis des serveurs AWS physiquement situés à Montréal.

**Avantages** :
- **Data residency Canada garantie** : les emails de magic link sont traités et envoyés depuis les serveurs AWS ca-central-1 à Montréal. Aucune donnée ne quitte le Canada pour le traitement email.
- **DPA AWS unifié** : le même DPA AWS signé pour le relais (ADR-D4) couvre également SES. Pas de DPA supplémentaire à négocier.
- **Intégration native AWS** : SES est dans le même compte AWS que le reste de l'infrastructure. Les logs d'envoi vont directement dans CloudWatch. Le billing est unifié. La configuration IAM (rôle Fargate → SES) est simple.
- **Coût extrêmement bas** : $0.10/1000 emails (10× moins cher que Postmark). Pour 10 000 emails/mois : $1.
- **Sandbox → Production** : le processus de sortie de sandbox SES (pour envoyer à des adresses non-vérifiées) est maintenant rapide (~24h de review) en 2026.

**Inconvénients** :
- **Délivrabilité inférieure à Postmark** : les IPs SES sont partagées entre tous les clients AWS (dont beaucoup envoient du spam ou des emails marketing). La réputation des IPs SES ca-central-1 est historiquement inférieure à celle de Postmark. Pour un magic link critique, un taux de deliverabilité de 95% vs 99.5% fait une différence mesurable en UX.
- **Pas de templates gérés en self-service** : SES Templates sont gérés via l'API AWS CLI ou la console — moins ergonomique que la console Postmark pour un solo dev qui veut modifier rapidement un template email.
- **Pas de dashboard de monitoring intuitif** : le monitoring SES se fait via CloudWatch Metrics (bounces, complaints, delivery rate) — fonctionnel mais moins lisible qu'un dashboard Postmark dédié.
- **Configuration plus complexe** : sender identity, DKIM, DMARC, SPF doivent être configurés manuellement. Postmark configure automatiquement ces éléments lors de l'ajout d'un domaine d'expéditeur.
- **Configuration IP dédiée possible mais coûteuse** : pour améliorer la délivrabilité, SES propose des IPs dédiées à $24.95/mois/IP — ce qui annule l'avantage de coût et dépasse Postmark.

**Estimation de coût mensuel** :
- 10 000 emails/mois : $1
- Avec IP dédiée : $25.95/mois

**Risques** :
- **Risque principal** : la délivrabilité des magic links est insuffisante (emails en spam), créant une frustration utilisateur et un taux d'abandon à l'onboarding. Ce risque est difficile à quantifier avant la mise en production mais documenté par de nombreux témoignages dans l'industrie.
- Risque de sur-configuration : DKIM + DMARC + SPF + warming up des IPs SES représente 1-2 jours de configuration et de test que Postmark élimine.

### Option C — Resend ⭐ Retenu

**Description** : Resend est un service d'email transactionnel fondé en 2023, conçu explicitement pour les développeurs TypeScript/React. Il est bâti sur une infrastructure AWS multi-région et se distingue par son intégration native avec **React Email** — les templates d'email sont des composants React écrits directement dans le monorepo, versionnés avec le code, reviewés en PR.

**Avantages** :

- **React Email intégré** : les templates d'email sont des composants `.tsx` dans `packages/i18n/emails/` — même langage, même pipeline CI, même review que le reste du code. Modifier le template du magic link = une PR, pas un aller-retour dans une console externe.
- **TypeScript SDK de référence** : le package `resend` est le SDK le plus ergonomique du marché en 2026. `resend.emails.send({ from, to, react: <MagicLinkEmail token={...} /> })` — c'est littéralement tout.
- **Plan gratuit généreux** : 3 000 emails/mois gratuits, 100/jour. La v1.0 (0-500 foyers) ne paiera probablement rien pendant les 6 premiers mois.
- **Délivrabilité solide** : Resend gère sa propre réputation d'IPs sur infrastructure AWS, comparable à Postmark pour les volumes transactionnels faibles à moyens.
- **Déjà en production chez Martial** : intégration et DPA déjà en place sur d'autres projets Wonupshop — zéro setup, zéro nouvelle négociation contractuelle, courbe d'apprentissage nulle.
- **DKIM/SPF/DMARC automatiques** : comme Postmark, Resend configure automatiquement les enregistrements DNS à l'ajout du domaine `kinhale.health`.
- **Dashboard moderne** : monitoring des envois, bounces, taux d'ouverture, logs par email — interface développeur très lisible.
- **Pricing prévisible** : après le tier gratuit, $20/mois pour 50 000 emails (vs ~$65/mois Postmark à ce volume).

**Inconvénients** :

- **Service plus récent** (2023) : moins d'historique de fiabilité que Postmark (2009) ou SES. Mitigé par la croissance rapide et la confiance de l'écosystème.
- **Pas de région Canada** : même situation que Postmark — serveurs US/EU. Même mitigation applicable (emails génériques, aucune donnée santé).
- **DPA** : disponible et RGPD-compliant. Couverture Loi 25 à vérifier formellement, mais même posture que Postmark — emails ne contiennent pas de données de santé.

**Estimation de coût mensuel** :

| Volume | Coût |
|---|---|
| 0-3 000 emails/mois | **Gratuit** |
| 3 000-50 000 emails/mois | $20/mois |
| > 50 000 emails/mois | Sur devis |

**Avantage décisif sur Postmark pour ce projet** : React Email dans le monorepo TypeScript. Les templates sont des composants React versionnés, testables (snapshots), traduisibles via `i18next` — cohérence totale avec l'architecture du projet.

## Critères de décision

1. **Délivrabilité du magic link** — arriver en boîte principale en < 30s, critère UX critique.
2. **Data residency Canada** — idéal, mais non-bloquant si le contenu email ne contient pas de données de santé.
3. **DPA signable couvrant Loi 25/PIPEDA** — obligatoire avant mise en production.
4. **Facilité de configuration et maintenance** — un solo dev ne doit pas passer > 1 jour sur la configuration email.
5. **Coût mensuel** — marginal pour le budget de ce projet.
6. **Aucune donnée santé dans les payloads** — quelle que soit l'option choisie.

## Décision

**Choix retenu : Option C — Resend**

Resend réunit tous les critères et élimine le principal friction point des autres options :

**Pourquoi pas Postmark** : Postmark a une délivrabilité excellente mais impose des templates gérés dans sa console externe — une friction supplémentaire pour un solo dev qui veut itérer vite sur les emails. Surtout, Martial utilise déjà Resend en production sur Wonupshop. Migrer vers Postmark = nouvel onboarding, nouveau DPA, nouveau monitoring à apprendre. Zéro gain justifiant ce switch.

**Pourquoi pas SES** : la délivrabilité des IPs partagées SES reste inférieure pour les magic links. Le gain de data residency Canada est annulé par le fait que les emails Kinhale ne contiennent aucune donnée de santé. La complexité de setup (DKIM, SPF, DMARC, sandbox approval) coûte 1-2 jours qu'on économise avec Resend.

**L'argument décisif** : React Email. Les templates d'email sont des composants React dans `packages/emails/` — versionnés, testés, traduits via `i18next`, reviewés en PR comme n'importe quel autre composant. C'est la cohérence architecturale parfaite avec un monorepo TypeScript/React.

**Posture conformité** : identique à Postmark. Les emails Kinhale sont génériques (magic link = token opaque, alerte = message sans donnée santé). Le prestataire ne voit que l'adresse email du destinataire. DPA Resend RGPD-compliant. Même mitigation Loi 25 que pour l'hébergement Hostinger.

Ce qui invaliderait ce choix : si un client B2B (clinique) exige contractuellement que les emails transitent depuis des serveurs canadiens. Dans ce cas, migration SES ca-central-1.

## Conséquences

**Positives :**
- **Zéro setup** — déjà intégré et opérationnel sur Wonupshop. Réutilisation du compte, des DNS, du DPA.
- **Plan gratuit couvre la v1.0** — 3 000 emails/mois gratuits, probablement suffisant jusqu'à ~300 foyers actifs.
- **React Email dans le monorepo** — templates `.tsx` dans `packages/emails/`, traduits FR/EN, testés par snapshots Jest, reviewés en PR.
- **SDK TypeScript minimal** — `resend.emails.send({ react: <MagicLinkEmail /> })` en 3 lignes.
- **Dashboard développeur** — monitoring des bounces et délais de livraison sans CloudWatch.

**Négatives / compromis acceptés :**
- Service plus récent que Postmark — historique de fiabilité plus court. Acceptable au vu de la traction et de l'usage existant.
- Emails transitent par serveurs US/EU — même posture que Postmark, acceptable car contenu générique.
- Dépendance à un tiers pour l'authentification magic link — mitigée par une file de retry Fastify (3 tentatives, backoff exponentiel) et passkeys WebAuthn comme alternative future.

**Plan de fallback** : variable d'environnement `EMAIL_PROVIDER=resend|ses` côté Fastify. Si Resend subit une panne, bascule vers SES ca-central-1 sans redéploiement. Configuration SES pré-documentée dans `docs/ops/EMAIL_FALLBACK.md`.

## Révision prévue

- **À 3 000 emails/mois** : passage au plan payant Resend ($20/mois) — décision triviale.
- **Premier client B2B clinique** : évaluer si le contrat exige data residency Canada pour les emails → migration SES ca-central-1.
- **À 50 000 emails/mois** (horizon v2.0) : comparer coût Resend ($20/mois) vs SES + IP dédiée (~$26/mois). Delta marginal, migration justifiée uniquement si exigence contractuelle B2B.
