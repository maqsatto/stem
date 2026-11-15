# Развёртывание

## 1. Требования

- Linux-сервер, 2 vCPU / 2 ГБ RAM (минимум для MVP), 20+ ГБ диска;
- Docker Engine 24+ и Docker Compose v2 (или совместимый podman-compose);
- домен и DNS-запись, если сайт доступен публично;
- исходящий доступ к registry при сборке образов.

Порты наружу: только `80`/`443` (через reverse proxy с TLS). PostgreSQL и
backend не публикуются напрямую — nginx внутри compose проксирует `/api` на
`backend:8000`.

## 2. Первый запуск

```bash
git clone <repository-url> ml-stem-lab
cd ml-stem-lab

cp .env.example .env
# сгенерируйте секреты
sed -i "s|^SECRET_KEY=.*|SECRET_KEY=$(openssl rand -hex 32)|" .env
# задайте сильный POSTGRES_PASSWORD и пароли аккаунтов в .env

docker compose up -d --build
docker compose ps
```

Backend при старте:

1. ждёт доступности PostgreSQL;
2. применяет `alembic upgrade head`;
3. при `SEED_ON_START=true` выполняет идемпотентный seed.

Проверка:

```bash
curl -fsS http://localhost:8080/healthz
curl -fsS "http://localhost:8080/api/v1/algorithms?page_size=1"
./scripts/smoke.sh http://localhost:8080
```

Откройте `http://<server>:8080` (или домен), войдите администратором и сразу
смените пароли.

## 3. Переменные окружения

Обязательно проверьте в `.env`:

| Переменная | Комментарий |
|---|---|
| `SECRET_KEY` | случайная строка ≥32 символов; при `ENVIRONMENT=production` значение по умолчанию отклоняется |
| `POSTGRES_PASSWORD` | сильный пароль БД |
| `ADMIN_PASSWORD`, `DEMO_*_PASSWORD` | смените или отключите демо-аккаунты |
| `SEED_ON_START` | `true` только для первого запуска демо; затем `false` |
| `DOCS_ENABLED` | `false`, если OpenAPI не должен быть публичным |
| `CORS_ORIGINS` | фактический origin сайта |
| `APP_PORT` | порт nginx на хосте |

После изменения `.env`:

```bash
docker compose up -d
```

## 4. Домен и TLS

Поставьте перед compose reverse proxy с сертификатом (Caddy, Traefik, nginx +
certbot). Пример Caddy:

```caddyfile
lab.example.kz {
    encode gzip
    reverse_proxy 127.0.0.1:8080
}
```

Caddy автоматически получит сертификат Let's Encrypt. Если используется
внешний nginx, пробросьте заголовки `Host`, `X-Real-IP`, `X-Forwarded-For`,
`X-Forwarded-Proto` и ограничьте размер тела запроса не меньше 30 МБ.

## 5. Production-чек-лист

- [ ] `SECRET_KEY` и `POSTGRES_PASSWORD` изменены;
- [ ] демо-пароли изменены или демо-аккаунты отключены;
- [ ] `SEED_ON_START=false` после первичного наполнения;
- [ ] `DOCS_ENABLED=false` (если документация не публична);
- [ ] TLS работает, HTTP перенаправляется на HTTPS;
- [ ] `docker compose ps` — все сервисы healthy;
- [ ] вход ученика/учителя/админа проверен;
- [ ] загрузка файла и скачивание проверены;
- [ ] backup запущен и восстановление проверено на staging;
- [ ] настроен внешний мониторинг `/healthz` и места на диске;
- [ ] контент проверен методистом, демо-бейджи сняты только у утверждённых
      материалов.

## 6. Обновление версии

```bash
git pull
docker compose build
docker compose up -d
docker compose ps
```

Миграции применяются автоматически при старте backend. Перед обновлением
сделайте резервную копию:

```bash
make backup
```

Откат приложения — вернуться на предыдущий git-коммит и пересобрать образы;
откат схемы — только через `alembic downgrade` после проверки на staging.
Откат БД — из backup (см. `backup-restore.md`).

## 7. Логи и диагностика

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose exec backend alembic current
docker compose exec db psql -U mlstem -d mlstem -c "select count(*) from users;"
```

Внутренние проверки:

- frontend: `GET /healthz`;
- backend: `GET /health` (внутри контейнера или через `docker compose exec`);
- публичный API: `GET /api/v1/algorithms`.

## 8. Ограничения текущей инфраструктуры

- один backend-процесс: in-process rate limiting и файловое хранилище не
  рассчитаны на горизонтальное масштабирование;
- нет внешнего S3 и антивирусного сканирования;
- TLS и домен настраиваются внешним reverse proxy, в compose входит только
  HTTP-nginx;
- для HA нужны внешняя БД, общий store и object storage — это за рамками MVP.
