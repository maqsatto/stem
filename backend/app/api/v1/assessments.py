import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.errors import ApiError
from app.db.session import get_db
from app.models.assessment import (
    Assessment,
    AssessmentAnswer,
    AssessmentAttempt,
    AssessmentQuestion,
)
from app.models.classroom import Assignment
from app.models.content import Competency
from app.models.enums import AttemptStatus, Role
from app.models.user import User
from app.schemas.assessment import (
    AnswersPatchIn,
    AssessmentCard,
    AssessmentStudentDetail,
    AttemptOut,
    AttemptStartIn,
    ClassResultsOut,
    CompetencyScoreOut,
    PrePostComparisonOut,
    StudentResultsOut,
)
from app.schemas.common import Page
from app.services import serializers
from app.services.access import ensure_classroom_access, ensure_classroom_teacher, not_found
from app.services.reports import build_class_results, class_results_csv, teacher_dashboard
from app.services.scoring import find_level, score_attempt, student_comparisons, student_progress

router = APIRouter(tags=["assessments"])


def get_assessment(db: Session, assessment_id: uuid.UUID) -> Assessment:
    assessment = db.get(Assessment, assessment_id)
    if assessment is None:
        raise not_found("Диагностика")
    return assessment


def can_view_assessment(assessment: Assessment, user: User) -> bool:
    if user.role == Role.admin.value:
        return True
    return assessment.status == "published"


def get_attempt(db: Session, attempt_id: uuid.UUID, user: User) -> AssessmentAttempt:
    attempt = db.get(AssessmentAttempt, attempt_id)
    if attempt is None:
        raise not_found("Талпыныс")
    if user.role == Role.student.value:
        if attempt.student_id != user.id:
            raise not_found("Талпыныс")
        return attempt
    if user.role == Role.admin.value:
        return attempt
    assignment = (
        db.get(Assignment, attempt.assignment_id) if attempt.assignment_id else None
    )
    if assignment is not None:
        ensure_classroom_teacher(db, user, assignment.classroom_id)
        return attempt
    raise not_found("Талпыныс")


@router.get("/assessments", response_model=Page[AssessmentCard])
def list_assessments(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    kind: str | None = Query(default=None, pattern="^(pre|post|quiz)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = select(Assessment)
    if user.role != Role.admin.value:
        query = query.where(Assessment.status == "published")
    if kind:
        query = query.where(Assessment.kind == kind)
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(Assessment.kind, Assessment.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    student_id = user.id if user.role == Role.student.value else None
    return Page(
        items=[serializers.assessment_card(db, item, student_id) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/assessments/{assessment_id}", response_model=AssessmentStudentDetail)
def get_assessment_detail(
    assessment_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assessment = get_assessment(db, assessment_id)
    if not can_view_assessment(assessment, user):
        raise not_found("Диагностика")
    reveal = user.role in {Role.teacher.value, Role.admin.value}
    card = serializers.assessment_card(
        db, assessment, user.id if user.role == Role.student.value else None
    )
    return AssessmentStudentDetail(
        **card,
        instructions=assessment.instructions,
        show_correct_answers=assessment.show_correct_answers,
        questions=[serializers.question_student(item, reveal=reveal) for item in assessment.questions],
    )


@router.post("/assessments/{assessment_id}/attempts", response_model=AttemptOut)
def start_attempt(
    assessment_id: uuid.UUID,
    payload: AttemptStartIn | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.student.value)),
):
    assessment = get_assessment(db, assessment_id)
    if assessment.status != "published":
        raise not_found("Диагностика")
    if not assessment.questions:
        raise ApiError(409, "assessment_empty", "Диагностикада сұрақтар жоқ.")
    assignments_limit = assessment.attempts_limit
    attempts = db.execute(
        select(AssessmentAttempt)
        .where(
            AssessmentAttempt.assessment_id == assessment.id,
            AssessmentAttempt.student_id == user.id,
        )
        .order_by(AssessmentAttempt.attempt_no)
    ).scalars().all()
    in_progress = next(
        (item for item in attempts if item.status == AttemptStatus.in_progress.value), None
    )
    if in_progress is not None:
        return serializers.attempt_out(in_progress)
    submitted = [item for item in attempts if item.status == AttemptStatus.submitted.value]
    if len(submitted) >= assignments_limit:
        raise ApiError(409, "attempts_exhausted", "Талпыныс лимиті аяқталды.")
    assignment_id = payload.assignment_id if payload else None
    if assignment_id:
        assignment = db.get(Assignment, assignment_id)
        if assignment is None or assignment.content_id != assessment.id:
            raise not_found("Тапсырма")
        ensure_classroom_access(db, user, assignment.classroom_id)
    attempt_no = max((item.attempt_no for item in attempts), default=0) + 1
    attempt = AssessmentAttempt(
        assessment_id=assessment.id,
        student_id=user.id,
        assignment_id=assignment_id,
        status=AttemptStatus.in_progress.value,
        started_at=datetime.now(UTC),
        attempt_no=attempt_no,
        assessment_version=assessment.version,
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return serializers.attempt_out(attempt, include_answers=False)


@router.get("/attempts/{attempt_id}", response_model=AttemptOut)
def get_attempt_detail(
    attempt_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attempt = get_attempt(db, attempt_id, user)
    show_correct = user.role in {Role.teacher.value, Role.admin.value} or (
        attempt.assessment.show_correct_answers
        and attempt.status == AttemptStatus.submitted.value
    )
    return serializers.attempt_out(
        attempt, show_correct=show_correct, config=attempt.assessment.scoring_config_json
    )


def validate_answer(question: AssessmentQuestion, answer: dict) -> dict:
    if question.type == "open_text":
        text = answer.get("text", "")
        if not isinstance(text, str) or len(text) > 10000:
            raise ApiError(422, "invalid_answer", "Ашық жауап мәтіні 10000 таңбадан аспауы керек.")
        return {"text": text}
    selected = answer.get("selected_option_ids", [])
    if not isinstance(selected, list):
        raise ApiError(422, "invalid_answer", "Жауап форматы қате.")
    valid_ids = {str(option.get("id")) for option in (question.options_json or [])}
    normalized = [str(item) for item in selected]
    if len(set(normalized)) != len(normalized):
        raise ApiError(422, "invalid_answer", "Бір нұсқаны бірнеше рет таңдауға болмайды.")
    if any(item not in valid_ids for item in normalized):
        raise ApiError(422, "invalid_answer", "Таңдалған нұсқа сұраққа тиесілі емес.")
    if question.type == "single_choice" and len(normalized) > 1:
        raise ApiError(422, "invalid_answer", "Бір ғана жауап нұсқасын таңдаңыз.")
    return {"selected_option_ids": normalized}


@router.patch("/attempts/{attempt_id}/answers", response_model=AttemptOut)
def save_answers(
    attempt_id: uuid.UUID,
    payload: AnswersPatchIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.student.value)),
):
    attempt = get_attempt(db, attempt_id, user)
    if attempt.status != AttemptStatus.in_progress.value:
        raise ApiError(409, "attempt_closed", "Бұл талпыныс жабылған, жауапты өзгерту мүмкін емес.")
    questions = {item.id: item for item in attempt.assessment.questions}
    for item in payload.answers:
        question = questions.get(item.question_id)
        if question is None:
            raise ApiError(404, "question_not_found", "Сұрақ табылмады.")
        answer_json = validate_answer(question, item.answer_json)
        existing = db.execute(
            select(AssessmentAnswer).where(
                AssessmentAnswer.attempt_id == attempt.id,
                AssessmentAnswer.question_id == question.id,
            )
        ).scalar_one_or_none()
        if existing is None:
            db.add(
                AssessmentAnswer(
                    attempt_id=attempt.id,
                    question_id=question.id,
                    answer_json=answer_json,
                    answered_at=datetime.now(UTC),
                )
            )
        else:
            existing.answer_json = answer_json
            existing.answered_at = datetime.now(UTC)
    db.commit()
    db.refresh(attempt)
    return serializers.attempt_out(attempt, include_answers=False)


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptOut)
def submit_attempt(
    attempt_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.student.value)),
):
    attempt = get_attempt(db, attempt_id, user)
    if attempt.status == AttemptStatus.submitted.value:
        # Idempotent: a repeated click must not create a second attempt or rescore.
        return serializers.attempt_out(
            attempt,
            show_correct=attempt.assessment.show_correct_answers,
            config=attempt.assessment.scoring_config_json,
        )
    score_attempt(db, attempt, attempt.assessment)
    db.commit()
    db.refresh(attempt)
    return serializers.attempt_out(
        attempt,
        show_correct=attempt.assessment.show_correct_answers,
        config=attempt.assessment.scoring_config_json,
    )


@router.get("/me/results", response_model=StudentResultsOut)
def my_results(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.student.value)),
):
    progress = student_progress(db, user.id)
    comparisons = student_comparisons(db, user.id)
    comparison_by_slug = {}
    for comparison in comparisons:
        for row in comparison["rows"]:
            comparison_by_slug[row["slug"]] = row

    attempts = db.execute(
        select(AssessmentAttempt)
        .where(
            AssessmentAttempt.student_id == user.id,
            AssessmentAttempt.status == AttemptStatus.submitted.value,
        )
        .order_by(AssessmentAttempt.submitted_at)
    ).scalars().all()

    latest_by_competency: dict[uuid.UUID, dict] = {}
    for attempt in attempts:
        for score in attempt.competency_scores:
            latest_by_competency[score.competency_id] = {
                "competency_id": score.competency_id,
                "title": score.competency.title if score.competency else "",
                "slug": score.competency.slug if score.competency else "",
                "earned": score.earned,
                "maximum": score.maximum,
                "percent": score.percent,
                "level": find_level(
                    score.percent, attempt.assessment.scoring_config_json
                ),
                "delta_pp": None,
            }
    summary = []
    for item in latest_by_competency.values():
        if item["slug"] in comparison_by_slug:
            item["delta_pp"] = comparison_by_slug[item["slug"]]["delta_pp"]
        summary.append(item)
    summary.sort(key=lambda item: item["title"])

    assessment_ids = {item.assessment_id for item in attempts}
    cards = []
    if assessment_ids:
        assessment_rows = db.execute(
            select(Assessment).where(Assessment.id.in_(assessment_ids))
        ).scalars().all()
        cards = [serializers.assessment_card(db, item, user.id) for item in assessment_rows]

    message = None
    if not attempts:
        message = "Диагностика әлі өтпеген. Мұғалім тағайындаған pre-test-тен бастаңыз."
    elif not comparisons:
        message = (
            "Салыстырмалы STEM динамикасын көру үшін pre және post диагностикасын "
            "аяқтау қажет. Қазіргі көрсеткіштер жеке диагностика нәтижесі ретінде көрсетіледі."
        )
    demo = any(
        attempt.assessment.is_demo for attempt in attempts
    )
    return StudentResultsOut(
        progress=progress,
        attempts=[AssessmentCard(**item) for item in cards],
        competency_summary=[CompetencyScoreOut(**item) for item in summary],
        comparisons=[PrePostComparisonOut(**item) for item in comparisons],
        demo_notice=(
            "Көрсетілген сандық көрсеткіштер демонстрациялық деректерге негізделген."
            if demo
            else None
        ),
        message=message,
    )


@router.get("/teacher/classes/{classroom_id}/results", response_model=ClassResultsOut)
def class_results(
    classroom_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.teacher.value, Role.admin.value)),
):
    classroom = ensure_classroom_teacher(db, user, classroom_id)
    return ClassResultsOut(**build_class_results(db, classroom))


@router.get("/teacher/classes/{classroom_id}/results.csv")
def class_results_csv_endpoint(
    classroom_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.teacher.value, Role.admin.value)),
):
    classroom = ensure_classroom_teacher(db, user, classroom_id)
    content = class_results_csv(db, classroom)
    return Response(
        content=content.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="class-{classroom.id}-results.csv"',
        },
    )


@router.get("/teacher/dashboard")
def get_teacher_dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.teacher.value, Role.admin.value)),
):
    stats = teacher_dashboard(db, user)
    return {
        "classrooms": stats["classrooms"],
        "students": stats["students"],
        "assignments": stats["assignments"],
        "pending_reviews": stats["pending_reviews"],
        "recent_assignments": [
            {
                "id": str(item.id),
                "classroom_id": str(item.classroom_id),
                "content_type": item.content_type,
                "content_id": str(item.content_id),
                "due_at": item.due_at.isoformat() if item.due_at else None,
                "status": item.status,
            }
            for item in stats["recent_assignments"]
        ],
    }


@router.get("/teacher/competencies")
def teacher_competencies(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.teacher.value, Role.admin.value)),
):
    rows = db.execute(
        select(Competency).where(Competency.status == "published").order_by(Competency.sort_order)
    ).scalars().all()
    return [
        {
            "id": str(item.id),
            "slug": item.slug,
            "title": item.title,
            "description": item.description,
            "indicators_json": item.indicators_json,
            "criteria_json": item.criteria_json,
        }
        for item in rows
    ]
