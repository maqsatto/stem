import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, HttpUrl, field_validator

from app.schemas.assessment import AssessmentCard, QuestionStudentOut
from app.schemas.common import ORMModel


class AlgorithmCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    slug: str | None = Field(default=None, max_length=120)
    title_en: str | None = Field(default=None, max_length=200)
    summary: str = ""
    body: str = ""
    cover_image: str | None = None
    status: str = Field(default="draft", pattern="^(draft|published|archived)$")
    sort_order: int = 0
    is_demo: bool = True


class AlgorithmUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    slug: str | None = Field(default=None, max_length=120)
    title_en: str | None = Field(default=None, max_length=200)
    summary: str | None = None
    body: str | None = None
    cover_image: str | None = None
    status: str | None = Field(default=None, pattern="^(draft|published|archived)$")
    sort_order: int | None = None
    is_demo: bool | None = None


class CompetencyCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    slug: str | None = Field(default=None, max_length=120)
    description: str = ""
    indicators_json: list = []
    criteria_json: dict = {}
    status: str = Field(default="draft", pattern="^(draft|published|archived)$")
    sort_order: int = 0
    is_demo: bool = True


class CompetencyUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    slug: str | None = Field(default=None, max_length=120)
    description: str | None = None
    indicators_json: list | None = None
    criteria_json: dict | None = None
    status: str | None = Field(default=None, pattern="^(draft|published|archived)$")
    sort_order: int | None = None
    is_demo: bool | None = None


class LessonCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=250)
    slug: str | None = Field(default=None, max_length=120)
    algorithm_id: uuid.UUID | None = None
    summary: str = ""
    body: str = ""
    goal: str = ""
    reflection: str = ""
    duration_min: int = Field(default=45, ge=1, le=600)
    order_no: int = Field(default=1, ge=1)
    competency_ids: list[uuid.UUID] = []
    status: str = Field(default="draft", pattern="^(draft|published|archived)$")
    is_demo: bool = True


class LessonUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=250)
    slug: str | None = Field(default=None, max_length=120)
    algorithm_id: uuid.UUID | None = None
    summary: str | None = None
    body: str | None = None
    goal: str | None = None
    reflection: str | None = None
    duration_min: int | None = Field(default=None, ge=1, le=600)
    order_no: int | None = Field(default=None, ge=1)
    competency_ids: list[uuid.UUID] | None = None
    status: str | None = Field(default=None, pattern="^(draft|published|archived)$")
    is_demo: bool | None = None


class TaskOptionIn(BaseModel):
    label: str = Field(min_length=1)
    is_correct: bool = False
    order_no: int = 1


class TaskCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=250)
    slug: str | None = Field(default=None, max_length=120)
    lesson_id: uuid.UUID | None = None
    algorithm_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    type: str = Field(pattern="^(single_choice|multiple_choice|open_text|file_upload|link)$")
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
    instructions: str = ""
    body: str = ""
    max_score: int = Field(default=10, ge=1, le=1000)
    rubric_json: list = []
    attempts_limit: int = Field(default=1, ge=1, le=10)
    show_correct_answers: bool = False
    competency_ids: list[uuid.UUID] = []
    options: list[TaskOptionIn] = []
    status: str = Field(default="draft", pattern="^(draft|published|archived)$")
    is_demo: bool = True


class TaskUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=250)
    slug: str | None = Field(default=None, max_length=120)
    lesson_id: uuid.UUID | None = None
    algorithm_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    type: str | None = Field(
        default=None, pattern="^(single_choice|multiple_choice|open_text|file_upload|link)$"
    )
    difficulty: str | None = Field(default=None, pattern="^(easy|medium|hard)$")
    instructions: str | None = None
    body: str | None = None
    max_score: int | None = Field(default=None, ge=1, le=1000)
    rubric_json: list | None = None
    attempts_limit: int | None = Field(default=None, ge=1, le=10)
    show_correct_answers: bool | None = None
    competency_ids: list[uuid.UUID] | None = None
    options: list[TaskOptionIn] | None = None
    status: str | None = Field(default=None, pattern="^(draft|published|archived)$")
    is_demo: bool | None = None


class ProjectCreateIn(BaseModel):
    title: str = Field(min_length=2, max_length=250)
    slug: str | None = Field(default=None, max_length=120)
    algorithm_id: uuid.UUID | None = None
    summary: str = ""
    problem: str = ""
    goal: str = ""
    body: str = ""
    steps_json: list = []
    materials_json: list = []
    tools_json: list = []
    expected_result: str = ""
    rubric_json: list = []
    competency_ids: list[uuid.UUID] = []
    status: str = Field(default="draft", pattern="^(draft|published|archived)$")
    sort_order: int = 0
    is_demo: bool = True


class ProjectUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=250)
    slug: str | None = Field(default=None, max_length=120)
    algorithm_id: uuid.UUID | None = None
    summary: str | None = None
    problem: str | None = None
    goal: str | None = None
    body: str | None = None
    steps_json: list | None = None
    materials_json: list | None = None
    tools_json: list | None = None
    expected_result: str | None = None
    rubric_json: list | None = None
    competency_ids: list[uuid.UUID] | None = None
    status: str | None = Field(default=None, pattern="^(draft|published|archived)$")
    sort_order: int | None = None
    is_demo: bool | None = None


class ResourceLinkCreateIn(BaseModel):
    entity_type: str = Field(pattern="^(algorithm|competency|lesson|task|project|assessment)$")
    entity_id: uuid.UUID
    audience: str = Field(default="student", pattern="^(public|student|teacher|admin)$")
    title: str = Field(min_length=1, max_length=250)
    url: HttpUrl

    @field_validator("url")
    @classmethod
    def https_only(cls, value: HttpUrl) -> HttpUrl:
        if value.scheme != "https":
            raise ValueError("only HTTPS links are allowed")
        return value


class ResourceUpdateIn(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=250)
    audience: str | None = Field(default=None, pattern="^(public|student|teacher|admin)$")
    url: HttpUrl | None = None


class AdminQuestionOut(QuestionStudentOut):
    pass


class AssessmentAdminDetail(AssessmentCard):
    instructions: str = ""
    scoring_config_json: dict = {}
    show_correct_answers: bool = False
    published_at: datetime | None = None
    questions: list[QuestionStudentOut] = []


class ContentItemOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    slug: str | None = None
    status: str
    is_demo: bool = False
    updated_at: datetime | None = None
    detail_url: str | None = None


class StaffCreateIn(BaseModel):
    email: EmailStr
    display_name: str = Field(min_length=2, max_length=160)
    role: str = Field(default="teacher", pattern="^(teacher|admin)$")
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserAdminOut(ORMModel):
    id: uuid.UUID
    email: EmailStr
    display_name: str
    role: str
    status: str
    created_at: datetime | None = None


class UserPatchIn(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=160)
    status: str | None = Field(default=None, pattern="^(active|disabled)$")
    role: str | None = Field(default=None, pattern="^(student|teacher|admin)$")


class PasswordResetOut(BaseModel):
    user_id: uuid.UUID
    temporary_password: str
    must_change_password: bool = True


class AuditLogOut(ORMModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None = None
    action: str
    entity: str
    entity_id: uuid.UUID | None = None
    details_json: dict = {}
    created_at: datetime
