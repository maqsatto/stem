import type { AlgorithmCard, AssessmentCard, AssessmentDetail, CompetencyCard, LessonCard, ProjectCard, Ref, TaskCard, TaskDetail } from "@/shared/types";
import type { Language } from "@/shared/preferences";

/** Missing translations fall back field by field to the original content. */
export function localizeLesson<T extends LessonCard>(lesson: T, language: Language): T {
  if (language !== "en" || !lesson.translation_en) return lesson;
  const translated = { ...lesson };
  for (const key of ["title", "summary", "body", "goal", "reflection"] as const) {
    const value = lesson.translation_en[key];
    if (typeof value === "string" && value.trim() && key in translated) {
      (translated as unknown as Record<string, unknown>)[key] = value;
    }
  }
  return translated;
}

export function localizeAlgorithm<T extends AlgorithmCard>(algorithm: T, language: Language): T {
  if (language !== "en") return algorithm;
  const translated = { ...algorithm };
  if (algorithm.title_en?.trim()) translated.title = algorithm.title_en;
  for (const key of ["summary", "body"] as const) {
    const value = algorithm.translation_en?.[key];
    if (value?.trim() && key in translated) (translated as unknown as Record<string, unknown>)[key] = value;
  }
  return translated;
}

export function localizeProject<T extends ProjectCard>(project: T, language: Language): T {
  if (language !== "en" || !project.translation_en) return project;
  const translated = { ...project };
  for (const key of ["title", "summary", "problem", "goal", "body", "expected_result", "steps_json", "materials_json", "tools_json"] as const) {
    const value = project.translation_en[key];
    if (key in translated && (typeof value === "string" ? Boolean(value.trim()) : Array.isArray(value) && value.some((item) => item.trim()))) {
      (translated as unknown as Record<string, unknown>)[key] = value;
    }
  }
  if ("rubric_json" in project && project.translation_en.rubric_labels) {
    const rubric = (project as unknown as { rubric_json: { criterion: string; points: number }[] }).rubric_json;
    (translated as unknown as { rubric_json: typeof rubric }).rubric_json = rubric.map((item, index) => ({ ...item, criterion: project.translation_en?.rubric_labels?.[index]?.trim() || item.criterion }));
  }
  return translated;
}

export function localizeTask<T extends TaskCard>(task: T, language: Language): T {
  if (language !== "en") return task;
  const translated = { ...task };
  for (const key of ["title", "instructions", "body"] as const) {
    const value = task.translation_en?.[key];
    if (value?.trim() && key in translated) (translated as unknown as Record<string, unknown>)[key] = value;
  }
  if ("rubric_json" in task && task.translation_en?.rubric_labels) {
    const rubric = (task as unknown as TaskDetail).rubric_json;
    (translated as unknown as Pick<TaskDetail, "rubric_json">).rubric_json = rubric.map((item, index) => ({ ...item, criterion: task.translation_en?.rubric_labels?.[index]?.trim() || item.criterion }));
  }
  if ("options" in task) {
    (translated as T & Pick<TaskDetail, "options">).options = (task as unknown as TaskDetail).options.map((option) => ({ ...option, label: option.label_en?.trim() || option.label }));
  }
  return translated;
}

export function localizeAssessment<T extends AssessmentCard>(assessment: T, language: Language): T {
  if (language !== "en") return assessment;
  const translated = { ...assessment };
  for (const key of ["name", "description", "instructions"] as const) {
    const value = assessment.translation_en?.[key];
    if (value?.trim() && key in translated) (translated as unknown as Record<string, unknown>)[key] = value;
  }
  if ("questions" in assessment) {
    (translated as T & Pick<AssessmentDetail, "questions">).questions = (assessment as unknown as AssessmentDetail).questions.map((question) => ({ ...question, body: question.body_en?.trim() || question.body, options: question.options.map((option) => ({ ...option, label: option.label_en?.trim() || option.label })) }));
  }
  return translated;
}

export function localizeCompetency<T extends CompetencyCard>(competency: T, language: Language): T {
  if (language !== "en" || !competency.translation_en) return competency;
  const translated = { ...competency };
  for (const key of ["title", "description", "indicators_json", "criteria_json"] as const) {
    const value = competency.translation_en[key];
    if (key in translated && (typeof value === "string" ? Boolean(value.trim()) : Array.isArray(value) ? value.some((item) => item.trim()) : value && Object.keys(value).length > 0)) (translated as unknown as Record<string, unknown>)[key] = value;
  }
  return translated;
}

export function localizeRefTitle(ref: Ref & { title_en?: string | null }, language: Language): string {
  return language === "en" ? ref.translation_en?.title?.trim() || ref.title_en?.trim() || ref.title : ref.title;
}
