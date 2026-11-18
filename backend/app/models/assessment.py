import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.models.enums import AttemptStatus, ContentStatus


class Assessment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "assessments"

    name: Mapped[str] = mapped_column(String(250), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    methodology_key: Mapped[str] = mapped_column(
        String(120), default="default", nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    instructions: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(
        String(20), default=ContentStatus.draft.value, nullable=False, index=True
    )
    translation_en: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    scoring_config_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    attempts_limit: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    show_correct_answers: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    questions: Mapped[list["AssessmentQuestion"]] = relationship(
        back_populates="assessment",
        cascade="all, delete-orphan",
        order_by="AssessmentQuestion.order_no",
    )
    attempts: Mapped[list["AssessmentAttempt"]] = relationship(
        back_populates="assessment", cascade="all, delete-orphan"
    )


class AssessmentQuestion(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "assessment_questions"

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), index=True,
        nullable=False
    )
    type: Mapped[str] = mapped_column(String(30), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    body_en: Mapped[str] = mapped_column(Text, default="", nullable=False)
    competency_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competencies.id", ondelete="SET NULL"), index=True
    )
    competency_ids_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    competency_weights_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    options_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    order_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    assessment: Mapped[Assessment] = relationship(back_populates="questions")
    competency: Mapped["Competency | None"] = relationship()  # noqa: F821


class AssessmentAttempt(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "assessment_attempts"
    __table_args__ = (
        UniqueConstraint("assessment_id", "student_id", "attempt_no", name="uq_attempt_number"),
    )

    assessment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessments.id", ondelete="CASCADE"), index=True,
        nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    assignment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assignments.id", ondelete="SET NULL"), index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default=AttemptStatus.in_progress.value, nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    attempt_no: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    assessment_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    assessment: Mapped[Assessment] = relationship(back_populates="attempts")
    answers: Mapped[list["AssessmentAnswer"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )
    competency_scores: Mapped[list["AssessmentCompetencyScore"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan"
    )


class AssessmentAnswer(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "assessment_answers"
    __table_args__ = (UniqueConstraint("attempt_id", "question_id", name="uq_attempt_question"),)

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessment_attempts.id", ondelete="CASCADE"), index=True,
        nullable=False
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessment_questions.id", ondelete="CASCADE"), index=True,
        nullable=False
    )
    answer_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    earned_points: Mapped[float | None] = mapped_column(Float, nullable=True)
    answered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    attempt: Mapped[AssessmentAttempt] = relationship(back_populates="answers")


class AssessmentCompetencyScore(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "assessment_competency_scores"
    __table_args__ = (
        UniqueConstraint("attempt_id", "competency_id", name="uq_attempt_competency_score"),
    )

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assessment_attempts.id", ondelete="CASCADE"), index=True,
        nullable=False
    )
    competency_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("competencies.id", ondelete="CASCADE"), index=True,
        nullable=False
    )
    earned: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    maximum: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    percent: Mapped[float] = mapped_column(Float, default=0, nullable=False)

    attempt: Mapped[AssessmentAttempt] = relationship(back_populates="competency_scores")
    competency: Mapped["Competency"] = relationship()  # noqa: F821
