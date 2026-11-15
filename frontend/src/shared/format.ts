import type { Role } from "@/shared/types";

export const statusLabels: Record<string, string> = {
  draft: "Жоба",
  published: "Жарияланған",
  archived: "Мұрағат",
  active: "Белсенді",
  closed: "Жабық",
  submitted: "Тапсырылды",
  reviewed: "Тексерілді",
  returned: "Қайта өңдеуге",
  not_started: "Басталмаған",
  in_progress: "Орындалуда",
  disabled: "Өшірілген",
};

export const roleLabels: Record<Role, string> = {
  student: "Оқушы",
  teacher: "Мұғалім",
  admin: "Әкімші",
};

export const taskTypeLabels: Record<string, string> = {
  single_choice: "Бір дұрыс жауап",
  multiple_choice: "Бірнеше дұрыс жауап",
  open_text: "Ашық жауап",
  file_upload: "Файл жүктеу",
  link: "Сілтеме",
};

export const difficultyLabels: Record<string, string> = {
  easy: "Жеңіл",
  medium: "Орташа",
  hard: "Қиын",
};

export const assessmentKindLabels: Record<string, string> = {
  pre: "Pre-test",
  post: "Post-test",
  quiz: "Тест",
};

export const levelLabels: Record<string, string> = {
  low: "Төмен",
  medium: "Орташа",
  high: "Жоғары",
};

export const audienceLabels: Record<string, string> = {
  public: "Барлығына",
  student: "Оқушыға",
  teacher: "Мұғалімге",
  admin: "Әкімшіге",
};

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("kk-KZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("kk-KZ", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatBytes(size?: number | null): string {
  if (!size) return "—";
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} КБ`;
  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

export function formatPercent(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toFixed(1)}%`;
}

export function formatDelta(value?: number | null): string {
  if (value === null || value === undefined) return "—";
  const numeric = Number(value);
  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(1)} п.п.`;
}

export function lessonPath(role: Role | string | undefined, id: string): string {
  if (role === "teacher" || role === "admin") return `/teacher/lessons/${id}`;
  return `/student/lessons/${id}`;
}

export function taskPath(role: Role | string | undefined, id: string): string {
  if (role === "teacher" || role === "admin") return `/teacher/tasks/${id}`;
  return `/student/tasks/${id}`;
}

export function projectPath(role: Role | string | undefined, id: string): string {
  if (role === "teacher" || role === "admin") return `/teacher/projects/${id}`;
  return `/student/projects/${id}`;
}

export function contentPath(
  role: Role | string | undefined,
  type: string,
  id: string,
): string {
  if (role === "admin") {
    const map: Record<string, string> = {
      lesson: "lessons",
      task: "tasks",
      project: "projects",
      assessment: "assessments",
      algorithm: "algorithms",
      competency: "competencies",
    };
    return `/admin/${map[type] ?? "content"}?edit=${id}`;
  }
  if (type === "lesson") return lessonPath(role, id);
  if (type === "task") return taskPath(role, id);
  if (type === "project") return projectPath(role, id);
  if (type === "assessment") return "/student/assessments";
  return "/";
}

export function highestRolePath(role: Role): string {
  if (role === "admin") return "/admin/content";
  if (role === "teacher") return "/teacher/dashboard";
  return "/student/dashboard";
}
