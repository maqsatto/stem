import csv
import io
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.classroom import (
    Assignment,
    Classroom,
    ClassroomMember,
    Submission,
)
from app.models.content import Competency
from app.models.enums import AssignmentStatus, SubmissionStatus
from app.models.user import User
from app.services.scoring import student_comparisons, student_progress


def class_students(db: Session, classroom: Classroom) -> list[User]:
    return db.execute(
        select(User)
        .join(ClassroomMember, ClassroomMember.student_id == User.id)
        .where(ClassroomMember.classroom_id == classroom.id)
        .order_by(User.display_name)
    ).scalars().all()


def assignment_stats(db: Session, assignment: Assignment) -> dict:
    students = class_students(db, assignment.classroom)
    submissions = db.execute(
        select(Submission).where(Submission.assignment_id == assignment.id)
    ).scalars().all()
    return {
        "total_students": len(students),
        "submitted_count": len(submissions),
        "reviewed_count": len(
            [item for item in submissions if item.status == SubmissionStatus.reviewed.value]
        ),
    }


def build_class_results(db: Session, classroom: Classroom) -> dict:
    students = class_students(db, classroom)
    assignments = db.execute(
        select(Assignment).where(
            Assignment.classroom_id == classroom.id,
            Assignment.status == AssignmentStatus.active.value,
        )
    ).scalars().all()
    assignment_ids = [item.id for item in assignments]
    all_submissions = (
        db.execute(
            select(Submission).where(Submission.assignment_id.in_(assignment_ids))
        ).scalars().all()
        if assignment_ids
        else []
    )
    submissions_by_student: dict[uuid.UUID, list[Submission]] = {}
    for submission in all_submissions:
        submissions_by_student.setdefault(submission.student_id, []).append(submission)

    pre_by_student: dict[uuid.UUID, dict[str, float]] = {}
    post_by_student: dict[uuid.UUID, dict[str, float]] = {}
    delta_by_student: dict[uuid.UUID, dict[str, float]] = {}
    pre_overall: dict[uuid.UUID, float] = {}
    post_overall: dict[uuid.UUID, float] = {}

    for student in students:
        comparisons = student_comparisons(db, student.id)
        if not comparisons:
            continue
        comparison = comparisons[0]
        pre_scores: dict[str, float] = {}
        post_scores: dict[str, float] = {}
        deltas: dict[str, float] = {}
        for row in comparison["rows"]:
            pre_scores[row["slug"]] = row["pre_percent"]
            post_scores[row["slug"]] = row["post_percent"]
            deltas[row["slug"]] = row["delta_pp"]
        pre_by_student[student.id] = pre_scores
        post_by_student[student.id] = post_scores
        delta_by_student[student.id] = deltas
        pre_overall[student.id] = comparison["pre_overall"]
        post_overall[student.id] = comparison["post_overall"]

    student_payloads = []
    for student in students:
        progress = student_progress(db, student.id)
        student_submissions = submissions_by_student.get(student.id, [])
        reviewed = [
            item for item in student_submissions if item.status == SubmissionStatus.reviewed.value
        ]
        grades = [float(item.grade) for item in reviewed if item.grade is not None]
        student_payloads.append(
            {
                "student_id": student.id,
                "display_name": student.display_name,
                "lessons_completed": progress["lessons_completed"],
                "tasks_submitted": progress["tasks_submitted"],
                "tasks_reviewed": progress["tasks_reviewed"],
                "average_grade": progress["average_grade"],
                "pre_scores": pre_by_student.get(student.id, {}),
                "post_scores": post_by_student.get(student.id, {}),
                "delta_pp": delta_by_student.get(student.id, {}),
                "pre_overall": pre_overall.get(student.id),
                "post_overall": post_overall.get(student.id),
                "reviewed_in_class": len(reviewed),
                "grades_in_class": grades,
            }
        )

    competencies = db.execute(
        select(Competency).where(Competency.status == "published").order_by(Competency.sort_order)
    ).scalars().all()
    averages = []
    for competency in competencies:
        pre_values = [
            item["pre_scores"][competency.slug]
            for item in student_payloads
            if competency.slug in item["pre_scores"]
        ]
        post_values = [
            item["post_scores"][competency.slug]
            for item in student_payloads
            if competency.slug in item["post_scores"]
        ]
        delta_values = [
            item["delta_pp"][competency.slug]
            for item in student_payloads
            if competency.slug in item["delta_pp"]
        ]
        averages.append(
            {
                "competency_id": str(competency.id),
                "slug": competency.slug,
                "title": competency.title,
                "pre_average": round(sum(pre_values) / len(pre_values), 2) if pre_values else None,
                "post_average": round(sum(post_values) / len(post_values), 2)
                if post_values
                else None,
                "delta_average_pp": round(sum(delta_values) / len(delta_values), 2)
                if delta_values
                else None,
                "students_with_pre": len(pre_values),
                "students_with_post": len(post_values),
            }
        )

    return {
        "classroom_id": classroom.id,
        "classroom_title": classroom.title,
        "students_total": len(students),
        "students": student_payloads,
        "competency_averages": averages,
        "demo_notice": (
            "Көрсеткіштер нақты диагностика деректері негізінде есептеледі; "
            "себеп-салдар дәлелі ретінде түсіндірілмейді."
        ),
    }


def class_results_csv(db: Session, classroom: Classroom) -> str:
    results = build_class_results(db, classroom)
    competencies = db.execute(
        select(Competency).where(Competency.status == "published").order_by(Competency.sort_order)
    ).scalars().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";", lineterminator="\r\n")
    header = [
        "Оқушы",
        "Аяқталған сабақтар",
        "Тапсырылған жұмыстар",
        "Тексерілген жұмыстар",
        "Орташа балл",
        "Pre жалпы (%)",
        "Post жалпы (%)",
        "Delta (п.п.)",
    ]
    for competency in competencies:
        header.extend(
            [
                f"{competency.title} — Pre (%)",
                f"{competency.title} — Post (%)",
                f"{competency.title} — Delta (п.п.)",
            ]
        )
    writer.writerow(header)
    for student in results["students"]:
        row = [
            student["display_name"],
            student["lessons_completed"],
            student["tasks_submitted"],
            student["tasks_reviewed"],
            student["average_grade"] if student["average_grade"] is not None else "",
            student["pre_overall"] if student["pre_overall"] is not None else "",
            student["post_overall"] if student["post_overall"] is not None else "",
            (
                round(student["post_overall"] - student["pre_overall"], 2)
                if student["pre_overall"] is not None and student["post_overall"] is not None
                else ""
            ),
        ]
        for competency in competencies:
            row.extend(
                [
                    student["pre_scores"].get(competency.slug, ""),
                    student["post_scores"].get(competency.slug, ""),
                    student["delta_pp"].get(competency.slug, ""),
                ]
            )
        writer.writerow(row)
    writer.writerow([])
    writer.writerow(
        [
            "Ескерту: көрсеткіштер тек салыстырылатын pre/post талпыныстары бар оқушылар үшін есептеледі. "
            "Бұл есеп әдістеменің себептік әсерін дәлелдемейді."
        ]
    )
    return "\ufeff" + buffer.getvalue()


def pending_reviews_count(db: Session, teacher_id: uuid.UUID) -> int:
    return len(
        db.execute(
            select(Submission)
            .join(Assignment, Assignment.id == Submission.assignment_id)
            .join(Classroom, Classroom.id == Assignment.classroom_id)
            .where(
                Classroom.teacher_id == teacher_id,
                Submission.status == SubmissionStatus.submitted.value,
            )
        ).scalars().all()
    )


def teacher_dashboard(db: Session, teacher: User) -> dict:
    classrooms = db.execute(
        select(Classroom).where(Classroom.teacher_id == teacher.id).order_by(Classroom.created_at.desc())
    ).scalars().all()
    total_students = sum(
        len(
            db.execute(
                select(ClassroomMember).where(ClassroomMember.classroom_id == classroom.id)
            ).scalars().all()
        )
        for classroom in classrooms
    )
    assignments = (
        db.execute(
            select(Assignment).where(
                Assignment.classroom_id.in_([item.id for item in classrooms])
            )
        ).scalars().all()
        if classrooms
        else []
    )
    return {
        "classrooms": len(classrooms),
        "students": total_students,
        "assignments": len(assignments),
        "pending_reviews": pending_reviews_count(db, teacher.id),
        "recent_assignments": assignments[-5:],
    }
