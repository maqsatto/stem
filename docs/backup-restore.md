# Резервное копирование и восстановление

## Что копируется

1. **PostgreSQL** — дамп в custom-формате (`pg_dump -Fc`), сжатый gzip.
2. **Загруженные файлы** — содержимое volume `/app/uploads` (tar.gz).
3. **`.env` и секреты** — храните отдельно в менеджере секретов, не в git.

## Создание копии

```bash
make backup
# или
./scripts/backup.sh
```

Скрипт создаёт в `backups/`:

```
mlstem-db-20261115T120000Z.dump.gz
mlstem-uploads-20261115T120000Z.tar.gz
```

Требования: запущенный compose-стек (`db` и `backend`). Скрипт читает
`POSTGRES_USER`/`POSTGRES_DB` из `.env`.

### Автоматизация (cron)

```cron
# ежедневно в 02:30
30 2 * * * cd /opt/ml-stem-lab && ./scripts/backup.sh >> /var/log/mlstem-backup.log 2>&1
```

Рекомендуется:

- хранить копии вне сервера (S3/второй сервер/лента);
- шифровать архивы (`age`, `gpg`) перед отправкой;
- держать 7 ежедневных, 4 недельных и 6 месячных копий;
- проверять восстановление не реже раза в квартал.

## Восстановление

> Опасная операция: `pg_restore --clean` удаляет текущие объекты БД. Сначала
> потренируйтесь на staging.

```bash
# остановить backend, восстановить БД, затем файлы
./scripts/restore.sh backups/mlstem-db-20261115T120000Z.dump.gz \
                    backups/mlstem-uploads-20261115T120000Z.tar.gz
```

Что делает скрипт:

1. останавливает `backend`, чтобы не было записи во время восстановления;
2. выполняет `pg_restore --clean --if-exists --no-owner`;
3. запускает backend;
4. распаковывает uploads в `/app/uploads`;
5. перезапускает backend.

После восстановления:

```bash
docker compose ps
curl -fsS http://localhost:8080/healthz
curl -fsS "http://localhost:8080/api/v1/algorithms?page_size=1"
```

Проверьте входы всех ролей, открытие урока, скачивание файла, сдачу задания и
CSV-экспорт.

## Проверка копии без восстановления в рабочую БД

Поднимите отдельный PostgreSQL (или временную БД) и восстановите дамп туда:

```bash
createdb -O mlstem restore_check
gunzip -c backups/mlstem-db-....dump.gz | pg_restore -U mlstem -d restore_check --no-owner
psql -U mlstem -d restore_check -c "select count(*) from users;"
dropdb restore_check
```

Для Docker можно использовать временный контейнер `postgres:18-alpine` и
подключить его к отдельной сети/порту. Не направляйте проверку на `mlstem`.

## Целевые показатели

- **RPO** — не более 24 часов (при ежедневном cron; чаще — меньше).
- **RTO** — 30–60 минут для MVP-развёртывания при готовом сервере и копиях.
- Восстановление считается успешным только после проверки сценариев входа,
  контента, файлов и сдач.
