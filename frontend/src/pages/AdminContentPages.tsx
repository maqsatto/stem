import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CopyPlus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { errorMessage, http } from "@/shared/api";
import { omitUnchangedAssessmentStructure } from "@/shared/assessmentChanges";
import {
  AdminEditorCard,
  AdminEmptyEditor,
  AdminListButton,
  CompetencyPicker,
  DemoField,
  DraftPreview,
  OptionEditor,
  RubricEditor,
  StatusField,
  TextListEditor,
  optionFromApi,
  useEditParam,
  type OptionDraft,
  type RefOption,
} from "@/shared/components/AdminShared";
import { HtmlEditor } from "@/shared/components/HtmlEditor";
import { difficultyLabels, statusLabels, taskTypeLabels } from "@/shared/format";
import { useTitle } from "@/shared/hooks";
import { remapRubricLabels } from "@/shared/rubricLabels";
import { useLabel, usePreferences, useText } from "@/shared/preferences";
import { localizeAssessment, localizeLesson, localizeProject, localizeTask } from "@/shared/localizeContent";
import type {
  AdminAssessment,
  AdminLesson,
  AdminProject,
  AdminTask,
  AlgorithmCard,
  AssessmentKind,
  AssessmentOption,
  AssessmentQuestion,
  CompetencyCard,
  ContentStatus,
  LessonCard,
  ProjectCard,
  TaskType,
} from "@/shared/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  DemoNotice,
  Field,
  PageHeader,
  PageLoader,
  Select,
  TextArea,
  TextInput,
} from "@/shared/ui";

function useAdminReferences() {
  const algorithms = useQuery({
    queryKey: ["admin", "algorithms"],
    queryFn: () => http.get<AlgorithmCard[]>("/admin/algorithms"),
  });
  const competencies = useQuery({
    queryKey: ["admin", "competencies"],
    queryFn: () => http.get<CompetencyCard[]>("/admin/competencies"),
  });
  const lessons = useQuery({
    queryKey: ["admin", "lessons"],
    queryFn: () => http.get<LessonCard[]>("/admin/lessons"),
  });
  const projects = useQuery({
    queryKey: ["admin", "projects"],
    queryFn: () => http.get<ProjectCard[]>("/admin/projects"),
  });
  return {
    algorithms: (algorithms.data ?? []).map((item) => ({ id: item.id, title: item.title })),
    competencies: (competencies.data ?? []).map((item) => ({ id: item.id, title: item.title })),
    lessons: (lessons.data ?? []).map((item) => ({
      id: item.id,
      title: `${item.order_no}. ${item.title}`,
    })),
    projects: (projects.data ?? []).map((item) => ({ id: item.id, title: item.title })),
  };
}

function RefSelect({
  label,
  htmlFor,
  value,
  onChange,
  options,
  emptyLabel = "Таңдалмаған",
}: {
  label: string;
  htmlFor: string;
  value: string;
  onChange: (value: string) => void;
  options: RefOption[];
  emptyLabel?: string;
}) {
  return (
    <Field label={label} htmlFor={htmlFor}>
      <Select id={htmlFor} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/* ------------------------------------------------------------------------- */
/* Lessons                                                                    */
/* ------------------------------------------------------------------------- */

function LessonEditor({
  initial,
  onSaved,
  refs,
}: {
  initial?: AdminLesson;
  onSaved: (id: string) => void;
  refs: ReturnType<typeof useAdminReferences>;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [algorithmId, setAlgorithmId] = useState(initial?.algorithm?.id ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [goal, setGoal] = useState(initial?.goal ?? "");
  const [reflection, setReflection] = useState(initial?.reflection ?? "");
  const [translationEn, setTranslationEn] = useState(initial?.translation_en ?? {});
  const [durationMin, setDurationMin] = useState(String(initial?.duration_min ?? 45));
  const [orderNo, setOrderNo] = useState(String(initial?.order_no ?? 1));
  const [competencyIds, setCompetencyIds] = useState<string[]>(initial?.competency_ids ?? []);
  const [status, setStatus] = useState<ContentStatus>(initial?.status ?? "draft");
  const [isDemo, setIsDemo] = useState(initial?.is_demo ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        algorithm_id: algorithmId || null,
        summary,
        body,
        goal,
        reflection,
        translation_en: translationEn,
        duration_min: Number(durationMin) || 45,
        order_no: Number(orderNo) || 1,
        competency_ids: competencyIds,
        status,
        is_demo: isDemo,
      };
      if (slug.trim()) payload.slug = slug.trim();
      else if (!initial) payload.slug = null;
      return initial
        ? http.patch<AdminLesson>(`/admin/lessons/${initial.id}`, payload)
        : http.post<AdminLesson>("/admin/lessons", payload);
    },
    onSuccess: (data) => {
      setError(null);
      onSaved(data.id);
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  return (
    <AdminEditorCard
      id={initial?.id ?? null}
      resource="lessons"
      title={title}
      status={status}
      isDemo={isDemo}
      onSaved={onSaved}
      onDeleted={() => onSaved("")}
    >
      <DraftPreview title={title} sections={[{ label: "Сипаттама", html: summary }, { label: "Мақсат", html: goal }, { label: "Мазмұн", html: body }, { label: "Рефлексия", html: reflection }]} />
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim().length < 2) {
            setError("Атауы кемінде 2 таңба болуы керек.");
            return;
          }
          save.mutate();
        }}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Атауы" htmlFor="lesson-title" required>
            <TextInput
              id="lesson-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={250}
            />
          </Field>
          <Field label="Slug (міндетті емес)" htmlFor="lesson-slug">
            <TextInput
              id="lesson-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="font-mono text-sm"
              maxLength={120}
            />
          </Field>
          <RefSelect
            label="ML алгоритмі"
            htmlFor="lesson-algorithm"
            value={algorithmId}
            onChange={setAlgorithmId}
            options={refs.algorithms}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Реттік нөмір" htmlFor="lesson-order">
              <TextInput
                id="lesson-order"
                type="number"
                min={1}
                value={orderNo}
                onChange={(event) => setOrderNo(event.target.value)}
              />
            </Field>
            <Field label="Ұзақтығы (мин)" htmlFor="lesson-duration">
              <TextInput
                id="lesson-duration"
                type="number"
                min={1}
                max={600}
                value={durationMin}
                onChange={(event) => setDurationMin(event.target.value)}
              />
            </Field>
          </div>
        </div>
        <Field label="Қысқаша сипаттама" htmlFor="lesson-summary">
          <TextArea
            id="lesson-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            className="min-h-20"
          />
        </Field>
        <Field label="Сабақ мақсаты" htmlFor="lesson-goal">
          <TextArea
            id="lesson-goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            className="min-h-20"
          />
        </Field>
        <HtmlEditor value={body} onChange={setBody} id="lesson-body" label="Сабақ мазмұны (HTML)" />
        <Field
          label="Рефлексия сұрағы"
          htmlFor="lesson-reflection"
          hint="Сабақ соңында оқушы жауап беретін қысқа сұрақ."
        >
          <TextArea
            id="lesson-reflection"
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            className="min-h-20"
          />
        </Field>
        <details className="rounded-lg border border-slate-200 p-4">
          <summary className="cursor-pointer font-semibold">English translation (optional)</summary>
          <div className="mt-4 space-y-3">
            <Field label="Title (English)" htmlFor="lesson-title-en"><TextInput id="lesson-title-en" value={translationEn.title ?? ""} onChange={(event) => setTranslationEn({ ...translationEn, title: event.target.value })} /></Field>
            <Field label="Summary (English)" htmlFor="lesson-summary-en"><TextArea id="lesson-summary-en" value={translationEn.summary ?? ""} onChange={(event) => setTranslationEn({ ...translationEn, summary: event.target.value })} /></Field>
            <Field label="Goal (English)" htmlFor="lesson-goal-en"><TextArea id="lesson-goal-en" value={translationEn.goal ?? ""} onChange={(event) => setTranslationEn({ ...translationEn, goal: event.target.value })} /></Field>
            <HtmlEditor value={translationEn.body ?? ""} onChange={(value) => setTranslationEn({ ...translationEn, body: value })} id="lesson-body-en" label="Lesson content (English)" />
            <Field label="Reflection (English)" htmlFor="lesson-reflection-en"><TextArea id="lesson-reflection-en" value={translationEn.reflection ?? ""} onChange={(event) => setTranslationEn({ ...translationEn, reflection: event.target.value })} /></Field>
          </div>
        </details>
        <CompetencyPicker
          options={refs.competencies}
          selected={competencyIds}
          onChange={setCompetencyIds}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusField value={status} onChange={setStatus} />
          <DemoField checked={isDemo} onChange={setIsDemo} />
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" loading={save.isPending}>
          {initial ? "Өзгерістерді сақтау" : "Сабақ жасау"}
        </Button>
      </form>
    </AdminEditorCard>
  );
}

export function AdminLessonsPage() {
  const t = useText();
  const label = useLabel();
  const { language } = usePreferences();
  useTitle(t("Сабақтар", "Lessons"));
  const queryClient = useQueryClient();
  const [editId, setEditId] = useEditParam();
  const isNew = editId === "new";
  const selectedId = isNew ? null : editId;
  const refs = useAdminReferences();
  const list = useQuery({
    queryKey: ["admin", "lessons"],
    queryFn: () => http.get<LessonCard[]>("/admin/lessons"),
  });
  const detail = useQuery({
    queryKey: ["admin", "lessons", "detail", selectedId],
    queryFn: () => http.get<AdminLesson>(`/admin/lessons/${selectedId}`),
    enabled: Boolean(selectedId),
  });
  const refreshAndSelect = (id: string) => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    setEditId(id || null);
  };

  return (
    <div>
      <PageHeader
        eyebrow="CMS"
        title={t("Сабақтар", "Lessons")}
        description={t("Сабақ мазмұны, мақсаты, рефлексиясы және STEM құзыреттіліктерімен байланысы. Сабақ жарияланған соң мұғалім оны сыныпқа тағайындай алады.", "Edit lesson content, goals, reflection, and competencies. Teachers can assign published lessons to classes.")}
        actions={
          <Button type="button" onClick={() => setEditId("new")}>
            <Plus className="size-4" aria-hidden />
            {t("Жаңа сабақ", "New lesson")}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="self-start">
          <h2 className="text-sm font-bold text-ink-950">{t("Сабақтар", "Lessons")}</h2>
          {list.isLoading ? (
            <PageLoader />
          ) : list.isError ? (
            <Alert tone="error">{errorMessage(list.error)}</Alert>
          ) : (
            <div className="mt-3 space-y-1.5">
              {(list.data ?? []).map((item) => (
                <AdminListButton
                  key={item.id}
                  active={selectedId === item.id}
                  title={`${item.order_no}. ${localizeLesson(item, language).title}`}
                  meta={`${label(statusLabels[item.status] ?? item.status)}${item.is_demo ? t(" · демо", " · demo") : ""}`}
                  onClick={() => setEditId(item.id)}
                />
              ))}
            </div>
          )}
        </Card>
        <div>
          {isNew ? (
            <LessonEditor key="new" refs={refs} onSaved={refreshAndSelect} />
          ) : selectedId ? (
            detail.isLoading ? (
              <PageLoader />
            ) : detail.isError ? (
              <Alert tone="error">{errorMessage(detail.error)}</Alert>
            ) : detail.data ? (
              <LessonEditor
                key={detail.data.id}
                initial={detail.data}
                refs={refs}
                onSaved={refreshAndSelect}
              />
            ) : null
          ) : (
            <AdminEmptyEditor text={t("Сабақты таңдаңыз немесе жаңа сабақ жасаңыз.", "Select a lesson or create a new one.")} />
          )}
        </div>
      </div>
      <div className="mt-6">
        <DemoNotice />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* ------------------------------------------------------------------------- */

function TaskEditor({
  initial,
  onSaved,
  refs,
}: {
  initial?: AdminTask;
  onSaved: (id: string) => void;
  refs: ReturnType<typeof useAdminReferences>;
}) {
  const [translationEn, setTranslationEn] = useState<NonNullable<AdminTask["translation_en"]>>(initial?.translation_en ?? {});
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [type, setType] = useState<TaskType>(initial?.type ?? "single_choice");
  const [difficulty, setDifficulty] = useState(initial?.difficulty ?? "medium");
  const [lessonId, setLessonId] = useState(initial?.lesson?.id ?? "");
  const [algorithmId, setAlgorithmId] = useState(initial?.algorithm?.id ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [maxScore, setMaxScore] = useState(String(initial?.max_score ?? 10));
  const [attemptsLimit, setAttemptsLimit] = useState(String(initial?.attempts_limit ?? 1));
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(
    initial?.show_correct_answers ?? false,
  );
  const [competencyIds, setCompetencyIds] = useState<string[]>(initial?.competency_ids ?? []);
  const [rubric, setRubric] = useState(initial?.rubric_json ?? []);
  const [options, setOptions] = useState<OptionDraft[]>(
    initial?.options?.length ? initial.options.map(optionFromApi) : [],
  );
  const [status, setStatus] = useState<ContentStatus>(initial?.status ?? "draft");
  const [isDemo, setIsDemo] = useState(initial?.is_demo ?? true);
  const [error, setError] = useState<string | null>(null);
  const closed = type === "single_choice" || type === "multiple_choice";

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        translation_en: translationEn,
        lesson_id: lessonId || null,
        algorithm_id: algorithmId || null,
        type,
        difficulty,
        instructions,
        body,
        max_score: Number(maxScore) || 10,
        rubric_json: rubric,
        attempts_limit: Number(attemptsLimit) || 1,
        show_correct_answers: showCorrectAnswers,
        competency_ids: competencyIds,
        options: closed
          ? options.map((option, index) => ({
              id: option.id,
              label: option.label,
              label_en: option.label_en ?? "",
              is_correct: option.is_correct,
              order_no: index + 1,
            }))
          : [],
        status,
        is_demo: isDemo,
      };
      if (slug.trim()) payload.slug = slug.trim();
      else if (!initial) payload.slug = null;
      return initial
        ? http.patch<AdminTask>(`/admin/tasks/${initial.id}`, payload)
        : http.post<AdminTask>("/admin/tasks", payload);
    },
    onSuccess: (data) => {
      setError(null);
      onSaved(data.id);
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  return (
    <AdminEditorCard
      id={initial?.id ?? null}
      resource="tasks"
      title={title}
      status={status}
      isDemo={isDemo}
      onSaved={onSaved}
      onDeleted={() => onSaved("")}
    >
      <DraftPreview title={title} sections={[{ label: "Нұсқау", html: instructions }, { label: "Мазмұн", html: body }, ...options.map((option, index) => ({ label: `${index + 1}`, html: option.label }))]} />
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim().length < 2) {
            setError("Атауы кемінде 2 таңба болуы керек.");
            return;
          }
          if (closed && options.length < 2) {
            setError("Жабық тест үшін кемінде екі жауап нұсқасы болуы керек.");
            return;
          }
          if (closed && !options.some((option) => option.is_correct)) {
            setError("Кемінде бір дұрыс жауапты белгілеңіз.");
            return;
          }
          save.mutate();
        }}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Атауы" htmlFor="task-title" required>
            <TextInput
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={250}
            />
          </Field>
          <Field label="Slug (міндетті емес)" htmlFor="task-slug">
            <TextInput
              id="task-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="font-mono text-sm"
              maxLength={120}
            />
          </Field>
          <Field label="Түрі" htmlFor="task-type" required>
            <Select
              id="task-type"
              value={type}
              onChange={(event) => setType(event.target.value as TaskType)}
            >
              {Object.entries(taskTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Қиындығы" htmlFor="task-difficulty">
            <Select
              id="task-difficulty"
              value={difficulty}
              onChange={(event) =>
                setDifficulty(event.target.value as "easy" | "medium" | "hard")
              }
            >
              {Object.entries(difficultyLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <RefSelect
            label="Сабақ"
            htmlFor="task-lesson"
            value={lessonId}
            onChange={setLessonId}
            options={refs.lessons}
          />
          <RefSelect
            label="ML алгоритмі"
            htmlFor="task-algorithm"
            value={algorithmId}
            onChange={setAlgorithmId}
            options={refs.algorithms}
          />
          <Field label="Максималды балл" htmlFor="task-score">
            <TextInput
              id="task-score"
              type="number"
              min={1}
              max={1000}
              value={maxScore}
              onChange={(event) => setMaxScore(event.target.value)}
            />
          </Field>
          <Field label="Талпыныс лимиті" htmlFor="task-attempts">
            <TextInput
              id="task-attempts"
              type="number"
              min={1}
              max={10}
              value={attemptsLimit}
              onChange={(event) => setAttemptsLimit(event.target.value)}
            />
          </Field>
        </div>
        <HtmlEditor
          value={instructions}
          onChange={setInstructions}
          id="task-instructions"
          label="Оқушыға арналған нұсқаулық (HTML)"
          rows={8}
        />
        <HtmlEditor
          value={body}
          onChange={setBody}
          id="task-body"
          label="Тапсырма мәтіні (HTML)"
          rows={10}
        />
        {closed ? (
          <OptionEditor
            english
            options={options}
            multiple={type === "multiple_choice"}
            onChange={setOptions}
            labels={{ add: "Нұсқа қосу", correct: "Дұрыс", empty: "Нұсқа қосылмаған." }}
            hint="Жабық тест серверде автоматты тексеріледі. Дұрыс жауаптар оқушыға тек рұқсат етілсе көрінеді."
          />
        ) : null}
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-semibold">English translation</summary>
          <div className="mt-4 space-y-4">
            {rubric.map((item, index) => <Field key={index} label={`English criterion: ${item.criterion}`} htmlFor={`task-rubric-en-${index}`}><TextInput id={`task-rubric-en-${index}`} value={translationEn.rubric_labels?.[index] ?? ""} onChange={(event) => { const labels = [...(translationEn.rubric_labels ?? [])]; labels[index] = event.target.value; setTranslationEn({ ...translationEn, rubric_labels: Array.from({ length: rubric.length }, (_, i) => labels[i] ?? "") }); }} /></Field>)}
            {(["title", "instructions", "body"] as const).map((field) => (
              <Field key={field} label={`English: ${field}`} htmlFor={`task-en-${field}`}><TextArea id={`task-en-${field}`} value={translationEn[field] ?? ""} onChange={(event) => setTranslationEn({ ...translationEn, [field]: event.target.value })} /></Field>
            ))}
          </div>
        </details>
        <RubricEditor items={rubric} onChange={(next) => { setTranslationEn((current) => ({ ...current, rubric_labels: remapRubricLabels(rubric, next, current.rubric_labels ?? []) })); setRubric(next); }} />
        <CompetencyPicker
          options={refs.competencies}
          selected={competencyIds}
          onChange={setCompetencyIds}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusField value={status} onChange={setStatus} />
          <DemoField checked={isDemo} onChange={setIsDemo} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={showCorrectAnswers}
            onChange={(event) => setShowCorrectAnswers(event.target.checked)}
            className="size-4 accent-brand-700"
          />
          Жауап жіберілгеннен кейін дұрыс жауапты оқушыға көрсету
        </label>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" loading={save.isPending}>
          {initial ? "Өзгерістерді сақтау" : "Тапсырма жасау"}
        </Button>
      </form>
    </AdminEditorCard>
  );
}

export function AdminTasksPage() {
  const t = useText();
  const label = useLabel();
  const { language } = usePreferences();
  useTitle(t("Тапсырмалар", "Tasks"));
  const queryClient = useQueryClient();
  const [editId, setEditId] = useEditParam();
  const isNew = editId === "new";
  const selectedId = isNew ? null : editId;
  const refs = useAdminReferences();
  const list = useQuery({
    queryKey: ["admin", "tasks"],
    queryFn: () => http.get<AdminTask[]>("/admin/tasks"),
  });
  const detail = useQuery({
    queryKey: ["admin", "tasks", "detail", selectedId],
    queryFn: () => http.get<AdminTask>(`/admin/tasks/${selectedId}`),
    enabled: Boolean(selectedId),
  });
  const refreshAndSelect = (id: string) => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    setEditId(id || null);
  };

  return (
    <div>
      <PageHeader
        eyebrow="CMS"
        title={t("Тапсырмалар", "Tasks")}
        description={t("Жабық тесттер, ашық жауаптар, файл жүктеу және сілтеме тапсырмалары. Жабық тесттер серверде автоматты тексеріледі.", "Manage closed questions, open responses, file uploads, and link tasks. Closed questions are graded automatically.")}
        actions={
          <Button type="button" onClick={() => setEditId("new")}>
            <Plus className="size-4" aria-hidden />
            {t("Жаңа тапсырма", "New task")}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="self-start">
          <h2 className="text-sm font-bold text-ink-950">{t("Тапсырмалар", "Tasks")}</h2>
          {list.isLoading ? (
            <PageLoader />
          ) : list.isError ? (
            <Alert tone="error">{errorMessage(list.error)}</Alert>
          ) : (
            <div className="mt-3 space-y-1.5">
              {(list.data ?? []).map((item) => (
                <AdminListButton
                  key={item.id}
                  active={selectedId === item.id}
                  title={localizeTask(item, language).title}
                  meta={`${label(taskTypeLabels[item.type] ?? item.type)} · ${
                    label(statusLabels[item.status] ?? item.status)
                  }`}
                  onClick={() => setEditId(item.id)}
                />
              ))}
            </div>
          )}
        </Card>
        <div>
          {isNew ? (
            <TaskEditor key="new" refs={refs} onSaved={refreshAndSelect} />
          ) : selectedId ? (
            detail.isLoading ? (
              <PageLoader />
            ) : detail.isError ? (
              <Alert tone="error">{errorMessage(detail.error)}</Alert>
            ) : detail.data ? (
              <TaskEditor
                key={detail.data.id}
                initial={detail.data}
                refs={refs}
                onSaved={refreshAndSelect}
              />
            ) : null
          ) : (
            <AdminEmptyEditor text={t("Тапсырманы таңдаңыз немесе жаңасын жасаңыз.", "Select a task or create a new one.")} />
          )}
        </div>
      </div>
      <div className="mt-6">
        <DemoNotice />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Projects                                                                   */
/* ------------------------------------------------------------------------- */

function ProjectEditor({
  initial,
  onSaved,
  refs,
}: {
  initial?: AdminProject;
  onSaved: (id: string) => void;
  refs: ReturnType<typeof useAdminReferences>;
}) {
  const [translationEn, setTranslationEn] = useState<NonNullable<AdminProject["translation_en"]>>(initial?.translation_en ?? {});
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [algorithmId, setAlgorithmId] = useState(initial?.algorithm?.id ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [problem, setProblem] = useState(initial?.problem ?? "");
  const [goal, setGoal] = useState(initial?.goal ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [steps, setSteps] = useState<string[]>(initial?.steps_json?.length ? initial.steps_json : [""]);
  const [materials, setMaterials] = useState<string[]>(
    initial?.materials_json?.length ? initial.materials_json : [""],
  );
  const [tools, setTools] = useState<string[]>(initial?.tools_json?.length ? initial.tools_json : [""]);
  const [expectedResult, setExpectedResult] = useState(initial?.expected_result ?? "");
  const [rubric, setRubric] = useState(initial?.rubric_json ?? []);
  const [competencyIds, setCompetencyIds] = useState<string[]>(initial?.competency_ids ?? []);
  const [sortOrder, setSortOrder] = useState("0");
  const [status, setStatus] = useState<ContentStatus>(initial?.status ?? "draft");
  const [isDemo, setIsDemo] = useState(initial?.is_demo ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        translation_en: translationEn,
        algorithm_id: algorithmId || null,
        summary,
        problem,
        goal,
        body,
        steps_json: steps.filter((item) => item.trim()),
        materials_json: materials.filter((item) => item.trim()),
        tools_json: tools.filter((item) => item.trim()),
        expected_result: expectedResult,
        rubric_json: rubric,
        competency_ids: competencyIds,
        sort_order: Number(sortOrder) || 0,
        status,
        is_demo: isDemo,
      };
      if (slug.trim()) payload.slug = slug.trim();
      else if (!initial) payload.slug = null;
      return initial
        ? http.patch<AdminProject>(`/admin/projects/${initial.id}`, payload)
        : http.post<AdminProject>("/admin/projects", payload);
    },
    onSuccess: (data) => {
      setError(null);
      onSaved(data.id);
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  return (
    <AdminEditorCard
      id={initial?.id ?? null}
      resource="projects"
      title={title}
      status={status}
      isDemo={isDemo}
      previewHref={initial?.status === "published" ? `/projects/${initial.id}` : undefined}
      onSaved={onSaved}
      onDeleted={() => onSaved("")}
    >
      <DraftPreview title={title} sections={[{ label: "Сипаттама", html: summary }, { label: "Мәселе", html: problem }, { label: "Мақсат", html: goal }, { label: "Мазмұн", html: body }, { label: "Нәтиже", html: expectedResult }]} />
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim().length < 2) {
            setError("Атауы кемінде 2 таңба болуы керек.");
            return;
          }
          save.mutate();
        }}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Атауы" htmlFor="project-title" required>
            <TextInput
              id="project-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={250}
            />
          </Field>
          <Field label="Slug (міндетті емес)" htmlFor="project-slug">
            <TextInput
              id="project-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="font-mono text-sm"
              maxLength={120}
            />
          </Field>
          <RefSelect
            label="ML алгоритмі"
            htmlFor="project-algorithm"
            value={algorithmId}
            onChange={setAlgorithmId}
            options={refs.algorithms}
          />
          <Field label="Реттік нөмір" htmlFor="project-order">
            <TextInput
              id="project-order"
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Қысқаша сипаттама" htmlFor="project-summary">
          <TextArea
            id="project-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            className="min-h-20"
          />
        </Field>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">Мәселе</p>
            <HtmlEditor value={problem} onChange={setProblem} id="project-problem" label="Мәселе (HTML)" rows={6} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Мақсат</p>
            <HtmlEditor value={goal} onChange={setGoal} id="project-goal" label="Мақсат (HTML)" rows={6} />
          </div>
        </div>
        <HtmlEditor value={body} onChange={setBody} id="project-body" label="Жоба сипаттамасы (HTML)" />
        <TextListEditor
          label="Орындау қадамдары"
          items={steps}
          onChange={setSteps}
          placeholder="Қадам сипаттамасы"
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <TextListEditor
            label="Материалдар"
            items={materials}
            onChange={setMaterials}
            placeholder="Материал"
          />
          <TextListEditor
            label="Құралдар"
            items={tools}
            onChange={setTools}
            placeholder="Құрал"
          />
        </div>
        <Field label="Күтілетін нәтиже" htmlFor="project-result">
          <TextArea
            id="project-result"
            value={expectedResult}
            onChange={(event) => setExpectedResult(event.target.value)}
            className="min-h-20"
          />
        </Field>
        <details className="rounded-xl border border-slate-200 p-4">
          <summary className="cursor-pointer font-semibold">English translation</summary>
          <div className="mt-4 space-y-4">
            {rubric.map((item, index) => <Field key={index} label={`English criterion: ${item.criterion}`} htmlFor={`project-rubric-en-${index}`}><TextInput id={`project-rubric-en-${index}`} value={translationEn.rubric_labels?.[index] ?? ""} onChange={(event) => { const labels = [...(translationEn.rubric_labels ?? [])]; labels[index] = event.target.value; setTranslationEn({ ...translationEn, rubric_labels: Array.from({ length: rubric.length }, (_, i) => labels[i] ?? "") }); }} /></Field>)}
            {(["title", "summary", "problem", "goal", "body", "expected_result"] as const).map((field) => (
              <Field key={field} label={`English: ${field}`} htmlFor={`project-en-${field}`}>
                <TextArea id={`project-en-${field}`} value={translationEn[field] ?? ""} onChange={(event) => setTranslationEn({ ...translationEn, [field]: event.target.value })} />
              </Field>
            ))}
            {(["steps_json", "materials_json", "tools_json"] as const).map((field) => (
              <TextListEditor key={field} label={`English: ${field}`} items={translationEn[field]?.length ? translationEn[field]! : [""]} onChange={(items) => setTranslationEn({ ...translationEn, [field]: items.filter((item) => item.trim()) })} />
            ))}
          </div>
        </details>
        <RubricEditor items={rubric} onChange={(next) => { setTranslationEn((current) => ({ ...current, rubric_labels: remapRubricLabels(rubric, next, current.rubric_labels ?? []) })); setRubric(next); }} />
        <CompetencyPicker
          options={refs.competencies}
          selected={competencyIds}
          onChange={setCompetencyIds}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusField value={status} onChange={setStatus} />
          <DemoField checked={isDemo} onChange={setIsDemo} />
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" loading={save.isPending}>
          {initial ? "Өзгерістерді сақтау" : "Жоба жасау"}
        </Button>
      </form>
    </AdminEditorCard>
  );
}

export function AdminProjectsPage() {
  const t = useText();
  const label = useLabel();
  const { language } = usePreferences();
  useTitle("Жобалар");
  const queryClient = useQueryClient();
  const [editId, setEditId] = useEditParam();
  const isNew = editId === "new";
  const selectedId = isNew ? null : editId;
  const refs = useAdminReferences();
  const list = useQuery({
    queryKey: ["admin", "projects"],
    queryFn: () => http.get<ProjectCard[]>("/admin/projects"),
  });
  const detail = useQuery({
    queryKey: ["admin", "projects", "detail", selectedId],
    queryFn: () => http.get<AdminProject>(`/admin/projects/${selectedId}`),
    enabled: Boolean(selectedId),
  });
  const refreshAndSelect = (id: string) => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    setEditId(id || null);
  };

  return (
    <div>
      <PageHeader
        eyebrow="CMS"
        title={t("STEM жобалары", "STEM projects")}
        description={t("Жобаның мәселесі, мақсаты, қадамдары, материалдары және бағалау рубрикасы. Жоба нәтижесін мұғалім рубрика бойынша бағалайды.", "Edit project problems, goals, steps, materials, and assessment rubrics.")}
        actions={
          <Button type="button" onClick={() => setEditId("new")}>
            <Plus className="size-4" aria-hidden />
            {t("Жаңа жоба", "New project")}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="self-start">
          <h2 className="text-sm font-bold text-ink-950">{t("Жобалар", "Projects")}</h2>
          {list.isLoading ? (
            <PageLoader />
          ) : list.isError ? (
            <Alert tone="error">{errorMessage(list.error)}</Alert>
          ) : (
            <div className="mt-3 space-y-1.5">
              {(list.data ?? []).map((item) => (
                <AdminListButton
                  key={item.id}
                  active={selectedId === item.id}
                  title={localizeProject(item, language).title}
                  meta={`${label(statusLabels[item.status] ?? item.status)}${item.is_demo ? t(" · демо", " · demo") : ""}`}
                  onClick={() => setEditId(item.id)}
                />
              ))}
            </div>
          )}
        </Card>
        <div>
          {isNew ? (
            <ProjectEditor key="new" refs={refs} onSaved={refreshAndSelect} />
          ) : selectedId ? (
            detail.isLoading ? (
              <PageLoader />
            ) : detail.isError ? (
              <Alert tone="error">{errorMessage(detail.error)}</Alert>
            ) : detail.data ? (
              <ProjectEditor
                key={detail.data.id}
                initial={detail.data}
                refs={refs}
                onSaved={refreshAndSelect}
              />
            ) : null
          ) : (
            <AdminEmptyEditor text={t("Жобаны таңдаңыз немесе жаңасын жасаңыз.", "Select a project or create a new one.")} />
          )}
        </div>
      </div>
      <div className="mt-6">
        <DemoNotice />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Assessments                                                                */
/* ------------------------------------------------------------------------- */

interface QuestionDraft {
  type: "single_choice" | "multiple_choice" | "open_text";
  body: string;
  body_en: string;
  competency_id: string;
  competency_ids: string[];
  competency_weights: Record<string, number>;
  points: number;
  order_no: number;
  options: OptionDraft[];
}

function questionFromApi(question: AssessmentQuestion): QuestionDraft {
  return {
    type: question.type,
    body: question.body,
    body_en: question.body_en ?? "",
    competency_id: question.competency_id ?? "",
    competency_ids: question.competency_ids ?? (question.competency_id ? [question.competency_id] : []),
    competency_weights: question.competency_weights ?? {},
    points: question.points,
    order_no: question.order_no,
    options: (question.options ?? []).map((option: AssessmentOption) => ({
      label: option.label,
      label_en: option.label_en,
      is_correct: Boolean(option.is_correct),
      order_no: option.order_no,
    })),
  };
}

function AssessmentEditor({
  initial,
  onSaved,
  refs,
  onNewVersion,
}: {
  initial?: AdminAssessment;
  onSaved: (id: string) => void;
  refs: ReturnType<typeof useAdminReferences>;
  onNewVersion?: () => void;
}) {
  const [translationEn, setTranslationEn] = useState<NonNullable<AdminAssessment["translation_en"]>>(initial?.translation_en ?? {});
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [kind, setKind] = useState<AssessmentKind>(initial?.kind ?? "quiz");
  const [version, setVersion] = useState(String(initial?.version ?? 1));
  const [methodologyKey, setMethodologyKey] = useState(initial?.methodology_key ?? "default");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [attemptsLimit, setAttemptsLimit] = useState(String(initial?.attempts_limit ?? 1));
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(
    initial?.show_correct_answers ?? false,
  );
  const initialConfig = (initial?.scoring_config_json ?? {}) as Record<string, unknown>;
  const initialThresholds = (initialConfig.thresholds ?? {}) as Record<string, unknown>;
  const initialWeights = (initialConfig.weights ?? {}) as Record<string, unknown>;
  const [lowThreshold, setLowThreshold] = useState(String(initialThresholds.low ?? 50));
  const [mediumThreshold, setMediumThreshold] = useState(String(initialThresholds.medium ?? 75));
  const [weights, setWeights] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(initialWeights).map(([id, value]) => [id, String(value)])),
  );
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initial?.questions?.length ? initial.questions.map(questionFromApi) : [],
  );
  const [status, setStatus] = useState<ContentStatus>(initial?.status ?? "draft");
  const [isDemo, setIsDemo] = useState(initial?.is_demo ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const currentWeights: Record<string, number> = {};
      for (const [competencyId, value] of Object.entries(initialWeights)) {
        currentWeights[competencyId] = Number(value);
      }
      for (const competency of refs.competencies) {
        const raw = weights[competency.id];
        if (raw === undefined) continue;
        if (raw.trim() === "") {
          delete currentWeights[competency.id];
        } else {
          currentWeights[competency.id] = Number(raw);
        }
      }
      const scoringConfig: Record<string, unknown> = {
        ...initialConfig,
        thresholds: {
          low: Number(lowThreshold),
          medium: Number(mediumThreshold),
        },
        attempt_rule: initialConfig.attempt_rule ?? "first_completed",
      };
      if (Object.keys(currentWeights).length > 0) scoringConfig.weights = currentWeights;
      else delete scoringConfig.weights;

      const payload: Record<string, unknown> = {
        name: name.trim(),
        translation_en: translationEn,
        kind,
        version: Number(version) || 1,
        methodology_key: methodologyKey.trim() || "default",
        description,
        instructions,
        scoring_config_json: scoringConfig,
        attempts_limit: Number(attemptsLimit) || 1,
        show_correct_answers: showCorrectAnswers,
        is_demo: isDemo,
        questions: questions.map((question, index) => ({
          type: question.type,
          body: question.body,
          body_en: question.body_en,
          competency_id: question.competency_id || null,
          competency_ids: question.competency_ids,
          competency_weights: Object.fromEntries(question.competency_ids.map((id) => [id, question.competency_weights[id] ?? 1])),
          points: question.points,
          order_no: question.order_no || index + 1,
          options:
            question.type === "open_text"
              ? []
              : question.options.map((option, optionIndex) => ({
                  label: option.label,
                  label_en: option.label_en ?? "",
                  is_correct: option.is_correct,
                  order_no: optionIndex + 1,
                })),
        })),
      };
      if (slug.trim()) payload.slug = slug.trim();
      else if (!initial) payload.slug = null;
      if (!initial) return http.post<AdminAssessment>("/admin/assessments", payload);
      const originalWeights = Object.fromEntries(Object.entries(initialWeights).map(([id, value]) => [id, String(value)]));
      const structural = omitUnchangedAssessmentStructure(payload, {
        kind, version: Number(version) || 1, methodologyKey: methodologyKey.trim() || "default", questions,
        scoring: { lowThreshold, mediumThreshold, weights },
      }, {
        kind: initial.kind, version: initial.version, methodologyKey: initial.methodology_key,
        questions: (initial.questions ?? []).map(questionFromApi),
        scoring: { lowThreshold: String(initialThresholds.low ?? 50), mediumThreshold: String(initialThresholds.medium ?? 75), weights: originalWeights },
      });
      return http.patch<AdminAssessment>(`/admin/assessments/${initial.id}`, structural);
    },
    onSuccess: (data) => {
      setError(null);
      onSaved(data.id);
    },
    onError: (mutationError) => {
      const message = errorMessage(mutationError);
      setError(
        message.includes("жаңа нұсқа") || message.toLowerCase().includes("attempt")
          ? `${message} «Жаңа нұсқа» түймесін пайдаланыңыз.`
          : message,
      );
    },
  });

  function updateQuestion(index: number, patch: Partial<QuestionDraft>) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...patch } : question,
      ),
    );
  }

  return (
    <AdminEditorCard
      id={initial?.id ?? null}
      resource="assessments"
      title={name}
      status={status}
      isDemo={isDemo}
      onSaved={onSaved}
      onDeleted={() => onSaved("")}
      extraActions={
        initial && onNewVersion ? (
          <Button type="button" size="sm" variant="secondary" onClick={onNewVersion}>
            <CopyPlus className="size-4" aria-hidden />
            Жаңа нұсқа
          </Button>
        ) : undefined
      }
    >
      <DraftPreview title={name} sections={[{ label: "Сипаттама", html: description }, { label: "Нұсқау", html: instructions }, ...questions.map((question, index) => ({ label: `${index + 1}`, html: question.body }))]} />
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim().length < 3) {
            setError("Атауы кемінде 3 таңба болуы керек.");
            return;
          }
          if (questions.length === 0) {
            setError("Кемінде бір сұрақ қосыңыз.");
            return;
          }
          for (const [index, question] of questions.entries()) {
            if (!question.body.trim()) {
              setError(`${index + 1}-сұрақтың мәтіні бос.`);
              return;
            }
            if (
              question.type !== "open_text" &&
              (question.options.length < 2 || !question.options.some((option) => option.is_correct))
            ) {
              setError(
                `${index + 1}-сұрақ: кемінде екі нұсқа және бір дұрыс жауап қажет.`,
              );
              return;
            }
          }
          const low = Number(lowThreshold);
          const medium = Number(mediumThreshold);
          if (
            !Number.isFinite(low) ||
            !Number.isFinite(medium) ||
            low < 0 ||
            low > 100 ||
            medium < 0 ||
            medium > 100
          ) {
            setError("Деңгей шектері 0 мен 100 аралығында болуы керек.");
            return;
          }
          if (medium <= low) {
            setError("Орташа деңгей шегі төмен деңгей шегінен үлкен болуы керек.");
            return;
          }
          for (const [competencyId, value] of Object.entries(weights)) {
            if (value.trim() === "") continue;
            const weight = Number(value);
            if (!Number.isFinite(weight) || weight < 0 || weight > 10) {
              const title =
                refs.competencies.find((item) => item.id === competencyId)?.title ?? competencyId;
              setError(`${title}: салмақ 0 мен 10 аралығында болуы керек.`);
              return;
            }
          }
          save.mutate();
        }}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Атауы" htmlFor="assessment-name" required>
            <TextInput
              id="assessment-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={250}
            />
          </Field>
          <Field label="Slug (міндетті емес)" htmlFor="assessment-slug">
            <TextInput
              id="assessment-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="font-mono text-sm"
            />
          </Field>
          <Field label="Түрі" htmlFor="assessment-kind">
            <Select
              id="assessment-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as AssessmentKind)}
            >
              <option value="pre">Pre-test</option>
              <option value="post">Post-test</option>
              <option value="quiz">Тест</option>
            </Select>
          </Field>
          <Field label="Нұсқа" htmlFor="assessment-version">
            <TextInput
              id="assessment-version"
              type="number"
              min={1}
              value={version}
              onChange={(event) => setVersion(event.target.value)}
            />
          </Field>
          <Field
            label="Әдістеме кілті"
            htmlFor="assessment-methodology"
            hint="Pre/post салыстыруы тек бір кілт шегінде жүргізіледі."
          >
            <TextInput
              id="assessment-methodology"
              value={methodologyKey}
              onChange={(event) => setMethodologyKey(event.target.value)}
              className="font-mono text-sm"
            />
          </Field>
          <Field label="Талпыныс лимиті" htmlFor="assessment-attempts">
            <TextInput
              id="assessment-attempts"
              type="number"
              min={1}
              max={10}
              value={attemptsLimit}
              onChange={(event) => setAttemptsLimit(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Сипаттама" htmlFor="assessment-description">
          <TextArea
            id="assessment-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-20"
          />
        </Field>
        <HtmlEditor
          value={instructions}
          onChange={setInstructions}
          id="assessment-instructions"
          label="Нұсқаулық (HTML)"
          rows={8}
        />

        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-sm font-semibold text-slate-800">Scoring конфигурациясы</p>
            <p className="text-xs text-slate-600">
              Деңгей шектері мен құзыреттілік салмақтарын осы жерде редакциялауға болады.
              Аяқталған талпыныс болса, құрылымдық өзгеріс 409 қатесін қайтарады — жаңа
              нұсқа жасаңыз.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Төмен деңгей шегі (%)"
              htmlFor="assessment-threshold-low"
              hint="Осы шектен төмен нәтиже — «Төмен»."
            >
              <TextInput
                id="assessment-threshold-low"
                type="number"
                min={0}
                max={100}
                value={lowThreshold}
                onChange={(event) => setLowThreshold(event.target.value)}
              />
            </Field>
            <Field
              label="Орташа деңгей шегі (%)"
              htmlFor="assessment-threshold-medium"
              hint="Осы шектен жоғары нәтиже — «Жоғары»."
            >
              <TextInput
                id="assessment-threshold-medium"
                type="number"
                min={0}
                max={100}
                value={mediumThreshold}
                onChange={(event) => setMediumThreshold(event.target.value)}
              />
            </Field>
          </div>
          <details className="rounded-lg border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              Құзыреттілік салмақтары (міндетті емес)
            </summary>
            <p className="mt-1 text-xs text-slate-500">
              Бос өріс әдепкі салмақты (1.0) қолданады. 0 — құзыреттілік жалпы балға
              кірмейді.
            </p>
            {refs.competencies.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Әзірге құзыреттіліктер жоқ. Алдымен STEM құзыреттіліктерін жасаңыз.
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {refs.competencies.map((competency) => (
                  <Field
                    key={competency.id}
                    label={competency.title}
                    htmlFor={`assessment-weight-${competency.id}`}
                  >
                    <TextInput
                      id={`assessment-weight-${competency.id}`}
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      placeholder="1.0"
                      value={weights[competency.id] ?? ""}
                      onChange={(event) =>
                        setWeights((current) => ({
                          ...current,
                          [competency.id]: event.target.value,
                        }))
                      }
                    />
                  </Field>
                ))}
              </div>
            )}
          </details>
        </div>

        <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">English translation</summary><div className="mt-4 space-y-4">
          {(["name", "description", "instructions"] as const).map((field) => <Field key={field} label={`English: ${field}`} htmlFor={`assessment-en-${field}`}><TextArea id={`assessment-en-${field}`} value={translationEn[field] ?? ""} onChange={(event) => setTranslationEn({ ...translationEn, [field]: event.target.value })} /></Field>)}
        </div></details>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-ink-950">Сұрақтар ({questions.length})</h2>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                setQuestions([
                  ...questions,
                  {
                    type: "single_choice",
                    body: "",
                    body_en: "",
                    competency_id: "",
                    competency_ids: [],
                    competency_weights: {},
                    points: 1,
                    order_no: questions.length + 1,
                    options: [
                      { label: "", is_correct: false, order_no: 1 },
                      { label: "", is_correct: false, order_no: 2 },
                    ],
                  },
                ])
              }
            >
              <Plus className="size-4" aria-hidden />
              Сұрақ қосу
            </Button>
          </div>
          {questions.length === 0 ? (
            <p className="text-sm text-slate-500">Әзірге сұрақ жоқ. Кемінде бір сұрақ қосыңыз.</p>
          ) : null}
          {questions.map((question, index) => (
            <div key={index} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone="brand">{index + 1}-сұрақ</Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setQuestions(
                      questions
                        .filter((_, questionIndex) => questionIndex !== index)
                        .map((item, itemIndex) => ({ ...item, order_no: itemIndex + 1 })),
                    )
                  }
                >
                  <Trash2 className="size-4" aria-hidden />
                  Жою
                </Button>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Field label="Түрі" htmlFor={`question-type-${index}`}>
                  <Select
                    id={`question-type-${index}`}
                    value={question.type}
                    onChange={(event) =>
                      updateQuestion(index, {
                        type: event.target.value as QuestionDraft["type"],
                      })
                    }
                  >
                    <option value="single_choice">Бір дұрыс жауап</option>
                    <option value="multiple_choice">Бірнеше дұрыс жауап</option>
                    <option value="open_text">Ашық жауап</option>
                  </Select>
                </Field>
                <Field label="Балл" htmlFor={`question-points-${index}`}>
                  <TextInput
                    id={`question-points-${index}`}
                    type="number"
                    min={1}
                    max={100}
                    value={question.points}
                    onChange={(event) =>
                      updateQuestion(index, { points: Number(event.target.value) || 1 })
                    }
                  />
                </Field>
                <CompetencyPicker
                  options={refs.competencies}
                  selected={question.competency_ids}
                  onChange={(ids) => updateQuestion(index, { competency_ids: ids, competency_id: ids[0] ?? "" })}
                />
              </div>
              {question.competency_ids.length ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {question.competency_ids.map((competencyId) => (
                  <Field key={competencyId} label={`${refs.competencies.find((item) => item.id === competencyId)?.title ?? competencyId} · салмақ`} htmlFor={`question-weight-${index}-${competencyId}`}>
                    <TextInput id={`question-weight-${index}-${competencyId}`} type="number" min={0.01} max={100} step={0.01}
                      value={question.competency_weights[competencyId] ?? 1}
                      onChange={(event) => updateQuestion(index, { competency_weights: { ...question.competency_weights, [competencyId]: Number(event.target.value) } })} />
                  </Field>
                ))}
              </div> : null}
              <div className="mt-3">
                <Field label="Сұрақ мәтіні (HTML қолжетімді)" htmlFor={`question-body-${index}`}>
                  <TextArea
                    id={`question-body-${index}`}
                    value={question.body}
                    onChange={(event) => updateQuestion(index, { body: event.target.value })}
                    className="min-h-20 font-mono text-xs"
                  />
                </Field>
              </div>
              <Field label="English question" htmlFor={`question-body-en-${index}`}><TextArea id={`question-body-en-${index}`} value={question.body_en} onChange={(event) => updateQuestion(index, { body_en: event.target.value })} /></Field>
              {question.type !== "open_text" ? (
                <div className="mt-3">
                  <OptionEditor
                    english
                    options={question.options}
                    multiple={question.type === "multiple_choice"}
                    onChange={(options) => updateQuestion(index, { options })}
                    labels={{
                      add: "Нұсқа қосу",
                      correct: "Дұрыс",
                      empty: "Нұсқа қосылмаған.",
                    }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <StatusField value={status} onChange={setStatus} />
          <DemoField checked={isDemo} onChange={setIsDemo} />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={showCorrectAnswers}
            onChange={(event) => setShowCorrectAnswers(event.target.checked)}
            className="size-4 accent-brand-700"
          />
          Тапсырылғаннан кейін дұрыс жауаптарды көрсету
        </label>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" loading={save.isPending}>
          {initial ? "Өзгерістерді сақтау" : "Диагностика жасау"}
        </Button>
      </form>
    </AdminEditorCard>
  );
}

export function AdminAssessmentsPage() {
  const t = useText();
  const label = useLabel();
  const { language } = usePreferences();
  useTitle(t("Диагностикалар", "Assessments"));
  const queryClient = useQueryClient();
  const [editId, setEditId] = useEditParam();
  const isNew = editId === "new";
  const selectedId = isNew ? null : editId;
  const refs = useAdminReferences();
  const list = useQuery({
    queryKey: ["admin", "assessments"],
    queryFn: () => http.get<AdminAssessment[]>("/admin/assessments"),
  });
  const detail = useQuery({
    queryKey: ["admin", "assessments", "detail", selectedId],
    queryFn: () => http.get<AdminAssessment>(`/admin/assessments/${selectedId}`),
    enabled: Boolean(selectedId),
  });
  const newVersion = useMutation({
    mutationFn: (id: string) =>
      http.post<AdminAssessment>(`/admin/assessments/${id}/new-version`),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      setEditId(data.id);
    },
  });
  const refreshAndSelect = (id: string) => {
    void queryClient.invalidateQueries({ queryKey: ["admin"] });
    setEditId(id || null);
  };

  return (
    <div>
      <PageHeader
        eyebrow="CMS"
        title={t("Диагностикалар", "Assessments")}
        description={t("Pre-test, post-test және тесттер. Сұрақтар құзыреттіліктерге байланысады; аяқталған талпыныстан кейін құрылымды өзгерту үшін жаңа нұсқа жасалады.", "Manage pre-tests, post-tests, and quizzes. Create a new version to change the structure after attempts exist.")}
        actions={
          <Button type="button" onClick={() => setEditId("new")}>
            <Plus className="size-4" aria-hidden />
            {t("Жаңа диагностика", "New assessment")}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="self-start">
          <h2 className="text-sm font-bold text-ink-950">{t("Диагностикалар", "Assessments")}</h2>
          {list.isLoading ? (
            <PageLoader />
          ) : list.isError ? (
            <Alert tone="error">{errorMessage(list.error)}</Alert>
          ) : (
            <div className="mt-3 space-y-1.5">
              {(list.data ?? []).map((item) => (
                <AdminListButton
                  key={item.id}
                  active={selectedId === item.id}
                  title={`${localizeAssessment(item, language).name} (v${item.version})`}
                  meta={`${item.kind === "pre" ? "Pre-test" : item.kind === "post" ? "Post-test" : "Тест"} · ${
                    label(statusLabels[item.status] ?? item.status)
                  }`}
                  onClick={() => setEditId(item.id)}
                />
              ))}
            </div>
          )}
        </Card>
        <div>
          {isNew ? (
            <AssessmentEditor key="new" refs={refs} onSaved={refreshAndSelect} />
          ) : selectedId ? (
            detail.isLoading ? (
              <PageLoader />
            ) : detail.isError ? (
              <Alert tone="error">{errorMessage(detail.error)}</Alert>
            ) : detail.data ? (
              <AssessmentEditor
                key={detail.data.id}
                initial={detail.data}
                refs={refs}
                onSaved={refreshAndSelect}
                onNewVersion={() => newVersion.mutate(detail.data.id)}
              />
            ) : null
          ) : (
            <AdminEmptyEditor text={t("Диагностиканы таңдаңыз немесе жаңасын жасаңыз.", "Select an assessment or create a new one.")} />
          )}
          {newVersion.isError ? (
            <div className="mt-4">
              <Alert tone="error">{errorMessage(newVersion.error)}</Alert>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-6">
        <DemoNotice>
          Порогтық деңгейлер мен балл есептеу ережелері демо-конфигурацияда. Нақты әдістеме
          ғылыми жетекшімен бекітілуі керек.
        </DemoNotice>
      </div>
    </div>
  );
}
