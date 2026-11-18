from datetime import UTC, datetime

from tests.helpers import (
    auth,
    create_assignment,
    create_classroom,
    create_lesson,
    create_project,
    create_task,
    create_user,
    login,
)


def test_task_sorting_by_difficulty_and_date(client, db):
    easy, medium, hard = [create_task(db) for _ in range(3)]
    for task, difficulty, year in [(easy, "easy", 2024), (medium, "medium", 2025), (hard, "hard", 2026)]:
        task.difficulty = difficulty
        task.created_at = datetime(year, 1, 1, tzinfo=UTC)
    db.commit()

    by_difficulty = client.get("/api/v1/tasks", params={"sort": "difficulty"})
    assert by_difficulty.status_code == 200
    assert [item["id"] for item in by_difficulty.json()["items"]] == [str(easy.id), str(medium.id), str(hard.id)]

    by_date = client.get("/api/v1/tasks", params={"sort": "date"})
    assert by_date.status_code == 200
    assert [item["id"] for item in by_date.json()["items"]] == [str(hard.id), str(medium.id), str(easy.id)]


def test_lessons_and_projects_sort_by_newest_and_title(client, db):
    for endpoint, factory in [("lessons", create_lesson), ("projects", create_project)]:
        older, newer = factory(db), factory(db)
        older.title, newer.title = "A", "Z"
        older.created_at = datetime(2024, 1, 1, tzinfo=UTC)
        newer.created_at = datetime(2025, 1, 1, tzinfo=UTC)
        db.commit()
        result = client.get(f"/api/v1/{endpoint}", params={"sort": "date"})
        assert result.status_code == 200
        assert [item["id"] for item in result.json()["items"]] == [str(newer.id), str(older.id)]
        result = client.get(f"/api/v1/{endpoint}", params={"sort": "title"})
        assert [item["id"] for item in result.json()["items"]] == [str(older.id), str(newer.id)]


def test_task_class_filter_only_returns_assigned_tasks_for_authorized_class(client, db):
    teacher = create_user(db, role="teacher")
    student = create_user(db, role="student")
    outsider = create_user(db, role="student")
    classroom = create_classroom(db, teacher, [student])
    assigned, other = create_task(db), create_task(db)
    create_assignment(db, classroom, "task", assigned.id)
    params = {"classroom_id": str(classroom.id)}
    assert client.get("/api/v1/tasks", params=params).status_code == 401
    response = client.get("/api/v1/tasks", params=params, headers=auth(login(client, student.email)))
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [str(assigned.id)]
    assert client.get("/api/v1/tasks", params=params, headers=auth(login(client, outsider.email))).status_code == 404
    assert client.get("/api/v1/tasks", params=params, headers=auth(login(client, teacher.email))).status_code == 200
    assert str(other.id) not in str(response.json())


def test_catalog_search_matches_english_translations(client, db):
    for endpoint, factory in [("lessons", create_lesson), ("tasks", create_task), ("projects", create_project)]:
        item = factory(db)
        item.translation_en = {"title": "Unicorn English lesson"}
        db.commit()
        response = client.get(f"/api/v1/{endpoint}", params={"q": "unicorn"})
        assert response.status_code == 200
        assert str(item.id) in [row["id"] for row in response.json()["items"]]
