import { expect, it } from "vitest";
import { localizeAlgorithm, localizeAssessment, localizeCompetency, localizeLesson, localizeProject, localizeTask } from "@/shared/localizeContent";
import type { AlgorithmDetail, AssessmentDetail, CompetencyDetail, LessonDetail, ProjectDetail, TaskDetail } from "@/shared/types";

it("uses English fields where provided and preserves original fields otherwise", () => {
  const lesson = {
    id: "1", slug: "lesson", title: "Сабақ", summary: "Қысқаша", body: "Мәтін",
    goal: "Мақсат", reflection: "Сұрақ", order_no: 1, duration_min: 45,
    is_demo: true, status: "published", algorithm: null, competencies: [], completed: false,
    tasks: [], resources: [], translation_en: { title: "Lesson", body: "Text", goal: "" },
  } satisfies LessonDetail;
  const english = localizeLesson(lesson, "en");
  expect(english.title).toBe("Lesson");
  expect(english.body).toBe("Text");
  expect(english.goal).toBe("Мақсат");
  expect(localizeLesson(lesson, "kk")).toBe(lesson);
  expect(lesson.title).toBe("Сабақ");
});

it("uses the English algorithm text without changing the original", () => {
  const algorithm = { id: "a", slug: "a", title: "Жіктеу", title_en: "Classification",
    summary: "Қысқаша", body: "Мәтін", translation_en: { summary: "Summary", body: "Body" },
    is_demo: true, status: "published", competencies: [], lessons: [], tasks: [], projects: [], resources: [] } satisfies AlgorithmDetail;
  expect(localizeAlgorithm(algorithm, "en")).toMatchObject({ title: "Classification", summary: "Summary", body: "Body" });
  expect(localizeAlgorithm(algorithm, "kk")).toBe(algorithm);
  expect(algorithm.title).toBe("Жіктеу");
});

it("localizes project content and keeps untranslated lists", () => {
  const project = { id: "p", slug: "p", title: "Жоба", summary: "Сипаттама", problem: "Мәселе", goal: "Мақсат", body: "Мәтін", expected_result: "Нәтиже", steps_json: ["Бір"], materials_json: ["Қағаз"], tools_json: [], rubric_json: [], tasks: [], resources: [], is_demo: true, status: "published", algorithm: null, competencies: [], translation_en: { title: "Project", steps_json: ["One"], materials_json: [] } } satisfies ProjectDetail;
  expect(localizeProject(project, "en")).toMatchObject({ title: "Project", summary: "Сипаттама", steps_json: ["One"], materials_json: ["Қағаз"] });
  expect(localizeProject(project, "kk")).toBe(project);
});

it("localizes task options while retaining their answer identities", () => {
  const task = { id: "t", slug: "t", title: "Тапсырма", type: "single_choice", difficulty: "easy", max_score: 1, is_demo: true, status: "published", algorithm: null, lesson: null, competencies: [], answer_key_available: false, instructions: "Нұсқау", body: "Сұрақ", attempts_limit: 1, show_correct_answers: false, resources: [], options: [{ id: "o", label: "Иә", label_en: "Yes", order_no: 1 }], translation_en: { title: "Task", body: "Question", rubric_labels: ["Clarity"] }, rubric_json: [{ criterion: "Айқындық", points: 3 }] } satisfies TaskDetail;
  expect(localizeTask(task, "en")).toMatchObject({ title: "Task", body: "Question", instructions: "Нұсқау", rubric_json: [{ criterion: "Clarity", points: 3 }], options: [{ id: "o", label: "Yes" }] });
  expect(localizeTask(task, "kk")).toBe(task);
});

it("localizes assessment questions without changing answer ids", () => {
  const assessment = { id: "a", name: "Тест", slug: "test", kind: "quiz", version: 1, methodology_key: "m", description: "Сипаттама", instructions: "Нұсқау", status: "published", question_count: 1, max_score: 1, attempts_limit: 1, is_demo: true, attempts_used: 0, best_score: null, last_status: null, can_attempt: true, show_correct_answers: false, translation_en: { name: "Test" }, questions: [{ id: "q", type: "single_choice", body: "Сұрақ", body_en: "Question", points: 1, competency_id: null, competency_title: null, order_no: 1, options: [{ id: "o", label: "Иә", label_en: "Yes", order_no: 1 }] }] } satisfies AssessmentDetail;
  expect(localizeAssessment(assessment, "en")).toMatchObject({ name: "Test", description: "Сипаттама", questions: [{ id: "q", body: "Question", options: [{ id: "o", label: "Yes" }] }] });
  expect(localizeAssessment(assessment, "kk")).toBe(assessment);
});

it("localizes competency indicators and leaves missing criteria intact", () => {
  const competency = { id: "c", slug: "c", title: "Ойлау", description: "Сипаттама", status: "published", is_demo: true, indicators_json: ["Белгі"], criteria_json: { low: "Бастапқы" }, algorithms: [], lessons: [], tasks: [], projects: [], translation_en: { title: "Thinking", indicators_json: ["Indicator"], criteria_json: {} } } satisfies CompetencyDetail;
  expect(localizeCompetency(competency, "en")).toMatchObject({ title: "Thinking", description: "Сипаттама", indicators_json: ["Indicator"], criteria_json: { low: "Бастапқы" } });
  expect(localizeCompetency(competency, "kk")).toBe(competency);
});
