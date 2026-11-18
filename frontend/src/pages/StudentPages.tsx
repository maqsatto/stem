import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Compass,
  ExternalLink,
  FolderKanban,
  ListChecks,
  Target,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { errorMessage, http } from "@/shared/api";
import { useAuth } from "@/shared/auth";
import { CatalogFilters, ClassFilter, LessonFilter } from "@/shared/components/CatalogFilters";
import { DiagnosticsChart } from "@/shared/components/DiagnosticsChart";
import { ResourceList } from "@/shared/components/ContentBits";
import { ContentCard } from "@/shared/components/ContentCard";
import { QuizForm, type QuizAnswer, type QuizInitialValues } from "@/shared/components/QuizForm";
import { RichTextRenderer } from "@/shared/components/RichTextRenderer";
import { SubmissionForm } from "@/shared/components/SubmissionForm";
import {
  assessmentKindLabels,
  contentPath,
  difficultyLabels,
  formatDate,
  formatDateTime,
  formatDelta,
  formatPercent,
  levelLabels,
  statusLabels,
  taskTypeLabels,
} from "@/shared/format";
import { useDebouncedValue, useTitle } from "@/shared/hooks";
import { useLabel, usePreferences, useText } from "@/shared/preferences";
import { localizeAssessment, localizeLesson, localizeProject, localizeRefTitle, localizeTask } from "@/shared/localizeContent";
import type {
  AssessmentCard,
  AssessmentDetail,
  Assignment,
  Attempt,
  Classroom,
  JoinClassResponse,
  LessonCard,
  LessonDetail,
  Page,
  ProjectCard,
  ProjectDetail,
  StudentResults,
  Submission,
  TaskCard,
  TaskDetail,
} from "@/shared/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  DemoNotice,
  EmptyState,
  Field,
  LinkButton,
  PageHeader,
  PageLoader,
  Pagination,
  ProgressBar,
  Select,
  StatCard,
  TextInput,
} from "@/shared/ui";

function findAssignment(
  assignments: Assignment[] | undefined,
  contentType: Assignment["content_type"],
  contentId: string,
): Assignment | undefined {
  return assignments?.find(
    (assignment) => assignment.content_type === contentType && assignment.content_id === contentId,
  );
}

function AssignmentStatusBadge({ status }: { status: string | null | undefined }) {
  const t = useText();
  if (status === "not_started") return <Badge tone="slate">{t("Басталмаған", "Not started")}</Badge>;
  if (status === "in_progress") return <Badge tone="blue">{t("Орындалуда", "In progress")}</Badge>;
  if (status === "submitted") return <Badge tone="amber">{t("Тапсырылды", "Submitted")}</Badge>;
  if (status === "reviewed") return <Badge tone="green">{t("Тексерілді", "Reviewed")}</Badge>;
  if (status === "returned") return <Badge tone="rose">{t("Қайта өңдеуге", "Returned")}</Badge>;
  return <Badge tone="slate">—</Badge>;
}

function useStudentAssignments() {
  return useQuery({
    queryKey: ["assignments", "student"],
    queryFn: () => http.get<Page<Assignment>>("/assignments?page_size=100"),
  });
}

function AssignmentStart({ assignment }: { assignment: Assignment | undefined }) {
  const t = useText();
  const queryClient = useQueryClient();
  const start = useMutation({
    mutationFn: () => http.post(`/assignments/${assignment?.id}/start`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["assignments", "student"] }),
  });
  if (!assignment || assignment.status !== "active" || assignment.student_status !== "not_started") return null;
  return <div className="mt-4">
    <Button type="button" variant="secondary" loading={start.isPending} onClick={() => start.mutate()}>{t("Жұмысты бастау", "Start work")}</Button>
    {start.isError ? <Alert tone="error">{errorMessage(start.error)}</Alert> : null}
  </div>;
}

export function StudentDashboardPage() {
  const { language } = usePreferences();
  const t = useText();
  useTitle(t("Менің оқуым", "My learning"));
  const { user } = useAuth();
  const results = useQuery({
    queryKey: ["student-results"],
    queryFn: () => http.get<StudentResults>("/me/results"),
  });
  const assignments = useStudentAssignments();
  const pending = (assignments.data?.items ?? []).filter((assignment) =>
    ["not_started", "returned", "in_progress"].includes(assignment.student_status ?? "not_started"),
  );
  const comparison = results.data?.comparisons[0] ?? null;

  return (
    <div>
      <PageHeader
        eyebrow={t("Оқушы кабинеті", "Student dashboard")}
        title={t(`Сәлеметсіз бе, ${user?.display_name ?? "оқушы"}!`, `Hello, ${user?.display_name ?? "student"}!`)}
        description={t("Оқу прогресіңіз, келесі қадамдарыңыз және STEM диагностика динамикасы бір жерде.", "Your learning progress, next steps and STEM assessment results in one place.")}
        actions={
          <>
            <LinkButton to="/student/lessons" variant="secondary">
              <BookOpen className="size-4" aria-hidden />
              {t("Сабақтар", "Lessons")}
            </LinkButton>
            <LinkButton to="/student/assessments">
              <ListChecks className="size-4" aria-hidden />
              {t("Диагностика", "Assessments")}
            </LinkButton>
          </>
        }
      />
      {results.isLoading ? (
        <PageLoader />
      ) : results.isError ? (
        <Alert tone="error">{errorMessage(results.error)}</Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t("Аяқталған сабақтар", "Completed lessons")}
              value={`${results.data?.progress.lessons_completed ?? 0} / ${
                results.data?.progress.lessons_total ?? 0
              }`}
            />
            <StatCard
              label={t("Тапсырылған жұмыстар", "Submitted work")}
              value={results.data?.progress.tasks_submitted ?? 0}
              tone="blue"
            />
            <StatCard
              label={t("Тексерілген жұмыстар", "Reviewed work")}
              value={results.data?.progress.tasks_reviewed ?? 0}
              tone="amber"
            />
            <StatCard
              label={t("Орташа балл", "Average score")}
              value={formatPercent(results.data?.progress.average_grade ?? null)}
            />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink-950">{t("Келесі қадамдар", "Next steps")}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t("Тағайындалған жұмыстар мен аяқталмаған әрекеттер.", "Assigned work and unfinished activities.")}
                  </p>
                </div>
                <Link to="/student/class" className="text-xs font-semibold no-underline">
                  {t("Барлығы", "View all")}
                </Link>
              </div>
              {pending.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title={t("Күтіп тұрған жұмыс жоқ", "Nothing pending")}
                    description={t("Жаңа тағайындаулар пайда болғанда осы жерде көрінеді.", "New assignments will appear here.")}
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {pending.slice(0, 5).map((assignment) => (
                    <li key={assignment.id}>
                      <Link
                        to={contentPath("student", assignment.content_type, assignment.content_id)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 no-underline transition hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink-950">
                            {language === "en" ? assignment.content_title_en || assignment.content_title : assignment.content_title}
                          </span>
                          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{assignment.classroom_title}</span>
                            {assignment.due_at ? (
                              <span className="inline-flex items-center gap-1">
                                <CalendarClock className="size-3" aria-hidden />
                                {formatDateTime(assignment.due_at)}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <AssignmentStatusBadge status={assignment.student_status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink-950">{t("STEM динамикасы", "STEM progress")}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {t("Pre/post салыстыруы бар болса ғана көрсетіледі.", "Shown when comparable pre- and post-test results are available.")}
                  </p>
                </div>
                <Link to="/student/results" className="text-xs font-semibold no-underline">
                  {t("Толығырақ", "View details")}
                </Link>
              </div>
              <div className="mt-4">
                {comparison ? (
                  <DiagnosticsChart comparison={comparison} height={240} />
                ) : (
                  <EmptyState
                    title={t("Диагностика әлі жеткіліксіз", "Not enough assessment data yet")}
                    description={t("Pre-test және post-test аяқталғаннан кейін құзыреттіліктер бойынша өзгеріс осында шығады.", "Complete both assessments to see changes in your competencies.")}
                    action={<LinkButton to="/student/assessments">{t("Диагностикаға өту", "Go to assessments")}</LinkButton>}
                  />
                )}
              </div>
            </Card>
          </div>

          {results.data?.competency_summary.length ? (
            <Card className="mt-6">
              <h2 className="text-lg font-bold text-ink-950">{t("Құзыреттіліктер профилі", "Competency profile")}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {results.data.competency_summary.map((item) => (
                  <div key={item.competency_id} className="rounded-xl border border-slate-200 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                      <Badge tone={item.level === "high" ? "green" : item.level === "low" ? "rose" : "slate"}>
                        {item.level ? levelLabels[item.level] ?? item.level : "—"}
                      </Badge>
                    </div>
                    <p className="mt-2 text-2xl font-bold text-ink-950">{formatPercent(item.percent)}</p>
                    {item.delta_pp !== null ? (
                      <p className="mt-1 text-xs font-semibold text-brand-700">{formatDelta(item.delta_pp)}</p>
                    ) : null}
                    <div className="mt-2">
                      <ProgressBar value={item.percent} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <div className="mt-6">
            <DemoNotice />
          </div>
        </>
      )}
    </div>
  );
}

export function StudentLessonsPage() {
  const t = useText();
  const { language } = usePreferences();
  useTitle(t("Сабақтар", "Lessons"));
  const [search, setSearch] = useState("");
  const [algorithmId, setAlgorithmId] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [sort, setSort] = useState("order");
  const query = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const lessons = useQuery({
    queryKey: ["student-lessons", query, algorithmId, competencyId, sort, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "12", sort });
      if (query) params.set("q", query);
      if (algorithmId) params.set("algorithm_id", algorithmId);
      if (competencyId) params.set("competency_id", competencyId);
      return http.get<Page<LessonCard>>(`/lessons?${params.toString()}`);
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow={t("Оқу материалы", "Learning materials")}
        title={t("Сабақтар", "Lessons")}
        description={t("Алты сабақ ML негіздерінен STEM жобасына дейінгі тізбекті құрайды. Әр сабақта теория, ресурстар, практика және рефлексия бар.", "Six lessons take you from ML basics to STEM projects, with theory, resources and practice.")}
      />
      <CatalogFilters
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        algorithmId={algorithmId}
        onAlgorithmId={(value) => {
          setAlgorithmId(value);
          setPage(1);
        }}
        competencyId={competencyId}
        onCompetencyId={(value) => {
          setCompetencyId(value);
          setPage(1);
        }}
        searchLabel={t("Сабақ іздеу", "Search lessons")}
        sort={sort} onSort={(value) => { setSort(value); setPage(1); }}
      />
      {lessons.isLoading ? (
        <PageLoader />
      ) : lessons.isError ? (
        <Alert tone="error">{errorMessage(lessons.error)}</Alert>
      ) : (lessons.data?.items.length ?? 0) === 0 ? (
        <EmptyState title={t("Сабақтар табылмады", "No lessons found")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lessons.data?.items.map((lesson) => (
              <ContentCard
                key={lesson.id}
                to={`/student/lessons/${lesson.id}`}
                title={localizeLesson(lesson, language).title}
                image="/images/stem-classroom.png"
                meta={t(`${lesson.order_no}-сабақ · ${lesson.duration_min} мин`, `Lesson ${lesson.order_no} · ${lesson.duration_min} min`)}
                description={localizeLesson(lesson, language).summary}
                icon={<BookOpen className="size-5" aria-hidden />}
                demo={lesson.is_demo}
                badges={
                  <>
                    {lesson.completed ? <Badge tone="green">{t("Оқылды", "Completed")}</Badge> : null}
                    {lesson.algorithm ? <Badge tone="brand">{localizeRefTitle(lesson.algorithm, language)}</Badge> : null}
                    {lesson.competencies.slice(0, 2).map((competency) => (
                      <Badge key={competency.id} tone="slate">
                        {localizeRefTitle(competency, language)}
                      </Badge>
                    ))}
                  </>
                }
              />
            ))}
          </div>
          <Pagination
            page={page}
            total={lessons.data?.total ?? 0}
            pageSize={12}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}

export function StudentLessonDetailPage() {
  const t = useText();
  const { language } = usePreferences();
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const lesson = useQuery({
    queryKey: ["student-lesson", id],
    queryFn: () => http.get<LessonDetail>(`/lessons/${id}`),
  });
  const complete = useMutation({
    mutationFn: () => http.post<{ completed: boolean }>(`/lessons/${id}/complete`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["student-lesson", id] });
      void queryClient.invalidateQueries({ queryKey: ["student-lessons"] });
      void queryClient.invalidateQueries({ queryKey: ["student-results"] });
    },
  });
  useTitle(lesson.data ? localizeLesson(lesson.data, language).title : t("Сабақ", "Lesson"));

  if (lesson.isLoading) return <PageLoader />;
  if (lesson.isError)
    return (
      <div className="max-w-3xl">
        <Alert tone="error" title={t("Сабақ ашылмады", "Could not open lesson")}>
          {errorMessage(lesson.error)}
        </Alert>
      </div>
    );
  const data = lesson.data ? localizeLesson(lesson.data, language) : undefined;
  if (!data) return null;

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_20rem]">
      <article>
        <Link to="/student/lessons" className="inline-flex items-center gap-1 text-sm font-semibold no-underline">
          <ArrowLeft className="size-4" aria-hidden /> {t("Сабақтар", "Lessons")}
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="brand">{t(`${data.order_no}-сабақ`, `Lesson ${data.order_no}`)}</Badge>
          <Badge tone="slate">{data.duration_min} {t("минут", "min")}</Badge>
          {data.completed ? <Badge tone="green">{t("Оқылды", "Completed")}</Badge> : null}
          {data.is_demo ? <Badge tone="amber">{t("Демо", "Demo")}</Badge> : null}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-950">{data.title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{data.summary}</p>
        <img src="/images/stem-classroom.png" alt="" className="mt-6 aspect-[2/1] w-full rounded-md object-cover" />
        {data.goal ? (
          <Card className="mt-5 bg-brand-50">
            <p className="text-xs font-bold tracking-wide text-brand-800 uppercase">{t("Мақсат", "Goal")}</p>
            <p className="mt-1 text-sm leading-6 text-brand-950">{data.goal}</p>
          </Card>
        ) : null}
        <div className="mt-6">
          <RichTextRenderer html={data.body} />
        </div>
        {data.reflection ? (
          <Card className="mt-8 border-amber-200 bg-amber-50">
            <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">{t("Рефлексия", "Reflection")}</p>
            <p className="mt-1 text-sm leading-6 text-amber-950">{data.reflection}</p>
          </Card>
        ) : null}
        {data.resources.length > 0 ? (
          <section className="mt-8">
            <ResourceList resources={data.resources} />
          </section>
        ) : null}
        {data.tasks.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-ink-950">{t("Байланысты тапсырмалар", "Related tasks")}</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.tasks.map((task) => (
                <Link
                  key={task.id}
                  to={`/student/tasks/${task.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 no-underline hover:border-brand-300"
                >
                  <span>
                    <span className="block text-sm font-semibold text-ink-950">{localizeRefTitle(task, language)}</span>
                    <span className="text-xs text-slate-500">
                      {taskTypeLabels[task.type] ?? task.type} ·{" "}
                      {difficultyLabels[task.difficulty] ?? task.difficulty}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-brand-700" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </article>
      <aside className="space-y-4">
        <Card>
          <h2 className="text-sm font-bold text-ink-950">{t("Оқу мәртебесі", "Learning status")}</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {t("Сабақ тек сіз өзіңіз белгілегенде аяқталды деп тіркеледі. Бетті жай ашу прогресс болып саналмайды.", "A lesson is completed only when you mark it. Opening the page does not record progress.")}
          </p>
          <div className="mt-4">
            {data.completed ? (
              <Alert tone="success">{t("Сабақ аяқталды деп белгіленген.", "Lesson marked as complete.")}</Alert>
            ) : (
              <Button
                className="w-full"
                loading={complete.isPending}
                onClick={() => complete.mutate()}
              >
                <CheckCircle2 className="size-4" aria-hidden />
                {t("Сабақты аяқталды деп белгілеу", "Mark lesson as complete")}
              </Button>
            )}
            {complete.isError ? (
              <div className="mt-2">
                <Alert tone="error">{errorMessage(complete.error)}</Alert>
              </div>
            ) : null}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-bold text-ink-950">{t("STEM құзыреттіліктері", "STEM competencies")}</h2>
          <ul className="mt-3 space-y-1.5">
            {data.competencies.map((competency) => (
              <li key={competency.id}>
                <Link
                  to={`/stem/${competency.slug}`}
                  className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 no-underline"
                >
                  <Target className="size-3.5" aria-hidden />
                  {localizeRefTitle(competency, language)}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        {data.algorithm ? (
          <Card>
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">ML алгоритмі</p>
            <Link to={`/ml/${data.algorithm.slug}`} className="mt-1 block text-sm font-semibold no-underline">
              {localizeRefTitle(data.algorithm, language)}
            </Link>
          </Card>
        ) : null}
        <DemoNotice />
      </aside>
    </div>
  );
}

export function StudentTasksPage() {
  const { language } = usePreferences();
  const t = useText();
  const label = useLabel();
  useTitle(t("Тапсырмалар", "Tasks"));
  const [search, setSearch] = useState("");
  const [algorithmId, setAlgorithmId] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [classroomId, setClassroomId] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sort, setSort] = useState("order");
  const query = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const tasks = useQuery({
    queryKey: ["student-tasks", query, algorithmId, competencyId, lessonId, classroomId, type, difficulty, sort, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "12", sort });
      if (query) params.set("q", query);
      if (algorithmId) params.set("algorithm_id", algorithmId);
      if (competencyId) params.set("competency_id", competencyId);
      if (lessonId) params.set("lesson_id", lessonId);
      if (classroomId) params.set("classroom_id", classroomId);
      if (type) params.set("type", type);
      if (difficulty) params.set("difficulty", difficulty);
      return http.get<Page<TaskCard>>(`/tasks?${params.toString()}`);
    },
  });
  const assignments = useStudentAssignments();
  const assignedIds = new Set(
    (assignments.data?.items ?? [])
      .filter((assignment) => assignment.content_type === "task")
      .map((assignment) => assignment.content_id),
  );

  return (
    <div>
      <PageHeader
        eyebrow={t("Практика", "Practice")}
        title={t("Тапсырмалар", "Tasks")}
        description={t("Жабық тесттер серверде автоматты тексеріледі; ашық жұмыстарды мұғалім рубрика бойынша бағалайды. Тапсырманы орындау үшін ол сыныбыңызға тағайындалуы керек.", "Closed questions are graded automatically; teachers review practical work. Your teacher must assign a task before you can submit it.")}
      />
      <CatalogFilters
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        algorithmId={algorithmId}
        onAlgorithmId={(value) => {
          setAlgorithmId(value);
          setPage(1);
        }}
        competencyId={competencyId}
        onCompetencyId={(value) => {
          setCompetencyId(value);
          setPage(1);
        }}
        searchLabel={t("Тапсырма іздеу", "Search tasks")}
      >
        <LessonFilter value={lessonId} onChange={(value) => { setLessonId(value); setPage(1); }} />
        <ClassFilter value={classroomId} onChange={(value) => { setClassroomId(value); setPage(1); }} />
        <Select
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
          aria-label={t("Тапсырма түрі", "Task type")}
        >
          <option value="">{t("Барлық түрлер", "All types")}</option>
          {Object.entries(taskTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {t(label, ({single_choice: "Single choice", multiple_choice: "Multiple choice", open_text: "Open response", file_upload: "File upload", link: "Link"} as Record<string, string>)[value] ?? label)}
            </option>
          ))}
        </Select>
        <Select
          value={difficulty}
          onChange={(event) => {
            setDifficulty(event.target.value);
            setPage(1);
          }}
          aria-label={t("Қиындық", "Difficulty")}
        >
          <option value="">{t("Барлық деңгейлер", "All levels")}</option>
          {Object.entries(difficultyLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {t(label, ({easy: "Easy", medium: "Medium", hard: "Hard"} as Record<string, string>)[value] ?? label)}
            </option>
          ))}
        </Select>
        <Select
          value={sort}
          onChange={(event) => {
            setSort(event.target.value);
            setPage(1);
          }}
          aria-label={t("Сұрыптау", "Sort")}
        >
          <option value="order">{t("Реті бойынша", "Default order")}</option>
          <option value="difficulty">{t("Қиындығы бойынша", "Difficulty")}</option>
          <option value="date">{t("Жаңа материалдар алдымен", "Newest first")}</option>
          <option value="title">{t("Атауы бойынша", "Title")}</option>
        </Select>
      </CatalogFilters>
      {tasks.isLoading ? (
        <PageLoader />
      ) : tasks.isError ? (
        <Alert tone="error">{errorMessage(tasks.error)}</Alert>
      ) : (tasks.data?.items.length ?? 0) === 0 ? (
        <EmptyState title={t("Тапсырмалар табылмады", "No tasks found")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tasks.data?.items.map((task) => (
              <ContentCard
                key={task.id}
                to={`/student/tasks/${task.id}`}
                title={localizeTask(task, language).title}
                meta={`${label(taskTypeLabels[task.type] ?? task.type)} · ${
                  label(difficultyLabels[task.difficulty] ?? task.difficulty)
                }`}
                icon={<ClipboardList className="size-5" aria-hidden />}
                demo={task.is_demo}
                badges={
                  <>
                    <Badge tone="slate">{task.max_score} балл</Badge>
                    {assignedIds.has(task.id) ? <Badge tone="green">Тағайындалған</Badge> : null}
                    {task.competencies.slice(0, 2).map((competency) => (
                      <Badge key={competency.id} tone="brand">
                        {localizeRefTitle(competency, language)}
                      </Badge>
                    ))}
                  </>
                }
              />
            ))}
          </div>
          <Pagination page={page} total={tasks.data?.total ?? 0} pageSize={12} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export function StudentTaskDetailPage() {
  const { language } = usePreferences();
  const t = useText();
  const label = useLabel();
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const task = useQuery({
    queryKey: ["student-task", id],
    queryFn: () => http.get<TaskDetail>(`/tasks/${id}`),
  });
  const assignments = useStudentAssignments();
  const assignment = findAssignment(assignments.data?.items, "task", id);
  const existingSubmission = useQuery({
    queryKey: ["submission", assignment?.submission_id],
    queryFn: () => http.get<Submission>(`/submissions/${assignment?.submission_id}`),
    enabled: Boolean(assignment?.submission_id),
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [closedSubmission, setClosedSubmission] = useState<Submission | null>(null);
  const [closedError, setClosedError] = useState<string | null>(null);

  const submitClosed = useMutation({
    mutationFn: () =>
      http.post<Submission>(`/assignments/${assignment?.id}/submissions`, {
        answers: { selected_option_ids: selected },
      }),
    onSuccess: (submission) => {
      setClosedSubmission(submission);
      setClosedError(null);
      void queryClient.invalidateQueries({ queryKey: ["assignments", "student"] });
      void queryClient.invalidateQueries({ queryKey: ["student-results"] });
      void queryClient.invalidateQueries({ queryKey: ["submission"] });
    },
    onError: (error) => setClosedError(errorMessage(error)),
  });

  useTitle(task.data ? localizeTask(task.data, language).title : t("Тапсырма", "Task"));

  if (task.isLoading) return <PageLoader />;
  if (task.isError)
    return (
      <Alert tone="error" title={t("Тапсырма ашылмады", "Could not open task")}>
        {errorMessage(task.error)}
      </Alert>
    );
  const data = task.data ? localizeTask(task.data, language) : undefined;
  if (!data) return null;
  const isClosed = data.type === "single_choice" || data.type === "multiple_choice";
  const shown = closedSubmission ?? existingSubmission.data ?? null;
  const attemptsLeft = shown
    ? Math.max(0, data.attempts_limit - shown.attempts_count)
    : data.attempts_limit;
  const submissionMode =
    data.type === "open_text"
      ? "open_text"
      : data.type === "file_upload"
        ? "file"
        : data.type === "link"
          ? "link"
          : "all";

  const taskType = data.type;

  function toggle(optionId: string) {
    if (taskType === "single_choice") {
      setSelected([optionId]);
      return;
    }
    setSelected((current) =>
      current.includes(optionId)
        ? current.filter((item) => item !== optionId)
        : [...current, optionId],
    );
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_20rem]">
      <article>
        <Link to="/student/tasks" className="inline-flex items-center gap-1 text-sm font-semibold no-underline">
          <ArrowLeft className="size-4" aria-hidden /> {t("Тапсырмалар", "Tasks")}
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="brand">{label(taskTypeLabels[data.type] ?? data.type)}</Badge>
          <Badge tone="slate">{label(difficultyLabels[data.difficulty] ?? data.difficulty)}</Badge>
          <Badge tone="amber">{data.max_score} {t("балл", "points")}</Badge>
          {data.is_demo ? <Badge tone="amber">{t("Демо", "Demo")}</Badge> : null}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-950">{data.title}</h1>
        <AssignmentStart assignment={assignment} />
        {data.instructions ? (
          <div className="mt-4">
            <RichTextRenderer html={data.instructions} />
          </div>
        ) : null}
        {data.body ? (
          <div className="mt-4">
            <RichTextRenderer html={data.body} />
          </div>
        ) : null}

        {!assignment ? (
          <div className="mt-6">
            <Alert tone="warning" title={t("Тапсырма әлі тағайындалмаған", "Task not yet assigned")}>
              {t("Бұл тапсырманы орындау үшін мұғалім оны сыныбыңызға тағайындауы керек. Осы уақытта теория мен талаптармен таныса аласыз.", "Your teacher must assign this task to your class before you can submit it. You can read the material in the meantime.")}
            </Alert>
          </div>
        ) : (
          <Card className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-ink-950">{t("Тапсырманы орындау", "Complete task")}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {assignment.classroom_title} · дедлайн: {formatDateTime(assignment.due_at)}
                </p>
              </div>
              <AssignmentStatusBadge status={shown?.status ?? assignment.student_status} />
            </div>

            {isClosed ? (
              <div className="mt-5">
                {shown ? (
                  <div className="space-y-4">
                    <Alert
                      tone={shown.status === "reviewed" ? "success" : "info"}
                      title={t("Жауап сақталған", "Answer saved")}
                    >
                      <p>
                        {t("Баға", "Score")}: <strong>{shown.grade ?? "—"}</strong> / {shown.max_score ?? data.max_score} ·
                        {t("Талпыныс", "Attempt")}: {shown.attempts_count} / {data.attempts_limit}
                      </p>
                      {shown.correct_labels?.length ? (
                        <p className="mt-1">
                          {t("Дұрыс жауап", "Correct answer")}: <strong>{data.options.filter((option) => shown.correct_option_ids?.includes(option.id)).map((option) => option.label).join(", ") || shown.correct_labels.join(", ")}</strong>
                        </p>
                      ) : null}
                    </Alert>
                    {attemptsLeft > 0 ? (
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setClosedSubmission(null);
                          setSelected([]);
                        }}
                      >
                        {t(`Жаңа талпыныс (${attemptsLeft} қалды)`, `New attempt (${attemptsLeft} remaining)`)}
                      </Button>
                    ) : (
                      <p className="text-sm text-slate-500">{t("Талпыныс лимиті аяқталды.", "No attempts remaining.")}</p>
                    )}
                  </div>
                ) : null}
                {(!shown || closedSubmission === null) && attemptsLeft > 0 ? (
                  <form
                    className="mt-4 space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (selected.length === 0) {
                        setClosedError(t("Кемінде бір жауап нұсқасын таңдаңыз.", "Select at least one answer."));
                        return;
                      }
                      submitClosed.mutate();
                    }}
                  >
                    <fieldset className="space-y-2">
                      <legend className="mb-2 text-sm font-semibold text-slate-800">
                        {data.type === "multiple_choice"
                          ? t("Бірнеше дұрыс жауапты таңдаңыз", "Select all correct answers")
                          : t("Бір дұрыс жауапты таңдаңыз", "Select one answer")}
                      </legend>
                      {data.options.map((option) => {
                        const checked = selected.includes(option.id);
                        return (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition ${
                              checked
                                ? "border-brand-400 bg-brand-50 text-brand-950"
                                : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"
                            }`}
                          >
                            <input
                              type={data.type === "single_choice" ? "radio" : "checkbox"}
                              name="task-option"
                              checked={checked}
                              onChange={() => toggle(option.id)}
                              className="mt-0.5 size-4 accent-brand-700"
                            />
                            <span>{option.label}</span>
                          </label>
                        );
                      })}
                    </fieldset>
                    {closedError ? <Alert tone="error">{closedError}</Alert> : null}
                    <Button type="submit" loading={submitClosed.isPending}>
                      {t("Жауапты жіберу", "Submit answer")}
                    </Button>
                  </form>
                ) : null}
              </div>
            ) : (
              <div className="mt-5">
                {existingSubmission.data || assignment.submission_id ? (
                  <div className="mb-5">
                    {existingSubmission.isLoading ? (
                      <PageLoader />
                    ) : existingSubmission.data ? (
                      <SubmissionForm
                        assignmentId={assignment.id}
                        mode={submissionMode}
                        existing={existingSubmission.data}
                        onSubmitted={() => {
                          void queryClient.invalidateQueries({ queryKey: ["assignments", "student"] });
                          void queryClient.invalidateQueries({ queryKey: ["submission"] });
                          void queryClient.invalidateQueries({ queryKey: ["student-results"] });
                        }}
                      />
                    ) : null}
                  </div>
                ) : (
                  <SubmissionForm
                    assignmentId={assignment.id}
                    mode={submissionMode}
                    onSubmitted={() => {
                      void queryClient.invalidateQueries({ queryKey: ["assignments", "student"] });
                      void queryClient.invalidateQueries({ queryKey: ["student-results"] });
                    }}
                  />
                )}
              </div>
            )}
          </Card>
        )}

        {data.resources.length > 0 ? (
          <section className="mt-8">
            <ResourceList resources={data.resources} />
          </section>
        ) : null}
      </article>
      <aside className="space-y-4">
        <Card>
          <h2 className="text-sm font-bold text-ink-950">{t("Бағалау", "Assessment")}</h2>
          {data.rubric_json.length > 0 ? (
            <table className="mt-3 w-full text-left text-sm">
              <thead className="text-xs font-bold text-slate-500 uppercase">
                <tr>
                  <th className="pb-2">Критерий</th>
                  <th className="pb-2 text-right">Балл</th>
                </tr>
              </thead>
              <tbody>
                {data.rubric_json.map((item, index) => (
                  <tr key={`${item.criterion}-${index}`} className="border-t border-slate-100">
                    <td className="py-2 text-slate-600">{item.criterion}</td>
                    <td className="py-2 text-right font-semibold">{item.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              {isClosed
                ? "Жабық тест серверде автоматты тексеріледі."
                : "Ашық жұмыс мұғалім тарапынан қолмен бағаланады."}
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Талпыныс лимиті: {data.attempts_limit}. Дұрыс жауаптарды көрсету:{" "}
            {data.show_correct_answers ? "қосулы" : "өшірулі"}.
          </p>
        </Card>
        <Card>
          <h2 className="text-sm font-bold text-ink-950">STEM құзыреттіліктері</h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {data.competencies.map((competency) => (
              <li key={competency.id}>
                <Link to={`/stem/${competency.slug}`} className="no-underline">
                  <Badge tone="brand">{localizeRefTitle(competency, language)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
          {data.lesson ? (
            <p className="mt-3 text-xs text-slate-500">
              Сабақ:{" "}
              <Link to={`/student/lessons/${data.lesson.id}`} className="font-semibold no-underline">
                {localizeRefTitle(data.lesson, language)}
              </Link>
            </p>
          ) : null}
        </Card>
        <DemoNotice />
      </aside>
    </div>
  );
}

export function StudentProjectsPage() {
  const { language } = usePreferences();
  const t = useText();
  useTitle(t("STEM жобалары", "STEM projects"));
  const [search, setSearch] = useState("");
  const [algorithmId, setAlgorithmId] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [sort, setSort] = useState("order");
  const query = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const projects = useQuery({
    queryKey: ["student-projects", query, algorithmId, competencyId, sort, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "12", sort });
      if (query) params.set("q", query);
      if (algorithmId) params.set("algorithm_id", algorithmId);
      if (competencyId) params.set("competency_id", competencyId);
      return http.get<Page<ProjectCard>>(`/projects?${params.toString()}`);
    },
  });
  const assignments = useStudentAssignments();
  const assignedIds = new Set(
    (assignments.data?.items ?? [])
      .filter((assignment) => assignment.content_type === "project")
      .map((assignment) => assignment.content_id),
  );
  return (
    <div>
      <PageHeader
        eyebrow={t("Практика", "Practice")}
        title={t("STEM жобалары", "STEM projects")}
        description={t("Жобаны таңдап, мәселені зерттеңіз, ML құралын қолданыңыз және нәтижені мұғалімге жіберіңіз. Жоба тағайындалған болса, жіберу формасы ашылады.", "Choose a project, investigate a problem, use ML tools, and submit your result to your teacher. The submission form opens when the project is assigned.")}
      />
      <CatalogFilters
        search={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        algorithmId={algorithmId}
        onAlgorithmId={(value) => {
          setAlgorithmId(value);
          setPage(1);
        }}
        competencyId={competencyId}
        onCompetencyId={(value) => {
          setCompetencyId(value);
          setPage(1);
        }}
        searchLabel={t("Жоба іздеу", "Search projects")}
        sort={sort} onSort={(value) => { setSort(value); setPage(1); }}
      />
      {projects.isLoading ? (
        <PageLoader />
      ) : projects.isError ? (
        <Alert tone="error">{errorMessage(projects.error)}</Alert>
      ) : (projects.data?.items.length ?? 0) === 0 ? (
        <EmptyState title={t("Жобалар табылмады", "No projects found")} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.data?.items.map((project) => (
              <ContentCard
                key={project.id}
                to={`/student/projects/${project.id}`}
                title={localizeProject(project, language).title}
                image="/images/stem-project.png"
                description={localizeProject(project, language).summary}
                icon={<FolderKanban className="size-5" aria-hidden />}
                demo={project.is_demo}
                badges={
                  <>
                    {assignedIds.has(project.id) ? <Badge tone="green">{t("Тағайындалған", "Assigned")}</Badge> : null}
                    {project.algorithm ? <Badge tone="brand">{localizeRefTitle(project.algorithm, language)}</Badge> : null}
                  </>
                }
              />
            ))}
          </div>
          <Pagination
            page={page}
            total={projects.data?.total ?? 0}
            pageSize={12}
            onPage={setPage}
          />
        </>
      )}
    </div>
  );
}

export function StudentProjectDetailPage() {
  const { language } = usePreferences();
  const t = useText();
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const project = useQuery({
    queryKey: ["student-project", id],
    queryFn: () => http.get<ProjectDetail>(`/projects/${id}`),
  });
  const assignments = useStudentAssignments();
  const assignment = findAssignment(assignments.data?.items, "project", id);
  const existingSubmission = useQuery({
    queryKey: ["submission", assignment?.submission_id],
    queryFn: () => http.get<Submission>(`/submissions/${assignment?.submission_id}`),
    enabled: Boolean(assignment?.submission_id),
  });
  useTitle(project.data ? localizeProject(project.data, language).title : t("STEM жобасы", "STEM project"));

  if (project.isLoading) return <PageLoader />;
  if (project.isError)
    return (
      <Alert tone="error" title={t("Жоба ашылмады", "Could not open project")}>
        {errorMessage(project.error)}
      </Alert>
    );
  const data = project.data ? localizeProject(project.data, language) : undefined;
  if (!data) return null;

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_21rem]">
      <article>
        <Link to="/student/projects" className="inline-flex items-center gap-1 text-sm font-semibold no-underline">
          <ArrowLeft className="size-4" aria-hidden /> {t("Жобалар", "Projects")}
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="brand">{t("STEM жобасы", "STEM project")}</Badge>
          {data.algorithm ? <Badge tone="slate">{localizeRefTitle(data.algorithm, language)}</Badge> : null}
          {data.is_demo ? <Badge tone="amber">{t("Демо", "Demo")}</Badge> : null}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-950">{data.title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{data.summary}</p>
        <AssignmentStart assignment={assignment} />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card className="bg-rose-50">
            <p className="text-xs font-bold tracking-wide text-rose-800 uppercase">{t("Мәселе", "Problem")}</p>
            <div className="mt-2 text-sm leading-6 text-rose-950">
              <RichTextRenderer html={data.problem} />
            </div>
          </Card>
          <Card className="bg-brand-50">
            <p className="text-xs font-bold tracking-wide text-brand-800 uppercase">{t("Мақсат", "Goal")}</p>
            <div className="mt-2 text-sm leading-6 text-brand-950">
              <RichTextRenderer html={data.goal} />
            </div>
          </Card>
          <Card className="bg-amber-50">
            <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">
              {t("Күтілетін нәтиже", "Expected result")}
            </p>
            <div className="mt-2 text-sm leading-6 text-amber-950">
              <RichTextRenderer html={data.expected_result} />
            </div>
          </Card>
        </div>
        <div className="mt-6">
          <RichTextRenderer html={data.body} />
        </div>
        <section className="mt-8">
          <h2 className="text-xl font-bold text-ink-950">{t("Орындау қадамдары", "Steps")}</h2>
          <ol className="mt-3 space-y-2">
            {(data.steps_json ?? []).map((step, index) => (
              <li
                key={`${step}-${index}`}
                className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-700"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
        <section className="mt-8 grid gap-6 sm:grid-cols-3">
          <div>
            <h2 className="text-base font-bold text-ink-950">{t("Материалдар", "Materials")}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {(data.materials_json ?? []).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-base font-bold text-ink-950">{t("Құралдар", "Tools")}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {(data.tools_json ?? []).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-base font-bold text-ink-950">{t("Критерийлер", "Criteria")}</h2>
            <ul className="mt-2 space-y-1 text-sm text-slate-600">
              {(data.rubric_json ?? []).map((item, index) => (
                <li key={`${item.criterion}-${index}`} className="flex justify-between gap-2">
                  <span>{item.criterion}</span>
                  <span className="font-semibold">{item.points}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
        {data.resources.length > 0 ? (
          <section className="mt-8">
            <ResourceList resources={data.resources} />
          </section>
        ) : null}
        <Card className="mt-8">
          <h2 className="text-lg font-bold text-ink-950">{t("Нәтижені жіберу", "Submit result")}</h2>
          {!assignment ? (
            <div className="mt-3">
              <Alert tone="warning" title={t("Жоба тағайындалмаған", "Project not assigned")}>
                {t("Нәтижені жіберу үшін мұғалім жобаны сыныбыңызға тағайындауы керек.", "Your teacher must assign this project to your class before you can submit a result.")}
              </Alert>
            </div>
          ) : existingSubmission.data ? (
            <div className="mt-3">
              <SubmissionForm
                assignmentId={assignment.id}
                mode="all"
                existing={existingSubmission.data}
                onSubmitted={() => {
                  void queryClient.invalidateQueries({ queryKey: ["assignments", "student"] });
                  void queryClient.invalidateQueries({ queryKey: ["submission"] });
                  void queryClient.invalidateQueries({ queryKey: ["student-results"] });
                }}
              />
            </div>
          ) : (
            <div className="mt-3">
              <SubmissionForm
                assignmentId={assignment.id}
                mode="all"
                onSubmitted={() => {
                  void queryClient.invalidateQueries({ queryKey: ["assignments", "student"] });
                  void queryClient.invalidateQueries({ queryKey: ["student-results"] });
                }}
              />
            </div>
          )}
        </Card>
      </article>
      <aside className="space-y-4">
        <Card>
          <h2 className="text-sm font-bold text-ink-950">{t("Жоба мәртебесі", "Project status")}</h2>
          <div className="mt-2"><AssignmentStatusBadge status={assignment?.student_status ?? null} /></div>
          <p className="mt-2 text-xs text-slate-500">
            {t("Дедлайн", "Deadline")}: {formatDateTime(assignment?.due_at)}
          </p>
          {assignment?.notes ? (
            <p className="mt-2 text-xs leading-5 text-slate-600">{assignment.notes}</p>
          ) : null}
        </Card>
        <Card>
          <h2 className="text-sm font-bold text-ink-950">{t("Дамитын құзыреттіліктер", "Competencies")}</h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {data.competencies.map((competency) => (
              <li key={competency.id}>
                <Link to={`/stem/${competency.slug}`} className="no-underline">
                  <Badge tone="brand">{localizeRefTitle(competency, language)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <DemoNotice />
      </aside>
    </div>
  );
}

export function StudentPracticePage() {
  const t = useText();
  useTitle(t("Практика", "Practice"));
  const tools = [
    {
      title: "Google Colab",
      url: "https://colab.research.google.com/",
      description:
        t("Python ортасында деректерді тазалау, модельді оқыту және нәтижені визуализациялау. Notebook-ты жүктеп, мұғалімге сілтеме арқылы жіберуге болады.", "Clean data, train a model, and visualize results in Python. Share the notebook with your teacher using a link."),
    },
    {
      title: "Teachable Machine",
      url: "https://teachablemachine.withgoogle.com/",
      description:
        t("Веб-камера немесе суреттер арқылы классификация моделін құру. Дайын модель сілтемесін жоба нәтижесі ретінде ұсыныңыз.", "Build a classification model using a webcam or images. Submit the model link as your project result."),
    },
    {
      title: "Kaggle Datasets",
      url: "https://www.kaggle.com/datasets",
      description:
        t("Ашық деректер жиынтықтары. Тек мұғаліммен келісілген, жеке деректерді қамтитын емес жиынтықтарды қолданыңыз.", "Open datasets. Use only datasets approved by your teacher that do not contain personal data."),
    },
  ];
  return (
    <div>
      <PageHeader
        eyebrow={t("Практика", "Practice")}
        title={t("Сыртқы ML құралдары", "External ML tools")}
        description={t("Платформа сыртқы құралдардың орнын баспайды, оларға әдістемелік бағыт береді. Барлық жұмысты тек HTTPS сілтеме немесе тексерілген файл арқылы жіберіңіз.", "The platform provides guidance for external tools. Submit work using an HTTPS link or an accepted file.")}
      />
      <div className="grid gap-4 md:grid-cols-3">
        {tools.map((tool) => (
          <Card key={tool.title} className="flex flex-col">
            <Compass className="size-6 text-brand-700" aria-hidden />
            <h2 className="mt-3 text-lg font-bold text-ink-950">{tool.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{tool.description}</p>
            <a
              href={tool.url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold no-underline"
            >
              {t("Құралды ашу", "Open tool")} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Card>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-ink-950">{t("Жұмысты жіберу ережесі", "How to submit work")}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>{t("Тапсырманы оқып, мұғалім тағайындаған форматты анықтаңыз.", "Read the task and identify the format assigned by your teacher.")}</li>
            <li>{t("Colab/Teachable Machine сілтемесін немесе файлды дайындаңыз.", "Prepare your Colab or Teachable Machine link or file.")}</li>
            <li>{t("Нәтижені тапсырма бетіндегі форма арқылы жіберіңіз.", "Submit your result using the form on the task page.")}</li>
            <li>{t("Мұғалім пікірін және бағаны «Нәтижелер» бөлімінен қараңыз.", "View teacher feedback and your grade in Results.")}</li>
          </ol>
        </Card>
        <Card>
          <h2 className="text-lg font-bold text-ink-950">{t("Қауіпсіздік", "Safety")}</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>{t("Жеке деректерді (телефон, мекенжай, сурет) ұсынбаңыз.", "Do not share personal information such as phone numbers, addresses, or photos.")}</li>
            <li>{t("Тек HTTPS сілтемелерді пайдаланыңыз.", "Use HTTPS links only.")}</li>
            <li>{t("Орындалған жұмысты басқа оқушының атынан жібермеңіз.", "Do not submit work on another student’s behalf.")}</li>
            <li>{t("Файл көлемі 25 МБ-тан аспауы керек.", "Files must not exceed 25 MB.")}</li>
          </ul>
        </Card>
      </div>
      <div className="mt-6">
        <DemoNotice />
      </div>
    </div>
  );
}

export function StudentAssessmentsPage() {
  const { language } = usePreferences();
  const t = useText();
  useTitle(t("Диагностика", "Assessments"));
  const [kind, setKind] = useState("");
  const assessments = useQuery({
    queryKey: ["student-assessments", kind],
    queryFn: () =>
      http.get<Page<AssessmentCard>>(
        `/assessments?page_size=100${kind ? `&kind=${kind}` : ""}`,
      ),
  });
  return (
    <div>
      <PageHeader
        eyebrow={t("Диагностика", "Assessments")}
        title={t("Pre-test және post-test", "Pre-test and post-test")}
        description={t("Диагностика STEM құзыреттіліктерінің бастапқы және соңғы деңгейін өлшейді. Салыстыру тек бір әдістеме кілті және сәйкес нұсқа бойынша жүргізіледі; бұл әдістеменің себептік әсерін дәлелдемейді.", "Assessments measure STEM competencies before and after learning. Only matching methodology versions can be compared; this does not prove causation.")}
      />
      <div className="mb-5 max-w-xs">
        <Select value={kind} onChange={(event) => setKind(event.target.value)} aria-label={t("Диагностика түрі", "Assessment type")}>
          <option value="">{t("Барлық диагностика", "All assessments")}</option>
          <option value="pre">Pre-test</option>
          <option value="post">Post-test</option>
          <option value="quiz">{t("Тест", "Quiz")}</option>
        </Select>
      </div>
      {assessments.isLoading ? (
        <PageLoader />
      ) : assessments.isError ? (
        <Alert tone="error">{errorMessage(assessments.error)}</Alert>
      ) : (assessments.data?.items.length ?? 0) === 0 ? (
        <EmptyState title={t("Диагностика тағайындалмаған", "No assessments available")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assessments.data?.items.map((assessment) => (
            <ContentCard
              key={assessment.id}
              to={`/student/assessments/${assessment.id}`}
              title={localizeAssessment(assessment, language).name}
              meta={`${assessmentKindLabels[assessment.kind] ?? assessment.kind} · ${
                assessment.question_count
              } ${t("сұрақ", "questions")} · ${assessment.max_score} ${t("балл", "points")}`}
              description={localizeAssessment(assessment, language).description}
              icon={<ListChecks className="size-5" aria-hidden />}
              demo={assessment.is_demo}
              badges={
                <>
                  <Badge tone="slate">{t("Талпыныс", "Attempts")}: {assessment.attempts_used}/{assessment.attempts_limit}</Badge>
                  {assessment.best_score !== null ? (
                    <Badge tone="green">{t("Үздік", "Best")}: {formatPercent(assessment.best_score)}</Badge>
                  ) : null}
                  {assessment.can_attempt ? (
                    <Badge tone="brand">{t("Қолжетімді", "Available")}</Badge>
                  ) : (
                    <Badge tone="amber">{t("Лимит аяқталды", "Limit reached")}</Badge>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}
      <div className="mt-8">
        <DemoNotice>
          {t("Нәтижелер нақты талпыныстар негізінде есептеледі. Пороговые деңгейлер мен формулалар демо-конфигурацияда берілген; ғылыми рубриканы тапсырыс беруші бекітеді.", "Results are based on recorded attempts. Thresholds and formulas are demonstration values; the final rubric requires approval.")}
        </DemoNotice>
      </div>
    </div>
  );
}

export function StudentAssessmentDetailPage() {
  const { language } = usePreferences();
  const t = useText();
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const assessment = useQuery({
    queryKey: ["student-assessment", id],
    queryFn: () => http.get<AssessmentDetail>(`/assessments/${id}`),
  });
  const assignments = useStudentAssignments();
  const assignment = findAssignment(assignments.data?.items, "assessment", id);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = useMutation({
    mutationFn: () =>
      http.post<Attempt>(`/assessments/${id}/attempts`, assignment ? { assignment_id: assignment.id } : {}),
    onSuccess: async (created) => {
      setError(null);
      const detail = await http.get<Attempt>(`/attempts/${created.id}`);
      setAttempt(detail);
      void queryClient.invalidateQueries({ queryKey: ["student-assessments"] });
      void queryClient.invalidateQueries({ queryKey: ["assignments", "student"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const submit = useMutation({
    mutationFn: async (answers: QuizAnswer[]) => {
      if (!attempt) throw new Error(t("Талпыныс табылмады.", "Attempt not found."));
      await http.patch<Attempt>(`/attempts/${attempt.id}/answers`, { answers });
      return http.post<Attempt>(`/attempts/${attempt.id}/submit`);
    },
    onSuccess: (submitted) => {
      setAttempt(submitted);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["student-assessments"] });
      void queryClient.invalidateQueries({ queryKey: ["student-results"] });
      void queryClient.invalidateQueries({ queryKey: ["assignments", "student"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  useTitle(assessment.data ? localizeAssessment(assessment.data, language).name : t("Диагностика", "Assessment"));

  if (assessment.isLoading) return <PageLoader />;
  if (assessment.isError)
    return (
      <Alert tone="error" title={t("Диагностика ашылмады", "Could not open assessment")}>
        {errorMessage(assessment.error)}
      </Alert>
    );
  const data = assessment.data ? localizeAssessment(assessment.data, language) : undefined;
  if (!data) return null;

  const initialValues: QuizInitialValues = {};
  for (const answer of attempt?.answers ?? []) {
    const selected = answer.answer_json.selected_option_ids ?? [];
    initialValues[answer.question_id] = {
      selected,
      text: answer.answer_json.text ?? "",
    };
  }

  const questionById = new Map(data.questions.map((question) => [question.id, question]));

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_20rem]">
      <div>
        <Link to="/student/assessments" className="inline-flex items-center gap-1 text-sm font-semibold no-underline">
          <ArrowLeft className="size-4" aria-hidden /> {t("Диагностика", "Assessments")}
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="brand">{assessmentKindLabels[data.kind] ?? data.kind}</Badge>
          <Badge tone="slate">{data.question_count} {t("сұрақ", "questions")}</Badge>
          <Badge tone="amber">{data.max_score} {t("балл", "points")}</Badge>
          <Badge tone="slate">
            {t("Талпыныс", "Attempts")}: {data.attempts_used}/{data.attempts_limit}
          </Badge>
          {data.is_demo ? <Badge tone="amber">{t("Демо", "Demo")}</Badge> : null}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-950">{data.name}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{data.description}</p>
        {data.instructions ? (
          <Card className="mt-4 bg-slate-50">
            <div className="text-sm leading-6 text-slate-700">
              <RichTextRenderer html={data.instructions} />
            </div>
          </Card>
        ) : null}

        {error ? (
          <div className="mt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}

        {attempt?.status === "submitted" ? (
          <div className="mt-6 space-y-4">
            <Card className="border-brand-200 bg-brand-50">
              <h2 className="text-lg font-bold text-brand-950">{t("Нәтиже", "Result")}</h2>
              <p className="mt-2 text-3xl font-extrabold text-brand-950">
                {formatPercent(attempt.percent)}
              </p>
              <p className="mt-1 text-sm text-brand-800">
                {attempt.total_score ?? 0} / {attempt.max_score ?? 0} {t("балл", "points")} · {t("Талпыныс", "Attempt")} №
                {attempt.attempt_no}
              </p>
            </Card>
            {attempt.competency_scores.length > 0 ? (
              <Card>
                <h2 className="text-lg font-bold text-ink-950">{t("Құзыреттіліктер бойынша", "By competency")}</h2>
                <div className="mt-3 space-y-3">
                  {attempt.competency_scores.map((score) => (
                    <div key={score.competency_id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700">{language === "en" ? score.title_en || score.title : score.title}</span>
                        <span className="text-slate-500">
                          {formatPercent(score.percent)} · {score.level ? levelLabels[score.level] ?? score.level : "—"}
                        </span>
                      </div>
                      <div className="mt-1">
                        <ProgressBar value={score.percent} />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
            <Card>
              <h2 className="text-lg font-bold text-ink-950">{t("Жауаптарды талдау", "Answer review")}</h2>
              {attempt.answers.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">{t("Жауаптар сақталмаған.", "No answers saved.")}</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {attempt.answers.map((answer, index) => {
                    const question = questionById.get(answer.question_id);
                    const selected = answer.answer_json.selected_option_ids ?? [];
                    const selectedLabels =
                      question?.options.filter((option) => selected.includes(option.id)).map((option) => option.label) ??
                      [];
                    return (
                      <li key={answer.question_id} className="rounded-xl border border-slate-200 p-3.5">
                        <p className="text-xs font-bold text-slate-500">
                          {t(`${index + 1}-сұрақ`, `Question ${index + 1}`)} · {answer.earned_points ?? 0} {t("балл", "points")}
                        </p>
                        <div className="mt-1 text-sm text-slate-700">
                          <RichTextRenderer html={question?.body ?? t("Сұрақ мәтіні сақталмаған.", "Question text is unavailable.")} />
                        </div>
                        <p className="mt-2 text-xs text-slate-600">
                          {t("Сіздің жауабыңыз", "Your answer")}: {" "}
                          <strong>
                            {answer.answer_json.text || selectedLabels.join(", ") || "—"}
                          </strong>
                        </p>
                        {answer.correct_labels?.length ? (
                          <p className="mt-1 text-xs text-emerald-700">
                            {t("Дұрыс жауап", "Correct answer")}: <strong>{(question?.options.filter((option) => answer.correct_option_ids?.includes(option.id)).map((option) => option.label).join(", ")) || answer.correct_labels.join(", ")}</strong>
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
            <div className="flex flex-wrap gap-2">
              <LinkButton to="/student/results">{t("Нәтижелерге өту", "View results")}</LinkButton>
              <LinkButton to="/student/assessments" variant="secondary">
                {t("Диагностика тізімі", "Assessment list")}
              </LinkButton>
            </div>
          </div>
        ) : attempt?.status === "in_progress" ? (
          <div className="mt-6">
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
              {t("Талпыныс ашылды. Барлық сұраққа жауап беріп, «Жауаптарды жіберу» түймесін басыңыз. Аяқтамай шығу үшін жауаптарды сақтау түймесін басыңыз.", "Answer every question and submit your answers. Save your answers before leaving to continue later.")}
            </div>
            <QuizForm
              questions={data.questions}
              initialValues={initialValues}
              onSave={(answers) => http.patch(`/attempts/${attempt.id}/answers`, { answers }).then(() => undefined)}
              onSubmit={(answers) => submit.mutateAsync(answers).then(() => undefined)}
              submitting={submit.isPending}
              submitLabel={t("Жауаптарды жіберу", "Submit answers")}
            />
          </div>
        ) : (
          <Card className="mt-6">
            <h2 className="text-lg font-bold text-ink-950">{t("Диагностиканы бастау", "Start assessment")}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {t("Барлық сұраққа жауап беру қажет. Талпыныс лимиті", "Answer all questions. Attempt limit")}: {data.attempts_limit}, {t("қолданылғаны", "used")}: {data.attempts_used}. {assignment ? `${t("Тағайындау", "Assigned class")}: ${assignment.classroom_title}.` : ""}
            </p>
            {data.best_score !== null ? (
              <p className="mt-2 text-sm font-semibold text-brand-800">
                {t("Үздік нәтиже", "Best result")}: {formatPercent(data.best_score)}
              </p>
            ) : null}
            {data.can_attempt ? (
              <div className="mt-4">
                {assignments.isError ? (
                  <Alert tone="error">{t("Тағайындауларды жүктеу мүмкін болмады. Бетті жаңартып, қайта көріңіз.", "Could not load assignments. Refresh the page and try again.")}</Alert>
                ) : null}
                <Button disabled={!assignments.isSuccess} loading={start.isPending} onClick={() => start.mutate()}>
                  {t("Талпынысты бастау", "Start attempt")}
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <Alert tone="warning">
                  {t("Талпыныс лимиті аяқталды. Нәтижені «Нәтижелер» бөлімінен қараңыз.", "The attempt limit has been reached. View your result in Results.")}
                </Alert>
              </div>
            )}
          </Card>
        )}
      </div>
      <aside className="space-y-4">
        <Card>
          <h2 className="text-sm font-bold text-ink-950">{t("Ережелер", "Rules")}</h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-500">
            <li>• {t("Жабық сұрақтар серверде автоматты тексеріледі.", "Closed questions are graded automatically by the server.")}</li>
            <li>• {t("Жауаптар тапсырылған соң өзгертілмейді.", "Answers cannot be changed after submission.")}</li>
            <li>• {t("Дұрыс жауаптар тек рұқсат етілген жағдайда көрсетіледі.", "Correct answers are shown only when permitted.")}</li>
            <li>• {t("Pre/post салыстыруы бір әдістеме кілті бойынша жүргізіледі.", "Pre/post comparisons use the same methodology key.")}</li>
          </ul>
        </Card>
        <Card>
          <h2 className="text-sm font-bold text-ink-950">{t("Статистика", "Statistics")}</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{t("Сұрақтар", "Questions")}</dt>
              <dd className="font-semibold">{data.question_count}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{t("Максимум", "Maximum")}</dt>
              <dd className="font-semibold">{data.max_score}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{t("Нұсқа", "Version")}</dt>
              <dd className="font-semibold">v{data.version}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">{t("Әдістеме кілті", "Methodology key")}</dt>
              <dd className="text-right font-mono text-xs">{data.methodology_key}</dd>
            </div>
          </dl>
        </Card>
        <DemoNotice />
      </aside>
    </div>
  );
}

export function StudentResultsPage() {
  const t = useText();
  const { language } = usePreferences();
  const label = useLabel();
  useTitle(t("Нәтижелер", "Results"));
  const results = useQuery({
    queryKey: ["student-results"],
    queryFn: () => http.get<StudentResults>("/me/results"),
  });

  return (
    <div>
      <PageHeader
        eyebrow={t("Нәтижелер", "Results")}
        title={t("Оқу және STEM динамикасы", "Learning and STEM progress")}
        description={t("Мұнда практикалық жұмыстардың бағалары, диагностика нәтижелері және pre/post өзгерісі көрсетіледі. Салыстыру тек толық жұп талпыныстар болғанда пайда болады.", "View practical work grades, assessment results, and pre/post changes. Comparisons appear when both attempts are complete.")}
      />
      {results.isLoading ? (
        <PageLoader />
      ) : results.isError ? (
        <Alert tone="error">{errorMessage(results.error)}</Alert>
      ) : !results.data ? null : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={t("Сабақтар", "Lessons")}
              value={`${results.data.progress.lessons_completed} / ${results.data.progress.lessons_total}`}
            />
            <StatCard label={t("Тапсырылды", "Submitted")} value={results.data.progress.tasks_submitted} tone="blue" />
            <StatCard label={t("Тексерілді", "Reviewed")} value={results.data.progress.tasks_reviewed} tone="amber" />
            <StatCard
              label={t("Орташа балл", "Average score")}
              value={formatPercent(results.data.progress.average_grade ?? null)}
            />
          </div>

          {results.data.message ? <Alert tone="info">{language === "en" ? (results.data.attempts.length ? "Complete both pre-test and post-test to see a comparison." : "No assessment completed yet. Start with the pre-test assigned by your teacher.") : results.data.message}</Alert> : null}

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink-950">{t("Pre/post салыстыруы", "Pre/post comparison")}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {t("Өзгеріс проценттік пунктпен (п.п.) көрсетіледі.", "Change is shown in percentage points (pp).")}
                </p>
              </div>
            </div>
            <div className="mt-4">
              {results.data.comparisons.length > 0 ? (
                <div className="space-y-8">
                  {results.data.comparisons.map((comparison) => (
                    <div key={comparison.methodology_key}>
                      <p className="mb-2 text-sm font-semibold text-slate-700">
                        {comparison.pre_assessment} → {comparison.post_assessment} ·{" "}
                        {formatDate(comparison.post_date)}
                      </p>
                      <DiagnosticsChart comparison={comparison} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={t("Диагностика әлі пройдена емес", "Assessment not completed yet")}
                  description={t("Pre-test және post-test екеуі де аяқталғанда ғана салыстыру пайда болады.", "A comparison appears when both pre-test and post-test are complete.")}
                  action={<LinkButton to="/student/assessments">{t("Диагностикаға өту", "Go to assessments")}</LinkButton>}
                />
              )}
            </div>
          </Card>

          {results.data.competency_summary.length > 0 ? (
            <Card>
              <h2 className="text-lg font-bold text-ink-950">{t("Құзыреттіліктер бойынша соңғы нәтиже", "Latest result by competency")}</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2">{t("Құзыреттілік", "Competency")}</th>
                      <th className="px-3 py-2 text-right">{t("Балл", "Score")}</th>
                      <th className="px-3 py-2 text-right">%</th>
                      <th className="px-3 py-2 text-right">{t("Деңгей", "Level")}</th>
                      <th className="px-3 py-2 text-right">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.data.competency_summary.map((score) => (
                      <tr key={score.competency_id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-700">{language === "en" ? score.title_en || score.title : score.title}</td>
                        <td className="px-3 py-2 text-right">
                          {score.earned} / {score.maximum}
                        </td>
                        <td className="px-3 py-2 text-right">{formatPercent(score.percent)}</td>
                        <td className="px-3 py-2 text-right">
                          {score.level ? label(levelLabels[score.level] ?? score.level) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-brand-700">
                          {formatDelta(score.delta_pp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          <Card>
            <h2 className="text-lg font-bold text-ink-950">{t("Диагностика тарихы", "Assessment history")}</h2>
            {results.data.attempts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">{t("Әзірге тапсырылған диагностика жоқ.", "No assessments submitted yet.")}</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2">{t("Диагностика", "Assessment")}</th>
                      <th className="px-3 py-2">{t("Түрі", "Type")}</th>
                      <th className="px-3 py-2 text-right">{t("Талпыныс", "Attempts")}</th>
                      <th className="px-3 py-2 text-right">{t("Үздік", "Best")}</th>
                      <th className="px-3 py-2 text-right">{t("Мәртебе", "Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.data.attempts.map((assessment) => (
                      <tr key={assessment.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <Link to={`/student/assessments/${assessment.id}`} className="font-semibold no-underline">
                            {localizeAssessment(assessment, language).name}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{assessmentKindLabels[assessment.kind] ?? assessment.kind}</td>
                        <td className="px-3 py-2 text-right">
                          {assessment.attempts_used}/{assessment.attempts_limit}
                        </td>
                        <td className="px-3 py-2 text-right">{formatPercent(assessment.best_score)}</td>
                        <td className="px-3 py-2 text-right">
                          {label(statusLabels[assessment.last_status ?? ""] ?? assessment.last_status ?? "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <DemoNotice>{results.data.demo_notice && language === "kk" ? results.data.demo_notice : undefined}</DemoNotice>
        </div>
      )}
    </div>
  );
}

export function StudentClassPage() {
  const { language } = usePreferences();
  const t = useText();
  const label = useLabel();
  useTitle(t("Менің сыныбым", "My class"));
  const queryClient = useQueryClient();
  const { refreshMe } = useAuth();
  const classes = useQuery({
    queryKey: ["student-classes"],
    queryFn: () => http.get<Page<Classroom>>("/classes?page_size=50"),
  });
  const assignments = useStudentAssignments();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const join = useMutation({
    mutationFn: () => http.post<JoinClassResponse>("/classes/join", { code: code.trim() }),
    onSuccess: (result) => {
      setMessage(
        result.already_member
          ? t(`Сіз «${result.classroom.title}» сыныбына бұрын қосылғансыз.`, `You are already a member of ${result.classroom.title}.`)
          : t(`«${result.classroom.title}» сыныбына қосылдыңыз.`, `You joined ${result.classroom.title}.`),
      );
      setError(null);
      setCode("");
      void queryClient.invalidateQueries({ queryKey: ["student-classes"] });
      void queryClient.invalidateQueries({ queryKey: ["assignments", "student"] });
      void refreshMe();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  return (
    <div>
      <PageHeader
        eyebrow={t("Сынып", "Class")}
        title={t("Менің сыныбым", "My class")}
        description={t("Мұғалім берген код арқылы сыныпқа қосылыңыз. Бір сыныпқа қайта қосылу дубль жасамайды.", "Join a class using the code from your teacher. Joining again does not create a duplicate.")}
      />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card>
          <h2 className="text-lg font-bold text-ink-950">{t("Сыныпқа қосылу", "Join a class")}</h2>
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!code.trim()) {
                setError(t("Кодты енгізіңіз.", "Enter a code."));
                return;
              }
              join.mutate();
            }}
          >
            <Field label={t("Сынып коды", "Class code")} htmlFor="join-code" required hint={t("Мысалы: DEMO10", "For example: DEMO10")}>
              <TextInput
                id="join-code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                maxLength={12}
                className="font-mono tracking-widest"
                placeholder="DEMO10"
              />
            </Field>
            {message ? <Alert tone="success">{message}</Alert> : null}
            {error ? <Alert tone="error">{error}</Alert> : null}
            <Button type="submit" className="w-full" loading={join.isPending}>
              <Users className="size-4" aria-hidden />
              {t("Қосылу", "Join")}
            </Button>
          </form>
        </Card>
        <div className="space-y-4">
          {classes.isLoading ? (
            <PageLoader />
          ) : classes.isError ? (
            <Alert tone="error">{errorMessage(classes.error)}</Alert>
          ) : (classes.data?.items.length ?? 0) === 0 ? (
            <EmptyState title={t("Сіз әлі сыныпқа қосылмағансыз", "You have not joined a class yet")} description={t("Мұғалімнен сынып кодын сұраңыз.", "Ask your teacher for the class code.")} />
          ) : (
            classes.data?.items.map((classroom) => {
              const classAssignments = (assignments.data?.items ?? []).filter(
                (assignment) => assignment.classroom_id === classroom.id,
              );
              return (
                <Card key={classroom.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-ink-950">{classroom.title}</h2>
                      <p className="text-xs text-slate-500">
                        {t("Мұғалім", "Teacher")}: {classroom.teacher_name ?? "—"} · {classroom.member_count} {t("оқушы", "students")}
                      </p>
                    </div>
                    <Badge tone={classroom.status === "active" ? "green" : "slate"}>
                      {label(statusLabels[classroom.status] ?? classroom.status)}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-700">{t("Тағайындалған жұмыстар", "Assigned work")}</h3>
                  {classAssignments.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">{t("Әзірге тағайындау жоқ.", "No assignments yet.")}</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-slate-100">
                      {classAssignments.map((assignment) => (
                        <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <Link
                            to={contentPath("student", assignment.content_type, assignment.content_id)}
                            className="text-sm font-semibold no-underline"
                          >
                            {language === "en" ? assignment.content_title_en || assignment.content_title : assignment.content_title}
                          </Link>
                          <span className="flex items-center gap-2 text-xs text-slate-500">
                            {assignment.due_at ? <span>{t("Дедлайн", "Deadline")}: {formatDate(assignment.due_at)}</span> : null}
                            <AssignmentStatusBadge status={assignment.student_status} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
      <div className="mt-6">
        <DemoNotice />
      </div>
    </div>
  );
}
