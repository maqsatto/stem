export type Role = "student" | "teacher" | "admin";
export type ContentStatus = "draft" | "published" | "archived";
export type SubmissionStatus = "submitted" | "reviewed" | "returned";
export type TaskType = "single_choice" | "multiple_choice" | "open_text" | "file_upload" | "link";
export type Difficulty = "easy" | "medium" | "hard";
export type AssessmentKind = "pre" | "post" | "quiz";

export interface User {
  id: string;
  email: string;
  role: Role;
  display_name: string;
  status: string;
  must_change_password: boolean;
  created_at?: string | null;
}

export interface ClassroomBrief {
  id: string;
  title: string;
}

export interface Me extends User {
  classrooms: ClassroomBrief[];
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Ref {
  id: string;
  title: string;
  slug: string;
}

export interface Resource {
  id: string;
  title: string;
  audience: string;
  kind: string;
  url: string | null;
  original_filename: string | null;
  mime: string | null;
  size: number | null;
  download_url: string | null;
}

export interface AlgorithmBrief extends Ref {
  title_en?: string | null;
}

export interface LessonBrief extends Ref {
  order_no: number;
}

export interface TaskBrief extends Ref {
  type: TaskType;
  difficulty: Difficulty;
}

export interface ProjectBrief extends Ref {
  summary: string;
}

export interface AlgorithmCard {
  id: string;
  slug: string;
  title: string;
  title_en?: string | null;
  summary: string;
  cover_image?: string | null;
  is_demo: boolean;
  status: ContentStatus;
}

export interface AlgorithmDetail extends AlgorithmCard {
  body: string;
  competencies: Ref[];
  lessons: LessonBrief[];
  tasks: TaskBrief[];
  projects: ProjectBrief[];
  resources: Resource[];
}

export interface CompetencyCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  is_demo: boolean;
  status: ContentStatus;
}

export interface CompetencyDetail extends CompetencyCard {
  indicators_json: string[];
  criteria_json: Record<string, string>;
  algorithms: AlgorithmBrief[];
  lessons: LessonBrief[];
  tasks: TaskBrief[];
  projects: ProjectBrief[];
}

export interface LessonCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  order_no: number;
  duration_min: number;
  is_demo: boolean;
  status: ContentStatus;
  algorithm: AlgorithmBrief | null;
  competencies: Ref[];
  completed: boolean;
}

export interface LessonDetail extends LessonCard {
  body: string;
  goal: string;
  reflection: string;
  tasks: TaskBrief[];
  resources: Resource[];
}

export interface TaskOption {
  id: string;
  label: string;
  order_no: number;
  is_correct?: boolean | null;
}

export interface RubricItem {
  criterion: string;
  points: number;
}

export interface TaskCard {
  id: string;
  slug: string;
  title: string;
  type: TaskType;
  difficulty: Difficulty;
  max_score: number;
  is_demo: boolean;
  status: ContentStatus;
  algorithm: AlgorithmBrief | null;
  lesson: LessonBrief | null;
  competencies: Ref[];
  answer_key_available: boolean;
}

export interface TaskDetail extends TaskCard {
  instructions: string;
  body: string;
  rubric_json: RubricItem[];
  attempts_limit: number;
  show_correct_answers: boolean;
  options: TaskOption[];
  resources: Resource[];
}

export interface ProjectCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  is_demo: boolean;
  status: ContentStatus;
  algorithm: AlgorithmBrief | null;
  competencies: Ref[];
}

export interface ProjectDetail extends ProjectCard {
  problem: string;
  goal: string;
  body: string;
  steps_json: string[];
  materials_json: string[];
  tools_json: string[];
  expected_result: string;
  rubric_json: RubricItem[];
  tasks: TaskBrief[];
  resources: Resource[];
}

export interface MatrixRow {
  algorithm_id: string;
  algorithm_title: string;
  algorithm_slug: string;
  competencies: Ref[];
  lesson_count: number;
  task_count: number;
  project_count: number;
}

export interface Classroom {
  id: string;
  title: string;
  status: string;
  join_code: string | null;
  member_count: number;
  teacher_name: string | null;
  created_at: string | null;
}

export interface Member {
  student_id: string;
  display_name: string;
  joined_at: string;
}

export interface ClassroomDetail extends Classroom {
  members: Member[];
}

export interface JoinClassResponse {
  classroom: Classroom;
  already_member: boolean;
}

export interface Assignment {
  id: string;
  classroom_id: string;
  classroom_title: string;
  content_type: "lesson" | "task" | "project" | "assessment";
  content_id: string;
  content_title: string;
  content_slug: string | null;
  due_at: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  student_status: string | null;
  submission_id: string | null;
  grade: number | null;
  total_students: number;
  submitted_count: number;
  reviewed_count: number;
  max_score: number | null;
}

export interface SubmissionFile {
  id: string;
  filename: string;
  mime: string | null;
  size: number | null;
  download_url: string;
}

export interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name: string | null;
  text: string | null;
  link: string | null;
  submitted_at: string;
  status: SubmissionStatus;
  grade: number | null;
  feedback: string | null;
  reviewed_at: string | null;
  max_score: number | null;
  auto_checked: boolean;
  attempts_count: number;
  answers_json: { selected_option_ids?: string[] };
  correct_option_ids: string[] | null;
  correct_labels: string[] | null;
  files: SubmissionFile[];
}

export interface SubmissionList {
  assignment_id: string;
  content_title: string;
  total_students: number;
  submitted_count: number;
  reviewed_count: number;
  items: Submission[];
}

export interface AssessmentOption {
  id: string;
  label: string;
  order_no: number;
  is_correct?: boolean | null;
}

export interface AssessmentQuestion {
  id: string;
  type: "single_choice" | "multiple_choice" | "open_text";
  body: string;
  points: number;
  competency_id: string | null;
  competency_title: string | null;
  order_no: number;
  options: AssessmentOption[];
}

export interface AssessmentCard {
  id: string;
  name: string;
  slug: string;
  kind: AssessmentKind;
  version: number;
  methodology_key: string;
  description: string;
  status: ContentStatus;
  question_count: number;
  max_score: number;
  attempts_limit: number;
  is_demo: boolean;
  attempts_used: number;
  best_score: number | null;
  last_status: string | null;
  can_attempt: boolean;
}

export interface AssessmentDetail extends AssessmentCard {
  instructions: string;
  show_correct_answers: boolean;
  questions: AssessmentQuestion[];
}

export interface CompetencyScore {
  competency_id: string;
  title: string;
  slug: string;
  earned: number;
  maximum: number;
  percent: number;
  level: string | null;
  delta_pp: number | null;
}

export interface AttemptAnswer {
  question_id: string;
  answer_json: { selected_option_ids?: string[]; text?: string };
  earned_points: number | null;
  correct_option_ids: string[] | null;
  correct_labels: string[] | null;
  correct_text: string | null;
}

export interface Attempt {
  id: string;
  assessment_id: string;
  assessment_name: string;
  kind: AssessmentKind;
  methodology_key: string;
  assessment_version: number;
  status: string;
  started_at: string;
  submitted_at: string | null;
  total_score: number | null;
  max_score: number | null;
  percent: number | null;
  attempt_no: number;
  competency_scores: CompetencyScore[];
  answers: AttemptAnswer[];
}

export interface ComparisonRow {
  competency_id: string;
  title: string;
  slug: string;
  pre_percent: number;
  post_percent: number;
  delta_pp: number;
  level: string | null;
}

export interface PrePostComparison {
  methodology_key: string;
  pre_assessment: string;
  post_assessment: string;
  pre_date: string;
  post_date: string;
  rows: ComparisonRow[];
  pre_overall: number;
  post_overall: number;
  overall_delta_pp: number;
  demo_notice: string | null;
}

export interface StudentProgress {
  lessons_completed: number;
  lessons_total: number;
  tasks_submitted: number;
  tasks_reviewed: number;
  average_grade: number | null;
}

export interface StudentResults {
  progress: StudentProgress;
  attempts: AssessmentCard[];
  competency_summary: CompetencyScore[];
  comparisons: PrePostComparison[];
  demo_notice: string | null;
  message: string | null;
}

export interface ClassStudentResult {
  student_id: string;
  display_name: string;
  lessons_completed: number;
  tasks_submitted: number;
  tasks_reviewed: number;
  average_grade: number | null;
  pre_scores: Record<string, number>;
  post_scores: Record<string, number>;
  delta_pp: Record<string, number>;
  pre_overall: number | null;
  post_overall: number | null;
}

export interface CompetencyAverage {
  competency_id: string;
  slug: string;
  title: string;
  pre_average: number | null;
  post_average: number | null;
  delta_average_pp: number | null;
  students_with_pre: number;
  students_with_post: number;
}

export interface ClassResults {
  classroom_id: string;
  classroom_title: string;
  students_total: number;
  students: ClassStudentResult[];
  competency_averages: CompetencyAverage[];
  demo_notice: string | null;
}

export interface TeacherDashboard {
  classrooms: number;
  students: number;
  assignments: number;
  pending_reviews: number;
  recent_assignments: {
    id: string;
    classroom_id: string;
    content_type: string;
    content_id: string;
    due_at: string | null;
    status: string;
  }[];
}

export interface ContentOverview {
  algorithms: number;
  competencies: number;
  lessons: number;
  tasks: number;
  projects: number;
  assessments: number;
  resources: number;
  users: number;
  classrooms: number;
  submissions_pending: number;
}

export interface AdminUser extends User {
  created_at: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details_json: Record<string, unknown>;
  created_at: string;
}

export interface ContentItem {
  id: string;
  type: "algorithm" | "competency" | "lesson" | "task" | "project" | "assessment";
  title: string;
  slug: string | null;
  status: ContentStatus;
  is_demo: boolean;
  updated_at: string | null;
  detail_url: string | null;
}

export interface AdminAlgorithm extends AlgorithmDetail {
  sort_order: number;
  published_at: string | null;
}

export interface AdminCompetency extends CompetencyDetail {
  sort_order: number;
  published_at: string | null;
}

export interface AdminLesson extends LessonDetail {
  competency_ids: string[];
  published_at: string | null;
}

export interface AdminTask extends TaskDetail {
  competency_ids: string[];
  published_at?: string | null;
}

export interface AdminProject extends ProjectDetail {
  competency_ids: string[];
  published_at: string | null;
}

export interface AdminAssessment extends AssessmentDetail {
  scoring_config_json: Record<string, unknown>;
  published_at: string | null;
}

export interface PasswordReset {
  user_id: string;
  temporary_password: string;
  must_change_password: boolean;
}

export interface MessageResponse {
  message: string;
}
