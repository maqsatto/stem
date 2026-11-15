import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.assessment import Assessment, AssessmentAttempt
from app.models.classroom import LessonProgress
from app.models.content import (
    Algorithm,
    Competency,
    Lesson,
    Project,
    Resource,
    Task,
)
from app.models.enums import AttemptStatus, Audience, Role
from app.models.user import User
from app.services.scoring import find_level, weighted_overall

DOWNLOAD_PREFIX = "/api/v1/resources"


def download_url(resource: Resource) -> str | None:
    if resource.kind == "file" and resource.file_key:
        return f"{DOWNLOAD_PREFIX}/{resource.id}/download"
    return resource.url


def resource_out(resource: Resource) -> dict:
    return {
        "id": resource.id,
        "title": resource.title,
        "audience": resource.audience,
        "kind": resource.kind,
        "url": resource.url if resource.kind == "link" else None,
        "original_filename": resource.original_filename,
        "mime": resource.mime,
        "size": resource.size,
        "download_url": download_url(resource),
    }


def can_view_audience(audience: str, user: User | None) -> bool:
    if user and user.role == Role.admin.value:
        return True
    if user and user.role == Role.teacher.value:
        return audience in {Audience.public.value, Audience.student.value, Audience.teacher.value}
    if user and user.role == Role.student.value:
        return audience in {Audience.public.value, Audience.student.value}
    return audience == Audience.public.value


def visible_resources(
    db: Session, entity_type: str, entity_id: uuid.UUID, user: User | None
) -> list[dict]:
    resources = db.execute(
        select(Resource)
        .where(Resource.entity_type == entity_type, Resource.entity_id == entity_id)
        .order_by(Resource.created_at.asc())
    ).scalars().all()
    return [resource_out(item) for item in resources if can_view_audience(item.audience, user)]


def ref(obj) -> dict:
    return {"id": obj.id, "title": obj.title, "slug": obj.slug}


def algorithm_brief(algorithm: Algorithm | None) -> dict | None:
    if algorithm is None:
        return None
    return {
        **ref(algorithm),
        "title_en": algorithm.title_en,
    }


def lesson_brief(lesson: Lesson | None) -> dict | None:
    if lesson is None:
        return None
    return {**ref(lesson), "order_no": lesson.order_no}


def task_brief(task: Task) -> dict:
    return {**ref(task), "type": task.type, "difficulty": task.difficulty}


def project_brief(project: Project) -> dict:
    return {**ref(project), "summary": project.summary}


def competency_refs(content) -> list[dict]:
    links = getattr(content, "competency_links", []) or []
    return [ref(link.competency) for link in links if link.competency is not None]


def lesson_card(lesson: Lesson, completed: bool = False) -> dict:
    return {
        "id": lesson.id,
        "slug": lesson.slug,
        "title": lesson.title,
        "summary": lesson.summary,
        "order_no": lesson.order_no,
        "duration_min": lesson.duration_min,
        "is_demo": lesson.is_demo,
        "status": lesson.status,
        "algorithm": algorithm_brief(lesson.algorithm),
        "competencies": competency_refs(lesson),
        "completed": completed,
    }


def lesson_detail(db: Session, lesson: Lesson, user: User | None) -> dict:
    completed = False
    if user and user.role == Role.student.value:
        completed = db.execute(
            select(LessonProgress).where(
                LessonProgress.student_id == user.id, LessonProgress.lesson_id == lesson.id
            )
        ).scalar_one_or_none() is not None
    return {
        **lesson_card(lesson, completed),
        "body": lesson.body,
        "goal": lesson.goal,
        "reflection": lesson.reflection,
        "tasks": [task_brief(task) for task in lesson.tasks if task.status == "published"],
        "resources": visible_resources(db, "lesson", lesson.id, user),
    }


def task_card(task: Task, user: User | None) -> dict:
    privileged = bool(user and user.role in {Role.teacher.value, Role.admin.value})
    return {
        "id": task.id,
        "slug": task.slug,
        "title": task.title,
        "type": task.type,
        "difficulty": task.difficulty,
        "max_score": task.max_score,
        "is_demo": task.is_demo,
        "status": task.status,
        "algorithm": algorithm_brief(task.algorithm),
        "lesson": lesson_brief(task.lesson),
        "competencies": competency_refs(task),
        "answer_key_available": privileged,
    }


def task_detail(db: Session, task: Task, user: User | None, reveal_answers: bool = False) -> dict:
    privileged = reveal_answers and bool(
        user and user.role in {Role.teacher.value, Role.admin.value}
    )
    options = []
    for option in task.options:
        options.append(
            {
                "id": option.id,
                "label": option.label,
                "order_no": option.order_no,
                "is_correct": option.is_correct if privileged else None,
            }
        )
    return {
        **task_card(task, user),
        "instructions": task.instructions,
        "body": task.body,
        "rubric_json": task.rubric_json,
        "attempts_limit": task.attempts_limit,
        "show_correct_answers": task.show_correct_answers,
        "options": options,
        "resources": visible_resources(db, "task", task.id, user),
    }


def project_card(project: Project) -> dict:
    return {
        "id": project.id,
        "slug": project.slug,
        "title": project.title,
        "summary": project.summary,
        "is_demo": project.is_demo,
        "status": project.status,
        "algorithm": algorithm_brief(project.algorithm),
        "competencies": competency_refs(project),
    }


def project_detail(db: Session, project: Project, user: User | None) -> dict:
    return {
        **project_card(project),
        "problem": project.problem,
        "goal": project.goal,
        "body": project.body,
        "steps_json": project.steps_json,
        "materials_json": project.materials_json,
        "tools_json": project.tools_json,
        "expected_result": project.expected_result,
        "rubric_json": project.rubric_json,
        "tasks": [task_brief(task) for task in project.tasks if task.status == "published"],
        "resources": visible_resources(db, "project", project.id, user),
    }


def algorithm_card(algorithm: Algorithm) -> dict:
    return {
        "id": algorithm.id,
        "slug": algorithm.slug,
        "title": algorithm.title,
        "title_en": algorithm.title_en,
        "summary": algorithm.summary,
        "cover_image": algorithm.cover_image,
        "is_demo": algorithm.is_demo,
        "status": algorithm.status,
    }


def algorithm_detail(db: Session, algorithm: Algorithm, user: User | None) -> dict:
    lessons = [item for item in algorithm.lessons if item.status == "published"]
    tasks = [item for item in algorithm.tasks if item.status == "published"]
    projects = [item for item in algorithm.projects if item.status == "published"]
    competencies: dict[uuid.UUID, dict] = {}
    for lesson in lessons:
        for link in lesson.competency_links:
            if link.competency:
                competencies[link.competency.id] = ref(link.competency)
    for task in tasks:
        for link in task.competency_links:
            if link.competency:
                competencies[link.competency.id] = ref(link.competency)
    for project in projects:
        for link in project.competency_links:
            if link.competency:
                competencies[link.competency.id] = ref(link.competency)
    return {
        **algorithm_card(algorithm),
        "body": algorithm.body,
        "competencies": sorted(competencies.values(), key=lambda item: item["title"]),
        "lessons": [
            {"id": item.id, "title": item.title, "slug": item.slug, "order_no": item.order_no}
            for item in sorted(lessons, key=lambda lesson: lesson.order_no)
        ],
        "tasks": [task_brief(item) for item in tasks],
        "projects": [project_brief(item) for item in projects],
        "resources": visible_resources(db, "algorithm", algorithm.id, user),
    }


def competency_card(competency: Competency) -> dict:
    return {
        "id": competency.id,
        "slug": competency.slug,
        "title": competency.title,
        "description": competency.description,
        "is_demo": competency.is_demo,
        "status": competency.status,
    }


def competency_detail(db: Session, competency: Competency, user: User | None) -> dict:
    algorithms: dict[uuid.UUID, dict] = {}
    lessons: dict[uuid.UUID, dict] = {}
    tasks: dict[uuid.UUID, dict] = {}
    projects: dict[uuid.UUID, dict] = {}

    for link in competency.lesson_links:
        lesson = link.lesson
        if lesson and lesson.status == "published":
            lessons[lesson.id] = {
                "id": lesson.id, "title": lesson.title, "slug": lesson.slug,
                "order_no": lesson.order_no,
            }
            if lesson.algorithm and lesson.algorithm.status == "published":
                algorithms[lesson.algorithm.id] = {
                    "id": lesson.algorithm.id,
                    "title": lesson.algorithm.title,
                    "slug": lesson.algorithm.slug,
                    "title_en": lesson.algorithm.title_en,
                }
    for link in competency.task_links:
        task = link.task
        if task and task.status == "published":
            tasks[task.id] = task_brief(task)
    for link in competency.project_links:
        project = link.project
        if project and project.status == "published":
            projects[project.id] = project_brief(project)

    return {
        **competency_card(competency),
        "indicators_json": competency.indicators_json,
        "criteria_json": competency.criteria_json,
        "algorithms": sorted(algorithms.values(), key=lambda item: item["title"]),
        "lessons": sorted(lessons.values(), key=lambda item: item["order_no"]),
        "tasks": sorted(tasks.values(), key=lambda item: item["title"]),
        "projects": sorted(projects.values(), key=lambda item: item["title"]),
    }


def matrix_rows(db: Session, user: User | None) -> list[dict]:
    algorithms = db.execute(
        select(Algorithm).where(Algorithm.status == "published").order_by(Algorithm.sort_order)
    ).scalars().all()
    rows = []
    for algorithm in algorithms:
        competencies: dict[uuid.UUID, dict] = {}
        lessons = [item for item in algorithm.lessons if item.status == "published"]
        tasks = [item for item in algorithm.tasks if item.status == "published"]
        projects = [item for item in algorithm.projects if item.status == "published"]
        for content in [*lessons, *tasks, *projects]:
            for link in content.competency_links:
                if link.competency and link.competency.status == "published":
                    competencies[link.competency.id] = ref(link.competency)
        rows.append(
            {
                "algorithm_id": algorithm.id,
                "algorithm_title": algorithm.title,
                "algorithm_slug": algorithm.slug,
                "competencies": sorted(competencies.values(), key=lambda item: item["title"]),
                "lesson_count": len(lessons),
                "task_count": len(tasks),
                "project_count": len(projects),
            }
        )
    return rows


def assessment_card(db: Session, assessment: Assessment, student_id: uuid.UUID | None = None) -> dict:
    attempts = []
    if student_id:
        attempts = db.execute(
            select(AssessmentAttempt)
            .where(
                AssessmentAttempt.assessment_id == assessment.id,
                AssessmentAttempt.student_id == student_id,
            )
            .order_by(AssessmentAttempt.attempt_no)
        ).scalars().all()
    submitted = [item for item in attempts if item.status == AttemptStatus.submitted.value]
    best = max(
        (
            100.0 * (item.total_score or 0) / (item.max_score or 1)
            for item in submitted
        ),
        default=None,
    )
    max_score = sum(question.points for question in assessment.questions)
    return {
        "id": assessment.id,
        "name": assessment.name,
        "slug": assessment.slug,
        "kind": assessment.kind,
        "version": assessment.version,
        "methodology_key": assessment.methodology_key,
        "description": assessment.description,
        "status": assessment.status,
        "question_count": len(assessment.questions),
        "max_score": max_score,
        "attempts_limit": assessment.attempts_limit,
        "is_demo": assessment.is_demo,
        "attempts_used": len(submitted),
        "best_score": round(best, 2) if best is not None else None,
        "last_status": submitted[-1].status if submitted else None,
        "can_attempt": len(submitted) < assessment.attempts_limit,
    }


def question_student(question, reveal: bool = False) -> dict:
    options = []
    for index, option in enumerate(question.options_json or [], start=1):
        option_id = str(option.get("id", index))
        options.append(
            {
                "id": option_id,
                "label": option.get("label", ""),
                "order_no": index,
                "is_correct": bool(option.get("is_correct")) if reveal else None,
            }
        )
    return {
        "id": question.id,
        "type": question.type,
        "body": question.body,
        "points": question.points,
        "competency_id": question.competency_id,
        "competency_title": question.competency.title if question.competency else None,
        "order_no": question.order_no,
        "options": options,
    }


def attempt_out(
    attempt: AssessmentAttempt,
    show_correct: bool = False,
    include_answers: bool = True,
    config: dict | None = None,
) -> dict:
    assessment = attempt.assessment
    max_score = attempt.max_score or 0
    percent = round(100.0 * (attempt.total_score or 0) / max_score, 2) if max_score else None
    scores = []
    for score in attempt.competency_scores:
        scores.append(
            {
                "competency_id": score.competency_id,
                "title": score.competency.title if score.competency else "",
                "slug": score.competency.slug if score.competency else "",
                "earned": score.earned,
                "maximum": score.maximum,
                "percent": score.percent,
                "level": find_level(score.percent, config or assessment.scoring_config_json),
                "delta_pp": None,
            }
        )
    scores.sort(key=lambda item: item["title"])

    answers = []
    if include_answers:
        questions = {question.id: question for question in assessment.questions}
        for answer in attempt.answers:
            question = questions.get(answer.question_id)
            correct_ids = []
            correct_labels = []
            correct_text = None
            if show_correct and question:
                for index, option in enumerate(question.options_json or [], start=1):
                    if option.get("is_correct"):
                        correct_ids.append(str(option.get("id", index)))
                        correct_labels.append(option.get("label", ""))
                if question.type == "open_text":
                    source = question.options_json if isinstance(question.options_json, dict) else {}
                    correct_text = source.get("answer")
            answers.append(
                {
                    "question_id": answer.question_id,
                    "answer_json": answer.answer_json,
                    "earned_points": answer.earned_points,
                    "correct_option_ids": correct_ids if show_correct else None,
                    "correct_labels": correct_labels if show_correct else None,
                    "correct_text": correct_text,
                }
            )

    return {
        "id": attempt.id,
        "assessment_id": attempt.assessment_id,
        "assessment_name": assessment.name,
        "kind": assessment.kind,
        "methodology_key": assessment.methodology_key,
        "assessment_version": attempt.assessment_version,
        "status": attempt.status,
        "started_at": attempt.started_at,
        "submitted_at": attempt.submitted_at,
        "total_score": attempt.total_score,
        "max_score": attempt.max_score,
        "percent": percent,
        "attempt_no": attempt.attempt_no,
        "competency_scores": scores,
        "answers": answers,
    }


def overall_from_scores(scores: list[dict], config: dict | None) -> float:
    return weighted_overall(scores, config)
