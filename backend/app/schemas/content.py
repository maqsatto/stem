import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class RefOut(ORMModel):
    id: uuid.UUID
    title: str
    slug: str


class CompetencyRef(RefOut):
    pass


class AlgorithmBrief(RefOut):
    title_en: str | None = None


class LessonBrief(RefOut):
    order_no: int


class TaskBrief(RefOut):
    type: str
    difficulty: str


class ProjectBrief(RefOut):
    summary: str = ""


class ResourceOut(ORMModel):
    id: uuid.UUID
    title: str
    audience: str
    kind: str
    url: str | None = None
    original_filename: str | None = None
    mime: str | None = None
    size: int | None = None
    download_url: str | None = None


class AlgorithmCard(ORMModel):
    id: uuid.UUID
    slug: str
    title: str
    title_en: str | None = None
    summary: str
    cover_image: str | None = None
    is_demo: bool = False
    status: str = "published"


class AlgorithmDetail(AlgorithmCard):
    body: str
    competencies: list[CompetencyRef] = []
    lessons: list[LessonBrief] = []
    tasks: list[TaskBrief] = []
    projects: list[ProjectBrief] = []
    resources: list[ResourceOut] = []


class CompetencyCard(ORMModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str
    is_demo: bool = False
    status: str = "published"


class CompetencyDetail(CompetencyCard):
    indicators_json: list = []
    criteria_json: dict = {}
    algorithms: list[AlgorithmBrief] = []
    lessons: list[LessonBrief] = []
    tasks: list[TaskBrief] = []
    projects: list[ProjectBrief] = []


class LessonCard(ORMModel):
    id: uuid.UUID
    slug: str
    title: str
    summary: str
    order_no: int
    duration_min: int
    is_demo: bool = False
    status: str = "published"
    algorithm: AlgorithmBrief | None = None
    competencies: list[CompetencyRef] = []
    completed: bool = False


class LessonDetail(LessonCard):
    body: str
    goal: str
    reflection: str
    tasks: list[TaskBrief] = []
    resources: list[ResourceOut] = []


class TaskOptionOut(BaseModel):
    id: uuid.UUID
    label: str
    order_no: int
    is_correct: bool | None = None


class TaskCard(ORMModel):
    id: uuid.UUID
    slug: str
    title: str
    type: str
    difficulty: str
    max_score: int
    is_demo: bool = False
    status: str = "published"
    algorithm: AlgorithmBrief | None = None
    lesson: LessonBrief | None = None
    competencies: list[CompetencyRef] = []
    answer_key_available: bool = False


class TaskDetail(TaskCard):
    instructions: str
    body: str
    rubric_json: list = []
    attempts_limit: int = 1
    show_correct_answers: bool = False
    options: list[TaskOptionOut] = []
    resources: list[ResourceOut] = []


class ProjectCard(ORMModel):
    id: uuid.UUID
    slug: str
    title: str
    summary: str
    is_demo: bool = False
    status: str = "published"
    algorithm: AlgorithmBrief | None = None
    competencies: list[CompetencyRef] = []


class ProjectDetail(ProjectCard):
    problem: str
    goal: str
    body: str
    steps_json: list = []
    materials_json: list = []
    tools_json: list = []
    expected_result: str
    rubric_json: list = []
    tasks: list[TaskBrief] = []
    resources: list[ResourceOut] = []


class MatrixRow(BaseModel):
    algorithm_id: uuid.UUID
    algorithm_title: str
    algorithm_slug: str
    competencies: list[CompetencyRef] = []
    lesson_count: int = 0
    task_count: int = 0
    project_count: int = 0


class ContentOverview(BaseModel):
    algorithms: int
    competencies: int
    lessons: int
    tasks: int
    projects: int
    assessments: int
    resources: int
    users: int
    classrooms: int
    submissions_pending: int


class SearchParams(BaseModel):
    q: str | None = Field(default=None, max_length=120)
    algorithm_id: uuid.UUID | None = None
    competency_id: uuid.UUID | None = None
    difficulty: str | None = None
    lesson_id: uuid.UUID | None = None
    status: str | None = None
    sort: str | None = "order"


class TeacherResourceOut(ResourceOut):
    uploaded_by_name: str | None = None
    created_at: datetime | None = None
