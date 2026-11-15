# Схема базы данных

PostgreSQL, SQLAlchemy 2.x, миграции Alembic. Всего 24 таблицы. Полная
актуальная схема — в миграциях `backend/alembic/versions/`; ниже — назначение
таблиц и ключевые связи.

## Группы таблиц

### Пользователи и сессии

| Таблица | Назначение |
|---|---|
| `users` | аккаунты: email, Argon2id-хэш, роль (`student`/`teacher`/`admin`), статус, `must_change_password` |
| `refresh_tokens` | refresh-токены с ротацией, сроком действия и отзывом |

### Контент

| Таблица | Назначение |
|---|---|
| `algorithms` | ML-алгоритмы: текст, slug, обложка, статус, `is_demo` |
| `competencies` | STEM-компетенции: индикаторы, критерии уровней |
| `lessons` | уроки, привязка к алгоритму, цель, рефлексия, порядок |
| `lesson_competencies` | M:N урок ↔ компетенция |
| `tasks` | задания: тип, сложность, баллы, лимит попыток, рубрика |
| `task_options` | варианты закрытых заданий и признак правильного |
| `task_competencies` | M:N задание ↔ компетенция |
| `projects` | проекты: проблема, цель, шаги, материалы, рубрика |
| `project_competencies` | M:N проект ↔ компетенция |
| `resources` | файлы и ссылки, аудитория (`public`/`student`/`teacher`/`admin`) |

### Классы и работы

| Таблица | Назначение |
|---|---|
| `classrooms` | класс, учитель-владелец, код вступления, статус |
| `classroom_members` | M:N ученик ↔ класс, дата вступления |
| `assignments` | назначение материала классу: `content_type` + `content_id`, дедлайн, статус |
| `submissions` | сдача ученика, ответы, балл, пікір, попытки, автопроверка |
| `submission_files` | файлы, приложенные к сдаче |
| `lesson_progress` | отметка о завершении урока учеником |

### Диагностика

| Таблица | Назначение |
|---|---|
| `assessments` | pre/post/quiz, версия, `methodology_key`, лимит попыток, показ ответов |
| `assessment_questions` | вопросы: тип, балл, компетенция, порядок |
| `assessment_attempts` | попытка ученика, статус, общий балл |
| `assessment_answers` | ответ на вопрос (варианты или текст) |
| `assessment_competency_scores` | проценты по компетенциям для попытки |

### Аудит

| Таблица | Назначение |
|---|---|
| `audit_logs` | актор, действие, объект, JSON-детали, время (только чтение) |

## Ключевые связи

```
users 1─N refresh_tokens
users 1─N classrooms (teacher_id)
users N─M classrooms (classroom_members)
classrooms 1─N assignments
assignments 1─N submissions
users 1─N submissions (student_id)
submissions 1─N submission_files
users 1─N lesson_progress
lessons 1─N lesson_progress

algorithms 1─N lessons / tasks / projects
lessons N─M competencies (lesson_competencies)
tasks   N─M competencies (task_competencies)
projects N─M competencies (project_competencies)

assessments 1─N assessment_questions
assessments 1─N assessment_attempts
assessment_attempts 1─N assessment_answers
assessment_attempts 1─N assessment_competency_scores
```

## Полиморфные связи

- `assignments.content_type` ∈ `lesson`, `task`, `project`, `assessment`;
  `content_id` — UUID соответствующей таблицы. Уникальность:
  `(classroom_id, content_type, content_id)` — повторное назначение не создаёт
  дубль.
- `resources.entity_type` ∈ `algorithm`, `competency`, `lesson`, `task`,
  `project`, `assessment`, `upload`; `entity_id` — UUID родителя.
- `submissions.answers_json` хранит выбранные варианты закрытого задания;
  правильные ответы не дублируются в сдаче.

## Ограничения и инварианты

- email уникален и нормализуется в lower-case;
- роль и статус — enum-значения, проверяются Pydantic и БД;
- один ученик — одна сдача на назначение (`assignment_id`, `student_id`);
- один прогресс на пару (`student_id`, `lesson_id`);
- один ответ на вопрос в попытке (`attempt_id`, `question_id`);
- правильные варианты закрытых заданий не отдаются в ученических DTO;
- `is_demo=true` — обязательный признак демонстрационного контента;
- удаление опубликованного материала запрещено на уровне API (архивирование);
- структурные изменения диагностики после попыток запрещены (новая версия).

## Миграции

```bash
cd backend
uv run alembic upgrade head       # применить
uv run alembic current            # текущая ревизия
uv run alembic downgrade -1       # откатить одну (осторожно)
uv run alembic revision --autogenerate -m "change"
```

В Docker миграции применяются автоматически при старте backend
(`alembic upgrade head` в entrypoint). Тестовая БД пересоздаётся pytest-фикстурой
и не должна указывать на рабочую базу.

## Seed

`python -m app.seed` создаёт:

- администратора, учителя и двух учеников (пароли из env);
- 5 STEM-компетенций, 3 ML-алгоритма, 6 уроков, 18 заданий, 4 проекта,
  2 диагностики;
- демо-класс с кодом `DEMO10` и демонстрационные сдачи.

Все материалы помечены `is_demo=true`. Seed идемпотентен: если в `users` уже
есть записи, он завершается без изменений. `--reset` удаляет все строки и
доступен только вне production.
