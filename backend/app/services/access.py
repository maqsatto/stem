import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.models.assessment import Assessment
from app.models.classroom import Assignment, Classroom, ClassroomMember
from app.models.content import Algorithm, Competency, Lesson, Project, Task
from app.models.enums import ContentStatus, Role
from app.models.user import User

CONTENT_MODELS = {
    "algorithm": Algorithm,
    "lesson": Lesson,
    "task": Task,
    "project": Project,
    "assessment": Assessment,
    "competency": Competency,
}


def not_found(what: str = "Материал") -> ApiError:
    return ApiError(404, "not_found", f"{what} табылмады.")


def is_admin(user: User | None) -> bool:
    return bool(user and user.role == Role.admin.value)


def is_teacher(user: User | None) -> bool:
    return bool(user and user.role == Role.teacher.value)


def get_classroom(db: Session, classroom_id: uuid.UUID) -> Classroom:
    classroom = db.get(Classroom, classroom_id)
    if classroom is None:
        raise not_found("Сынып")
    return classroom


def ensure_classroom_access(db: Session, user: User, classroom_id: uuid.UUID) -> Classroom:
    classroom = get_classroom(db, classroom_id)
    if user.role == Role.admin.value:
        return classroom
    if user.role == Role.teacher.value:
        if classroom.teacher_id != user.id:
            raise not_found("Сынып")
        return classroom
    membership = db.execute(
        select(ClassroomMember).where(
            ClassroomMember.classroom_id == classroom_id,
            ClassroomMember.student_id == user.id,
        )
    ).scalar_one_or_none()
    if membership is None:
        raise not_found("Сынып")
    return classroom


def ensure_classroom_teacher(db: Session, user: User, classroom_id: uuid.UUID) -> Classroom:
    classroom = get_classroom(db, classroom_id)
    if user.role == Role.admin.value:
        return classroom
    if user.role != Role.teacher.value or classroom.teacher_id != user.id:
        raise not_found("Сынып")
    return classroom


def ensure_assignment_teacher(db: Session, user: User, assignment_id: uuid.UUID) -> Assignment:
    assignment = db.get(Assignment, assignment_id)
    if assignment is None:
        raise not_found("Тапсырма")
    ensure_classroom_teacher(db, user, assignment.classroom_id)
    return assignment


def content_is_visible(content, user: User | None) -> bool:
    if content is None:
        return False
    if user and user.role == Role.admin.value:
        return True
    return content.status == ContentStatus.published.value


def get_content(
    db: Session, content_type: str, content_id: uuid.UUID, user: User | None
) -> Algorithm | Lesson | Task | Project | Assessment | Competency:
    model = CONTENT_MODELS.get(content_type)
    if model is None:
        raise not_found("Мазмұн түрі")
    content = db.get(model, content_id)
    if content is None or not content_is_visible(content, user):
        raise not_found("Материал")
    return content


def ensure_same_classroom(db: Session, student: User, classroom_id: uuid.UUID) -> None:
    membership = db.execute(
        select(ClassroomMember).where(
            ClassroomMember.classroom_id == classroom_id,
            ClassroomMember.student_id == student.id,
        )
    ).scalar_one_or_none()
    if membership is None:
        raise not_found("Сынып")
