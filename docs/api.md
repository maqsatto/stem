# API — краткое описание

Базовый префикс: `/api/v1` (настраивается `API_V1_PREFIX`). Формат — JSON,
кроме скачивания файлов и CSV.

Интерактивная документация и полная схема:

- Swagger UI: `/docs`
- ReDoc: `/redoc`
- OpenAPI JSON: `/openapi.json`
- Снимок для репозитория: [`openapi.json`](openapi.json)

В Docker-развёртывании nginx проксирует `/api/`, `/docs`, `/redoc` и
`/openapi.json` на backend. Если документация не должна быть публичной,
установите `DOCS_ENABLED=false`.

## 1. Аутентификация

Access-токен — короткоживущий JWT (по умолчанию 30 минут), refresh-токен
хранится в БД, ротируется при обновлении и отзывается при выходе.

| Метод | Путь | Назначение |
|---|---|---|
| POST | `/auth/register` | самостоятельная регистрация ученика (если разрешена) |
| POST | `/auth/login` | вход, возвращает пару токенов и пользователя |
| POST | `/auth/refresh` | ротация refresh-токена |
| POST | `/auth/logout` | отзыв refresh-токена (нужен access-токен) |
| GET | `/me` | текущий пользователь и его классы |
| PATCH | `/me` | изменить отображаемое имя |
| POST | `/change-password` | смена пароля |

Защищённые запросы:

```http
Authorization: Bearer <access_token>
```

Пример входа:

```bash
curl -s http://localhost:8080/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"teacher@mlstem.kz","password":"Teacher123!"}'
```

Ответ:

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {"id": "...", "email": "...", "role": "teacher", "display_name": "..."}
}
```

После `401` клиент должен один раз попробовать `/auth/refresh`, затем
разлогиниться. Refresh-токены одноразовые: повторное использование старого
токена отклоняется.

## 2. Ошибки

Единый конверт:

```json
{"detail": "Понятное сообщение", "code": "machine_code"}
```

| HTTP | Типичные коды |
|---|---|
| 400 | `bad_request` |
| 401 | `unauthorized`, `invalid_credentials`, `token_expired` |
| 403 | `forbidden`, `content_not_available` |
| 404 | `not_found` |
| 409 | `conflict`, `archive_instead`, `content_in_use`, `assessment_has_attempts` |
| 413 | `file_too_large` |
| 422 | `validation_error`, `invalid_file_type`, `mime_mismatch`, `content_not_published` |
| 429 | `rate_limited` (вход) |

## 3. Роли и доступ

- **Гость** видит только опубликованные алгоритмы, компетенции, уроки,
  задания, проекты и публичные ресурсы.
- **Ученик** видит опубликованный контент, свои назначения, сдачи,
  диагностики и результаты. Ключи ответов и teacher-only файлы скрыты.
- **Учитель** видит свои классы, назначения, сдачи и результаты; чужой класс
  по прямому ID недоступен.
- **Администратор** управляет CMS, пользователями, файлами, классами
  (просмотр) и аудитом.

Проверки выполняются на backend для каждого объекта, а не только в UI.

Отчёт класса учитывает работы и попытки, связанные с назначениями этого
класса. Результат pre или post показывается до появления пары; разница
рассчитывается только для совместимых pre/post одной версии методики.

## 4. Публичный каталог

| Метод | Путь | Описание |
|---|---|---|
| GET | `/algorithms?page=&page_size=&q=` | опубликованные ML-алгоритмы |
| GET | `/algorithms/{slug}` | карточка алгоритма |
| GET | `/competencies` | STEM-компетенции |
| GET | `/competencies/{slug}` | карточка компетенции |
| GET | `/matrix` | матрица «компетенция ↔ материал» |
| GET | `/lessons` | опубликованные уроки |
| GET | `/lessons/{id}` | урок |
| GET | `/tasks` | опубликованные задания |
| GET | `/tasks/{id}` | задание |
| GET | `/projects` | опубликованные проекты |
| GET | `/projects/{id}` | проект |
| GET | `/resources/{id}/download` | скачивание ресурса с проверкой аудитории |

Списки уроков, заданий и проектов поддерживают поиск `q`, фильтры
`algorithm_id` и `competency_id`, а также `page` и `page_size` (до 100).
Для заданий доступны дополнительные фильтры `lesson_id`, `difficulty` и
`type`. Параметр `sort` заданий принимает `order`, `difficulty` (от лёгкого
к сложному), `date` (сначала новые) или `title`.

## 5. Ученик

| Метод | Путь | Описание |
|---|---|---|
| POST | `/lessons/{id}/complete` | отметить урок завершённым |
| POST | `/classes/join` | вступить по коду |
| GET | `/classes` | мои классы |
| POST | `/assignments/{id}/submissions` | сдать работу |
| GET | `/assignments/{id}/submissions` | мои сдачи по назначению |
| GET | `/submissions/{id}` | сдача |
| GET | `/submission-files/{id}/download` | файл сдачи (свой или учителю класса) |
| GET | `/assessments` | доступные диагностики |
| GET | `/assessments/{id}` | вопросы без ключей |
| POST | `/assessments/{id}/attempts` | начать попытку |
| GET | `/attempts/{id}` | попытка |
| PATCH | `/attempts/{id}/answers` | сохранить ответы |
| POST | `/attempts/{id}/submit` | завершить и получить балл |
| GET | `/me/results` | результаты и pre/post |
| POST | `/uploads` | файл для сдачи |
| GET/DELETE | `/uploads/{id}` | скачать/удалить свой файл |

Правила сдачи:

- назначать можно только опубликованный контент;
- в закрытом назначении нельзя отправить новую работу;
- лимит попыток задаётся у задания/диагностики;
- закрытые ответы проверяются сервером, повторная отправка не удваивает
  попытку;
- при `return_for_revision` работа возвращается ученику.

## 6. Учитель

| Метод | Путь | Описание |
|---|---|---|
| GET | `/teacher/dashboard` | сводка |
| GET | `/teacher/competencies` | компетенции и материалы |
| POST/GET | `/classes` | создать / список своих классов |
| GET/PATCH | `/classes/{id}` | класс (только владелец) |
| POST | `/classes/{id}/regenerate-code` | новый код вступления |
| GET | `/classes/{id}/members` | участники |
| POST/GET | `/assignments` | назначить / список |
| GET/PATCH | `/assignments/{id}` | назначение, дедлайн, закрытие |
| GET | `/assignments/{id}/submissions` | сдачи класса |
| PATCH | `/submissions/{id}/review` | оценка, пікір, возврат на доработку |
| GET | `/teacher/classes/{id}/results` | результаты класса |
| GET | `/teacher/classes/{id}/results.csv` | CSV (UTF-8 BOM) |

CSV содержит только учеников и классы текущего учителя.

## 7. Администратор

Все пути ниже требуют роль `admin`.

| Группа | Пути |
|---|---|
| Обзор | `GET /admin/overview`, `GET /admin/content` |
| Алгоритмы | `GET/POST /admin/algorithms`, `GET/PATCH/DELETE /admin/algorithms/{id}`, `POST .../publish` |
| Компетенции | `GET/POST /admin/competencies`, `GET/PATCH/DELETE /admin/competencies/{id}`, `POST .../publish` |
| Уроки | `GET/POST /admin/lessons`, `GET/PATCH/DELETE /admin/lessons/{id}`, `POST .../publish` |
| Задания | `GET/POST /admin/tasks`, `GET/PATCH/DELETE /admin/tasks/{id}`, `POST .../publish` |
| Проекты | `GET/POST /admin/projects`, `GET/PATCH/DELETE /admin/projects/{id}`, `POST .../publish` |
| Диагностики | `GET/POST /admin/assessments`, `GET/PATCH/DELETE /admin/assessments/{id}`, `POST .../publish`, `POST .../new-version` |
| Файлы/ссылки | `POST /admin/uploads`, `POST /admin/resources`, `GET/PATCH/DELETE /admin/resources...` |
| Пользователи | `GET /admin/users`, `POST /admin/users/invite-teacher`, `PATCH /admin/users/{id}`, `POST /admin/users/{id}/reset-password`, `DELETE /admin/users/{id}` |
| Классы | `GET /admin/classes` |
| Аудит | `GET /admin/audit-logs` |

Особенности:

- загрузка в CMS возможна только после создания записи: форма требует
  `entity_type` и `entity_id`;
- опубликованный материал удалить нельзя (`409 archive_instead`);
- структурное изменение диагностики после завершённых попыток возвращает
  `409 assessment_has_attempts` — создайте новую версию;
- администратор не может отключить сам себя.

## 8. Пагинация

Списки CMS и каталогов возвращают:

```json
{"items": [], "total": 0, "page": 1, "page_size": 20}
```

`page_size` ограничен 100.

## 9. Загрузки

Ограничения по умолчанию:

- размер: 25 МБ (`MAX_UPLOAD_MB`);
- расширения: `pdf`, `docx`, `pptx`, `csv`, `xlsx`, `ipynb`, `png`, `jpg`,
  `jpeg`, `webp`;
- проверяются MIME и magic bytes;
- файлы хранятся в `UPLOAD_DIR` и отдаются только через API.

## 10. Rate limiting

Вход ограничен in-process счётчиком (по умолчанию 8 попыток за 60 секунд на
клиента). Это защита MVP для одного процесса; при горизонтальном
масштабировании нужен общий store (Redis).
