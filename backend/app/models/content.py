import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import Audience, ContentStatus, ResourceKind


class ContentMixin:
    status: Mapped[str] = mapped_column(
        String(20), default=ContentStatus.draft.value, nullable=False, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Algorithm(UUIDPrimaryKeyMixin, TimestampMixin, ContentMixin, Base):
    __tablename__ = "algorithms"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    title_en: Mapped[str | None] = mapped_column(String(200), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    translation_en: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    cover_image: Mapped[str | None] = mapped_column(String(500), nullable=True)

    lessons: Mapped[list["Lesson"]] = relationship(back_populates="algorithm")
    tasks: Mapped[list["Task"]] = relationship(back_populates="algorithm")
    projects: Mapped[list["Project"]] = relationship(back_populates="algorithm")


class Competency(UUIDPrimaryKeyMixin, TimestampMixin, ContentMixin, Base):
    __tablename__ = "competencies"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    translation_en: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    indicators_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    criteria_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    lesson_links: Mapped[list["LessonCompetency"]] = relationship(back_populates="competency")
    task_links: Mapped[list["TaskCompetency"]] = relationship(back_populates="competency")
    project_links: Mapped[list["ProjectCompetency"]] = relationship(back_populates="competency")


class Lesson(UUIDPrimaryKeyMixin, TimestampMixin, ContentMixin, Base):
    __tablename__ = "lessons"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    algorithm_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("algorithms.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    goal: Mapped[str] = mapped_column(Text, nullable=False, default="")
    reflection: Mapped[str] = mapped_column(Text, nullable=False, default="")
    translation_en: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    duration_min: Mapped[int] = mapped_column(Integer, default=45, nullable=False)
    order_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False, index=True)

    algorithm: Mapped[Algorithm | None] = relationship(back_populates="lessons")
    competency_links: Mapped[list["LessonCompetency"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan"
    )
    tasks: Mapped[list["Task"]] = relationship(back_populates="lesson")
    progress: Mapped[list["LessonProgress"]] = relationship(  # noqa: F821
        back_populates="lesson", cascade="all, delete-orphan"
    )


class LessonCompetency(Base):
    __tablename__ = "lesson_competencies"
    __table_args__ = (UniqueConstraint("lesson_id", "competency_id", name="uq_lesson_competency"),)

    lesson_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), primary_key=True
    )
    competency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competencies.id", ondelete="CASCADE"), primary_key=True
    )
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(String(300), nullable=True)

    lesson: Mapped[Lesson] = relationship(back_populates="competency_links")
    competency: Mapped[Competency] = relationship(back_populates="lesson_links")


class Task(UUIDPrimaryKeyMixin, TimestampMixin, ContentMixin, Base):
    __tablename__ = "tasks"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lessons.id", ondelete="SET NULL"), index=True
    )
    algorithm_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("algorithms.id", ondelete="SET NULL"), index=True
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    type: Mapped[str] = mapped_column(String(30), nullable=False, default="single_choice")
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False, default="medium")
    instructions: Mapped[str] = mapped_column(Text, nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    translation_en: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    max_score: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    rubric_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    attempts_limit: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    show_correct_answers: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    lesson: Mapped[Lesson | None] = relationship(back_populates="tasks")
    algorithm: Mapped[Algorithm | None] = relationship(back_populates="tasks")
    project: Mapped["Project | None"] = relationship(back_populates="tasks")
    options: Mapped[list["TaskOption"]] = relationship(
        back_populates="task", cascade="all, delete-orphan", order_by="TaskOption.order_no"
    )
    competency_links: Mapped[list["TaskCompetency"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class TaskOption(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "task_options"

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), index=True, nullable=False
    )
    label: Mapped[str] = mapped_column(Text, nullable=False)
    label_en: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    order_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    task: Mapped[Task] = relationship(back_populates="options")


class TaskCompetency(Base):
    __tablename__ = "task_competencies"
    __table_args__ = (UniqueConstraint("task_id", "competency_id", name="uq_task_competency"),)

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True
    )
    competency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competencies.id", ondelete="CASCADE"), primary_key=True
    )

    task: Mapped[Task] = relationship(back_populates="competency_links")
    competency: Mapped[Competency] = relationship(back_populates="task_links")


class Project(UUIDPrimaryKeyMixin, TimestampMixin, ContentMixin, Base):
    __tablename__ = "projects"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    algorithm_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("algorithms.id", ondelete="SET NULL"), index=True
    )
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    problem: Mapped[str] = mapped_column(Text, nullable=False, default="")
    goal: Mapped[str] = mapped_column(Text, nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    translation_en: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    steps_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    materials_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    tools_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    expected_result: Mapped[str] = mapped_column(Text, nullable=False, default="")
    rubric_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    algorithm: Mapped[Algorithm | None] = relationship(back_populates="projects")
    tasks: Mapped[list[Task]] = relationship(back_populates="project")
    competency_links: Mapped[list["ProjectCompetency"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectCompetency(Base):
    __tablename__ = "project_competencies"
    __table_args__ = (
        UniqueConstraint("project_id", "competency_id", name="uq_project_competency"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True
    )
    competency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competencies.id", ondelete="CASCADE"), primary_key=True
    )

    project: Mapped[Project] = relationship(back_populates="competency_links")
    competency: Mapped[Competency] = relationship(back_populates="project_links")


class Resource(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "resources"

    entity_type: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True, nullable=False)
    audience: Mapped[str] = mapped_column(String(20), default=Audience.student.value, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), default=ResourceKind.file.value, nullable=False)
    title: Mapped[str] = mapped_column(String(250), nullable=False)
    file_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mime: Mapped[str | None] = mapped_column(String(120), nullable=True)
    size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
