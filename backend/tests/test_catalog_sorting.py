from datetime import UTC, datetime

from tests.helpers import create_task


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
