# Environnement de développement local Kinhale

## Démarrage

```bash
# Depuis la racine du projet
docker compose -f infra/docker/docker-compose.yml up -d

# Vérifier que tout est healthy
docker compose -f infra/docker/docker-compose.yml ps
```

## Services disponibles

| Service | Port hôte | Port interne | UI |
|---|---|---|---|
| PostgreSQL 16 | 5434 | 5432 | — |
| Redis 7 | 6379 | 6379 | — |
| Mailpit (SMTP + UI) | 1027 / 8027 | 1025 / 8025 | http://localhost:8027 |
| MinIO (S3-compatible / R2) | 9000 / 9001 | 9000 / 9001 | http://localhost:9001 |

> **Note ports** : les ports hôtes 5432, 1025 et 8025 sont réservés aux autres projets du workspace.
> Kinhale utilise 5434 (postgres), 1027/8027 (mailpit) pour éviter les conflits.

## Initialiser MinIO (premier démarrage)

```bash
docker exec kinhale_minio mc alias set local http://localhost:9000 kinhale kinhale_minio_dev
docker exec kinhale_minio mc mb local/kinhale-relay-blobs
```

## Arrêt

```bash
docker compose -f infra/docker/docker-compose.yml down
# Pour supprimer les volumes (reset complet) :
docker compose -f infra/docker/docker-compose.yml down -v
```
