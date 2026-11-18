import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, Query
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_optional_user, require_roles
from app.core.errors import ApiError
from app.db.session import get_db
from app.models.classroom import Assignment, LessonProgress
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
)
from app.models.enums import ResourceKind, Role
from app.models.user import User
from app.schemas.common import Page
from app.schemas.content import (
    AlgorithmCard,
    AlgorithmDetail,
    CompetencyCard,
    CompetencyDetail,
    LessonCard,
    LessonDetail,
    MatrixRow,
    ProjectCard,
    ProjectDetail,
    TaskCard,
    TaskDetail,
)
from app.services import serializers
from app.services.access import content_is_visible, ensure_classroom_access, not_found
from app.services.storage import storage_path

router = APIRouter(tags=["catalog"])


def _page(db: Session, query, page: int, page_size: int):
    total = db.execute(
        select(func.count()).select_from(query.order_by(None).subquery())
    ).scalar_one()
    items = db.execute(
        query.offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()
    return items, total


@router.get("/algorithms", response_model=Page[AlgorithmCard])
def list_algorithms(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = None,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    query = select(Algorithm).where(Algorithm.status == "published")
    if q:
        query = query.where(
            or_(Algorithm.title.ilike(f"%{q}%"), Algorithm.title_en.ilike(f"%{q}%"), Algorithm.summary.ilike(f"%{q}%"), Algorithm.translation_en["summary"].as_string().ilike(f"%{q}%"))
        )
    query = query.order_by(Algorithm.sort_order, Algorithm.title)
    items, total = _page(db, query, page, page_size)
    return Page(
        items=[serializers.algorithm_card(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/algorithms/{slug}", response_model=AlgorithmDetail)
def get_algorithm(
    slug: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    algorithm = db.execute(select(Algorithm).where(Algorithm.slug == slug)).scalar_one_or_none()
    if algorithm is None or not content_is_visible(algorithm, user):
        raise not_found("Алгоритм")
    return serializers.algorithm_detail(db, algorithm, user)


@router.get("/competencies", response_model=Page[CompetencyCard])
def list_competencies(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    query = (
        select(Competency)
        .where(Competency.status == "published")
        .order_by(Competency.sort_order, Competency.title)
    )
    items, total = _page(db, query, page, page_size)
    return Page(
        items=[serializers.competency_card(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/competencies/{slug}", response_model=CompetencyDetail)
def get_competency(
    slug: str,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    competency = db.execute(
        select(Competency).where(Competency.slug == slug)
    ).scalar_one_or_none()
    if competency is None or not content_is_visible(competency, user):
        raise not_found("Құзыреттілік")
    return serializers.competency_detail(db, competency, user)


@router.get("/matrix", response_model=list[MatrixRow])
def get_matrix(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return serializers.matrix_rows(db, user)


@router.get("/lessons", response_model=Page[LessonCard])
def list_lessons(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = None,
    algorithm_id: uuid.UUID | None = None,
    competency_id: uuid.UUID | None = None,
    sort: str = Query(default="order", pattern="^(order|title|date)$"),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    query = select(Lesson).where(Lesson.status == "published")
    if q:
        query = query.where(or_(Lesson.title.ilike(f"%{q}%"), Lesson.summary.ilike(f"%{q}%"), Lesson.translation_en["title"].as_string().ilike(f"%{q}%"), Lesson.translation_en["summary"].as_string().ilike(f"%{q}%")))
    if algorithm_id:
        query = query.where(Lesson.algorithm_id == algorithm_id)
    if competency_id:
        query = query.where(
            Lesson.competency_links.any(LessonCompetency.competency_id == competency_id)
        )
    if sort == "date":
        query = query.order_by(Lesson.created_at.desc(), Lesson.id)
    elif sort == "title":
        query = query.order_by(Lesson.title, Lesson.id)
    else:
        query = query.order_by(Lesson.order_no, Lesson.title, Lesson.id)
    items, total = _page(db, query, page, page_size)
    completed_ids: set[uuid.UUID] = set()
    if user and user.role == Role.student.value:
        completed_ids = {
            row.lesson_id
            for row in db.execute(
                select(LessonProgress).where(LessonProgress.student_id == user.id)
            ).scalars().all()
        }
    return Page(
        items=[serializers.lesson_card(item, item.id in completed_ids) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/lessons/{lesson_id}", response_model=LessonDetail)
def get_lesson(
    lesson_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None or not content_is_visible(lesson, user):
        raise not_found("Сабақ")
    return serializers.lesson_detail(db, lesson, user)


@router.post("/lessons/{lesson_id}/complete", response_model=dict)
def complete_lesson(
    lesson_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.student.value)),
):
    lesson = db.get(Lesson, lesson_id)
    if lesson is None or lesson.status != "published":
        raise not_found("Сабақ")
    existing = db.execute(
        select(LessonProgress).where(
            LessonProgress.student_id == user.id, LessonProgress.lesson_id == lesson_id
        )
    ).scalar_one_or_none()
    if existing is None:
        from datetime import UTC, datetime

        existing = LessonProgress(
            student_id=user.id,
            lesson_id=lesson_id,
            completed_at=datetime.now(UTC),
        )
        db.add(existing)
        db.commit()
    return {"lesson_id": str(lesson_id), "completed": True}


@router.get("/tasks", response_model=Page[TaskCard])
def list_tasks(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = None,
    algorithm_id: uuid.UUID | None = None,
    competency_id: uuid.UUID | None = None,
    lesson_id: uuid.UUID | None = None,
    classroom_id: uuid.UUID | None = None,
    difficulty: str | None = None,
    type: str | None = None,
    sort: str = Query(default="order", pattern="^(order|difficulty|title|date)$"),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    query = select(Task).where(Task.status == "published")
    if classroom_id:
        if user is None:
            raise ApiError(401, "unauthorized", "Алдымен жүйеге кіріңіз.")
        ensure_classroom_access(db, user, classroom_id)
        query = query.where(Task.id.in_(select(Assignment.content_id).where(
            Assignment.classroom_id == classroom_id,
            Assignment.content_type == "task",
            Assignment.status == "active",
        )))
    if q:
        query = query.where(or_(Task.title.ilike(f"%{q}%"), Task.instructions.ilike(f"%{q}%"), Task.translation_en["title"].as_string().ilike(f"%{q}%"), Task.translation_en["instructions"].as_string().ilike(f"%{q}%")))
    if algorithm_id:
        query = query.where(Task.algorithm_id == algorithm_id)
    if lesson_id:
        query = query.where(Task.lesson_id == lesson_id)
    if difficulty:
        query = query.where(Task.difficulty == difficulty)
    if type:
        query = query.where(Task.type == type)
    if competency_id:
        query = query.where(Task.competency_links.any(TaskCompetency.competency_id == competency_id))
    if sort == "difficulty":
        query = query.order_by(
            case((Task.difficulty == "easy", 0), (Task.difficulty == "medium", 1),
                 (Task.difficulty == "hard", 2), else_=3), Task.title, Task.id
        )
    elif sort == "date":
        query = query.order_by(Task.created_at.desc(), Task.id)
    elif sort == "title":
        query = query.order_by(Task.title)
    else:
        query = query.order_by(Task.sort_order, Task.title)
    items, total = _page(db, query, page, page_size)
    return Page(
        items=[serializers.task_card(item, user) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/tasks/{task_id}", response_model=TaskDetail)
def get_task(
    task_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    task = db.get(Task, task_id)
    if task is None or not content_is_visible(task, user):
        raise not_found("Тапсырма")
    return serializers.task_detail(db, task, user, reveal_answers=True)


@router.get("/projects", response_model=Page[ProjectCard])
def list_projects(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: str | None = None,
    algorithm_id: uuid.UUID | None = None,
    competency_id: uuid.UUID | None = None,
    sort: str = Query(default="order", pattern="^(order|title|date)$"),
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    query = select(Project).where(Project.status == "published")
    if q:
        query = query.where(
            or_(Project.title.ilike(f"%{q}%"), Project.summary.ilike(f"%{q}%"), Project.translation_en["title"].as_string().ilike(f"%{q}%"), Project.translation_en["summary"].as_string().ilike(f"%{q}%"))
        )
    if algorithm_id:
        query = query.where(Project.algorithm_id == algorithm_id)
    if competency_id:
        query = query.where(Project.competency_links.any(ProjectCompetency.competency_id == competency_id))
    if sort == "date":
        query = query.order_by(Project.created_at.desc(), Project.id)
    elif sort == "title":
        query = query.order_by(Project.title, Project.id)
    else:
        query = query.order_by(Project.sort_order, Project.title, Project.id)
    items, total = _page(db, query, page, page_size)
    return Page(
        items=[serializers.project_card(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/projects/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    project = db.get(Project, project_id)
    if project is None or not content_is_visible(project, user):
        raise not_found("Жоба")
    return serializers.project_detail(db, project, user)


@router.get("/resources/{resource_id}/download")
def download_resource(
    resource_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    resource = db.get(Resource, resource_id)
    if resource is None:
        raise not_found("Файл")
    if not serializers.can_view_audience(resource.audience, user):
        raise ApiError(403, "forbidden", "Бұл файлға рұқсатыңыз жоқ.")
    parent = None
    if resource.entity_type in {"algorithm", "lesson", "task", "project", "assessment", "competency"}:
        from app.services.access import CONTENT_MODELS

        model = CONTENT_MODELS.get(resource.entity_type)
        if model is not None:
            parent = db.get(model, resource.entity_id)
            if parent is None or not content_is_visible(parent, user):
                raise not_found("Файл")
    if resource.kind == ResourceKind.link.value and resource.url:
        return RedirectResponse(resource.url)
    if not resource.file_key:
        raise not_found("Файл")
    path = storage_path(resource.file_key)
    if not Path(path).exists():
        raise not_found("Файл")
    return FileResponse(
        path,
        media_type=resource.mime or "application/octet-stream",
        filename=resource.original_filename or Path(resource.file_key).name,
        headers={"Cache-Control": "private, no-store"},
    )
