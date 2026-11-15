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
  Search,
  Target,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { errorMessage, http } from "@/shared/api";
import { useAuth } from "@/shared/auth";
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

function assignmentStatusBadge(status: string | null) {
  if (status === "not_started") return <Badge tone="slate">Басталмаған</Badge>;
  if (status === "in_progress") return <Badge tone="blue">Орындалуда</Badge>;
  if (status === "submitted") return <Badge tone="amber">Тапсырылды</Badge>;
  if (status === "reviewed") return <Badge tone="green">Тексерілді</Badge>;
  if (status === "returned") return <Badge tone="rose">Қайта өңдеуге</Badge>;
  return <Badge tone="slate">—</Badge>;
}

function useStudentAssignments() {
  return useQuery({
    queryKey: ["assignments", "student"],
    queryFn: () => http.get<Page<Assignment>>("/assignments?page_size=100"),
  });
}

export function StudentDashboardPage() {
  useTitle("Менің оқуым");
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
        eyebrow="Оқушы кабинеті"
        title={`Сәлеметсіз бе, ${user?.display_name ?? "оқушы"}!`}
        description="Оқу прогресіңіз, келесі қадамдарыңыз және STEM диагностика динамикасы бір жерде."
        actions={
          <>
            <LinkButton to="/student/lessons" variant="secondary">
              <BookOpen className="size-4" aria-hidden />
              Сабақтар
            </LinkButton>
            <LinkButton to="/student/assessments">
              <ListChecks className="size-4" aria-hidden />
              Диагностика
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
              label="Аяқталған сабақтар"
              value={`${results.data?.progress.lessons_completed ?? 0} / ${
                results.data?.progress.lessons_total ?? 0
              }`}
            />
            <StatCard
              label="Тапсырылған жұмыстар"
              value={results.data?.progress.tasks_submitted ?? 0}
              tone="blue"
            />
            <StatCard
              label="Тексерілген жұмыстар"
              value={results.data?.progress.tasks_reviewed ?? 0}
              tone="amber"
            />
            <StatCard
              label="Орташа балл"
              value={formatPercent(results.data?.progress.average_grade ?? null)}
            />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink-950">Келесі қадамдар</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Тағайындалған жұмыстар мен аяқталмаған әрекеттер.
                  </p>
                </div>
                <Link to="/student/class" className="text-xs font-semibold no-underline">
                  Барлығы
                </Link>
              </div>
              {pending.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="Күтіп тұрған жұмыс жоқ"
                    description="Жаңа тағайындаулар пайда болғанда осы жерде көрінеді."
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
                            {assignment.content_title}
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
                        {assignmentStatusBadge(assignment.student_status)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink-950">STEM динамикасы</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Pre/post салыстыруы бар болса ғана көрсетіледі.
                  </p>
                </div>
                <Link to="/student/results" className="text-xs font-semibold no-underline">
                  Толығырақ
                </Link>
              </div>
              <div className="mt-4">
                {comparison ? (
                  <DiagnosticsChart comparison={comparison} height={240} />
                ) : (
                  <EmptyState
                    title="Диагностика әлі жеткіліксіз"
                    description="Pre-test және post-test аяқталғаннан кейін құзыреттіліктер бойынша өзгеріс осында шығады."
                    action={<LinkButton to="/student/assessments">Диагностикаға өту</LinkButton>}
                  />
                )}
              </div>
            </Card>
          </div>

          {results.data?.competency_summary.length ? (
            <Card className="mt-6">
              <h2 className="text-lg font-bold text-ink-950">Құзыреттіліктер профилі</h2>
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
  useTitle("Сабақтар");
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const lessons = useQuery({
    queryKey: ["student-lessons", query, page],
    queryFn: () =>
      http.get<Page<LessonCard>>(
        `/lessons?page=${page}&page_size=12${query ? `&q=${encodeURIComponent(query)}` : ""}`,
      ),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Оқу материалы"
        title="Сабақтар"
        description="Алты сабақ ML негіздерінен STEM жобасына дейінгі тізбекті құрайды. Әр сабақта теория, ресурстар, практика және рефлексия бар."
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400" aria-hidden />
          <TextInput
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Сабақ іздеу..."
            className="pl-9"
            aria-label="Сабақ іздеу"
          />
        </div>
        <p className="text-sm text-slate-500">
          Барлығы: <strong>{lessons.data?.total ?? "—"}</strong>
        </p>
      </div>
      {lessons.isLoading ? (
        <PageLoader />
      ) : lessons.isError ? (
        <Alert tone="error">{errorMessage(lessons.error)}</Alert>
      ) : (lessons.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="Сабақтар табылмады" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lessons.data?.items.map((lesson) => (
              <ContentCard
                key={lesson.id}
                to={`/student/lessons/${lesson.id}`}
                title={lesson.title}
                meta={`${lesson.order_no}-сабақ · ${lesson.duration_min} мин`}
                description={lesson.summary}
                icon={<BookOpen className="size-5" aria-hidden />}
                demo={lesson.is_demo}
                badges={
                  <>
                    {lesson.completed ? <Badge tone="green">Изучено</Badge> : null}
                    {lesson.algorithm ? <Badge tone="brand">{lesson.algorithm.title}</Badge> : null}
                    {lesson.competencies.slice(0, 2).map((competency) => (
                      <Badge key={competency.id} tone="slate">
                        {competency.title}
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
  useTitle(lesson.data?.title ?? "Сабақ");

  if (lesson.isLoading) return <PageLoader />;
  if (lesson.isError)
    return (
      <div className="max-w-3xl">
        <Alert tone="error" title="Сабақ ашылмады">
          {errorMessage(lesson.error)}
        </Alert>
      </div>
    );
  const data = lesson.data;
  if (!data) return null;

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_20rem]">
      <article>
        <Link to="/student/lessons" className="inline-flex items-center gap-1 text-sm font-semibold no-underline">
          <ArrowLeft className="size-4" aria-hidden /> Сабақтар
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="brand">{data.order_no}-сабақ</Badge>
          <Badge tone="slate">{data.duration_min} минут</Badge>
          {data.completed ? <Badge tone="green">Изучено</Badge> : null}
          {data.is_demo ? <Badge tone="amber">Демо</Badge> : null}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-950">{data.title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{data.summary}</p>
        {data.goal ? (
          <Card className="mt-5 bg-brand-50">
            <p className="text-xs font-bold tracking-wide text-brand-800 uppercase">Мақсат</p>
            <p className="mt-1 text-sm leading-6 text-brand-950">{data.goal}</p>
          </Card>
        ) : null}
        <div className="mt-6">
          <RichTextRenderer html={data.body} />
        </div>
        {data.reflection ? (
          <Card className="mt-8 border-amber-200 bg-amber-50">
            <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">Рефлексия</p>
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
            <h2 className="text-xl font-bold text-ink-950">Байланысты тапсырмалар</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.tasks.map((task) => (
                <Link
                  key={task.id}
                  to={`/student/tasks/${task.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 no-underline hover:border-brand-300"
                >
                  <span>
                    <span className="block text-sm font-semibold text-ink-950">{task.title}</span>
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
          <h2 className="text-sm font-bold text-ink-950">Оқу мәртебесі</h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            «Изучено» тек сіз өзіңіз белгілегенде тіркеледі. Бетті жай ашу автоматты түрде
            прогресс болып саналмайды.
          </p>
          <div className="mt-4">
            {data.completed ? (
              <Alert tone="success">Сабақ аяқталды деп белгіленген.</Alert>
            ) : (
              <Button
                className="w-full"
                loading={complete.isPending}
                onClick={() => complete.mutate()}
              >
                <CheckCircle2 className="size-4" aria-hidden />
                Сабақты изучено деп белгілеу
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
          <h2 className="text-sm font-bold text-ink-950">STEM құзыреттіліктері</h2>
          <ul className="mt-3 space-y-1.5">
            {data.competencies.map((competency) => (
              <li key={competency.id}>
                <Link
                  to={`/stem/${competency.slug}`}
                  className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 no-underline"
                >
                  <Target className="size-3.5" aria-hidden />
                  {competency.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        {data.algorithm ? (
          <Card>
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">ML алгоритмі</p>
            <Link to={`/ml/${data.algorithm.slug}`} className="mt-1 block text-sm font-semibold no-underline">
              {data.algorithm.title}
            </Link>
          </Card>
        ) : null}
        <DemoNotice />
      </aside>
    </div>
  );
}

export function StudentTasksPage() {
  useTitle("Тапсырмалар");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sort, setSort] = useState("order");
  const query = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const tasks = useQuery({
    queryKey: ["student-tasks", query, type, difficulty, sort, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "12", sort });
      if (query) params.set("q", query);
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
        eyebrow="Практика"
        title="Тапсырмалар"
        description="Жабық тесттер серверде автоматты тексеріледі; ашық жұмыстарды мұғалім рубрика бойынша бағалайды. Тапсырманы орындау үшін ол сыныбыңызға тағайындалуы керек."
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400" aria-hidden />
          <TextInput
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Іздеу..."
            className="pl-9"
            aria-label="Тапсырма іздеу"
          />
        </div>
        <Select
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
          aria-label="Тапсырма түрі"
        >
          <option value="">Барлық түрлер</option>
          {Object.entries(taskTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={difficulty}
          onChange={(event) => {
            setDifficulty(event.target.value);
            setPage(1);
          }}
          aria-label="Қиындық"
        >
          <option value="">Барлық деңгейлер</option>
          {Object.entries(difficultyLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Сұрыптау">
          <option value="order">Реті бойынша</option>
          <option value="difficulty">Қиындығы бойынша</option>
          <option value="title">Атауы бойынша</option>
        </Select>
      </div>
      {tasks.isLoading ? (
        <PageLoader />
      ) : tasks.isError ? (
        <Alert tone="error">{errorMessage(tasks.error)}</Alert>
      ) : (tasks.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="Тапсырмалар табылмады" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tasks.data?.items.map((task) => (
              <ContentCard
                key={task.id}
                to={`/student/tasks/${task.id}`}
                title={task.title}
                meta={`${taskTypeLabels[task.type] ?? task.type} · ${
                  difficultyLabels[task.difficulty] ?? task.difficulty
                }`}
                icon={<ClipboardList className="size-5" aria-hidden />}
                demo={task.is_demo}
                badges={
                  <>
                    <Badge tone="slate">{task.max_score} балл</Badge>
                    {assignedIds.has(task.id) ? <Badge tone="green">Тағайындалған</Badge> : null}
                    {task.competencies.slice(0, 2).map((competency) => (
                      <Badge key={competency.id} tone="brand">
                        {competency.title}
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

  useTitle(task.data?.title ?? "Тапсырма");

  if (task.isLoading) return <PageLoader />;
  if (task.isError)
    return (
      <Alert tone="error" title="Тапсырма ашылмады">
        {errorMessage(task.error)}
      </Alert>
    );
  const data = task.data;
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
          <ArrowLeft className="size-4" aria-hidden /> Тапсырмалар
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="brand">{taskTypeLabels[data.type] ?? data.type}</Badge>
          <Badge tone="slate">{difficultyLabels[data.difficulty] ?? data.difficulty}</Badge>
          <Badge tone="amber">{data.max_score} балл</Badge>
          {data.is_demo ? <Badge tone="amber">Демо</Badge> : null}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-950">{data.title}</h1>
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
            <Alert tone="warning" title="Тапсырма әлі тағайындалмаған">
              Бұл тапсырманы орындау үшін мұғалім оны сыныбыңызға тағайындауы керек. Осы уақытта
              теория мен талаптармен таныса аласыз.
            </Alert>
          </div>
        ) : (
          <Card className="mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-ink-950">Тапсырманы орындау</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {assignment.classroom_title} · дедлайн: {formatDateTime(assignment.due_at)}
                </p>
              </div>
              {assignmentStatusBadge(shown?.status ?? assignment.student_status)}
            </div>

            {isClosed ? (
              <div className="mt-5">
                {shown ? (
                  <div className="space-y-4">
                    <Alert
                      tone={shown.status === "reviewed" ? "success" : "info"}
                      title="Жауап сақталған"
                    >
                      <p>
                        Баға: <strong>{shown.grade ?? "—"}</strong> / {shown.max_score ?? data.max_score} ·
                        Талпыныс: {shown.attempts_count} / {data.attempts_limit}
                      </p>
                      {shown.correct_labels?.length ? (
                        <p className="mt-1">
                          Дұрыс жауап: <strong>{shown.correct_labels.join(", ")}</strong>
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
                        Жаңа талпыныс ({attemptsLeft} қалды)
                      </Button>
                    ) : (
                      <p className="text-sm text-slate-500">Талпыныс лимиті аяқталды.</p>
                    )}
                  </div>
                ) : null}
                {(!shown || closedSubmission === null) && attemptsLeft > 0 ? (
                  <form
                    className="mt-4 space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (selected.length === 0) {
                        setClosedError("Кемінде бір жауап нұсқасын таңдаңыз.");
                        return;
                      }
                      submitClosed.mutate();
                    }}
                  >
                    <fieldset className="space-y-2">
                      <legend className="mb-2 text-sm font-semibold text-slate-800">
                        {data.type === "multiple_choice"
                          ? "Бірнеше дұрыс жауапты таңдаңыз"
                          : "Бір дұрыс жауапты таңдаңыз"}
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
                      Жауапты жіберу
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
          <h2 className="text-sm font-bold text-ink-950">Бағалау</h2>
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
                  <Badge tone="brand">{competency.title}</Badge>
                </Link>
              </li>
            ))}
          </ul>
          {data.lesson ? (
            <p className="mt-3 text-xs text-slate-500">
              Сабақ:{" "}
              <Link to={`/student/lessons/${data.lesson.id}`} className="font-semibold no-underline">
                {data.lesson.title}
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
  useTitle("STEM жобалары");
  const projects = useQuery({
    queryKey: ["student-projects"],
    queryFn: () => http.get<Page<ProjectCard>>("/projects?page_size=20"),
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
        eyebrow="Практика"
        title="STEM жобалары"
        description="Жобаны таңдап, мәселені зерттеңіз, ML құралын қолданыңыз және нәтижені мұғалімге жіберіңіз. Жоба тағайындалған болса, жіберу формасы ашылады."
      />
      {projects.isLoading ? (
        <PageLoader />
      ) : projects.isError ? (
        <Alert tone="error">{errorMessage(projects.error)}</Alert>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.data?.items.map((project) => (
            <ContentCard
              key={project.id}
              to={`/student/projects/${project.id}`}
              title={project.title}
              description={project.summary}
              icon={<FolderKanban className="size-5" aria-hidden />}
              demo={project.is_demo}
              badges={
                <>
                  {assignedIds.has(project.id) ? <Badge tone="green">Тағайындалған</Badge> : null}
                  {project.algorithm ? <Badge tone="brand">{project.algorithm.title}</Badge> : null}
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StudentProjectDetailPage() {
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
  useTitle(project.data?.title ?? "STEM жобасы");

  if (project.isLoading) return <PageLoader />;
  if (project.isError)
    return (
      <Alert tone="error" title="Жоба ашылмады">
        {errorMessage(project.error)}
      </Alert>
    );
  const data = project.data;
  if (!data) return null;

  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_21rem]">
      <article>
        <Link to="/student/projects" className="inline-flex items-center gap-1 text-sm font-semibold no-underline">
          <ArrowLeft className="size-4" aria-hidden /> Жобалар
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="brand">STEM жобасы</Badge>
          {data.algorithm ? <Badge tone="slate">{data.algorithm.title}</Badge> : null}
          {data.is_demo ? <Badge tone="amber">Демо</Badge> : null}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-950">{data.title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{data.summary}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <Card className="bg-rose-50">
            <p className="text-xs font-bold tracking-wide text-rose-800 uppercase">Мәселе</p>
            <div className="mt-2 text-sm leading-6 text-rose-950">
              <RichTextRenderer html={data.problem} />
            </div>
          </Card>
          <Card className="bg-brand-50">
            <p className="text-xs font-bold tracking-wide text-brand-800 uppercase">Мақсат</p>
            <div className="mt-2 text-sm leading-6 text-brand-950">
              <RichTextRenderer html={data.goal} />
            </div>
          </Card>
          <Card className="bg-amber-50">
            <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">
              Күтілетін нәтиже
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
          <h2 className="text-xl font-bold text-ink-950">Орындау қадамдары</h2>
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
            <h2 className="text-base font-bold text-ink-950">Материалдар</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {(data.materials_json ?? []).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-base font-bold text-ink-950">Құралдар</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {(data.tools_json ?? []).map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-base font-bold text-ink-950">Критерийлер</h2>
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
          <h2 className="text-lg font-bold text-ink-950">Нәтижені жіберу</h2>
          {!assignment ? (
            <div className="mt-3">
              <Alert tone="warning" title="Жоба тағайындалмаған">
                Нәтижені жіберу үшін мұғалім жобаны сыныбыңызға тағайындауы керек.
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
          <h2 className="text-sm font-bold text-ink-950">Жоба мәртебесі</h2>
          <div className="mt-2">{assignmentStatusBadge(assignment?.student_status ?? null)}</div>
          <p className="mt-2 text-xs text-slate-500">
            Дедлайн: {formatDateTime(assignment?.due_at)}
          </p>
          {assignment?.notes ? (
            <p className="mt-2 text-xs leading-5 text-slate-600">{assignment.notes}</p>
          ) : null}
        </Card>
        <Card>
          <h2 className="text-sm font-bold text-ink-950">Дамитын құзыреттіліктер</h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {data.competencies.map((competency) => (
              <li key={competency.id}>
                <Link to={`/stem/${competency.slug}`} className="no-underline">
                  <Badge tone="brand">{competency.title}</Badge>
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
  useTitle("Практика");
  const tools = [
    {
      title: "Google Colab",
      url: "https://colab.research.google.com/",
      description:
        "Python ортасында деректерді тазалау, модельді оқыту және нәтижені визуализациялау. Notebook-ты жүктеп, мұғалімге сілтеме арқылы жіберуге болады.",
    },
    {
      title: "Teachable Machine",
      url: "https://teachablemachine.withgoogle.com/",
      description:
        "Веб-камера немесе суреттер арқылы классификация моделін құру. Дайын модель сілтемесін жоба нәтижесі ретінде ұсыныңыз.",
    },
    {
      title: "Kaggle Datasets",
      url: "https://www.kaggle.com/datasets",
      description:
        "Ашық деректер жиынтықтары. Тек мұғаліммен келісілген, жеке деректерді қамтитын емес жиынтықтарды қолданыңыз.",
    },
  ];
  return (
    <div>
      <PageHeader
        eyebrow="Практика"
        title="Сыртқы ML құралдары"
        description="Платформа сыртқы құралдардың орнын баспайды, оларға әдістемелік бағыт береді. Барлық жұмысты тек HTTPS сілтеме немесе тексерілген файл арқылы жіберіңіз."
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
              Құралды ашу <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </Card>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-ink-950">Жұмысты жіберу ережесі</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>Тапсырманы оқып, мұғалім тағайындаған форматты анықтаңыз.</li>
            <li>Colab/Teachable Machine сілтемесін немесе файлды дайындаңыз.</li>
            <li>Нәтижені тапсырма бетіндегі форма арқылы жіберіңіз.</li>
            <li>Мұғалім пікірін және бағаны «Нәтижелер» бөлімінен қараңыз.</li>
          </ol>
        </Card>
        <Card>
          <h2 className="text-lg font-bold text-ink-950">Қауіпсіздік</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>Жеке деректерді (телефон, мекенжай, сурет) ұсынбаңыз.</li>
            <li>Тек HTTPS сілтемелерді пайдаланыңыз.</li>
            <li>Орындалған жұмысты басқа оқушының атынан жібермеңіз.</li>
            <li>Файл көлемі 25 МБ-тан аспауы керек.</li>
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
  useTitle("Диагностика");
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
        eyebrow="Диагностика"
        title="Pre-test және post-test"
        description="Диагностика STEM құзыреттіліктерінің бастапқы және соңғы деңгейін өлшейді. Салыстыру тек бір әдістеме кілті және сәйкес нұсқа бойынша жүргізіледі; бұл әдістеменің себептік әсерін дәлелдемейді."
      />
      <div className="mb-5 max-w-xs">
        <Select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Диагностика түрі">
          <option value="">Барлық диагностика</option>
          <option value="pre">Pre-test</option>
          <option value="post">Post-test</option>
          <option value="quiz">Тест</option>
        </Select>
      </div>
      {assessments.isLoading ? (
        <PageLoader />
      ) : assessments.isError ? (
        <Alert tone="error">{errorMessage(assessments.error)}</Alert>
      ) : (assessments.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="Диагностика тағайындалмаған" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {assessments.data?.items.map((assessment) => (
            <ContentCard
              key={assessment.id}
              to={`/student/assessments/${assessment.id}`}
              title={assessment.name}
              meta={`${assessmentKindLabels[assessment.kind] ?? assessment.kind} · ${
                assessment.question_count
              } сұрақ · ${assessment.max_score} балл`}
              description={assessment.description}
              icon={<ListChecks className="size-5" aria-hidden />}
              demo={assessment.is_demo}
              badges={
                <>
                  <Badge tone="slate">Талпыныс: {assessment.attempts_used}/{assessment.attempts_limit}</Badge>
                  {assessment.best_score !== null ? (
                    <Badge tone="green">Үздік: {formatPercent(assessment.best_score)}</Badge>
                  ) : null}
                  {assessment.can_attempt ? (
                    <Badge tone="brand">Қолжетімді</Badge>
                  ) : (
                    <Badge tone="amber">Лимит аяқталды</Badge>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}
      <div className="mt-8">
        <DemoNotice>
          Нәтижелер нақты талпыныстар негізінде есептеледі. Пороговые деңгейлер мен формулалар
          демо-конфигурацияда берілген; ғылыми рубриканы тапсырыс беруші бекітеді.
        </DemoNotice>
      </div>
    </div>
  );
}

export function StudentAssessmentDetailPage() {
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
      if (!attempt) throw new Error("Талпыныс табылмады.");
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

  useTitle(assessment.data?.name ?? "Диагностика");

  if (assessment.isLoading) return <PageLoader />;
  if (assessment.isError)
    return (
      <Alert tone="error" title="Диагностика ашылмады">
        {errorMessage(assessment.error)}
      </Alert>
    );
  const data = assessment.data;
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
          <ArrowLeft className="size-4" aria-hidden /> Диагностика
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="brand">{assessmentKindLabels[data.kind] ?? data.kind}</Badge>
          <Badge tone="slate">{data.question_count} сұрақ</Badge>
          <Badge tone="amber">{data.max_score} балл</Badge>
          <Badge tone="slate">
            Талпыныс: {data.attempts_used}/{data.attempts_limit}
          </Badge>
          {data.is_demo ? <Badge tone="amber">Демо</Badge> : null}
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
              <h2 className="text-lg font-bold text-brand-950">Нәтиже</h2>
              <p className="mt-2 text-3xl font-extrabold text-brand-950">
                {formatPercent(attempt.percent)}
              </p>
              <p className="mt-1 text-sm text-brand-800">
                {attempt.total_score ?? 0} / {attempt.max_score ?? 0} балл · Талпыныс №
                {attempt.attempt_no}
              </p>
            </Card>
            {attempt.competency_scores.length > 0 ? (
              <Card>
                <h2 className="text-lg font-bold text-ink-950">Құзыреттіліктер бойынша</h2>
                <div className="mt-3 space-y-3">
                  {attempt.competency_scores.map((score) => (
                    <div key={score.competency_id}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-700">{score.title}</span>
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
              <h2 className="text-lg font-bold text-ink-950">Жауаптарды талдау</h2>
              {attempt.answers.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Жауаптар сақталмаған.</p>
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
                          {index + 1}-сұрақ · {answer.earned_points ?? 0} балл
                        </p>
                        <div className="mt-1 text-sm text-slate-700">
                          <RichTextRenderer html={question?.body ?? "Сұрақ мәтіні сақталмаған."} />
                        </div>
                        <p className="mt-2 text-xs text-slate-600">
                          Сіздің жауабыңыз:{" "}
                          <strong>
                            {answer.answer_json.text || selectedLabels.join(", ") || "—"}
                          </strong>
                        </p>
                        {answer.correct_labels?.length ? (
                          <p className="mt-1 text-xs text-emerald-700">
                            Дұрыс жауап: <strong>{answer.correct_labels.join(", ")}</strong>
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
            <div className="flex flex-wrap gap-2">
              <LinkButton to="/student/results">Нәтижелерге өту</LinkButton>
              <LinkButton to="/student/assessments" variant="secondary">
                Диагностика тізімі
              </LinkButton>
            </div>
          </div>
        ) : attempt?.status === "in_progress" ? (
          <div className="mt-6">
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">
              Талпыныс ашылды. Барлық сұраққа жауап беріп, «Жауаптарды жіберу» түймесін басыңыз.
              Жауаптар жіберілгенге дейін серверде сақталады.
            </div>
            <QuizForm
              questions={data.questions}
              initialValues={initialValues}
              onSubmit={(answers) => submit.mutateAsync(answers).then(() => undefined)}
              submitting={submit.isPending}
              submitLabel="Жауаптарды жіберу"
            />
          </div>
        ) : (
          <Card className="mt-6">
            <h2 className="text-lg font-bold text-ink-950">Диагностиканы бастау</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Барлық сұраққа жауап беру қажет. Талпыныс лимиті: {data.attempts_limit}, қолданылғаны:{" "}
              {data.attempts_used}. {assignment ? `Тағайындау: ${assignment.classroom_title}.` : ""}
            </p>
            {data.best_score !== null ? (
              <p className="mt-2 text-sm font-semibold text-brand-800">
                Үздік нәтиже: {formatPercent(data.best_score)}
              </p>
            ) : null}
            {data.can_attempt ? (
              <div className="mt-4">
                <Button loading={start.isPending} onClick={() => start.mutate()}>
                  Талпынысты бастау
                </Button>
              </div>
            ) : (
              <div className="mt-4">
                <Alert tone="warning">
                  Талпыныс лимиті аяқталды. Нәтижені «Нәтижелер» бөлімінен қараңыз.
                </Alert>
              </div>
            )}
          </Card>
        )}
      </div>
      <aside className="space-y-4">
        <Card>
          <h2 className="text-sm font-bold text-ink-950">Ережелер</h2>
          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-slate-500">
            <li>• Жабық сұрақтар серверде автоматты тексеріледі.</li>
            <li>• Жауаптар тапсырылған соң өзгертілмейді.</li>
            <li>• Дұрыс жауаптар тек рұқсат етілген жағдайда көрсетіледі.</li>
            <li>• Pre/post салыстыруы бір әдістеме кілті бойынша жүргізіледі.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="text-sm font-bold text-ink-950">Статистика</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Сұрақтар</dt>
              <dd className="font-semibold">{data.question_count}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Максимум</dt>
              <dd className="font-semibold">{data.max_score}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Нұсқа</dt>
              <dd className="font-semibold">v{data.version}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Әдістеме кілті</dt>
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
  useTitle("Нәтижелер");
  const results = useQuery({
    queryKey: ["student-results"],
    queryFn: () => http.get<StudentResults>("/me/results"),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Нәтижелер"
        title="Оқу және STEM динамикасы"
        description="Мұнда практикалық жұмыстардың бағалары, диагностика нәтижелері және pre/post өзгерісі көрсетіледі. Салыстыру тек толық жұп талпыныстар болғанда пайда болады."
      />
      {results.isLoading ? (
        <PageLoader />
      ) : results.isError ? (
        <Alert tone="error">{errorMessage(results.error)}</Alert>
      ) : !results.data ? null : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Сабақтар"
              value={`${results.data.progress.lessons_completed} / ${results.data.progress.lessons_total}`}
            />
            <StatCard label="Тапсырылды" value={results.data.progress.tasks_submitted} tone="blue" />
            <StatCard label="Тексерілді" value={results.data.progress.tasks_reviewed} tone="amber" />
            <StatCard
              label="Орташа балл"
              value={formatPercent(results.data.progress.average_grade ?? null)}
            />
          </div>

          {results.data.message ? <Alert tone="info">{results.data.message}</Alert> : null}

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-ink-950">Pre/post салыстыруы</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Өзгеріс проценттік пунктпен (п.п.) көрсетіледі.
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
                  title="Диагностика әлі пройдена емес"
                  description="Pre-test және post-test екеуі де аяқталғанда ғана салыстыру пайда болады."
                  action={<LinkButton to="/student/assessments">Диагностикаға өту</LinkButton>}
                />
              )}
            </div>
          </Card>

          {results.data.competency_summary.length > 0 ? (
            <Card>
              <h2 className="text-lg font-bold text-ink-950">Құзыреттіліктер бойынша соңғы нәтиже</h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2">Құзыреттілік</th>
                      <th className="px-3 py-2 text-right">Балл</th>
                      <th className="px-3 py-2 text-right">%</th>
                      <th className="px-3 py-2 text-right">Деңгей</th>
                      <th className="px-3 py-2 text-right">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.data.competency_summary.map((score) => (
                      <tr key={score.competency_id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-700">{score.title}</td>
                        <td className="px-3 py-2 text-right">
                          {score.earned} / {score.maximum}
                        </td>
                        <td className="px-3 py-2 text-right">{formatPercent(score.percent)}</td>
                        <td className="px-3 py-2 text-right">
                          {score.level ? levelLabels[score.level] ?? score.level : "—"}
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
            <h2 className="text-lg font-bold text-ink-950">Диагностика тарихы</h2>
            {results.data.attempts.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Әзірге тапсырылған диагностика жоқ.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2">Диагностика</th>
                      <th className="px-3 py-2">Түрі</th>
                      <th className="px-3 py-2 text-right">Талпыныс</th>
                      <th className="px-3 py-2 text-right">Үздік</th>
                      <th className="px-3 py-2 text-right">Мәртебе</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.data.attempts.map((assessment) => (
                      <tr key={assessment.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">
                          <Link to={`/student/assessments/${assessment.id}`} className="font-semibold no-underline">
                            {assessment.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{assessmentKindLabels[assessment.kind] ?? assessment.kind}</td>
                        <td className="px-3 py-2 text-right">
                          {assessment.attempts_used}/{assessment.attempts_limit}
                        </td>
                        <td className="px-3 py-2 text-right">{formatPercent(assessment.best_score)}</td>
                        <td className="px-3 py-2 text-right">
                          {statusLabels[assessment.last_status ?? ""] ?? assessment.last_status ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <DemoNotice>{results.data.demo_notice ?? undefined}</DemoNotice>
        </div>
      )}
    </div>
  );
}

export function StudentClassPage() {
  useTitle("Менің сыныбым");
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
          ? `Сіз «${result.classroom.title}» сыныбына бұрын қосылғансыз.`
          : `«${result.classroom.title}» сыныбына қосылдыңыз.`,
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
        eyebrow="Сынып"
        title="Менің сыныбым"
        description="Мұғалім берген код арқылы сыныпқа қосылыңыз. Бір сыныпқа қайта қосылу дубль жасамайды."
      />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card>
          <h2 className="text-lg font-bold text-ink-950">Сыныпқа қосылу</h2>
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!code.trim()) {
                setError("Кодты енгізіңіз.");
                return;
              }
              join.mutate();
            }}
          >
            <Field label="Сынып коды" htmlFor="join-code" required hint="Мысалы: DEMO10">
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
              Қосылу
            </Button>
          </form>
        </Card>
        <div className="space-y-4">
          {classes.isLoading ? (
            <PageLoader />
          ) : classes.isError ? (
            <Alert tone="error">{errorMessage(classes.error)}</Alert>
          ) : (classes.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="Сіз әлі сыныпқа қосылмағансыз" description="Мұғалімнен сынып кодын сұраңыз." />
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
                        Мұғалім: {classroom.teacher_name ?? "—"} · {classroom.member_count} оқушы
                      </p>
                    </div>
                    <Badge tone={classroom.status === "active" ? "green" : "slate"}>
                      {statusLabels[classroom.status] ?? classroom.status}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-sm font-bold text-slate-700">Тағайындалған жұмыстар</h3>
                  {classAssignments.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">Әзірге тағайындау жоқ.</p>
                  ) : (
                    <ul className="mt-2 divide-y divide-slate-100">
                      {classAssignments.map((assignment) => (
                        <li key={assignment.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <Link
                            to={contentPath("student", assignment.content_type, assignment.content_id)}
                            className="text-sm font-semibold no-underline"
                          >
                            {assignment.content_title}
                          </Link>
                          <span className="flex items-center gap-2 text-xs text-slate-500">
                            {assignment.due_at ? <span>Дедлайн: {formatDate(assignment.due_at)}</span> : null}
                            {assignmentStatusBadge(assignment.student_status)}
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
