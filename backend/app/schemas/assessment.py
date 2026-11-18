import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMModel


class OptionPublic(BaseModel):
    label_en: str = ""
    id: str
    label: str
    order_no: int
    is_correct: bool | None = None


class QuestionStudentOut(BaseModel):
    body_en: str = ""
    id: uuid.UUID
    type: str
    body: str
    points: int
    competency_id: uuid.UUID | None = None
    competency_ids: list[uuid.UUID] = []
    competency_weights: dict[str, float] = {}
    competency_title: str | None = None
    order_no: int
    options: list[OptionPublic] = []


class AssessmentCard(ORMModel):
    translation_en: dict[str, str] = {}
    id: uuid.UUID
    name: str
    slug: str
    kind: str
    version: int
    methodology_key: str
    description: str
    status: str
    question_count: int = 0
    max_score: int = 0
    attempts_limit: int = 1
    is_demo: bool = False
    attempts_used: int = 0
    best_score: float | None = None
    last_status: str | None = None
    can_attempt: bool = True


class AssessmentStudentDetail(AssessmentCard):
    instructions: str
    show_correct_answers: bool = False
    questions: list[QuestionStudentOut] = []


class AnswerIn(BaseModel):
    question_id: uuid.UUID
    answer_json: dict = Field(default_factory=dict)


class AttemptStartIn(BaseModel):
    assignment_id: uuid.UUID | None = None


class AnswersPatchIn(BaseModel):
    answers: list[AnswerIn] = Field(min_length=1)


class AttemptAnswerOut(BaseModel):
    question_id: uuid.UUID
    answer_json: dict
    earned_points: float | None = None
    correct_option_ids: list[str] | None = None
    correct_labels: list[str] | None = None
    correct_text: str | None = None


class CompetencyScoreOut(BaseModel):
    title_en: str | None = None
    competency_id: uuid.UUID
    title: str
    slug: str
    earned: float
    maximum: float
    percent: float
    level: str | None = None
    delta_pp: float | None = None


class AttemptOut(BaseModel):
    id: uuid.UUID
    assessment_id: uuid.UUID
    assessment_name: str
    kind: str
    methodology_key: str
    assessment_version: int
    status: str
    started_at: datetime
    submitted_at: datetime | None = None
    total_score: float | None = None
    max_score: float | None = None
    percent: float | None = None
    attempt_no: int
    competency_scores: list[CompetencyScoreOut] = []
    answers: list[AttemptAnswerOut] = []


class ComparisonRow(BaseModel):
    title_en: str | None = None
    competency_id: uuid.UUID
    title: str
    slug: str
    pre_percent: float
    post_percent: float
    delta_pp: float
    level: str | None = None


class PrePostComparisonOut(BaseModel):
    methodology_key: str
    pre_assessment: str
    post_assessment: str
    pre_date: datetime
    post_date: datetime
    rows: list[ComparisonRow]
    pre_overall: float
    post_overall: float
    overall_delta_pp: float
    demo_notice: str | None = None


class StudentProgressOut(BaseModel):
    lessons_completed: int
    lessons_total: int
    tasks_submitted: int
    tasks_reviewed: int
    average_grade: float | None = None


class StudentResultsOut(BaseModel):
    progress: StudentProgressOut
    attempts: list[AssessmentCard] = []
    competency_summary: list[CompetencyScoreOut] = []
    comparisons: list[PrePostComparisonOut] = []
    demo_notice: str | None = None
    message: str | None = None


class ClassStudentResultOut(BaseModel):
    student_id: uuid.UUID
    display_name: str
    lessons_completed: int
    tasks_submitted: int
    tasks_reviewed: int
    average_grade: float | None = None
    pre_scores: dict[str, float] = {}
    post_scores: dict[str, float] = {}
    delta_pp: dict[str, float] = {}
    pre_overall: float | None = None
    post_overall: float | None = None


class ClassResultsOut(BaseModel):
    classroom_id: uuid.UUID
    classroom_title: str
    students_total: int
    students: list[ClassStudentResultOut]
    competency_averages: list[dict] = []
    demo_notice: str | None = None


class AssessmentQuestionIn(BaseModel):
    body_en: str = ""
    type: str = Field(pattern="^(single_choice|multiple_choice|open_text)$")
    body: str = Field(min_length=1)
    competency_id: uuid.UUID | None = None
    competency_ids: list[uuid.UUID] = Field(default_factory=list, max_length=5)
    competency_weights: dict[uuid.UUID, float] = Field(default_factory=dict)
    points: int = Field(default=1, ge=1, le=100)
    options: list[dict] = []
    order_no: int = 1

    @field_validator("options")
    @classmethod
    def validate_options(cls, value: list[dict]) -> list[dict]:
        for option in value:
            if not isinstance(option, dict) or "label" not in option:
                raise ValueError("each option must contain a label")
        return value


class AssessmentEnglishIn(BaseModel):
    name: str = ""
    description: str = ""
    instructions: str = ""


class AssessmentCreateIn(BaseModel):
    translation_en: AssessmentEnglishIn = Field(default_factory=AssessmentEnglishIn)
    name: str = Field(min_length=3, max_length=250)
    slug: str | None = None
    kind: str = Field(pattern="^(pre|post|quiz)$")
    version: int = Field(default=1, ge=1)
    methodology_key: str = Field(default="default", max_length=120)
    description: str = ""
    instructions: str = ""
    status: str = Field(default="draft", pattern="^(draft|published|archived)$")
    scoring_config_json: dict = {}
    attempts_limit: int = Field(default=1, ge=1, le=10)
    show_correct_answers: bool = False
    is_demo: bool = True
    questions: list[AssessmentQuestionIn] = []


class AssessmentUpdateIn(BaseModel):
    translation_en: AssessmentEnglishIn | None = None
    name: str | None = Field(default=None, min_length=3, max_length=250)
    status: str | None = Field(default=None, pattern="^(draft|published|archived)$")
    slug: str | None = None
    kind: str | None = Field(default=None, pattern="^(pre|post|quiz)$")
    version: int | None = Field(default=None, ge=1)
    methodology_key: str | None = Field(default=None, max_length=120)
    description: str | None = None
    instructions: str | None = None
    scoring_config_json: dict | None = None
    attempts_limit: int | None = Field(default=None, ge=1, le=10)
    show_correct_answers: bool | None = None
    is_demo: bool | None = None
    questions: list[AssessmentQuestionIn] | None = None
