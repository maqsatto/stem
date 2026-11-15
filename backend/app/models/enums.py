from enum import StrEnum


class Role(StrEnum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class UserStatus(StrEnum):
    active = "active"
    disabled = "disabled"


class ContentStatus(StrEnum):
    draft = "draft"
    published = "published"
    archived = "archived"


class Audience(StrEnum):
    public = "public"
    student = "student"
    teacher = "teacher"
    admin = "admin"


class ResourceKind(StrEnum):
    file = "file"
    link = "link"


class AssignmentContentType(StrEnum):
    lesson = "lesson"
    task = "task"
    project = "project"
    assessment = "assessment"


class AssignmentStatus(StrEnum):
    active = "active"
    closed = "closed"


class SubmissionStatus(StrEnum):
    submitted = "submitted"
    reviewed = "reviewed"
    returned = "returned"


class TaskType(StrEnum):
    single_choice = "single_choice"
    multiple_choice = "multiple_choice"
    open_text = "open_text"
    file_upload = "file_upload"
    link = "link"


class Difficulty(StrEnum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class AssessmentKind(StrEnum):
    pre = "pre"
    post = "post"
    quiz = "quiz"


class QuestionType(StrEnum):
    single_choice = "single_choice"
    multiple_choice = "multiple_choice"
    open_text = "open_text"


class AttemptStatus(StrEnum):
    in_progress = "in_progress"
    submitted = "submitted"
