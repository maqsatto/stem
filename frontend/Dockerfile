# syntax=docker/dockerfile:1.7

# Build context is the repository root (see docker-compose.yml), because the
# nginx configuration lives in infrastructure/nginx/.

FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@11.28.9 --activate

WORKDIR /app

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

# ---------------------------------------------------------------------------
# Runtime: static files served by nginx, which also proxies /api to FastAPI.
# ---------------------------------------------------------------------------
FROM nginx:1.29-alpine AS runtime

COPY infrastructure/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1/healthz || exit 1
