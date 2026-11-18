import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.errors import ApiError
from app.db.session import get_db
from app.models.assessment import Assessment, AssessmentAttempt, AssessmentQuestion
from app.models.classroom import (
    Assignment,
    Classroom,
    ClassroomMember,
    Submission,
    SubmissionFile,
)
from app.models.content import (
    Algorithm,
    Competency,
    Lesson,
    LessonCompetency,
    Project,
    ProjectCompetency,
    Resource,
    Task,
    TaskCompetency,
    TaskOption,
)
from app.models.enums import Audience, ContentStatus, ResourceKind, Role
from app.models.user import User
from app.schemas.admin import (
    AlgorithmCreateIn,
    AlgorithmUpdateIn,
    AuditLogOut,
    CompetencyCreateIn,
    CompetencyUpdateIn,
    ContentItemOut,
    LessonCreateIn,
    LessonUpdateIn,
    PasswordResetOut,
    ProjectCreateIn,
    ProjectUpdateIn,
    ResourceLinkCreateIn,
    ResourceUpdateIn,
    StaffCreateIn,
    TaskCreateIn,
    TaskUpdateIn,
    UserAdminOut,
    UserPatchIn,
)
from app.schemas.assessment import AssessmentCreateIn, AssessmentUpdateIn
from app.schemas.classroom import ClassroomOut
from app.schemas.common import MessageOut, Page
from app.schemas.content import AlgorithmCard, ContentOverview, ResourceOut
from app.services import serializers
from app.services.access import not_found
from app.services.audit import log_action
from app.services.storage import delete_stored_file, save_upload
from app.services.text import sanitize_html, unique_slug

router = APIRouter(prefix="/admin", tags=["admin"])
admin_only = Depends(require_roles(Role.admin.value))

MODEL_MAP = {
    "algorithms": Algorithm,
    "competencies": Competency,
    "lessons": Lesson,
    "tasks": Task,
    "projects": Project,
    "assessments": Assessment,
}
SINGULAR = {
    "algorithms": "algorithm",
    "competencies": "competency",
    "lessons": "lesson",
    "tasks": "task",
    "projects": "project",
    "assessments": "assessment",
}
ENTITY_LABELS = {
    "algorithm": "Алгоритм",
    "competency": "Құзыреттілік",
    "lesson": "Сабақ",
    "task": "Тапсырма",
    "project": "Жоба",
    "assessment": "Диагностика",
}


def get_admin_entity(db: Session, entity: str, entity_id: uuid.UUID):
    model = MODEL_MAP.get(entity)
    if model is None:
        raise not_found("Әкімшілік бөлім")
    obj = db.get(model, entity_id)
    if obj is None:
        raise not_found(ENTITY_LABELS.get(SINGULAR[entity], "Материал"))
    return obj


def validate_competency_ids(db: Session, ids: list[uuid.UUID]) -> None:
    unique_ids = set(ids)
    if not unique_ids:
        return
    rows = db.execute(select(Competency.id).where(Competency.id.in_(unique_ids))).scalars().all()
    if len(rows) != len(unique_ids):
        raise ApiError(422, "invalid_competency", "Кейбір құзыреттіліктер табылмады.")


def set_competencies(
    db: Session, content, ids: list[uuid.UUID], link_model, content_field: str
) -> None:
    validate_competency_ids(db, ids)
    db.query(link_model).filter(getattr(link_model, content_field) == content.id).delete(
        synchronize_session=False
    )
    for competency_id in dict.fromkeys(ids):
        db.add(link_model(**{content_field: content.id, "competency_id": competency_id}))
    db.flush()
    db.expire(content, ["competency_links"])


def validate_publish(db: Session, entity: str, obj) -> None:
    label = ENTITY_LABELS[SINGULAR[entity]]
    if entity == "algorithms":
        if not obj.title.strip() or not obj.summary.strip() or not obj.body.strip():
            raise ApiError(422, "incomplete_content", f"{label}: атауы, қысқаша сипаттамасы және мәтіні толтырылуы керек.")
    elif entity == "competencies":
        if not obj.title.strip() or not obj.description.strip():
            raise ApiError(422, "incomplete_content", f"{label}: атауы мен сипаттамасы толтырылуы керек.")
        if not obj.indicators_json:
            raise ApiError(422, "incomplete_content", f"{label}: кемінде бір индикатор қосу керек.")
    elif entity == "lessons":
        if not obj.title.strip() or not obj.body.strip():
            raise ApiError(422, "incomplete_content", f"{label}: атауы мен мазмұны толтырылуы керек.")
        if not obj.competency_links:
            raise ApiError(422, "incomplete_content", f"{label}: кемінде бір STEM құзыреттілігін байланыстырыңыз.")
    elif entity == "tasks":
        if not obj.title.strip() or not obj.instructions.strip():
            raise ApiError(422, "incomplete_content", f"{label}: атауы мен нұсқаулығы толтырылуы керек.")
        if not obj.competency_links:
            raise ApiError(422, "incomplete_content", f"{label}: кемінде бір құзыреттілікті байланыстырыңыз.")
        if obj.type in {"single_choice", "multiple_choice"}:
            options = obj.options or []
            correct = [option for option in options if option.is_correct]
            if len(options) < 2:
                raise ApiError(422, "incomplete_content", f"{label}: кемінде екі жауап нұсқасы қажет.")
            if obj.type == "single_choice" and len(correct) != 1:
                raise ApiError(422, "incomplete_content", f"{label}: бір дұрыс жауап болуы керек.")
            if obj.type == "multiple_choice" and len(correct) < 1:
                raise ApiError(422, "incomplete_content", f"{label}: кемінде бір дұрыс жауап белгілеңіз.")
    elif entity == "projects":
        if not obj.title.strip() or not obj.problem.strip() or not obj.goal.strip():
            raise ApiError(422, "incomplete_content", f"{label}: атауы, мәселесі және мақсаты толтырылуы керек.")
    elif entity == "assessments":
        if not obj.questions:
            raise ApiError(422, "incomplete_content", f"{label}: кемінде бір сұрақ қажет.")
        for question in obj.questions:
            if question.type in {"single_choice", "multiple_choice"}:
                options = question.options_json or []
                correct = [item for item in options if item.get("is_correct")]
                if len(options) < 2:
                    raise ApiError(422, "incomplete_content", f"{label}: әр сұрақта кемінде екі нұсқа болуы керек.")
                if question.type == "single_choice" and len(correct) != 1:
                    raise ApiError(422, "incomplete_content", f"{label}: бір дұрыс жауап болуы керек.")
                if question.type == "multiple_choice" and len(correct) < 1:
                    raise ApiError(422, "incomplete_content", f"{label}: дұрыс жауаптарды белгілеңіз.")
            if obj.kind in {"pre", "post"} and question.competency_id is None:
                raise ApiError(422, "incomplete_content", f"{label}: әр сұрақ құзыреттілікке байланысуы керек.")


def normalize_options(options: list) -> list[TaskOption]:
    result = []
    for index, option in enumerate(options, start=1):
        label = (option.label or "").strip()
        if not label:
            raise ApiError(422, "invalid_option", "Жауап нұсқасы бос болмауы керек.")
        result.append(
            TaskOption(
                label=sanitize_html(label),
                label_en=sanitize_html(option.label_en),
                is_correct=option.is_correct,
                order_no=option.order_no or index,
            )
        )
    return result


def assessment_questions_payload(
    db: Session, questions: list, kind: str
) -> list[AssessmentQuestion]:
    result = []
    for index, question in enumerate(questions, start=1):
        competency_ids = list(dict.fromkeys(question.competency_ids or ([question.competency_id] if question.competency_id else [])))
        if any(key not in competency_ids or not 0 < weight <= 100 for key, weight in question.competency_weights.items()):
            raise ApiError(422, "invalid_competency_weight", "Құзыреттілік салмағы 0 мен 100 аралығында болуы керек.")
        for competency_id in competency_ids:
            if db.get(Competency, competency_id) is None:
                raise ApiError(422, "invalid_competency", "Сұрақтың құзыреттілігі табылмады.")
        options: list[dict] = []
        if question.type in {"single_choice", "multiple_choice"}:
            for option_index, option in enumerate(question.options, start=1):
                label = str(option.get("label", "")).strip()
                if not label:
                    raise ApiError(422, "invalid_option", "Диагностика нұсқасы бос болмауы керек.")
                options.append(
                    {
                        "id": str(option.get("id") or uuid.uuid4().hex),
                        "label": sanitize_html(label),
                        "label_en": sanitize_html(str(option.get("label_en", ""))),
                        "is_correct": bool(option.get("is_correct")),
                        "order_no": option_index,
                    }
                )
        result.append(
            AssessmentQuestion(
                type=question.type,
                body=sanitize_html(question.body),
                body_en=sanitize_html(question.body_en),
                competency_id=competency_ids[0] if competency_ids else None,
                competency_ids_json=[str(item) for item in competency_ids],
                competency_weights_json={str(key): value for key, value in question.competency_weights.items()},
                points=question.points,
                options_json=options,
                order_no=question.order_no or index,
            )
        )
    return result


def default_scoring_config(db: Session) -> dict:
    competencies = db.execute(
        select(Competency).where(Competency.status == ContentStatus.published.value)
    ).scalars().all()
    return {
        "weights": {str(item.id): 1.0 for item in competencies},
        "thresholds": {"low": 50, "medium": 75},
        "attempt_rule": "first_completed",
        "demo_weights": True,
    }


def publish_obj(db: Session, entity: str, obj, actor: User) -> None:
    validate_publish(db, entity, obj)
    if not getattr(obj, "published_at", None):
        obj.published_at = datetime.now(UTC)
    obj.status = ContentStatus.published.value
    log_action(db, actor.id, "content_published", SINGULAR[entity], obj.id)
    db.commit()


# ---------------------------------------------------------------------------
# Overview / united content catalog
# ---------------------------------------------------------------------------


@router.get("/overview", response_model=ContentOverview)
def admin_overview(db: Session = Depends(get_db), user: User = admin_only):
    def count(model):
        return db.execute(select(func.count()).select_from(model)).scalar_one()

    pending = db.execute(
        select(func.count()).select_from(Submission).where(Submission.status == "submitted")
    ).scalar_one()
    return ContentOverview(
        algorithms=count(Algorithm),
        competencies=count(Competency),
        lessons=count(Lesson),
        tasks=count(Task),
        projects=count(Project),
        assessments=count(Assessment),
        resources=count(Resource),
        users=count(User),
        classrooms=count(Classroom),
        submissions_pending=pending,
    )


@router.get("/content", response_model=Page[ContentItemOut])
def admin_content(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    type: str | None = Query(default=None, pattern="^(algorithm|competency|lesson|task|project|assessment)$"),
    status: str | None = Query(default=None, pattern="^(draft|published|archived)$"),
    q: str | None = None,
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    items = []
    for plural, model in MODEL_MAP.items():
        query = select(model)
        if type and SINGULAR[plural] != type:
            continue
        if status:
            query = query.where(model.status == status)
        if q:
            query = query.where(model.title.ilike(f"%{q}%"))
        for obj in db.execute(query).scalars().all():
            items.append(
                {
                    "id": obj.id,
                    "type": SINGULAR[plural],
                    "title": obj.title,
                    "slug": obj.slug,
                    "status": obj.status,
                    "is_demo": obj.is_demo,
                    "updated_at": obj.updated_at,
                    "detail_url": f"/admin/{plural}/{obj.id}",
                }
            )
    items.sort(key=lambda item: item["updated_at"] or datetime.min.replace(tzinfo=UTC), reverse=True)
    total = len(items)
    start = (page - 1) * page_size
    return Page(items=items[start : start + page_size], total=total, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# Algorithms
# ---------------------------------------------------------------------------


@router.get("/algorithms", response_model=list[AlgorithmCard])
def admin_algorithms(db: Session = Depends(get_db), user: User = admin_only):
    rows = db.execute(select(Algorithm).order_by(Algorithm.sort_order, Algorithm.title)).scalars().all()
    return [serializers.algorithm_card(item) for item in rows]


@router.get("/algorithms/{algorithm_id}")
def admin_algorithm_detail(
    algorithm_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    obj = get_admin_entity(db, "algorithms", algorithm_id)
    return {
        **serializers.algorithm_detail(db, obj, user),
        "status": obj.status,
        "sort_order": obj.sort_order,
        "published_at": obj.published_at,
        "resources": serializers.visible_resources(db, "algorithm", obj.id, user),
    }


@router.post("/algorithms", status_code=201)
def create_algorithm(
    payload: AlgorithmCreateIn, db: Session = Depends(get_db), user: User = admin_only
):
    obj = Algorithm(
        title=payload.title.strip(),
        slug=unique_slug(db, Algorithm, payload.title, payload.slug),
        title_en=payload.title_en,
        summary=sanitize_html(payload.summary),
        body=sanitize_html(payload.body),
        translation_en={key: sanitize_html(value) for key, value in payload.translation_en.model_dump().items()},
        cover_image=payload.cover_image,
        status=payload.status,
        sort_order=payload.sort_order,
        is_demo=payload.is_demo,
    )
    db.add(obj)
    db.flush()
    log_action(db, user.id, "content_created", "algorithm", obj.id)
    if payload.status == ContentStatus.published.value:
        publish_obj(db, "algorithms", obj, user)
    else:
        db.commit()
    return serializers.algorithm_detail(db, obj, user)


@router.patch("/algorithms/{algorithm_id}")
def update_algorithm(
    algorithm_id: uuid.UUID,
    payload: AlgorithmUpdateIn,
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    obj = get_admin_entity(db, "algorithms", algorithm_id)
    data = payload.model_dump(exclude_unset=True)
    if "title" in data:
        obj.title = data["title"].strip()
    if "slug" in data:
        obj.slug = unique_slug(db, Algorithm, obj.title, data["slug"], exclude_id=obj.id)
    for field in ["title_en", "cover_image", "sort_order", "is_demo"]:
        if field in data:
            setattr(obj, field, data[field])
    for field in ["summary", "body"]:
        if field in data:
            setattr(obj, field, sanitize_html(data[field]))
    if "translation_en" in data:
        obj.translation_en = {key: sanitize_html(value) for key, value in (data["translation_en"] or {}).items()}
    if "status" in data and data["status"] != obj.status:
        if data["status"] == ContentStatus.published.value:
            obj.status = ContentStatus.published.value
            publish_obj(db, "algorithms", obj, user)
            return serializers.algorithm_detail(db, obj, user)
        obj.status = data["status"]
    log_action(db, user.id, "content_updated", "algorithm", obj.id)
    db.commit()
    return serializers.algorithm_detail(db, obj, user)


@router.post("/algorithms/{algorithm_id}/publish")
def publish_algorithm(
    algorithm_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    obj = get_admin_entity(db, "algorithms", algorithm_id)
    publish_obj(db, "algorithms", obj, user)
    return {"id": str(obj.id), "status": obj.status}


@router.delete("/algorithms/{algorithm_id}", response_model=MessageOut)
def delete_algorithm(
    algorithm_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    obj = get_admin_entity(db, "algorithms", algorithm_id)
    if obj.status == ContentStatus.published.value:
        raise ApiError(409, "archive_instead", "Жарияланған материалды жою мүмкін емес. Архивтеңіз.")
    referenced = (
        db.execute(select(func.count()).select_from(Lesson).where(Lesson.algorithm_id == obj.id)).scalar_one()
        + db.execute(select(func.count()).select_from(Task).where(Task.algorithm_id == obj.id)).scalar_one()
        + db.execute(select(func.count()).select_from(Project).where(Project.algorithm_id == obj.id)).scalar_one()
    )
    if referenced:
        raise ApiError(409, "content_in_use", "Материал басқа мазмұнмен байланысқан, жою мүмкін емес.")
    db.delete(obj)
    db.commit()
    return MessageOut(message="Материал жойылды.")


# ---------------------------------------------------------------------------
# Competencies
# ---------------------------------------------------------------------------


@router.get("/competencies")
def admin_competencies(db: Session = Depends(get_db), user: User = admin_only):
    rows = db.execute(
        select(Competency).order_by(Competency.sort_order, Competency.title)
    ).scalars().all()
    return [
        {
            **serializers.competency_card(item),
            "indicators_json": item.indicators_json,
            "criteria_json": item.criteria_json,
            "sort_order": item.sort_order,
        }
        for item in rows
    ]


@router.get("/competencies/{competency_id}")
def admin_competency_detail(
    competency_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    obj = get_admin_entity(db, "competencies", competency_id)
    return {
        **serializers.competency_detail(db, obj, user),
        "status": obj.status,
        "sort_order": obj.sort_order,
        "published_at": obj.published_at,
    }


def sanitize_competency_translation(data: dict) -> dict:
    return {key: ([sanitize_html(item) for item in value] if isinstance(value, list) else {k: sanitize_html(v) for k, v in value.items()} if isinstance(value, dict) else sanitize_html(value)) for key, value in data.items()}


@router.post("/competencies", status_code=201)
def create_competency(
    payload: CompetencyCreateIn, db: Session = Depends(get_db), user: User = admin_only
):
    obj = Competency(
        title=payload.title.strip(),
        slug=unique_slug(db, Competency, payload.title, payload.slug),
        translation_en=sanitize_competency_translation(payload.translation_en.model_dump()),
        description=sanitize_html(payload.description),
        indicators_json=payload.indicators_json,
        criteria_json=payload.criteria_json,
        status=payload.status,
        sort_order=payload.sort_order,
        is_demo=payload.is_demo,
    )
    db.add(obj)
    db.flush()
    log_action(db, user.id, "content_created", "competency", obj.id)
    if payload.status == ContentStatus.published.value:
        publish_obj(db, "competencies", obj, user)
    else:
        db.commit()
    return serializers.competency_detail(db, obj, user)


@router.patch("/competencies/{competency_id}")
def update_competency(
    competency_id: uuid.UUID,
    payload: CompetencyUpdateIn,
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    obj = get_admin_entity(db, "competencies", competency_id)
    data = payload.model_dump(exclude_unset=True)
    if "translation_en" in data:
        obj.translation_en = sanitize_competency_translation(data["translation_en"] or {})
    if "title" in data:
        obj.title = data["title"].strip()
    if "slug" in data:
        obj.slug = unique_slug(db, Competency, obj.title, data["slug"], exclude_id=obj.id)
    if "description" in data:
        obj.description = sanitize_html(data["description"])
    for field in ["indicators_json", "criteria_json", "sort_order", "is_demo"]:
        if field in data:
            setattr(obj, field, data[field])
    if "status" in data and data["status"] != obj.status:
        if data["status"] == ContentStatus.published.value:
            obj.status = ContentStatus.published.value
            publish_obj(db, "competencies", obj, user)
            return serializers.competency_detail(db, obj, user)
        obj.status = data["status"]
    log_action(db, user.id, "content_updated", "competency", obj.id)
    db.commit()
    return serializers.competency_detail(db, obj, user)


@router.post("/competencies/{competency_id}/publish")
def publish_competency(
    competency_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    obj = get_admin_entity(db, "competencies", competency_id)
    publish_obj(db, "competencies", obj, user)
    return {"id": str(obj.id), "status": obj.status}


@router.delete("/competencies/{competency_id}", response_model=MessageOut)
def delete_competency(
    competency_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    obj = get_admin_entity(db, "competencies", competency_id)
    if obj.status == ContentStatus.published.value:
        raise ApiError(409, "archive_instead", "Жарияланған құзыреттілікті жою мүмкін емес. Архивтеңіз.")
    questions = db.execute(select(AssessmentQuestion)).scalars().all()
    if any(str(competency_id) in (question.competency_ids_json or []) for question in questions):
        raise ApiError(409, "competency_in_use", "Құзыреттілік диагностикада қолданылады.")
    db.delete(obj)
    db.commit()
    return MessageOut(message="Құзыреттілік жойылды.")


# ---------------------------------------------------------------------------
# Lessons
# ---------------------------------------------------------------------------


@router.get("/lessons")
def admin_lessons(db: Session = Depends(get_db), user: User = admin_only):
    rows = db.execute(select(Lesson).order_by(Lesson.order_no)).scalars().all()
    return [
        {
            **serializers.lesson_card(item),
            "status": item.status,
            "goal": item.goal,
            "competency_ids": [str(link.competency_id) for link in item.competency_links],
            "resources": serializers.visible_resources(db, "lesson", item.id, user),
        }
        for item in rows
    ]


@router.get("/lessons/{lesson_id}")
def admin_lesson_detail(lesson_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only):
    obj = get_admin_entity(db, "lessons", lesson_id)
    return {
        **serializers.lesson_detail(db, obj, user),
        "status": obj.status,
        "goal": obj.goal,
        "reflection": obj.reflection,
        "competency_ids": [str(link.competency_id) for link in obj.competency_links],
        "published_at": obj.published_at,
    }


def validate_algorithm_ref(db: Session, algorithm_id: uuid.UUID | None) -> None:
    if algorithm_id is not None and db.get(Algorithm, algorithm_id) is None:
        raise ApiError(422, "invalid_algorithm", "ML алгоритмі табылмады.")


@router.post("/lessons", status_code=201)
def create_lesson(payload: LessonCreateIn, db: Session = Depends(get_db), user: User = admin_only):
    validate_algorithm_ref(db, payload.algorithm_id)
    obj = Lesson(
        title=payload.title.strip(),
        slug=unique_slug(db, Lesson, payload.title, payload.slug),
        algorithm_id=payload.algorithm_id,
        summary=sanitize_html(payload.summary),
        body=sanitize_html(payload.body),
        goal=sanitize_html(payload.goal),
        reflection=sanitize_html(payload.reflection),
        translation_en={key: sanitize_html(value) for key, value in payload.translation_en.model_dump().items()},
        duration_min=payload.duration_min,
        order_no=payload.order_no,
        status=payload.status,
        is_demo=payload.is_demo,
    )
    db.add(obj)
    db.flush()
    set_competencies(db, obj, payload.competency_ids, LessonCompetency, "lesson_id")
    db.flush()
    log_action(db, user.id, "content_created", "lesson", obj.id)
    if payload.status == ContentStatus.published.value:
        publish_obj(db, "lessons", obj, user)
    else:
        db.commit()
    return serializers.lesson_detail(db, obj, user)


@router.patch("/lessons/{lesson_id}")
def update_lesson(
    lesson_id: uuid.UUID,
    payload: LessonUpdateIn,
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    obj = get_admin_entity(db, "lessons", lesson_id)
    data = payload.model_dump(exclude_unset=True)
    if "title" in data:
        obj.title = data["title"].strip()
    if "slug" in data:
        obj.slug = unique_slug(db, Lesson, obj.title, data["slug"], exclude_id=obj.id)
    if "algorithm_id" in data:
        validate_algorithm_ref(db, data["algorithm_id"])
        obj.algorithm_id = data["algorithm_id"]
    for field in ["summary", "body", "goal", "reflection"]:
        if field in data:
            setattr(obj, field, sanitize_html(data[field]))
    if "translation_en" in data:
        obj.translation_en = {key: sanitize_html(value) for key, value in (data["translation_en"] or {}).items()}
    for field in ["duration_min", "order_no", "is_demo"]:
        if field in data:
            setattr(obj, field, data[field])
    if "competency_ids" in data:
        set_competencies(db, obj, data["competency_ids"] or [], LessonCompetency, "lesson_id")
        db.flush()
    if "status" in data and data["status"] != obj.status:
        if data["status"] == ContentStatus.published.value:
            obj.status = ContentStatus.published.value
            publish_obj(db, "lessons", obj, user)
            return serializers.lesson_detail(db, obj, user)
        obj.status = data["status"]
    log_action(db, user.id, "content_updated", "lesson", obj.id)
    db.commit()
    return serializers.lesson_detail(db, obj, user)


@router.post("/lessons/{lesson_id}/publish")
def publish_lesson(lesson_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only):
    obj = get_admin_entity(db, "lessons", lesson_id)
    publish_obj(db, "lessons", obj, user)
    return {"id": str(obj.id), "status": obj.status}


@router.delete("/lessons/{lesson_id}", response_model=MessageOut)
def delete_lesson(lesson_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only):
    obj = get_admin_entity(db, "lessons", lesson_id)
    assigned = db.execute(
        select(func.count()).select_from(Assignment).where(
            Assignment.content_type == "lesson", Assignment.content_id == obj.id
        )
    ).scalar_one()
    if obj.status == ContentStatus.published.value or assigned:
        raise ApiError(409, "archive_instead", "Сабақты жою мүмкін емес. Архивтеңіз.")
    db.delete(obj)
    db.commit()
    return MessageOut(message="Сабақ жойылды.")


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


def apply_task_fields(db: Session, obj: Task, data: dict) -> None:
    if "translation_en" in data:
        obj.translation_en = sanitize_project_translation(data["translation_en"] or {})
    if "title" in data:
        obj.title = data["title"].strip()
    if "slug" in data:
        obj.slug = unique_slug(db, Task, obj.title, data["slug"], exclude_id=obj.id)
    for field in ["lesson_id", "algorithm_id", "project_id"]:
        if field in data:
            setattr(obj, field, data[field])
    for field in ["type", "difficulty", "attempts_limit", "show_correct_answers", "is_demo"]:
        if field in data:
            setattr(obj, field, data[field])
    if "max_score" in data:
        obj.max_score = data["max_score"]
    for field in ["instructions", "body"]:
        if field in data:
            setattr(obj, field, sanitize_html(data[field]))
    if "rubric_json" in data:
        obj.rubric_json = data["rubric_json"]


@router.get("/tasks")
def admin_tasks(db: Session = Depends(get_db), user: User = admin_only):
    rows = db.execute(select(Task).order_by(Task.sort_order, Task.title)).scalars().all()
    return [
        {
            **serializers.task_card(item, user),
            "status": item.status,
            "instructions": item.instructions,
            "competency_ids": [str(link.competency_id) for link in item.competency_links],
            "options": [
                {
                    "id": str(option.id),
                    "label": option.label,
                    "label_en": option.label_en,
                    "is_correct": option.is_correct,
                    "order_no": option.order_no,
                }
                for option in item.options
            ],
        }
        for item in rows
    ]


@router.get("/tasks/{task_id}")
def admin_task_detail(task_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only):
    obj = get_admin_entity(db, "tasks", task_id)
    return {
        **serializers.task_detail(db, obj, user, reveal_answers=True),
        "status": obj.status,
        "competency_ids": [str(link.competency_id) for link in obj.competency_links],
        "options": [
            {
                "id": str(option.id),
                "label": option.label,
                "label_en": option.label_en,
                "is_correct": option.is_correct,
                "order_no": option.order_no,
            }
            for option in obj.options
        ],
        "published_at": obj.published_at,
    }


@router.post("/tasks", status_code=201)
def create_task(payload: TaskCreateIn, db: Session = Depends(get_db), user: User = admin_only):
    validate_algorithm_ref(db, payload.algorithm_id)
    if payload.lesson_id and db.get(Lesson, payload.lesson_id) is None:
        raise ApiError(422, "invalid_lesson", "Сабақ табылмады.")
    if payload.project_id and db.get(Project, payload.project_id) is None:
        raise ApiError(422, "invalid_project", "Жоба табылмады.")
    obj = Task(
        title=payload.title.strip(),
        slug=unique_slug(db, Task, payload.title, payload.slug),
        lesson_id=payload.lesson_id,
        algorithm_id=payload.algorithm_id,
        project_id=payload.project_id,
        type=payload.type,
        difficulty=payload.difficulty,
        translation_en=sanitize_project_translation(payload.translation_en.model_dump()),
        instructions=sanitize_html(payload.instructions),
        body=sanitize_html(payload.body),
        max_score=payload.max_score,
        rubric_json=payload.rubric_json,
        attempts_limit=payload.attempts_limit,
        show_correct_answers=payload.show_correct_answers,
        status=payload.status,
        is_demo=payload.is_demo,
    )
    db.add(obj)
    db.flush()
    set_competencies(db, obj, payload.competency_ids, TaskCompetency, "task_id")
    for option in normalize_options(payload.options):
        option.task_id = obj.id
        db.add(option)
    db.flush()
    log_action(db, user.id, "content_created", "task", obj.id)
    if payload.status == ContentStatus.published.value:
        publish_obj(db, "tasks", obj, user)
    else:
        db.commit()
    return serializers.task_detail(db, obj, user, reveal_answers=True)


@router.patch("/tasks/{task_id}")
def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdateIn,
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    obj = get_admin_entity(db, "tasks", task_id)
    data = payload.model_dump(exclude_unset=True)
    if "lesson_id" in data and data["lesson_id"] is not None and db.get(Lesson, data["lesson_id"]) is None:
        raise ApiError(422, "invalid_lesson", "Сабақ табылмады.")
    if "project_id" in data and data["project_id"] is not None and db.get(Project, data["project_id"]) is None:
        raise ApiError(422, "invalid_project", "Жоба табылмады.")
    apply_task_fields(db, obj, data)
    if "competency_ids" in data:
        set_competencies(db, obj, data["competency_ids"] or [], TaskCompetency, "task_id")
    if "options" in data:
        existing = {option.id: option for option in obj.options}
        retained = set()
        incoming = payload.options or []
        normalized = normalize_options(incoming)
        for source, option in zip(incoming, normalized, strict=True):
            if source.id:
                if source.id not in existing or source.id in retained:
                    raise ApiError(422, "invalid_option", "Жауап нұсқасы табылмады.")
                retained.add(source.id)
                target = existing[source.id]
                target.label, target.label_en = option.label, option.label_en
                target.is_correct, target.order_no = option.is_correct, option.order_no
            else:
                option.task_id = obj.id
                db.add(option)
        for option_id, option in existing.items():
            if option_id not in retained:
                db.delete(option)
        db.flush()
        db.expire(obj, ["options"])
    db.flush()
    db.refresh(obj)
    if "status" in data and data["status"] != obj.status:
        if data["status"] == ContentStatus.published.value:
            obj.status = ContentStatus.published.value
            publish_obj(db, "tasks", obj, user)
            return serializers.task_detail(db, obj, user, reveal_answers=True)
        obj.status = data["status"]
    log_action(db, user.id, "content_updated", "task", obj.id)
    db.commit()
    return serializers.task_detail(db, obj, user, reveal_answers=True)


@router.post("/tasks/{task_id}/publish")
def publish_task(task_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only):
    obj = get_admin_entity(db, "tasks", task_id)
    publish_obj(db, "tasks", obj, user)
    return {"id": str(obj.id), "status": obj.status}


@router.delete("/tasks/{task_id}", response_model=MessageOut)
def delete_task(task_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only):
    obj = get_admin_entity(db, "tasks", task_id)
    assigned = db.execute(
        select(func.count()).select_from(Assignment).where(
            Assignment.content_type == "task", Assignment.content_id == obj.id
        )
    ).scalar_one()
    if obj.status == ContentStatus.published.value or assigned:
        raise ApiError(409, "archive_instead", "Тапсырманы жою мүмкін емес. Архивтеңіз.")
    db.delete(obj)
    db.commit()
    return MessageOut(message="Тапсырма жойылды.")


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------


def sanitize_project_translation(data: dict) -> dict:
    return {key: [sanitize_html(item) for item in value] if isinstance(value, list) else sanitize_html(value) for key, value in data.items()}


def apply_project_fields(db: Session, obj: Project, data: dict) -> None:
    if "translation_en" in data:
        obj.translation_en = sanitize_project_translation(data["translation_en"] or {})
    if "title" in data:
        obj.title = data["title"].strip()
    if "slug" in data:
        obj.slug = unique_slug(db, Project, obj.title, data["slug"], exclude_id=obj.id)
    if "algorithm_id" in data:
        validate_algorithm_ref(db, data["algorithm_id"])
        obj.algorithm_id = data["algorithm_id"]
    for field in ["body", "summary", "problem", "goal", "expected_result"]:
        if field in data:
            setattr(obj, field, sanitize_html(data[field]))
    for field in ["steps_json", "materials_json", "tools_json", "rubric_json", "sort_order", "is_demo"]:
        if field in data:
            setattr(obj, field, data[field])


@router.get("/projects")
def admin_projects(db: Session = Depends(get_db), user: User = admin_only):
    rows = db.execute(select(Project).order_by(Project.sort_order, Project.title)).scalars().all()
    return [
        {
            **serializers.project_card(item),
            "status": item.status,
            "problem": item.problem,
            "goal": item.goal,
            "steps_json": item.steps_json,
            "materials_json": item.materials_json,
            "tools_json": item.tools_json,
            "expected_result": item.expected_result,
            "rubric_json": item.rubric_json,
            "competency_ids": [str(link.competency_id) for link in item.competency_links],
            "resources": serializers.visible_resources(db, "project", item.id, user),
        }
        for item in rows
    ]


@router.get("/projects/{project_id}")
def admin_project_detail(
    project_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    obj = get_admin_entity(db, "projects", project_id)
    return {
        **serializers.project_detail(db, obj, user),
        "status": obj.status,
        "competency_ids": [str(link.competency_id) for link in obj.competency_links],
        "published_at": obj.published_at,
    }


@router.post("/projects", status_code=201)
def create_project(payload: ProjectCreateIn, db: Session = Depends(get_db), user: User = admin_only):
    validate_algorithm_ref(db, payload.algorithm_id)
    obj = Project(
        title=payload.title.strip(),
        slug=unique_slug(db, Project, payload.title, payload.slug),
        algorithm_id=payload.algorithm_id,
        translation_en=sanitize_project_translation(payload.translation_en.model_dump()),
        summary=sanitize_html(payload.summary),
        problem=sanitize_html(payload.problem),
        goal=sanitize_html(payload.goal),
        body=sanitize_html(payload.body),
        steps_json=payload.steps_json,
        materials_json=payload.materials_json,
        tools_json=payload.tools_json,
        expected_result=sanitize_html(payload.expected_result),
        rubric_json=payload.rubric_json,
        status=payload.status,
        sort_order=payload.sort_order,
        is_demo=payload.is_demo,
    )
    db.add(obj)
    db.flush()
    set_competencies(db, obj, payload.competency_ids, ProjectCompetency, "project_id")
    db.flush()
    log_action(db, user.id, "content_created", "project", obj.id)
    if payload.status == ContentStatus.published.value:
        publish_obj(db, "projects", obj, user)
    else:
        db.commit()
    return serializers.project_detail(db, obj, user)


@router.patch("/projects/{project_id}")
def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdateIn,
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    obj = get_admin_entity(db, "projects", project_id)
    data = payload.model_dump(exclude_unset=True)
    apply_project_fields(db, obj, data)
    if "competency_ids" in data:
        set_competencies(db, obj, data["competency_ids"] or [], ProjectCompetency, "project_id")
    db.flush()
    if "status" in data and data["status"] != obj.status:
        if data["status"] == ContentStatus.published.value:
            obj.status = ContentStatus.published.value
            publish_obj(db, "projects", obj, user)
            return serializers.project_detail(db, obj, user)
        obj.status = data["status"]
    log_action(db, user.id, "content_updated", "project", obj.id)
    db.commit()
    return serializers.project_detail(db, obj, user)


@router.post("/projects/{project_id}/publish")
def publish_project(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only):
    obj = get_admin_entity(db, "projects", project_id)
    publish_obj(db, "projects", obj, user)
    return {"id": str(obj.id), "status": obj.status}


@router.delete("/projects/{project_id}", response_model=MessageOut)
def delete_project(project_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only):
    obj = get_admin_entity(db, "projects", project_id)
    assigned = db.execute(
        select(func.count()).select_from(Assignment).where(
            Assignment.content_type == "project", Assignment.content_id == obj.id
        )
    ).scalar_one()
    if obj.status == ContentStatus.published.value or assigned:
        raise ApiError(409, "archive_instead", "Жобаны жою мүмкін емес. Архивтеңіз.")
    db.delete(obj)
    db.commit()
    return MessageOut(message="Жоба жойылды.")


# ---------------------------------------------------------------------------
# Assessments (diagnostics)
# ---------------------------------------------------------------------------


def assessment_admin_payload(obj: Assessment, db: Session) -> dict:
    card = serializers.assessment_card(db, obj)
    return {
        **card,
        "instructions": obj.instructions,
        "scoring_config_json": obj.scoring_config_json,
        "show_correct_answers": obj.show_correct_answers,
        "published_at": obj.published_at,
        "questions": [serializers.question_student(item, reveal=True) for item in obj.questions],
    }


@router.get("/assessments")
def admin_assessments(db: Session = Depends(get_db), user: User = admin_only):
    rows = db.execute(select(Assessment).order_by(Assessment.kind, Assessment.name)).scalars().all()
    return [assessment_admin_payload(item, db) for item in rows]


@router.get("/assessments/{assessment_id}")
def admin_assessment_detail(
    assessment_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    obj = get_admin_entity(db, "assessments", assessment_id)
    return assessment_admin_payload(obj, db)


@router.post("/assessments", status_code=201)
def create_assessment(
    payload: AssessmentCreateIn, db: Session = Depends(get_db), user: User = admin_only
):
    questions = assessment_questions_payload(db, payload.questions, payload.kind)
    obj = Assessment(
        name=payload.name.strip(),
        slug=unique_slug(db, Assessment, payload.name, payload.slug),
        kind=payload.kind,
        version=payload.version,
        methodology_key=payload.methodology_key,
        translation_en={key: sanitize_html(value) for key, value in payload.translation_en.model_dump().items()},
        description=sanitize_html(payload.description),
        instructions=sanitize_html(payload.instructions),
        scoring_config_json=payload.scoring_config_json or default_scoring_config(db),
        attempts_limit=payload.attempts_limit,
        show_correct_answers=payload.show_correct_answers,
        status=payload.status,
        is_demo=payload.is_demo,
    )
    db.add(obj)
    db.flush()
    for question in questions:
        question.assessment_id = obj.id
        db.add(question)
    db.flush()
    log_action(db, user.id, "content_created", "assessment", obj.id)
    if payload.status == ContentStatus.published.value:
        publish_obj(db, "assessments", obj, user)
    else:
        db.commit()
    return assessment_admin_payload(obj, db)


@router.patch("/assessments/{assessment_id}")
def update_assessment(
    assessment_id: uuid.UUID,
    payload: AssessmentUpdateIn,
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    obj = get_admin_entity(db, "assessments", assessment_id)
    data = payload.model_dump(exclude_unset=True)
    attempts_count = db.execute(
        select(func.count()).select_from(AssessmentAttempt).where(
            AssessmentAttempt.assessment_id == obj.id
        )
    ).scalar_one()
    structural = {"questions", "scoring_config_json", "kind", "methodology_key", "version"}
    if attempts_count and structural.intersection(data.keys()):
        raise ApiError(
            409,
            "assessment_has_attempts",
            "Аяқталған талпыныстар бар. Құрылымды өзгерту үшін жаңа нұсқа жасаңыз.",
        )
    if "translation_en" in data:
        obj.translation_en = {key: sanitize_html(value) for key, value in (data["translation_en"] or {}).items()}
    if "name" in data:
        obj.name = data["name"].strip()
    if "slug" in data:
        obj.slug = unique_slug(db, Assessment, obj.name, data["slug"], exclude_id=obj.id)
    for field in ["description", "instructions"]:
        if field in data:
            setattr(obj, field, sanitize_html(data[field]))
    for field in ["kind", "version", "methodology_key", "attempts_limit", "show_correct_answers", "is_demo"]:
        if field in data:
            setattr(obj, field, data[field])
    if "scoring_config_json" in data:
        obj.scoring_config_json = data["scoring_config_json"] or default_scoring_config(db)
    if "questions" in data:
        for question in list(obj.questions):
            db.delete(question)
        db.flush()
        for question in assessment_questions_payload(db, payload.questions or [], obj.kind):
            question.assessment_id = obj.id
            db.add(question)
    db.flush()
    db.refresh(obj)
    if "status" in data and data["status"] != obj.status:
        if data["status"] == ContentStatus.published.value:
            obj.status = ContentStatus.published.value
            publish_obj(db, "assessments", obj, user)
            return assessment_admin_payload(obj, db)
        obj.status = data["status"]
    log_action(db, user.id, "content_updated", "assessment", obj.id)
    db.commit()
    return assessment_admin_payload(obj, db)


@router.post("/assessments/{assessment_id}/publish")
def publish_assessment(
    assessment_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    obj = get_admin_entity(db, "assessments", assessment_id)
    publish_obj(db, "assessments", obj, user)
    return {"id": str(obj.id), "status": obj.status, "version": obj.version}


@router.post("/assessments/{assessment_id}/new-version", status_code=201)
def new_assessment_version(
    assessment_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    obj = get_admin_entity(db, "assessments", assessment_id)
    existing_versions = db.execute(
        select(Assessment.version).where(
            Assessment.methodology_key == obj.methodology_key, Assessment.kind == obj.kind
        )
    ).scalars().all()
    clone = Assessment(
        name=obj.name,
        slug=unique_slug(db, Assessment, obj.name, f"{obj.slug}-v{max(existing_versions, default=obj.version) + 1}"),
        kind=obj.kind,
        version=max(existing_versions, default=obj.version) + 1,
        methodology_key=obj.methodology_key,
        description=obj.description,
        translation_en=dict(obj.translation_en or {}),
        instructions=obj.instructions,
        scoring_config_json=obj.scoring_config_json,
        attempts_limit=obj.attempts_limit,
        show_correct_answers=obj.show_correct_answers,
        status=ContentStatus.draft.value,
        is_demo=obj.is_demo,
    )
    db.add(clone)
    db.flush()
    for question in obj.questions:
        db.add(
            AssessmentQuestion(
                assessment_id=clone.id,
                type=question.type,
                body=question.body,
                body_en=question.body_en,
                competency_id=question.competency_id,
                competency_ids_json=list(question.competency_ids_json or []),
                competency_weights_json=dict(question.competency_weights_json or {}),
                points=question.points,
                options_json=question.options_json,
                order_no=question.order_no,
            )
        )
    log_action(db, user.id, "assessment_version_created", "assessment", clone.id, {"source": str(obj.id)})
    db.commit()
    return assessment_admin_payload(clone, db)


@router.delete("/assessments/{assessment_id}", response_model=MessageOut)
def delete_assessment(
    assessment_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    obj = get_admin_entity(db, "assessments", assessment_id)
    attempts = db.execute(
        select(func.count()).select_from(AssessmentAttempt).where(
            AssessmentAttempt.assessment_id == obj.id
        )
    ).scalar_one()
    if obj.status == ContentStatus.published.value or attempts:
        raise ApiError(409, "archive_instead", "Диагностиканы жою мүмкін емес. Архивтеңіз.")
    db.delete(obj)
    db.commit()
    return MessageOut(message="Диагностика жойылды.")


# ---------------------------------------------------------------------------
# Files / resources
# ---------------------------------------------------------------------------


@router.post("/uploads", response_model=ResourceOut, status_code=201)
async def admin_upload(
    file: UploadFile = File(...),
    entity_type: str = Form(...),
    entity_id: uuid.UUID = Form(...),
    audience: str = Form(default="student"),
    title: str | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    if entity_type not in {"algorithm", "competency", "lesson", "task", "project", "assessment"}:
        raise ApiError(422, "invalid_entity", "Файлды тіркеу нысаны қате.")
    if audience not in {item.value for item in Audience}:
        raise ApiError(422, "invalid_audience", "Аудитория мәні қате.")
    model = MODEL_MAP.get(f"{entity_type}s")
    if model is None:
        from app.models.content import Algorithm as AlgorithmModel

        model = {"algorithm": AlgorithmModel, "competency": Competency}.get(entity_type)
    parent = db.get(model, entity_id) if model else None
    if parent is None:
        raise ApiError(404, "not_found", "Файл тіркелетін материал табылмады.")
    stored = await save_upload(file, subdir=entity_type)
    resource = Resource(
        entity_type=entity_type,
        entity_id=entity_id,
        audience=audience,
        kind=ResourceKind.file.value,
        title=(title or stored.original_filename)[:250],
        file_key=stored.file_key,
        original_filename=stored.original_filename,
        mime=stored.mime,
        size=stored.size,
        uploaded_by=user.id,
        created_at=datetime.now(UTC),
    )
    db.add(resource)
    db.flush()
    log_action(db, user.id, "resource_uploaded", "resource", resource.id)
    db.commit()
    return serializers.resource_out(resource)


@router.post("/resources", response_model=ResourceOut, status_code=201)
def create_resource_link(
    payload: ResourceLinkCreateIn, db: Session = Depends(get_db), user: User = admin_only
):
    model = MODEL_MAP.get(f"{payload.entity_type}s")
    if model is None:
        model = {"algorithm": Algorithm, "competency": Competency}.get(payload.entity_type)
    if model is None or db.get(model, payload.entity_id) is None:
        raise ApiError(404, "not_found", "Материал табылмады.")
    resource = Resource(
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        audience=payload.audience,
        kind=ResourceKind.link.value,
        title=payload.title.strip(),
        url=str(payload.url),
        uploaded_by=user.id,
        created_at=datetime.now(UTC),
    )
    db.add(resource)
    db.flush()
    log_action(db, user.id, "resource_link_created", "resource", resource.id)
    db.commit()
    return serializers.resource_out(resource)


@router.get("/resources", response_model=Page[ResourceOut])
def admin_resources(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    entity_type: str | None = None,
    audience: str | None = None,
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    query = select(Resource)
    if entity_type:
        query = query.where(Resource.entity_type == entity_type)
    if audience:
        query = query.where(Resource.audience == audience)
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(Resource.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    return Page(
        items=[serializers.resource_out(item) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.patch("/resources/{resource_id}", response_model=ResourceOut)
def update_resource(
    resource_id: uuid.UUID,
    payload: ResourceUpdateIn,
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise not_found("Файл")
    if payload.title is not None:
        resource.title = payload.title.strip()
    if payload.audience is not None:
        resource.audience = payload.audience
    if payload.url is not None:
        if resource.kind != ResourceKind.link.value:
            raise ApiError(422, "not_a_link", "Файл ресурсының сілтемесін өзгерту мүмкін емес.")
        resource.url = str(payload.url)
    db.commit()
    return serializers.resource_out(resource)


@router.delete("/resources/{resource_id}", response_model=MessageOut)
def delete_resource(
    resource_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise not_found("Файл")
    if resource.file_key:
        referenced = db.execute(
            select(SubmissionFile).where(SubmissionFile.file_key == resource.file_key)
        ).scalar_one_or_none()
        if referenced is not None:
            raise ApiError(409, "file_in_use", "Файл тапсырылған жұмысқа тіркелген, жою мүмкін емес.")
        delete_stored_file(resource.file_key)
    db.delete(resource)
    db.commit()
    return MessageOut(message="Ресурс жойылды.")


# ---------------------------------------------------------------------------
# Users / classes / audit
# ---------------------------------------------------------------------------


def temp_password() -> str:
    return f"Ml{secrets.token_hex(4)}7!"


@router.get("/users", response_model=Page[UserAdminOut])
def admin_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    role: str | None = None,
    status: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    query = select(User)
    if role:
        query = query.where(User.role == role)
    if status:
        query = query.where(User.status == status)
    if q:
        query = query.where(or_(User.email.ilike(f"%{q}%"), User.display_name.ilike(f"%{q}%")))
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(User.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    return Page(
        items=[UserAdminOut.model_validate(item) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/users/invite-teacher", status_code=201)
def invite_teacher(
    payload: StaffCreateIn, db: Session = Depends(get_db), user: User = admin_only
):
    from app.core.security import hash_password

    email = payload.email.strip().lower()
    if db.execute(select(User).where(User.email == email)).scalar_one_or_none():
        raise ApiError(409, "email_taken", "Бұл email тіркелген.")
    password = payload.password or temp_password()
    created = User(
        email=email,
        password_hash=hash_password(password),
        display_name=payload.display_name.strip(),
        role=payload.role,
        status="active",
        must_change_password=payload.password is None,
    )
    db.add(created)
    db.flush()
    log_action(db, user.id, "staff_invited", "user", created.id, {"role": created.role})
    db.commit()
    return {
        "user": UserAdminOut.model_validate(created).model_dump(),
        "temporary_password": None if payload.password else password,
        "must_change_password": created.must_change_password,
    }


@router.patch("/users/{user_id}", response_model=UserAdminOut)
def update_user(
    user_id: uuid.UUID,
    payload: UserPatchIn,
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    target = db.get(User, user_id)
    if target is None:
        raise not_found("Пайдаланушы")
    if target.id == user.id and payload.status == "disabled":
        raise ApiError(422, "self_disable", "Өз аккаунтыңызды өшіре алмайсыз.")
    if payload.display_name is not None:
        target.display_name = payload.display_name.strip()
    if payload.status is not None:
        target.status = payload.status
    if payload.role is not None:
        target.role = payload.role
    log_action(db, user.id, "user_updated", "user", target.id, payload.model_dump(exclude_unset=True))
    db.commit()
    return UserAdminOut.model_validate(target)


@router.post("/users/{user_id}/reset-password", response_model=PasswordResetOut)
def reset_password(
    user_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    from app.core.security import hash_password

    target = db.get(User, user_id)
    if target is None:
        raise not_found("Пайдаланушы")
    password = temp_password()
    target.password_hash = hash_password(password)
    target.must_change_password = True
    log_action(db, user.id, "password_reset", "user", target.id)
    db.commit()
    return PasswordResetOut(user_id=target.id, temporary_password=password)


@router.delete("/users/{user_id}", response_model=MessageOut)
def deactivate_user(
    user_id: uuid.UUID, db: Session = Depends(get_db), user: User = admin_only
):
    target = db.get(User, user_id)
    if target is None:
        raise not_found("Пайдаланушы")
    if target.id == user.id:
        raise ApiError(422, "self_disable", "Өз аккаунтыңызды өшіре алмайсыз.")
    target.status = "disabled"
    log_action(db, user.id, "user_deactivated", "user", target.id)
    db.commit()
    return MessageOut(message="Аккаунт өшірілді.")


@router.get("/classes", response_model=Page[ClassroomOut])
def admin_classes(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    query = select(Classroom)
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(Classroom.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    items = []
    for classroom in rows:
        items.append(
            {
                "id": classroom.id,
                "title": classroom.title,
                "status": classroom.status,
                "join_code": classroom.join_code,
                "member_count": db.execute(
                    select(func.count()).select_from(ClassroomMember).where(
                        ClassroomMember.classroom_id == classroom.id
                    )
                ).scalar_one(),
                "teacher_name": classroom.teacher.display_name if classroom.teacher else None,
                "created_at": classroom.created_at,
            }
        )
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.get("/audit-logs", response_model=Page[AuditLogOut])
def admin_audit_logs(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = admin_only,
):
    from app.models.audit import AuditLog

    query = select(AuditLog)
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    return Page(
        items=[AuditLogOut.model_validate(item) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )
