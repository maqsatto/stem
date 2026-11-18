import uuid
from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.assessment import (
    Assessment,
    AssessmentAnswer,
    AssessmentAttempt,
    AssessmentCompetencyScore,
)
from app.models.classroom import LessonProgress, Submission
from app.models.content import Task
from app.models.enums import AssessmentKind, AttemptStatus, SubmissionStatus, TaskType


def grade_question(
    question_type: str,
    correct_ids: list[str],
    answer_json: dict,
    points: float,
) -> float:
    if question_type == TaskType.single_choice.value:
        selected = [str(item) for item in answer_json.get("selected_option_ids", [])]
        if len(correct_ids) == 1 and selected == correct_ids:
            return points
        return 0.0
    if question_type == TaskType.multiple_choice.value:
        selected = {str(item) for item in answer_json.get("selected_option_ids", [])}
        if correct_ids and selected == set(correct_ids):
            return points
        return 0.0
    # Open answers are not auto-graded in the MVP (manual teacher review).
    return 0.0


def grade_task(task: Task, answer_json: dict) -> float:
    if task.type not in {TaskType.single_choice.value, TaskType.multiple_choice.value}:
        return 0.0
    correct_ids = [str(option.id) for option in task.options if option.is_correct]
    return grade_question(task.type, correct_ids, answer_json, float(task.max_score))


def score_attempt(db: Session, attempt: AssessmentAttempt, assessment: Assessment) -> None:
    """Authoritative server-side scoring of a diagnostic attempt."""
    answers = {answer.question_id: answer for answer in attempt.answers}
    competency_earned: dict[uuid.UUID, float] = defaultdict(float)
    competency_max: dict[uuid.UUID, float] = defaultdict(float)
    total_earned = 0.0
    total_max = 0.0

    now = datetime.now(UTC)
    for question in assessment.questions:
        answer = answers.get(question.id)
        if answer is None:
            answer = AssessmentAnswer(
                attempt_id=attempt.id,
                question_id=question.id,
                answer_json={},
                answered_at=now,
            )
            db.add(answer)
            attempt.answers.append(answer)
            answers[question.id] = answer

        options = question.options_json or []
        correct_ids = [str(option["id"]) for option in options if option.get("is_correct")]
        earned = grade_question(question.type, correct_ids, answer.answer_json or {}, float(question.points))
        # Open answers require manual review; MVP diagnostics use closed questions.
        if question.type == "open_text":
            earned = 0.0
        answer.earned_points = earned
        total_earned += earned
        total_max += float(question.points)
        ids = question.competency_ids_json or ([str(question.competency_id)] if question.competency_id else [])
        for raw_id in ids:
            competency_id = uuid.UUID(str(raw_id))
            weight = float((question.competency_weights_json or {}).get(str(competency_id), 1))
            competency_earned[competency_id] += earned * weight
            competency_max[competency_id] += float(question.points) * weight

    attempt.total_score = round(total_earned, 2)
    attempt.max_score = round(total_max, 2)
    attempt.status = AttemptStatus.submitted.value
    attempt.submitted_at = now

    for existing in list(attempt.competency_scores):
        db.delete(existing)
    db.flush()
    for competency_id, maximum in competency_max.items():
        earned = competency_earned[competency_id]
        percent = round(100.0 * earned / maximum, 2) if maximum > 0 else 0.0
        db.add(
            AssessmentCompetencyScore(
                attempt_id=attempt.id,
                competency_id=competency_id,
                earned=round(earned, 2),
                maximum=round(maximum, 2),
                percent=percent,
            )
        )


def find_level(percent: float, config: dict | None) -> str | None:
    thresholds = (config or {}).get("thresholds") or {}
    low = thresholds.get("low")
    medium = thresholds.get("medium")
    if low is None or medium is None:
        return None
    if percent < float(low):
        return "low"
    if percent < float(medium):
        return "medium"
    return "high"


def weighted_overall(scores: list[dict], config: dict | None) -> float:
    weights = (config or {}).get("weights") or {}
    numerator = 0.0
    denominator = 0.0
    for score in scores:
        weight = float(weights.get(str(score["competency_id"]), 1.0))
        if weight <= 0:
            continue
        numerator += float(score["percent"]) * weight
        denominator += weight
    if denominator == 0:
        return 0.0
    return round(numerator / denominator, 2)


def first_completed_attempt(
    db: Session, assessment_id: uuid.UUID, student_id: uuid.UUID,
    assignment_ids: list[uuid.UUID] | None = None,
) -> AssessmentAttempt | None:
    query = (
        select(AssessmentAttempt)
        .where(
            AssessmentAttempt.assessment_id == assessment_id,
            AssessmentAttempt.student_id == student_id,
            AssessmentAttempt.status == AttemptStatus.submitted.value,
        )
        .order_by(AssessmentAttempt.submitted_at.asc())
    )
    if assignment_ids is not None:
        query = query.where(AssessmentAttempt.assignment_id.in_(assignment_ids))
    return db.execute(query).scalars().first()


def _score_payload(attempt: AssessmentAttempt) -> list[dict]:
    result = []
    for score in attempt.competency_scores:
        competency = score.competency
        result.append(
            {
                "competency_id": score.competency_id,
                "title": competency.title if competency else "",
                "title_en": (competency.translation_en or {}).get("title") if competency else None,
                "slug": competency.slug if competency else "",
                "earned": score.earned,
                "maximum": score.maximum,
                "percent": score.percent,
            }
        )
    return sorted(result, key=lambda item: item["title"])


def build_comparison(
    db: Session, student_id: uuid.UUID, methodology_key: str, version: int,
    assignment_ids: list[uuid.UUID] | None = None,
) -> dict | None:
    assessments = db.execute(
        select(Assessment).where(
            Assessment.methodology_key == methodology_key,
            Assessment.version == version,
            Assessment.kind.in_([AssessmentKind.pre.value, AssessmentKind.post.value]),
            Assessment.status == "published",
        )
    ).scalars().all()
    pre = next((item for item in assessments if item.kind == AssessmentKind.pre.value), None)
    post = next((item for item in assessments if item.kind == AssessmentKind.post.value), None)
    if pre is None or post is None:
        return None
    pre_attempt = first_completed_attempt(db, pre.id, student_id, assignment_ids)
    post_attempt = first_completed_attempt(db, post.id, student_id, assignment_ids)
    if pre_attempt is None or post_attempt is None:
        return None

    pre_scores = {item["competency_id"]: item for item in _score_payload(pre_attempt)}
    post_scores = {item["competency_id"]: item for item in _score_payload(post_attempt)}
    common_ids = [cid for cid in pre_scores if cid in post_scores]
    if not common_ids:
        return None

    rows = []
    for competency_id in common_ids:
        pre_item = pre_scores[competency_id]
        post_item = post_scores[competency_id]
        rows.append(
            {
                "competency_id": competency_id,
                "title": post_item["title"] or pre_item["title"],
                "title_en": post_item.get("title_en") or pre_item.get("title_en"),
                "slug": post_item["slug"] or pre_item["slug"],
                "pre_percent": pre_item["percent"],
                "post_percent": post_item["percent"],
                "delta_pp": round(post_item["percent"] - pre_item["percent"], 2),
                "level": find_level(post_item["percent"], post.scoring_config_json),
            }
        )
    rows.sort(key=lambda item: item["title"])

    pre_overall = weighted_overall(list(pre_scores.values()), pre.scoring_config_json)
    post_overall = weighted_overall(list(post_scores.values()), post.scoring_config_json)
    return {
        "methodology_key": methodology_key,
        "pre_assessment": pre.name,
        "post_assessment": post.name,
        "pre_date": pre_attempt.submitted_at,
        "post_date": post_attempt.submitted_at,
        "rows": rows,
        "pre_overall": pre_overall,
        "post_overall": post_overall,
        "overall_delta_pp": round(post_overall - pre_overall, 2),
        "demo_notice": (
            "Демонстрациялық есептеу: салмақтар мен шектер әдістеме бойынша "
            "ғылыми түрде бекітілуі керек."
            if (pre.scoring_config_json or {}).get("demo_weights", True)
            else None
        ),
    }


def student_comparisons(
    db: Session, student_id: uuid.UUID, assignment_ids: list[uuid.UUID] | None = None
) -> list[dict]:
    keys = db.execute(
        select(Assessment.methodology_key, Assessment.version)
        .where(
            Assessment.status == "published",
            Assessment.kind.in_([AssessmentKind.pre.value, AssessmentKind.post.value]),
        )
        .distinct()
    ).all()
    comparisons = []
    for methodology_key, version in keys:
        comparison = build_comparison(db, student_id, methodology_key, version, assignment_ids)
        if comparison:
            comparisons.append(comparison)
    return comparisons


def student_progress(db: Session, student_id: uuid.UUID) -> dict:
    lessons_completed = len(
        db.execute(
            select(LessonProgress).where(LessonProgress.student_id == student_id)
        ).scalars().all()
    )
    from app.models.content import Lesson  # local import to avoid cycles

    lessons_total = len(
        db.execute(select(Lesson).where(Lesson.status == "published")).scalars().all()
    )
    submissions = db.execute(
        select(Submission).where(Submission.student_id == student_id)
    ).scalars().all()
    reviewed = [item for item in submissions if item.status == SubmissionStatus.reviewed.value]
    grades = [float(item.grade) for item in reviewed if item.grade is not None]
    return {
        "lessons_completed": lessons_completed,
        "lessons_total": lessons_total,
        "tasks_submitted": len(submissions),
        "tasks_reviewed": len(reviewed),
        "average_grade": round(sum(grades) / len(grades), 2) if grades else None,
    }
