"""The initial demo remains usable in both supported content languages."""

from sqlalchemy import select

from app.models.assessment import Assessment
from app.models.content import Algorithm, Competency, Lesson, Project, Task
from app.seed import seed


def test_new_demo_seed_contains_english_content_and_preserves_option_keys(db):
    seed()
    for model in (Algorithm, Competency, Lesson, Project, Task, Assessment):
        rows = db.scalars(select(model)).all()
        assert rows
        assert all(row.translation_en for row in rows)
    tasks = db.scalars(select(Task)).all()
    assert all(option.label_en for task in tasks for option in task.options)
    assessments = db.scalars(select(Assessment)).all()
    for assessment in assessments:
        for question in assessment.questions:
            assert question.body_en
            assert all(option.get("label_en") and "is_correct" in option and option.get("id") for option in question.options_json)
