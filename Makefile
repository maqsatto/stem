SHELL := /bin/sh

.PHONY: help env up down logs ps build restart migrate seed test test-backend test-frontend check backup restore

help:
	@echo "ML + STEM LAB — common commands"
	@echo ""
	@echo "  make env            Create .env from .env.example (if missing)"
	@echo "  make up             Build and start db + backend + frontend"
	@echo "  make down           Stop all containers (data is kept)"
	@echo "  make logs           Follow container logs"
	@echo "  make migrate        Apply Alembic migrations inside the backend container"
	@echo "  make seed           Seed demo accounts/content inside the backend container"
	@echo "  make test-backend   Run pytest + ruff locally (uv)"
	@echo "  make test-frontend  Run vitest + typecheck + production build locally (pnpm)"
	@echo "  make check          Run the full local verification suite"
	@echo "  make backup         Dump PostgreSQL and the uploads volume to ./backups"
	@echo "  make restore DB=... [UPLOADS=...]  Restore from a backup"

env:
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env — change secrets before production use."; fi

up: env
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

ps:
	docker compose ps

build:
	docker compose build

restart:
	docker compose restart

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python -m app.seed

test-backend:
	cd backend && uv run ruff check app tests && uv run pytest

test-frontend:
	cd frontend && pnpm typecheck && pnpm test && pnpm build

check: test-backend test-frontend

backup:
	./scripts/backup.sh

restore:
	@if [ -z "$(DB)" ]; then echo "Usage: make restore DB=backups/mlstem-db-....dump.gz [UPLOADS=backups/mlstem-uploads-....tar.gz]"; exit 1; fi
	./scripts/restore.sh "$(DB)" $(if $(UPLOADS),"$(UPLOADS)")
