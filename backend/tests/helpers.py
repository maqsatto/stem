"""Factories shared by the backend test modules."""

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.assessment import Assessment, AssessmentQuestion
from app.models.classroom import Assignment, Classroom, ClassroomMember, LessonProgress
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
from app.models.enums import ResourceKind
from app.models.user import User

PASSWORD = "Passw0rd!"
NOW = datetime.now(UTC)


def uid() -> str:
    return uuid.uuid4().hex[:10]


def create_user(
    db: Session,
    role: str = "student",
    email: str | None = None,
    password: str = PASSWORD,
    display_name: str | None = None,
) -> User:
    user = User(
        email=(email or f"{role}-{uid()}@test.kz").lower(),
        password_hash=hash_password(password),
        display_name=display_name or f"Test {role} {uid()}",
        role=role,
        status="active",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login(client, email: str, password: str = PASSWORD) -> dict:
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return response.json()


def auth(token_or_pair: str | dict) -> dict[str, str]:
    token = token_or_pair["access_token"] if isinstance(token_or_pair, dict) else token_or_pair
    return {"Authorization": f"Bearer {token}"}


def create_competency(db: Session, title: str | None = None, status: str = "published") -> Competency:
    competency = Competency(
        slug=f"comp-{uid()}",
        title=title or f"Құзыреттілік {uid()}",
        description="Демо-сипаттама",
        indicators_json=["Индикатор 1"],
        criteria_json={"low": "төмен", "high": "жоғары"},
        status=status,
        sort_order=0,
        is_demo=True,
    )
    db.add(competency)
    db.commit()
    db.refresh(competency)
    return competency


def create_algorithm(
    db: Session,
    status: str = "published",
    body: str = "<p>Демо мазмұн</p>",
    summary: str = "Демо қысқаша сипаттама",
) -> Algorithm:
    algorithm = Algorithm(
        slug=f"alg-{uid()}",
        title=f"Алгоритм {uid()}",
        title_en="Algorithm",
        summary=summary,
        body=body,
        status=status,
        sort_order=0,
        is_demo=True,
    )
    db.add(algorithm)
    db.commit()
    db.refresh(algorithm)
    return algorithm


def create_lesson(
    db: Session,
    competencies: list[Competency] | None = None,
    algorithm: Algorithm | None = None,
    status: str = "published",
    body: str = "<p>Сабақ мазмұны</p>",
) -> Lesson:
    lesson = Lesson(
        slug=f"lesson-{uid()}",
        title=f"Сабақ {uid()}",
        algorithm_id=algorithm.id if algorithm else None,
        summary="Демо сабақ",
        body=body,
        goal="Мақсат",
        reflection="Рефлексия сұрағы",
        duration_min=45,
        order_no=1,
        status=status,
        is_demo=True,
    )
    db.add(lesson)
    db.flush()
    for competency in competencies or []:
        db.add(LessonCompetency(lesson_id=lesson.id, competency_id=competency.id))
    db.commit()
    db.refresh(lesson)
    return lesson


def create_task(
    db: Session,
    task_type: str = "single_choice",
    options: list[tuple[str, bool]] | None = None,
    max_score: int = 10,
    attempts_limit: int = 2,
    show_correct_answers: bool = True,
    competencies: list[Competency] | None = None,
    lesson: Lesson | None = None,
    algorithm: Algorithm | None = None,
    status: str = "published",
) -> Task:
    options = options or [("Дұрыс жауап", True), ("Қате жауап", False)]
    task = Task(
        slug=f"task-{uid()}",
        title=f"Тапсырма {uid()}",
        lesson_id=lesson.id if lesson else None,
        algorithm_id=algorithm.id if algorithm else None,
        type=task_type,
        difficulty="medium",
        instructions="<p>Нұсқаулық</p>",
        body="",
        max_score=max_score,
        rubric_json=[],
        attempts_limit=attempts_limit,
        show_correct_answers=show_correct_answers,
        status=status,
        sort_order=0,
        is_demo=True,
    )
    db.add(task)
    db.flush()
    for competency in competencies or []:
        db.add(TaskCompetency(task_id=task.id, competency_id=competency.id))
    for index, (label, is_correct) in enumerate(options, start=1):
        db.add(
            TaskOption(
                task_id=task.id,
                label=label,
                is_correct=is_correct,
                order_no=index,
            )
        )
    db.commit()
    db.refresh(task)
    return task


def create_project(
    db: Session,
    competencies: list[Competency] | None = None,
    algorithm: Algorithm | None = None,
    status: str = "published",
) -> Project:
    project = Project(
        slug=f"project-{uid()}",
        title=f"Жоба {uid()}",
        algorithm_id=algorithm.id if algorithm else None,
        summary="Демо жоба",
        problem="Мәселе",
        goal="Мақсат",
        body="<p>Жоба мазмұны</p>",
        steps_json=["Қадам 1"],
        materials_json=["Материал"],
        tools_json=["Құрал"],
        expected_result="Күтілетін нәтиже",
        rubric_json=[],
        status=status,
        sort_order=0,
        is_demo=True,
    )
    db.add(project)
    db.flush()
    for competency in competencies or []:
        db.add(ProjectCompetency(project_id=project.id, competency_id=competency.id))
    db.commit()
    db.refresh(project)
    return project


def question(
    question_type: str,
    competency: Competency,
    correct: list[str],
    wrong: list[str] | None = None,
    points: int = 10,
    body: str = "Сұрақ мәтіні",
) -> dict:
    wrong = wrong or ["Қате 1", "Қате 2"]
    options = [
        {"id": uuid.uuid4().hex, "label": label, "is_correct": True, "order_no": i + 1}
        for i, label in enumerate(correct)
    ]
    offset = len(options)
    options.extend(
        {
            "id": uuid.uuid4().hex,
            "label": label,
            "is_correct": False,
            "order_no": offset + i + 1,
        }
        for i, label in enumerate(wrong)
    )
    return {
        "type": question_type,
        "body": body,
        "competency_id": competency.id,
        "points": points,
        "options": options,
    }


def create_assessment(
    db: Session,
    kind: str = "pre",
    methodology_key: str = "test-methodology-v1",
    questions: list[dict] | None = None,
    version: int = 1,
    attempts_limit: int = 3,
    show_correct_answers: bool = True,
    status: str = "published",
    is_demo: bool = True,
) -> Assessment:
    questions = questions or []
    weights = {
        str(item["competency_id"]): 1.0 for item in questions if item.get("competency_id")
    }
    assessment = Assessment(
        name=f"Диагностика {kind} {uid()}",
        slug=f"assess-{uid()}",
        kind=kind,
        version=version,
        methodology_key=methodology_key,
        description="Демо диагностика",
        instructions="Нұсқаулық",
        scoring_config_json={
            "weights": weights,
            "thresholds": {"low": 50, "medium": 75},
            "attempt_rule": "first_completed",
            "demo_weights": False,
        },
        attempts_limit=attempts_limit,
        show_correct_answers=show_correct_answers,
        status=status,
        is_demo=is_demo,
        published_at=NOW - timedelta(days=1),
    )
    db.add(assessment)
    db.flush()
    for index, item in enumerate(questions, start=1):
        db.add(
            AssessmentQuestion(
                assessment_id=assessment.id,
                type=item["type"],
                body=item["body"],
                competency_id=item["competency_id"],
                points=item["points"],
                options_json=item["options"],
                order_no=index,
            )
        )
    db.commit()
    db.refresh(assessment)
    return assessment


def create_classroom(
    db: Session,
    teacher: User,
    students: list[User] | None = None,
    code: str | None = None,
) -> Classroom:
    classroom = Classroom(
        teacher_id=teacher.id,
        title=f"Сынып {uid()}",
        join_code=code or uid().upper()[:6],
        status="active",
    )
    db.add(classroom)
    db.flush()
    for student in students or []:
        db.add(
            ClassroomMember(
                classroom_id=classroom.id,
                student_id=student.id,
                joined_at=NOW,
            )
        )
    db.commit()
    db.refresh(classroom)
    return classroom


def create_assignment(
    db: Session,
    classroom: Classroom,
    content_type: str,
    content_id,
    status: str = "active",
) -> Assignment:
    assignment = Assignment(
        classroom_id=classroom.id,
        content_type=content_type,
        content_id=content_id,
        due_at=NOW + timedelta(days=7),
        created_by=classroom.teacher_id,
        status=status,
        notes="Тест тапсырмасы",
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def create_resource(
    db: Session,
    entity_type: str,
    entity_id,
    audience: str = "student",
    url: str = "https://example.com/resource",
) -> Resource:
    resource = Resource(
        entity_type=entity_type,
        entity_id=entity_id,
        audience=audience,
        kind=ResourceKind.link.value,
        title=f"Ресурс {uid()}",
        url=url,
        created_at=NOW,
    )
    db.add(resource)
    db.commit()
    db.refresh(resource)
    return resource


def complete_lesson(db: Session, student: User, lesson: Lesson) -> LessonProgress:
    progress = LessonProgress(
        student_id=student.id,
        lesson_id=lesson.id,
        completed_at=NOW,
    )
    db.add(progress)
    db.commit()
    db.refresh(progress)
    return progress


def correct_option_ids(assessment: Assessment, question_index: int) -> list[str]:
    q = assessment.questions[question_index]
    return [str(item["id"]) for item in q.options_json if item.get("is_correct")]


def wrong_option_ids(assessment: Assessment, question_index: int) -> list[str]:
    q = assessment.questions[question_index]
    return [str(item["id"]) for item in q.options_json if not item.get("is_correct")]
