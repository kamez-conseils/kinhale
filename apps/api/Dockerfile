# Dev image pour Kinhale API (Fastify 5)
# Usage : docker compose -f infra/docker/docker-compose.yml up -d --build
FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copie minimaliste pour optimiser le cache docker
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/crypto/package.json ./packages/crypto/
COPY packages/domain/package.json ./packages/domain/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/test-utils/package.json ./packages/test-utils/

RUN pnpm install --frozen-lockfile

# Entrypoint : synchronise le schéma DB puis lance le dev server
COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3002

CMD ["/docker-entrypoint.sh"]
