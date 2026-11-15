# ML + STEM LAB — MVP

Бір сайт: публичный каталог **ML → STEM → проекты** плюс три защищённые зоны —
ученик, учитель, администратор. Один FastAPI REST API, одна PostgreSQL,
файловое хранилище и CMS для самостоятельной загрузки материалов.

> **Демо-контент.** Все алгоритмы, уроки, задания, проекты и диагностики из
> `seed` помечены `is_demo=true` и показываются с бейджем «Демо». Это
> демонстрационная структура, а не утверждённая научная методика. Перед
> реальным использованием заказчик должен заменить тексты, критерии и
> диагностические ключи.

## Стек

| Слой | Технологии |
|---|---|
| Frontend | React 19, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS v4, Recharts |
| Backend | FastAPI, SQLAlchemy 2.x, Alembic, Pydantic 2, Argon2id, JWT |
| БД | PostgreSQL 18 (совместимо с 16+) |
| Инфраструктура | Docker Compose, nginx (SPA + reverse proxy), uv, pnpm |
| Тесты | pytest + httpx, Vitest + Testing Library |

## Быстрый старт через Docker

```bash
cp .env.example .env
# отредактируйте .env: SECRET_KEY, POSTGRES_PASSWORD, пароли демо-аккаунтов
docker compose up -d --build
```

Сайт: <http://localhost:8080> (порт задаётся `APP_PORT`).
API и OpenAPI: <http://localhost:8080/docs>.

При первом старте backend ждёт PostgreSQL, применяет миграции Alembic и
выполняет идемпотентный seed. Повторный seed ничего не делает, если в БД уже
есть пользователи. Демо-учётки:

| Роль | Email | Пароль |
|---|---|---|
| Администратор | `admin@mlstem.kz` | `Admin123!` |
| Учитель | `teacher@mlstem.kz` | `Teacher123!` |
| Ученик | `student@mlstem.kz` | `Student123!` |
| Ученик 2 | `student2@mlstem.kz` | `Student123!` |

Код класса для вступления: `DEMO10`.

**Сразу после первого входа смените пароли и `SECRET_KEY`.** Для чистой
production-базы установите `SEED_ON_START=false` (или удалите демо-данные) и
создайте администратора через seed с собственными `ADMIN_EMAIL` /
`ADMIN_PASSWORD`.

## Локальная разработка

Требования: Python 3.12+, [uv](https://docs.astral.sh/uv/), Node 24+,
pnpm 11+, PostgreSQL 16+.

### PostgreSQL

```bash
# пример для локального PostgreSQL
createuser -P mlstem        # пароль mlstem
createdb -O mlstem mlstem
createdb -O mlstem mlstem_test
```

### Backend

```bash
cd backend
uv sync --extra dev
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --reload --port 8000
```

Настройки читаются из переменных окружения, `backend/.env` или корневого
`.env`. Значение по умолчанию:
`postgresql+psycopg://mlstem:mlstem@localhost:5432/mlstem`.

### Frontend

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Vite отдаёт SPA на <http://localhost:5173> и проксирует `/api` на
`http://localhost:8000`.

## Тесты и проверки

```bash
make check          # backend ruff + pytest, frontend typecheck + vitest + build
```

Или по отдельности:

```bash
cd backend && uv run ruff check app tests && uv run pytest
cd frontend && pnpm typecheck && pnpm test && pnpm build
```

Актуальные результаты и карта приёмочных сценариев — в
[`docs/testing.md`](docs/testing.md).

## Переменные окружения

Основные переменные (полный список — `backend/app/core/config.py` и
`.env.example`):

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `ENVIRONMENT` | `development` / `production` | `development` |
| `SECRET_KEY` | подпись JWT; обязателен в production | insecure dev value |
| `DATABASE_URL` | SQLAlchemy URL PostgreSQL | `...localhost:5432/mlstem` |
| `CORS_ORIGINS` | разрешённые Origin через запятую | localhost:5173/8080 |
| `UPLOAD_DIR` | каталог файлов | `uploads` |
| `MAX_UPLOAD_MB` | лимит файла | `25` |
| `ALLOWED_EXTENSIONS` | whitelist расширений | pdf/docx/pptx/csv/xlsx/ipynb/png/jpg/jpeg/webp |
| `ALLOW_STUDENT_REGISTRATION` | самостоятельная регистрация учеников | `true` |
| `DOCS_ENABLED` | `/docs`, `/redoc`, `/openapi.json` | `true` |
| `SEED_ON_START` | seed при старте контейнера | `false` (в compose `true`) |

Frontend: `VITE_API_URL` (по умолчанию `/api/v1`).

## Структура репозитория

```
backend/            FastAPI, SQLAlchemy, Alembic, pytest
frontend/           React + TypeScript SPA, Vitest
infrastructure/     nginx-конфигурация
scripts/            backup / restore / smoke
docs/               README для заказчика, API, БД, деплой, тесты
docker-compose.yml  db + backend + frontend
Makefile            частые команды
```

## Документация

- [`docs/admin-guide.md`](docs/admin-guide.md) — как загрузить урок, файл,
  задание, тест и диагностику и опубликовать материал.
- [`docs/api.md`](docs/api.md) — описание API и правила доступа.
- [`docs/database.md`](docs/database.md) — схема БД и связи таблиц.
- [`docs/deployment.md`](docs/deployment.md) — развёртывание на сервере.
- [`docs/backup-restore.md`](docs/backup-restore.md) — резервное копирование
  и восстановление.
- [`docs/testing.md`](docs/testing.md) — тесты и приёмочные сценарии.
- [`docs/known-limitations.md`](docs/known-limitations.md) — ограничения MVP.
- OpenAPI-снимок: [`docs/openapi.json`](docs/openapi.json).

## Безопасность (кратко)

- Argon2id для паролей, короткоживущий access JWT и ротируемые refresh-токены
  в БД; выход отзывает refresh-токен.
- Все права проверяются на backend: роль, владение классом, доступ к
  назначению, скрытие ключей ответов и teacher-only файлов.
- HTML санитизируется bleach при записи и отдаче.
- Загрузки: whitelist расширений, проверка MIME и magic bytes, лимит размера.
- Ошибки API имеют единый конверт `{"detail": "...", "code": "..."}`.
- Аудит-журнал фиксирует публикации, изменения пользователей, оценки и файлы.

Подробнее — в [`docs/deployment.md`](docs/deployment.md) и
[`docs/known-limitations.md`](docs/known-limitations.md).
