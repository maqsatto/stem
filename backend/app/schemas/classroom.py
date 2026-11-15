import uuid
from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl, field_validator

from app.schemas.common import ORMModel


class ClassroomCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=160)


class ClassroomUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=160)
    status: str | None = Field(default=None, pattern="^(active|archived)$")


class MemberOut(BaseModel):
    student_id: uuid.UUID
    display_name: str
    joined_at: datetime


class ClassroomOut(ORMModel):
    id: uuid.UUID
    title: str
    status: str
    join_code: str | None = None
    member_count: int = 0
    teacher_name: str | None = None
    created_at: datetime | None = None


class ClassroomDetail(ClassroomOut):
    members: list[MemberOut] = []


class JoinClassIn(BaseModel):
    code: str = Field(min_length=4, max_length=16)

    @field_validator("code")
    @classmethod
    def normalize(cls, value: str) -> str:
        return value.strip().upper()


class JoinClassOut(BaseModel):
    classroom: ClassroomOut
    already_member: bool = False


class AssignmentCreateIn(BaseModel):
    classroom_id: uuid.UUID
    content_type: str = Field(pattern="^(lesson|task|project|assessment)$")
    content_id: uuid.UUID
    due_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=1000)


class AssignmentUpdateIn(BaseModel):
    due_at: datetime | None = None
    status: str | None = Field(default=None, pattern="^(active|closed)$")
    notes: str | None = Field(default=None, max_length=1000)


class SubmissionCreateIn(BaseModel):
    text: str | None = Field(default=None, max_length=20000)
    link: HttpUrl | None = None
    file_ids: list[uuid.UUID] = []
    answers: dict | None = None

    @field_validator("link")
    @classmethod
    def https_only(cls, value: HttpUrl | None) -> HttpUrl | None:
        if value is not None and value.scheme != "https":
            raise ValueError("only HTTPS links are allowed")
        return value


class SubmissionFileOut(BaseModel):
    id: uuid.UUID
    filename: str
    mime: str | None = None
    size: int | None = None
    download_url: str


class SubmissionOut(ORMModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    student_id: uuid.UUID
    student_name: str | None = None
    text: str | None = None
    link: str | None = None
    submitted_at: datetime
    status: str
    grade: int | None = None
    feedback: str | None = None
    reviewed_at: datetime | None = None
    max_score: int | None = None
    auto_checked: bool = False
    attempts_count: int = 0
    answers_json: dict = {}
    correct_option_ids: list[str] | None = None
    correct_labels: list[str] | None = None
    files: list[SubmissionFileOut] = []


class ReviewIn(BaseModel):
    grade: int = Field(ge=0, le=1000)
    feedback: str | None = Field(default=None, max_length=5000)
    return_for_revision: bool = False


class AssignmentOut(BaseModel):
    id: uuid.UUID
    classroom_id: uuid.UUID
    classroom_title: str
    content_type: str
    content_id: uuid.UUID
    content_title: str
    content_slug: str | None = None
    due_at: datetime | None = None
    status: str
    notes: str | None = None
    created_at: datetime
    student_status: str | None = None
    submission_id: uuid.UUID | None = None
    grade: int | None = None
    total_students: int = 0
    submitted_count: int = 0
    reviewed_count: int = 0
    max_score: int | None = None


class SubmissionListOut(BaseModel):
    assignment_id: uuid.UUID
    content_title: str
    total_students: int
    submitted_count: int
    reviewed_count: int
    items: list[SubmissionOut]
