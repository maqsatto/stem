"""Unit tests for authoritative server-side scoring helpers."""

import uuid

from app.services.scoring import find_level, grade_question, grade_task, weighted_overall
from tests.helpers import create_task


def test_grade_single_choice():
    assert grade_question("single_choice", ["a"], {"selected_option_ids": ["a"]}, 10) == 10
    assert grade_question("single_choice", ["a"], {"selected_option_ids": ["b"]}, 10) == 0
    assert grade_question("single_choice", ["a"], {"selected_option_ids": []}, 10) == 0
    assert grade_question("single_choice", ["a"], {"selected_option_ids": ["a", "b"]}, 10) == 0
    assert grade_question("single_choice", ["a"], {"selected_option_ids": ["a", "a"]}, 10) == 0


def test_grade_multiple_choice_requires_exact_set():
    assert (
        grade_question(
            "multiple_choice", ["a", "b"], {"selected_option_ids": ["b", "a"]}, 15
        )
        == 15
    )
    assert (
        grade_question("multiple_choice", ["a", "b"], {"selected_option_ids": ["a"]}, 15)
        == 0
    )
    assert (
        grade_question(
            "multiple_choice", ["a", "b"], {"selected_option_ids": ["a", "b", "c"]}, 15
        )
        == 0
    )
    assert (
        grade_question("multiple_choice", ["a"], {"selected_option_ids": ["a", "a"]}, 15)
        == 15
    )


def test_open_text_is_not_auto_graded():
    assert grade_question("open_text", [], {"text": "Жауап"}, 20) == 0


def test_grade_task_uses_database_options(db):
    task = create_task(db, options=[("Дұрыс", True), ("Қате", False)], max_score=12)
    correct = [str(option.id) for option in task.options if option.is_correct]
    wrong = [str(option.id) for option in task.options if not option.is_correct]
    assert grade_task(task, {"selected_option_ids": correct}) == 12
    assert grade_task(task, {"selected_option_ids": wrong}) == 0


def test_find_level_thresholds():
    config = {"thresholds": {"low": 50, "medium": 75}}
    assert find_level(0, config) == "low"
    assert find_level(49.99, config) == "low"
    assert find_level(50, config) == "medium"
    assert find_level(74.99, config) == "medium"
    assert find_level(75, config) == "high"
    assert find_level(100, config) == "high"
    assert find_level(90, None) is None
    assert find_level(90, {"thresholds": {}}) is None


def test_weighted_overall_respects_weights_and_zero():
    first = str(uuid.uuid4())
    second = str(uuid.uuid4())
    scores = [
        {"competency_id": first, "percent": 40.0},
        {"competency_id": second, "percent": 100.0},
    ]
    assert weighted_overall(scores, {"weights": {first: 3, second: 1}}) == 55.0
    assert weighted_overall(scores, {"weights": {first: 0, second: 1}}) == 100.0
    assert weighted_overall([], {"weights": {first: 1}}) == 0.0
    assert weighted_overall(scores, None) == 70.0
