import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_roles
from app.core.errors import ApiError
from app.db.session import get_db
from app.models.assessment import Assessment
from app.models.classroom import (
    Assignment,
    AssignmentProgress,
    Classroom,
    ClassroomMember,
    Submission,
    SubmissionFile,
)
from app.models.content import Lesson, Project, Resource, Task
from app.models.enums import (
    AssignmentContentType,
    AssignmentStatus,
    Role,
    SubmissionStatus,
    TaskType,
)
from app.models.user import User
from app.schemas.classroom import (
    AssignmentCreateIn,
    AssignmentOut,
    AssignmentUpdateIn,
    ClassroomCreateIn,
    ClassroomDetail,
    ClassroomOut,
    ClassroomUpdateIn,
    JoinClassIn,
    JoinClassOut,
    MemberOut,
    ReviewIn,
    SubmissionCreateIn,
    SubmissionListOut,
    SubmissionOut,
)
from app.schemas.common import Page
from app.services.access import (
    ensure_assignment_teacher,
    ensure_classroom_access,
    ensure_classroom_teacher,
    get_classroom,
    not_found,
)
from app.services.audit import log_action
from app.services.scoring import grade_task

router = APIRouter(tags=["classrooms"])
ASSIGNABLE = {
    "lesson": Lesson,
    "task": Task,
    "project": Project,
    "assessment": Assessment,
}
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CLOSED_TYPES = {TaskType.single_choice.value, TaskType.multiple_choice.value}


def generate_join_code(db: Session) -> str:
    for _ in range(50):
        code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(6))
        exists = db.execute(select(Classroom.id).where(Classroom.join_code == code)).first()
        if not exists:
            return code
    raise ApiError(500, "code_generation_failed", "Кодты жасау мүмкін болмады. Қайталаңыз.")


def member_count(db: Session, classroom_id: uuid.UUID) -> int:
    return db.execute(
        select(func.count()).select_from(ClassroomMember).where(
            ClassroomMember.classroom_id == classroom_id
        )
    ).scalar_one()


def classroom_out(db: Session, classroom: Classroom, include_code: bool) -> dict:
    return {
        "id": classroom.id,
        "title": classroom.title,
        "status": classroom.status,
        "join_code": classroom.join_code if include_code else None,
        "member_count": member_count(db, classroom.id),
        "teacher_name": classroom.teacher.display_name if classroom.teacher else None,
        "created_at": classroom.created_at,
    }


def assignment_content(db: Session, content_type: str, content_id: uuid.UUID):
    model = ASSIGNABLE.get(content_type)
    if model is None:
        raise ApiError(422, "invalid_content_type", "Тапсырма түрі қолдау көрсетілмейді.")
    return db.get(model, content_id)


def submission_for(db: Session, assignment_id: uuid.UUID, student_id: uuid.UUID):
    return db.execute(
        select(Submission).where(
            Submission.assignment_id == assignment_id, Submission.student_id == student_id
        )
    ).scalar_one_or_none()


def assignment_max_score(db: Session, assignment: Assignment) -> int | None:
    content = assignment_content(db, assignment.content_type, assignment.content_id)
    if isinstance(content, Task):
        return content.max_score
    if isinstance(content, Project):
        return 100
    if isinstance(content, Assessment):
        return sum(question.points for question in content.questions)
    return None


def submission_out(db: Session, submission: Submission, reveal_answers: bool = False) -> dict:
    assignment = submission.assignment
    content = assignment_content(db, assignment.content_type, assignment.content_id)
    correct_ids = None
    correct_labels = None
    if (
        reveal_answers
        and submission.auto_checked
        and isinstance(content, Task)
        and content.type in CLOSED_TYPES
    ):
        correct_ids = [str(option.id) for option in content.options if option.is_correct]
        correct_labels = [option.label for option in content.options if option.is_correct]
    return {
        "id": submission.id,
        "assignment_id": submission.assignment_id,
        "student_id": submission.student_id,
        "student_name": submission.student.display_name if submission.student else None,
        "text": submission.text,
        "link": submission.link,
        "submitted_at": submission.submitted_at,
        "status": submission.status,
        "grade": submission.grade,
        "feedback": submission.feedback,
        "reviewed_at": submission.reviewed_at,
        "max_score": assignment_max_score(db, assignment),
        "auto_checked": submission.auto_checked,
        "attempts_count": submission.attempts_count,
        "answers_json": submission.answers_json or {},
        "correct_option_ids": correct_ids,
        "correct_labels": correct_labels,
        "files": [
            {
                "id": file.id,
                "filename": file.filename,
                "mime": file.mime,
                "size": file.size,
                "download_url": f"/api/v1/submission-files/{file.id}/download",
            }
            for file in submission.files
        ],
    }


def assignment_out(db: Session, assignment: Assignment, student: User | None = None) -> dict:
    content = assignment_content(db, assignment.content_type, assignment.content_id)
    classroom = assignment.classroom
    students = member_count(db, assignment.classroom_id)
    submissions = db.execute(
        select(Submission).where(Submission.assignment_id == assignment.id)
    ).scalars().all()
    submitted_count = len(submissions)
    reviewed_count = len(
        [item for item in submissions if item.status == SubmissionStatus.reviewed.value]
    )
    if assignment.content_type == AssignmentContentType.assessment.value:
        from app.models.assessment import AssessmentAttempt
        from app.models.enums import AttemptStatus

        submitted_count = db.execute(
            select(func.count(func.distinct(AssessmentAttempt.student_id)))
            .join(ClassroomMember, ClassroomMember.student_id == AssessmentAttempt.student_id)
            .where(
                ClassroomMember.classroom_id == assignment.classroom_id,
                AssessmentAttempt.assignment_id == assignment.id,
                AssessmentAttempt.status == AttemptStatus.submitted.value,
            )
        ).scalar_one()
        reviewed_count = submitted_count
    payload = {
        "id": assignment.id,
        "classroom_id": assignment.classroom_id,
        "classroom_title": classroom.title if classroom else "",
        "content_type": assignment.content_type,
        "content_id": assignment.content_id,
        "content_title": getattr(content, "title", None) or getattr(content, "name", "Материал"),
        "content_title_en": (getattr(content, "translation_en", None) or {}).get("name" if isinstance(content, Assessment) else "title") or None,
        "content_slug": getattr(content, "slug", None),
        "due_at": assignment.due_at,
        "status": assignment.status,
        "notes": assignment.notes,
        "created_at": assignment.created_at,
        "total_students": students,
        "submitted_count": submitted_count,
        "reviewed_count": reviewed_count,
        "max_score": assignment_max_score(db, assignment),
        "student_status": None,
        "submission_id": None,
        "grade": None,
    }
    if student is not None:
        submission = submission_for(db, assignment.id, student.id)
        if submission:
            payload.update(
                {
                    "student_status": submission.status,
                    "submission_id": submission.id,
                    "grade": submission.grade,
                }
            )
        elif assignment.content_type == AssignmentContentType.assessment.value:
            from app.models.assessment import AssessmentAttempt

            attempt = db.execute(
                select(AssessmentAttempt)
                .where(
                    AssessmentAttempt.assignment_id == assignment.id,
                    AssessmentAttempt.student_id == student.id,
                )
                .order_by(AssessmentAttempt.attempt_no.desc())
            ).scalars().first()
            payload["student_status"] = attempt.status if attempt else "not_started"
        else:
            progress = db.get(AssignmentProgress, (assignment.id, student.id))
            payload["student_status"] = "in_progress" if progress else "not_started"
    return payload


@router.post("/classes", response_model=ClassroomOut, status_code=201)
def create_classroom(
    payload: ClassroomCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.teacher.value, Role.admin.value)),
):
    classroom = Classroom(
        teacher_id=user.id,
        title=payload.title.strip(),
        join_code=generate_join_code(db),
        status="active",
    )
    db.add(classroom)
    db.flush()
    log_action(db, user.id, "classroom_created", "classroom", classroom.id, {"title": classroom.title})
    db.commit()
    return classroom_out(db, classroom, include_code=True)


@router.get("/classes", response_model=Page[ClassroomOut])
def list_classrooms(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == Role.teacher.value:
        query = select(Classroom).where(Classroom.teacher_id == user.id)
    elif user.role == Role.student.value:
        query = (
            select(Classroom)
            .join(ClassroomMember, ClassroomMember.classroom_id == Classroom.id)
            .where(ClassroomMember.student_id == user.id)
        )
    elif user.role == Role.admin.value:
        query = select(Classroom)
    else:
        query = select(Classroom).where(False)
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(Classroom.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    include_code = user.role in {Role.teacher.value, Role.admin.value}
    return Page(
        items=[classroom_out(db, item, include_code) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.post("/classes/join", response_model=JoinClassOut)
def join_classroom(
    payload: JoinClassIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.student.value)),
):
    classroom = db.execute(
        select(Classroom).where(Classroom.join_code == payload.code)
    ).scalar_one_or_none()
    if classroom is None or classroom.status != "active":
        raise ApiError(404, "invalid_code", "Сынып коды табылмады немесе белсенді емес.")
    existing = db.execute(
        select(ClassroomMember).where(
            ClassroomMember.classroom_id == classroom.id,
            ClassroomMember.student_id == user.id,
        )
    ).scalar_one_or_none()
    if existing is None:
        db.add(
            ClassroomMember(
                classroom_id=classroom.id,
                student_id=user.id,
                joined_at=datetime.now(UTC),
            )
        )
        db.commit()
    return JoinClassOut(
        classroom=ClassroomOut(**classroom_out(db, classroom, include_code=False)),
        already_member=existing is not None,
    )


@router.get("/classes/{classroom_id}", response_model=ClassroomDetail)
def get_classroom_detail(
    classroom_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    classroom = ensure_classroom_access(db, user, classroom_id)
    include_code = user.role in {Role.teacher.value, Role.admin.value}
    base = classroom_out(db, classroom, include_code=include_code)
    members = []
    if user.role in {Role.teacher.value, Role.admin.value}:
        rows = db.execute(
            select(ClassroomMember)
            .where(ClassroomMember.classroom_id == classroom.id)
            .order_by(ClassroomMember.joined_at)
        ).scalars().all()
        members = [
            MemberOut(
                student_id=row.student_id,
                display_name=row.student.display_name if row.student else "—",
                joined_at=row.joined_at,
            )
            for row in rows
        ]
    return ClassroomDetail(**base, members=members)


@router.patch("/classes/{classroom_id}", response_model=ClassroomOut)
def update_classroom(
    classroom_id: uuid.UUID,
    payload: ClassroomUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.teacher.value, Role.admin.value)),
):
    classroom = ensure_classroom_teacher(db, user, classroom_id)
    if payload.title is not None:
        classroom.title = payload.title.strip()
    if payload.status is not None:
        classroom.status = payload.status
    db.commit()
    return classroom_out(db, classroom, include_code=True)


@router.post("/classes/{classroom_id}/regenerate-code", response_model=ClassroomOut)
def regenerate_code(
    classroom_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.teacher.value, Role.admin.value)),
):
    classroom = ensure_classroom_teacher(db, user, classroom_id)
    classroom.join_code = generate_join_code(db)
    log_action(db, user.id, "join_code_regenerated", "classroom", classroom.id)
    db.commit()
    return classroom_out(db, classroom, include_code=True)


@router.get("/classes/{classroom_id}/members", response_model=list[MemberOut])
def list_members(
    classroom_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.teacher.value, Role.admin.value)),
):
    classroom = ensure_classroom_teacher(db, user, classroom_id)
    rows = db.execute(
        select(ClassroomMember)
        .where(ClassroomMember.classroom_id == classroom.id)
        .order_by(ClassroomMember.joined_at)
    ).scalars().all()
    return [
        MemberOut(
            student_id=row.student_id,
            display_name=row.student.display_name if row.student else "—",
            joined_at=row.joined_at,
        )
        for row in rows
    ]


@router.post("/assignments", response_model=AssignmentOut, status_code=201)
def create_assignment(
    payload: AssignmentCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.teacher.value, Role.admin.value)),
):
    classroom = ensure_classroom_teacher(db, user, payload.classroom_id)
    content = assignment_content(db, payload.content_type, payload.content_id)
    if content is None or content.status != "published":
        raise ApiError(422, "content_not_published", "Тек жарияланған материалды тағайындауға болады.")
    existing = db.execute(
        select(Assignment).where(
            Assignment.classroom_id == classroom.id,
            Assignment.content_type == payload.content_type,
            Assignment.content_id == payload.content_id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        return assignment_out(db, existing)
    assignment = Assignment(
        classroom_id=classroom.id,
        content_type=payload.content_type,
        content_id=payload.content_id,
        due_at=payload.due_at,
        created_by=user.id,
        status=AssignmentStatus.active.value,
        notes=payload.notes,
    )
    db.add(assignment)
    db.flush()
    log_action(
        db,
        user.id,
        "assignment_created",
        "assignment",
        assignment.id,
        {"classroom_id": str(classroom.id), "content_type": payload.content_type},
    )
    db.commit()
    return assignment_out(db, assignment)


@router.get("/assignments", response_model=Page[AssignmentOut])
def list_assignments(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    classroom_id: uuid.UUID | None = None,
    content_type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role == Role.student.value:
        query = (
            select(Assignment)
            .join(ClassroomMember, ClassroomMember.classroom_id == Assignment.classroom_id)
            .where(ClassroomMember.student_id == user.id)
        )
    elif user.role == Role.teacher.value:
        query = (
            select(Assignment)
            .join(Classroom, Classroom.id == Assignment.classroom_id)
            .where(Classroom.teacher_id == user.id)
        )
    else:
        query = select(Assignment)
    if classroom_id:
        if user.role == Role.student.value:
            ensure_classroom_access(db, user, classroom_id)
        elif user.role == Role.teacher.value:
            ensure_classroom_teacher(db, user, classroom_id)
        query = query.where(Assignment.classroom_id == classroom_id)
    if content_type:
        query = query.where(Assignment.content_type == content_type)
    total = db.execute(select(func.count()).select_from(query.subquery())).scalar_one()
    rows = db.execute(
        query.order_by(Assignment.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).scalars().all()
    student = user if user.role == Role.student.value else None
    return Page(
        items=[assignment_out(db, item, student) for item in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/assignments/{assignment_id}", response_model=AssignmentOut)
def get_assignment(
    assignment_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    assignment = db.get(Assignment, assignment_id)
    if assignment is None:
        raise not_found("Тапсырма")
    if user.role == Role.student.value:
        ensure_classroom_access(db, user, assignment.classroom_id)
        return assignment_out(db, assignment, user)
    if user.role != Role.admin.value:
        ensure_classroom_teacher(db, user, assignment.classroom_id)
    return assignment_out(db, assignment)


@router.patch("/assignments/{assignment_id}", response_model=AssignmentOut)
def update_assignment(
    assignment_id: uuid.UUID,
    payload: AssignmentUpdateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.teacher.value, Role.admin.value)),
):
    assignment = ensure_assignment_teacher(db, user, assignment_id)
    if payload.due_at is not None:
        assignment.due_at = payload.due_at
    if payload.status is not None:
        assignment.status = payload.status
    if payload.notes is not None:
        assignment.notes = payload.notes
    db.commit()
    return assignment_out(db, assignment)


@router.post("/assignments/{assignment_id}/start", response_model=dict)
def start_assignment(assignment_id: uuid.UUID, db: Session = Depends(get_db), user: User = Depends(require_roles(Role.student.value))):
    assignment = db.get(Assignment, assignment_id)
    if assignment is None:
        raise not_found("Тапсырма")
    ensure_classroom_access(db, user, assignment.classroom_id)
    if assignment.status != AssignmentStatus.active.value:
        raise ApiError(409, "assignment_closed", "Бұл тапсырма жабылған.")
    if assignment.content_type not in {"task", "project"}:
        raise ApiError(422, "invalid_assignment", "Бұл материал үшін бастау қолжетімсіз.")
    existing = submission_for(db, assignment.id, user.id)
    if existing is not None:
        return {"status": existing.status}
    db.execute(
        insert(AssignmentProgress)
        .values(assignment_id=assignment.id, student_id=user.id, started_at=datetime.now(UTC))
        .on_conflict_do_nothing(index_elements=["assignment_id", "student_id"])
    )
    db.commit()
    return {"status": "in_progress"}


@router.post("/assignments/{assignment_id}/submissions", response_model=SubmissionOut)
def submit_assignment(
    assignment_id: uuid.UUID,
    payload: SubmissionCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.student.value)),
):
    assignment = db.get(Assignment, assignment_id)
    if assignment is None:
        raise not_found("Тапсырма")
    ensure_classroom_access(db, user, assignment.classroom_id)
    if assignment.status != AssignmentStatus.active.value:
        raise ApiError(409, "assignment_closed", "Бұл тапсырма жабылған.")
    if assignment.content_type == AssignmentContentType.assessment.value:
        raise ApiError(
            422,
            "use_assessment_attempt",
            "Диагностиканы тапсыру үшін тест талпынысын бастаңыз.",
        )

    content = assignment_content(db, assignment.content_type, assignment.content_id)
    is_closed = isinstance(content, Task) and content.type in CLOSED_TYPES
    existing = submission_for(db, assignment.id, user.id)

    if is_closed:
        raw_answers = payload.answers or {}
        selected = raw_answers.get("selected_option_ids", [])
        if not isinstance(selected, list):
            raise ApiError(422, "invalid_answer", "Жауап форматы қате.")
        selected = [str(item) for item in selected]
        valid_ids = {str(option.id) for option in content.options}
        if any(item not in valid_ids for item in selected):
            raise ApiError(422, "invalid_answer", "Таңдалған нұсқа тапсырмаға тиесілі емес.")
        if content.type == TaskType.single_choice.value and len(selected) > 1:
            raise ApiError(422, "invalid_answer", "Бір ғана жауап нұсқасын таңдаңыз.")
        if not selected:
            raise ApiError(422, "empty_answer", "Кемінде бір жауап нұсқасын таңдаңыз.")
        normalized = {"selected_option_ids": selected}
        if existing is not None and existing.auto_checked and existing.answers_json == normalized:
            return submission_out(db, existing, reveal_answers=content.show_correct_answers)
        if existing is not None and existing.attempts_count >= content.attempts_limit:
            raise ApiError(409, "attempts_exhausted", "Тапсырма бойынша талпыныс лимиті аяқталды.")
        score = grade_task(content, normalized)
        now = datetime.now(UTC)
        if existing is None:
            existing = Submission(
                assignment_id=assignment.id,
                student_id=user.id,
                submitted_at=now,
                answers_json=normalized,
                auto_checked=True,
                attempts_count=1,
                status=SubmissionStatus.reviewed.value,
                grade=int(score),
                feedback=f"Автоматты тексеру: {int(score)}/{content.max_score}",
                reviewed_at=now,
            )
            db.add(existing)
        else:
            existing.answers_json = normalized
            existing.submitted_at = now
            existing.auto_checked = True
            existing.attempts_count += 1
            existing.status = SubmissionStatus.reviewed.value
            existing.grade = int(score)
            existing.feedback = f"Автоматты тексеру: {int(score)}/{content.max_score}"
            existing.reviewed_at = now
        db.commit()
        db.refresh(existing)
        return submission_out(db, existing, reveal_answers=content.show_correct_answers)

    if existing and existing.status == SubmissionStatus.reviewed.value:
        raise ApiError(409, "already_reviewed", "Жұмыс тексерілген, қайта тапсыру мүмкін емес.")
    if not payload.text and not payload.link and not payload.file_ids:
        raise ApiError(422, "empty_submission", "Мәтін, сілтеме немесе файл қосыңыз.")

    uploaded_files = []
    for file_id in payload.file_ids:
        resource = db.get(Resource, file_id)
        if (
            resource is None
            or resource.uploaded_by != user.id
            or resource.entity_type != "upload"
            or resource.kind != "file"
        ):
            raise ApiError(404, "file_not_found", "Жүктелген файл табылмады.")
        uploaded_files.append(resource)

    if existing is None:
        existing = Submission(
            assignment_id=assignment.id,
            student_id=user.id,
            submitted_at=datetime.now(UTC),
            status=SubmissionStatus.submitted.value,
            attempts_count=1,
        )
        db.add(existing)
        db.flush()
    else:
        existing.attempts_count += 1
    existing.text = payload.text
    existing.link = str(payload.link) if payload.link else None
    existing.submitted_at = datetime.now(UTC)
    if existing.status == SubmissionStatus.returned.value:
        existing.status = SubmissionStatus.submitted.value
    for resource in uploaded_files:
        duplicate = next((item for item in existing.files if item.file_key == resource.file_key), None)
        if duplicate:
            continue
        db.add(
            SubmissionFile(
                submission_id=existing.id,
                file_key=resource.file_key,
                filename=resource.original_filename or resource.title,
                mime=resource.mime,
                size=resource.size,
                created_at=datetime.now(UTC),
            )
        )
    db.commit()
    db.refresh(existing)
    return submission_out(db, existing)


@router.get("/assignments/{assignment_id}/submissions", response_model=SubmissionListOut)
def list_assignment_submissions(
    assignment_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.teacher.value, Role.admin.value)),
):
    assignment = ensure_assignment_teacher(db, user, assignment_id)
    classroom = get_classroom(db, assignment.classroom_id)
    content = assignment_content(db, assignment.content_type, assignment.content_id)
    submissions = db.execute(
        select(Submission)
        .where(Submission.assignment_id == assignment.id)
        .order_by(Submission.submitted_at.desc())
    ).scalars().all()
    by_student = {item.student_id: item for item in submissions}
    members = db.execute(
        select(ClassroomMember).where(ClassroomMember.classroom_id == classroom.id)
    ).scalars().all()
    attempt_statuses: dict[uuid.UUID, str] = {}
    progress_rows = db.execute(select(AssignmentProgress).where(AssignmentProgress.assignment_id == assignment.id)).scalars().all()
    for progress in progress_rows:
        attempt_statuses[progress.student_id] = "in_progress"
    if assignment.content_type == AssignmentContentType.assessment.value:
        from app.models.assessment import AssessmentAttempt

        attempts = db.execute(
            select(AssessmentAttempt)
            .where(AssessmentAttempt.assignment_id == assignment.id)
            .order_by(AssessmentAttempt.attempt_no.desc())
        ).scalars().all()
        for attempt in attempts:
            attempt_statuses.setdefault(attempt.student_id, attempt.status)
    students = [
        {
            "student_id": member.student_id,
            "display_name": member.student.display_name,
            "status": by_student[member.student_id].status if member.student_id in by_student else attempt_statuses.get(member.student_id, "not_started"),
            "submission_id": by_student[member.student_id].id if member.student_id in by_student else None,
        }
        for member in members
    ]
    if assignment.content_type == AssignmentContentType.assessment.value:
        submitted_count = sum(row["status"] == "submitted" for row in students)
        reviewed_count = submitted_count
    else:
        submitted_count = len(submissions)
        reviewed_count = sum(item.status == SubmissionStatus.reviewed.value for item in submissions)
    return SubmissionListOut(
        assignment_id=assignment.id,
        content_title=getattr(content, "title", None) or getattr(content, "name", "Материал"),
        total_students=member_count(db, classroom.id),
        submitted_count=submitted_count,
        reviewed_count=reviewed_count,
        items=[SubmissionOut(**submission_out(db, item, reveal_answers=True)) for item in submissions],
        students=students,
    )


@router.get("/submissions/{submission_id}", response_model=SubmissionOut)
def get_submission(
    submission_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise not_found("Жұмыс")
    reveal = False
    if user.role == Role.student.value:
        if submission.student_id != user.id:
            raise not_found("Жұмыс")
        content = assignment_content(
            db, submission.assignment.content_type, submission.assignment.content_id
        )
        reveal = isinstance(content, Task) and content.show_correct_answers
    else:
        if user.role != Role.admin.value:
            ensure_classroom_teacher(db, user, submission.assignment.classroom_id)
        reveal = True
    return submission_out(db, submission, reveal_answers=reveal)


@router.patch("/submissions/{submission_id}/review", response_model=SubmissionOut)
def review_submission(
    submission_id: uuid.UUID,
    payload: ReviewIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.teacher.value, Role.admin.value)),
):
    submission = db.get(Submission, submission_id)
    if submission is None:
        raise not_found("Жұмыс")
    ensure_classroom_teacher(db, user, submission.assignment.classroom_id)
    max_score = assignment_max_score(db, submission.assignment)
    if max_score is not None and payload.grade > max_score:
        raise ApiError(422, "grade_too_high", f"Баға {max_score} балдан аспауы керек.")
    if payload.return_for_revision and not (payload.feedback or "").strip():
        raise ApiError(422, "feedback_required", "Дайындауға қайтару үшін түсініктеме міндетті.")
    submission.grade = payload.grade
    submission.feedback = payload.feedback
    submission.status = (
        SubmissionStatus.returned.value
        if payload.return_for_revision
        else SubmissionStatus.reviewed.value
    )
    submission.reviewed_at = datetime.now(UTC)
    submission.reviewed_by = user.id
    log_action(
        db,
        user.id,
        "submission_reviewed",
        "submission",
        submission.id,
        {"grade": payload.grade, "status": submission.status},
    )
    db.commit()
    db.refresh(submission)
    return submission_out(db, submission, reveal_answers=True)


@router.get("/submission-files/{file_id}/download")
def download_submission_file(
    file_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    from pathlib import Path

    from fastapi.responses import FileResponse

    from app.services.storage import storage_path

    file = db.get(SubmissionFile, file_id)
    if file is None:
        raise not_found("Файл")
    submission = file.submission
    if user.role == Role.student.value and submission.student_id != user.id:
        raise not_found("Файл")
    if user.role == Role.teacher.value:
        ensure_classroom_teacher(db, user, submission.assignment.classroom_id)
    path = storage_path(file.file_key)
    if not Path(path).exists():
        raise not_found("Файл")
    return FileResponse(
        path,
        media_type=file.mime or "application/octet-stream",
        filename=file.filename,
        headers={"Cache-Control": "private, no-store"},
    )
