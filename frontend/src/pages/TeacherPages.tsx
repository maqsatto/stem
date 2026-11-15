import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FolderKanban,
  GraduationCap,
  Layers,
  ListChecks,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { errorMessage, http } from "@/shared/api";
import { CatalogFilters, LessonFilter } from "@/shared/components/CatalogFilters";
import { AssignToClass, ResourceList } from "@/shared/components/ContentBits";
import { ContentCard } from "@/shared/components/ContentCard";
import { RichTextRenderer } from "@/shared/components/RichTextRenderer";
import {
  difficultyLabels,
  formatDate,
  levelLabels,
  taskTypeLabels,
} from "@/shared/format";
import { useDebouncedValue, useTitle } from "@/shared/hooks";
import type {
  Assignment,
  Classroom,
  LessonCard,
  LessonDetail,
  MatrixRow,
  Page,
  ProjectCard,
  ProjectDetail,
  TaskCard,
  TaskDetail,
  TeacherDashboard,
} from "@/shared/types";
import {
  Alert,
  Badge,
  Card,
  DemoNotice,
  EmptyState,
  LinkButton,
  PageHeader,
  PageLoader,
  Pagination,
  Select,
  StatCard,
} from "@/shared/ui";

interface TeacherCompetency {
  id: string;
  slug: string;
  title: string;
  description: string;
  indicators_json: string[];
  criteria_json: Record<string, string>;
}

export function TeacherDashboardPage() {
  useTitle("Мұғалім кабинеті");
  const dashboard = useQuery({
    queryKey: ["teacher-dashboard"],
    queryFn: () => http.get<TeacherDashboard>("/teacher/dashboard"),
  });
  const classes = useQuery({
    queryKey: ["classes", "teacher"],
    queryFn: () => http.get<Page<Classroom>>("/classes?page_size=100"),
  });
  const assignments = useQuery({
    queryKey: ["assignments", "teacher", "recent"],
    queryFn: () => http.get<Page<Assignment>>("/assignments?page_size=5"),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Мұғалім кабинеті"
        title="Сыныптар мен жұмыстар шолуы"
        description="Күнделікті жұмыстың қысқаша көрінісі: сыныптар, тағайындаулар және тексеруді күтіп тұрған жұмыстар."
        actions={
          <>
            <LinkButton to="/teacher/assignments" variant="secondary">
              <CalendarClock className="size-4" aria-hidden />
              Тағайындау
            </LinkButton>
            <LinkButton to="/teacher/reviews">
              <CheckCircle2 className="size-4" aria-hidden />
              Тексерулер
            </LinkButton>
          </>
        }
      />
      {dashboard.isLoading ? (
        <PageLoader />
      ) : dashboard.isError ? (
        <Alert tone="error">{errorMessage(dashboard.error)}</Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Сыныптар" value={dashboard.data?.classrooms ?? 0} />
            <StatCard label="Оқушылар" value={dashboard.data?.students ?? 0} tone="blue" />
            <StatCard label="Тағайындаулар" value={dashboard.data?.assignments ?? 0} tone="amber" />
            <StatCard
              label="Тексеруді күтіп тұр"
              value={dashboard.data?.pending_reviews ?? 0}
              tone="rose"
              hint="Ашық/практикалық жұмыстар"
            />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-ink-950">Менің сыныптарым</h2>
                  <p className="mt-1 text-sm text-slate-500">Кіру кодын оқушыларға беріңіз.</p>
                </div>
                <Link to="/teacher/classes" className="text-xs font-semibold no-underline">
                  Басқару
                </Link>
              </div>
              {(classes.data?.items.length ?? 0) === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    title="Сынып әлі жасалмаған"
                    description="Алғашқы сыныпты жасап, оқушыларға қосылу кодын беріңіз."
                    action={<LinkButton to="/teacher/classes">Сынып жасау</LinkButton>}
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {classes.data?.items.map((classroom) => (
                    <li key={classroom.id}>
                      <Link
                        to={`/teacher/classes/${classroom.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3 no-underline hover:border-brand-300 hover:bg-brand-50/40"
                      >
                        <span>
                          <span className="block text-sm font-semibold text-ink-950">
                            {classroom.title}
                          </span>
                          <span className="text-xs text-slate-500">
                            {classroom.member_count} оқушы · код:{" "}
                            <span className="font-mono font-bold text-brand-700">
                              {classroom.join_code ?? "—"}
                            </span>
                          </span>
                        </span>
                        <ArrowRight className="size-4 text-brand-700" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <h2 className="text-lg font-bold text-ink-950">Соңғы тағайындаулар</h2>
              {assignments.isLoading ? (
                <PageLoader />
              ) : (assignments.data?.items.length ?? 0) === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Әзірге тағайындау жоқ.</p>
              ) : (
                <ul className="mt-4 space-y-2">
                  {assignments.data?.items.map((assignment) => (
                    <li
                      key={assignment.id}
                      className="rounded-xl border border-slate-200 px-3.5 py-3"
                    >
                      <p className="text-sm font-semibold text-ink-950">{assignment.content_title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {assignment.classroom_title} · дедлайн: {formatDate(assignment.due_at)} ·{" "}
                        {assignment.submitted_count}/{assignment.total_students} сдано
                      </p>
                      <div className="mt-2 flex gap-2">
                        <Link
                          to={`/teacher/reviews/${assignment.id}`}
                          className="text-xs font-semibold no-underline"
                        >
                          Тексеруге өту
                        </Link>
                        <Link
                          to="/teacher/assignments"
                          className="text-xs font-semibold no-underline"
                        >
                          Басқару
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <div className="mt-6">
            <DemoNotice>
              Демо-сыныптар мен аккаунттар MVP қабылдау сынағына арналған. Нақты оқушы
              деректерін тек келісілген сақтау саясаты бойынша енгізіңіз.
            </DemoNotice>
          </div>
        </>
      )}
    </div>
  );
}

export function TeacherMethodologyPage() {
  useTitle("Әдістеме");
  const matrix = useQuery({
    queryKey: ["matrix"],
    queryFn: () => http.get<MatrixRow[]>("/matrix"),
  });
  const competencies = useQuery({
    queryKey: ["teacher-competencies"],
    queryFn: () => http.get<TeacherCompetency[]>("/teacher/competencies"),
  });
  return (
    <div>
      <PageHeader
        eyebrow="Әдістеме"
        title="ML ↔ STEM байланыс матрицасы"
        description="Әр ML алгоритмі нақты STEM құзыреттіліктерімен байланысады. Матрица сабақ, тапсырма және жоба байланыстарынан автоматты құрылады — бұл мазмұндық байланыс, бағалау нәтижесі емес."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-brand-50">
          <p className="text-xs font-bold tracking-wide text-brand-800 uppercase">1. Мазмұн</p>
          <p className="mt-2 text-sm leading-6 text-brand-950">
            Алгоритм → сабақ → тапсырма → жоба. Әр элемент бір немесе бірнеше STEM
            құзыреттілігіне байланысады.
          </p>
        </Card>
        <Card className="bg-blue-50">
          <p className="text-xs font-bold tracking-wide text-blue-800 uppercase">2. Өлшеу</p>
          <p className="mt-2 text-sm leading-6 text-blue-950">
            Pre/post диагностика құзыреттіліктер бойынша балл мен деңгейді береді. Өзгеріс
            проценттік пунктпен көрсетіледі.
          </p>
        </Card>
        <Card className="bg-amber-50">
          <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">3. Түсіндіру</p>
          <p className="mt-2 text-sm leading-6 text-amber-950">
            Нәтиже — өлшенген динамика. Ол әдістеменің себептік әсерін дәлелдемейді; толық
            зерттеу дизайны бөлек талап етіледі.
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-lg font-bold text-ink-950">ML алгоритмдерінің STEM-байланысы</h2>
        {matrix.isLoading ? (
          <PageLoader />
        ) : matrix.isError ? (
          <Alert tone="error">{errorMessage(matrix.error)}</Alert>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-3 py-2">ML алгоритмі</th>
                  <th className="px-3 py-2">STEM құзыреттіліктері</th>
                  <th className="px-3 py-2 text-right">Сабақ</th>
                  <th className="px-3 py-2 text-right">Тапсырма</th>
                  <th className="px-3 py-2 text-right">Жоба</th>
                </tr>
              </thead>
              <tbody>
                {matrix.data?.map((row) => (
                  <tr key={row.algorithm_id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-3 font-semibold text-ink-950">
                      <Link to={`/ml/${row.algorithm_slug}`} className="no-underline">
                        {row.algorithm_title}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {row.competencies.map((competency) => (
                          <Badge key={competency.id} tone="brand">
                            {competency.title}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right">{row.lesson_count}</td>
                    <td className="px-3 py-3 text-right">{row.task_count}</td>
                    <td className="px-3 py-3 text-right">{row.project_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6">
        <h2 className="text-xl font-bold text-ink-950">STEM құзыреттіліктерінің сипаттамасы</h2>
        {competencies.isLoading ? (
          <PageLoader />
        ) : competencies.isError ? (
          <Alert tone="error">{errorMessage(competencies.error)}</Alert>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {competencies.data?.map((competency) => (
              <Card key={competency.id}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-bold text-ink-950">{competency.title}</h3>
                  <Link to={`/stem/${competency.slug}`} className="text-xs font-semibold no-underline">
                    Публикация
                  </Link>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{competency.description}</p>
                <p className="mt-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  Индикаторлар
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  {(competency.indicators_json ?? []).map((indicator, index) => (
                    <li key={`${indicator}-${index}`}>{indicator}</li>
                  ))}
                </ul>
                {Object.keys(competency.criteria_json ?? {}).length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {Object.entries(competency.criteria_json).map(([level, text]) => (
                      <div key={level} className="rounded-lg bg-slate-50 p-2.5">
                        <p className="text-[10px] font-bold tracking-wide text-brand-700 uppercase">
                          {levelLabels[level] ?? level}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{text}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </div>
      <div className="mt-6">
        <DemoNotice>
          Матрица байланыстары CMS-тегі мазмұнға тәуелді. Құзыреттілік критерийлерінің
          ғылыми мазмұнын тапсырыс беруші бекітеді.
        </DemoNotice>
      </div>
    </div>
  );
}

export function TeacherCurriculumPage() {
  useTitle("Оқу бағдарламасы");
  const lessons = useQuery({
    queryKey: ["teacher-lessons", "curriculum"],
    queryFn: () => http.get<Page<LessonCard>>("/lessons?page_size=100"),
  });
  const matrix = useQuery({
    queryKey: ["matrix"],
    queryFn: () => http.get<MatrixRow[]>("/matrix"),
  });
  const grouped = new Map<string, LessonCard[]>();
  for (const lesson of lessons.data?.items ?? []) {
    const key = lesson.algorithm?.title ?? "Жалпы модуль";
    grouped.set(key, [...(grouped.get(key) ?? []), lesson]);
  }
  return (
    <div>
      <PageHeader
        eyebrow="Оқу бағдарламасы"
        title="Сабақтар картасы"
        description="Алты сабақ ML негіздерінен STEM жобасына дейін реттелген. Әр сабақта мақсат, теория, практика, ресурстар және рефлексия бар."
        actions={<LinkButton to="/teacher/methodology" variant="secondary">Әдістемелік матрица</LinkButton>}
      />
      {lessons.isLoading ? (
        <PageLoader />
      ) : lessons.isError ? (
        <Alert tone="error">{errorMessage(lessons.error)}</Alert>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([group, items]) => (
            <Card key={group}>
              <h2 className="text-lg font-bold text-ink-950">{group}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {items
                  .sort((a, b) => a.order_no - b.order_no)
                  .map((lesson) => (
                    <Link
                      key={lesson.id}
                      to={`/teacher/lessons/${lesson.id}`}
                      className="flex gap-3 rounded-xl border border-slate-200 p-3.5 no-underline transition hover:border-brand-300 hover:bg-brand-50/30"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-800">
                        {lesson.order_no}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-ink-950">
                          {lesson.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                          {lesson.summary}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {lesson.competencies.map((competency) => (
                            <Badge key={competency.id} tone="slate">
                              {competency.title}
                            </Badge>
                          ))}
                        </span>
                      </span>
                    </Link>
                  ))}
              </div>
            </Card>
          ))}
          {matrix.data?.length ? (
            <Card className="bg-slate-50">
              <h2 className="text-lg font-bold text-ink-950">Бағдарламаның ML ↔ STEM қамтуы</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {matrix.data.map((row) => (
                  <div key={row.algorithm_id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-ink-950">{row.algorithm_title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.lesson_count} сабақ · {row.task_count} тапсырма · {row.project_count} жоба
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function TeacherLessonsPage() {
  useTitle("Сабақтар");
  const [search, setSearch] = useState("");
  const [algorithmId, setAlgorithmId] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const query = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const lessons = useQuery({
    queryKey: ["teacher-lessons", query, algorithmId, competencyId, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "12" });
      if (query) params.set("q", query);
      if (algorithmId) params.set("algorithm_id", algorithmId);
      if (competencyId) params.set("competency_id", competencyId);
      return http.get<Page<LessonCard>>(`/lessons?${params.toString()}`);
    },
  });
  return (
    <div>
      <PageHeader
        eyebrow="Кітапхана"
        title="Сабақ жоспарлары мен материалдар"
        description="Мұғалімге арналған файлдар, презентациялар және бағалау материалдары сабақ бетінде көрсетіледі. Оқушылар бұл файлдарды көрмейді."
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
        searchLabel="Сабақ іздеу"
      />
      {lessons.isLoading ? (
        <PageLoader />
      ) : lessons.isError ? (
        <Alert tone="error">{errorMessage(lessons.error)}</Alert>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {lessons.data?.items.map((lesson) => (
              <ContentCard
                key={lesson.id}
                to={`/teacher/lessons/${lesson.id}`}
                title={lesson.title}
                meta={`${lesson.order_no}-сабақ · ${lesson.duration_min} мин`}
                description={lesson.summary}
                icon={<BookOpen className="size-5" aria-hidden />}
                demo={lesson.is_demo}
                badges={lesson.competencies.map((competency) => (
                  <Badge key={competency.id} tone="brand">
                    {competency.title}
                  </Badge>
                ))}
              />
            ))}
          </div>
          <Pagination page={page} total={lessons.data?.total ?? 0} pageSize={12} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export function TeacherLessonDetailPage() {
  const { id = "" } = useParams();
  const lesson = useQuery({
    queryKey: ["teacher-lesson", id],
    queryFn: () => http.get<LessonDetail>(`/lessons/${id}`),
  });
  useTitle(lesson.data?.title ?? "Сабақ");
  if (lesson.isLoading) return <PageLoader />;
  if (lesson.isError)
    return (
      <Alert tone="error" title="Сабақ ашылмады">
        {errorMessage(lesson.error)}
      </Alert>
    );
  const data = lesson.data;
  if (!data) return null;
  const teacherResources = data.resources.filter((resource) => resource.audience === "teacher");
  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_21rem]">
      <article>
        <Link to="/teacher/lessons" className="inline-flex items-center gap-1 text-sm font-semibold no-underline">
          <ArrowLeft className="size-4" aria-hidden /> Сабақтар
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="brand">{data.order_no}-сабақ</Badge>
          <Badge tone="slate">{data.duration_min} минут</Badge>
          {data.is_demo ? <Badge tone="amber">Демо</Badge> : null}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-950">{data.title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{data.summary}</p>
        <Card className="mt-5 bg-brand-50">
          <p className="text-xs font-bold tracking-wide text-brand-800 uppercase">Сабақ мақсаты</p>
          <p className="mt-1 text-sm leading-6 text-brand-950">{data.goal}</p>
        </Card>
        <div className="mt-6">
          <RichTextRenderer html={data.body} />
        </div>
        {data.reflection ? (
          <Card className="mt-8 border-amber-200 bg-amber-50">
            <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">
              Рефлексия сұрағы
            </p>
            <p className="mt-1 text-sm leading-6 text-amber-950">{data.reflection}</p>
          </Card>
        ) : null}
        {teacherResources.length > 0 ? (
          <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <ResourceList resources={teacherResources} title="Мұғалімге арналған материалдар" />
          </section>
        ) : null}
        {data.resources.some((resource) => resource.audience !== "teacher") ? (
          <section className="mt-8">
            <ResourceList
              resources={data.resources.filter((resource) => resource.audience !== "teacher")}
              title="Оқушыға арналған материалдар"
            />
          </section>
        ) : null}
        {data.tasks.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-xl font-bold text-ink-950">Байланысты тапсырмалар</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.tasks.map((task) => (
                <Link
                  key={task.id}
                  to={`/teacher/tasks/${task.id}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 no-underline hover:border-brand-300"
                >
                  <span>
                    <span className="block text-sm font-semibold text-ink-950">{task.title}</span>
                    <span className="text-xs text-slate-500">
                      {taskTypeLabels[task.type] ?? task.type}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-brand-700" aria-hidden />
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </article>
      <aside className="space-y-4">
        <Card>
          <h2 className="text-sm font-bold text-ink-950">Сыныпқа тағайындау</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Сабақ тағайындалғанда оқушы оны «Менің оқуым» және сынып бетінде көреді.
          </p>
          <div className="mt-3">
            <AssignToClass contentType="lesson" contentId={data.id} label="Сабақты тағайындау" />
          </div>
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

export function TeacherTasksPage() {
  useTitle("Тапсырмалар кітапханасы");
  const [search, setSearch] = useState("");
  const [algorithmId, setAlgorithmId] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [type, setType] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [sort, setSort] = useState("order");
  const [page, setPage] = useState(1);
  const query = useDebouncedValue(search.trim(), 300);
  const tasks = useQuery({
    queryKey: ["teacher-tasks", query, algorithmId, competencyId, lessonId, type, difficulty, sort, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "12", sort });
      if (query) params.set("q", query);
      if (algorithmId) params.set("algorithm_id", algorithmId);
      if (competencyId) params.set("competency_id", competencyId);
      if (lessonId) params.set("lesson_id", lessonId);
      if (type) params.set("type", type);
      if (difficulty) params.set("difficulty", difficulty);
      return http.get<Page<TaskCard>>(`/tasks?${params.toString()}`);
    },
  });
  return (
    <div>
      <PageHeader
        eyebrow="Кітапхана"
        title="Тапсырмалар"
        description="Жабық тесттердің дұрыс жауаптары мен ашық жұмыстардың рубрикалары осында қолжетімді. Тапсырманы сыныпқа тағайындау үшін оны ашыңыз."
      />
      <CatalogFilters
        search={search}
        onSearch={(value) => { setSearch(value); setPage(1); }}
        algorithmId={algorithmId}
        onAlgorithmId={(value) => { setAlgorithmId(value); setPage(1); }}
        competencyId={competencyId}
        onCompetencyId={(value) => { setCompetencyId(value); setPage(1); }}
        searchLabel="Тапсырма іздеу"
      >
        <LessonFilter value={lessonId} onChange={(value) => { setLessonId(value); setPage(1); }} />
        <Select value={type} onChange={(event) => { setType(event.target.value); setPage(1); }} aria-label="Түрі">
          <option value="">Барлық түрлер</option>
          {Object.entries(taskTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={difficulty}
          onChange={(event) => { setDifficulty(event.target.value); setPage(1); }}
          aria-label="Қиындығы"
        >
          <option value="">Барлық деңгейлер</option>
          {Object.entries(difficultyLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label="Сұрыптау">
          <option value="order">Реті бойынша</option>
          <option value="difficulty">Қиындығы бойынша</option>
          <option value="date">Жаңа материалдар алдымен</option>
          <option value="title">Атауы бойынша</option>
        </Select>
      </CatalogFilters>
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
              to={`/teacher/tasks/${task.id}`}
              title={task.title}
              meta={`${taskTypeLabels[task.type] ?? task.type} · ${
                difficultyLabels[task.difficulty] ?? task.difficulty
              }`}
              icon={<ClipboardList className="size-5" aria-hidden />}
              demo={task.is_demo}
              badges={
                <>
                  <Badge tone="slate">{task.max_score} балл</Badge>
                  {task.answer_key_available ? <Badge tone="green">Жауап кілті</Badge> : null}
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

export function TeacherTaskDetailPage() {
  const { id = "" } = useParams();
  const task = useQuery({
    queryKey: ["teacher-task", id],
    queryFn: () => http.get<TaskDetail>(`/tasks/${id}`),
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
  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_21rem]">
      <article>
        <Link to="/teacher/tasks" className="inline-flex items-center gap-1 text-sm font-semibold no-underline">
          <ArrowLeft className="size-4" aria-hidden /> Тапсырмалар
        </Link>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="brand">{taskTypeLabels[data.type] ?? data.type}</Badge>
          <Badge tone="slate">{difficultyLabels[data.difficulty] ?? data.difficulty}</Badge>
          <Badge tone="amber">{data.max_score} балл</Badge>
          {data.answer_key_available ? <Badge tone="green">Жауап кілті қолжетімді</Badge> : null}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-ink-950">{data.title}</h1>
        <div className="mt-4">
          <RichTextRenderer html={data.instructions} />
        </div>
        {data.body ? (
          <div className="mt-4">
            <RichTextRenderer html={data.body} />
          </div>
        ) : null}

        {data.options.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-xl font-bold text-ink-950">Жауап нұсқалары</h2>
            <p className="mt-1 text-xs text-slate-500">
              Жасыл белгі — дұрыс жауап. Бұл ақпарат оқушыға көрсетілмейді.
            </p>
            <ul className="mt-3 space-y-2">
              {data.options.map((option) => (
                <li
                  key={option.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-sm ${
                    option.is_correct
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  <span>{option.label}</span>
                  {option.is_correct ? <Badge tone="green">Дұрыс</Badge> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {data.rubric_json.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-xl font-bold text-ink-950">Бағалау рубрикасы</h2>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2">Критерий</th>
                    <th className="px-3 py-2 text-right">Балл</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rubric_json.map((item, index) => (
                    <tr key={`${item.criterion}-${index}`} className="border-t border-slate-100">
                      <td className="px-3 py-2 text-slate-700">{item.criterion}</td>
                      <td className="px-3 py-2 text-right font-semibold">{item.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        {data.resources.length > 0 ? (
          <section className="mt-6">
            <ResourceList resources={data.resources} />
          </section>
        ) : null}
      </article>
      <aside className="space-y-4">
        <Card>
          <h2 className="text-sm font-bold text-ink-950">Сыныпқа тағайындау</h2>
          <div className="mt-3">
            <AssignToClass contentType="task" contentId={data.id} label="Тапсырманы тағайындау" />
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-bold text-ink-950">Параметрлер</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Талпыныс лимиті</dt>
              <dd className="font-semibold">{data.attempts_limit}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Дұрыс жауапты көрсету</dt>
              <dd className="font-semibold">{data.show_correct_answers ? "Иә" : "Жоқ"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-500">Максимум балл</dt>
              <dd className="font-semibold">{data.max_score}</dd>
            </div>
          </dl>
        </Card>
        <Card>
          <h2 className="text-sm font-bold text-ink-950">STEM құзыреттіліктері</h2>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {data.competencies.map((competency) => (
              <li key={competency.id}>
                <Badge tone="brand">{competency.title}</Badge>
              </li>
            ))}
          </ul>
        </Card>
        <DemoNotice />
      </aside>
    </div>
  );
}

export function TeacherProjectsPage() {
  useTitle("STEM жобалары");
  const [search, setSearch] = useState("");
  const [algorithmId, setAlgorithmId] = useState("");
  const [competencyId, setCompetencyId] = useState("");
  const [page, setPage] = useState(1);
  const query = useDebouncedValue(search.trim(), 300);
  const projects = useQuery({
    queryKey: ["teacher-projects", query, algorithmId, competencyId, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "12" });
      if (query) params.set("q", query);
      if (algorithmId) params.set("algorithm_id", algorithmId);
      if (competencyId) params.set("competency_id", competencyId);
      return http.get<Page<ProjectCard>>(`/projects?${params.toString()}`);
    },
  });
  return (
    <div>
      <PageHeader
        eyebrow="Кітапхана"
        title="STEM жобалары"
        description="Жобалардың толық сипаттамасы, рубрикалары және оқушыларға арналған нұсқаулықтары. Жобаны сыныпқа тағайындап, нәтижені рубрика бойынша бағалаңыз."
      />
      <CatalogFilters
        search={search}
        onSearch={(value) => { setSearch(value); setPage(1); }}
        algorithmId={algorithmId}
        onAlgorithmId={(value) => { setAlgorithmId(value); setPage(1); }}
        competencyId={competencyId}
        onCompetencyId={(value) => { setCompetencyId(value); setPage(1); }}
        searchLabel="Жоба іздеу"
      />
      {projects.isLoading ? (
        <PageLoader />
      ) : projects.isError ? (
        <Alert tone="error">{errorMessage(projects.error)}</Alert>
      ) : (projects.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="Жобалар табылмады" />
      ) : (
        <>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.data?.items.map((project) => (
            <ContentCard
              key={project.id}
              to={`/teacher/projects/${project.id}`}
              title={project.title}
              description={project.summary}
              icon={<FolderKanban className="size-5" aria-hidden />}
              demo={project.is_demo}
              badges={project.competencies.slice(0, 3).map((competency) => (
                <Badge key={competency.id} tone="brand">
                  {competency.title}
                </Badge>
              ))}
            />
          ))}
        </div>
        <Pagination page={page} total={projects.data?.total ?? 0} pageSize={12} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export function TeacherProjectDetailPage() {
  const { id = "" } = useParams();
  const project = useQuery({
    queryKey: ["teacher-project", id],
    queryFn: () => http.get<ProjectDetail>(`/projects/${id}`),
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
        <Link to="/teacher/projects" className="inline-flex items-center gap-1 text-sm font-semibold no-underline">
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
          <h2 className="text-xl font-bold text-ink-950">Қадамдар</h2>
          <ol className="mt-3 space-y-2">
            {(data.steps_json ?? []).map((step, index) => (
              <li key={`${step}-${index}`} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-700">
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
            <h2 className="text-base font-bold text-ink-950">Бағалау критерийлері</h2>
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
      </article>
      <aside className="space-y-4">
        <Card>
          <h2 className="text-sm font-bold text-ink-950">Сыныпқа тағайындау</h2>
          <div className="mt-3">
            <AssignToClass contentType="project" contentId={data.id} label="Жобаны тағайындау" />
          </div>
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

export function TeacherToolsPage() {
  useTitle("Мұғалім құралдары");
  const tools = [
    {
      title: "Google Colab",
      url: "https://colab.research.google.com/",
      description:
        "Оқушылар Python кодты браузерде орындай алады. Notebook үлгісін дайындап, сыныпқа көшірме жасау жолын түсіндіріңіз.",
    },
    {
      title: "Teachable Machine",
      url: "https://teachablemachine.withgoogle.com/",
      description:
        "Классификация моделін визуалды түрде құру. Жоба нәтижесі ретінде модель сілтемесін қабылдауға болады.",
    },
    {
      title: "Kaggle",
      url: "https://www.kaggle.com/",
      description:
        "Ашық деректер жиынтықтары мен notebook мысалдары. Тек қауіпсіз, жеке деректерсіз жиынтықтарды таңдаңыз.",
    },
  ];
  return (
    <div>
      <PageHeader
        eyebrow="Құралдар"
        title="Мұғалімге арналған практикалық нұсқаулық"
        description="Сыртқы ML құралдарын сабақта қалай қолдану керектігі, оқушы жұмысын қабылдау форматтары және қауіпсіздік ережелері."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {tools.map((tool) => (
          <Card key={tool.title} className="flex flex-col">
            <Wrench className="size-6 text-brand-700" aria-hidden />
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
          <h2 className="text-lg font-bold text-ink-950">Сынып жұмысын ұйымдастыру</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>Сынып жасап, кіру кодын оқушыларға беріңіз.</li>
            <li>Сабақты немесе тапсырманы дедлайнмен тағайындаңыз.</li>
            <li>Оқушы жұмысын «Тексерулер» бөлімінде ашып, рубрика бойынша бағалаңыз.</li>
            <li>Қайта өңдеуге қайтарғанда түсініктеме міндетті.</li>
            <li>Нәтижелерді CSV форматында жүктеп алыңыз (UTF-8 BOM, Excel үшін).</li>
          </ol>
        </Card>
        <Card>
          <h2 className="text-lg font-bold text-ink-950">Файлдар мен жауап кілттері</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>Мұғалімге арналған файлдар оқушыға көрсетілмейді.</li>
            <li>Жабық тесттің жауап кілті тек мұғалім/әкімшіге қолжетімді.</li>
            <li>Оқушы файлы 25 МБ-тан аспауы керек және MIME тексеріледі.</li>
            <li>Сыртқы сілтемелер тек HTTPS болуы шарт.</li>
          </ul>
        </Card>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <LinkButton to="/teacher/methodology" variant="secondary">
          <Layers className="size-4" aria-hidden />
          Әдістемелік матрица
        </LinkButton>
        <LinkButton to="/teacher/diagnostics" variant="secondary">
          <ListChecks className="size-4" aria-hidden />
          Диагностика
        </LinkButton>
        <LinkButton to="/teacher/results" variant="secondary">
          <GraduationCap className="size-4" aria-hidden />
          Нәтижелер мен CSV
        </LinkButton>
      </div>
      <div className="mt-6">
        <DemoNotice>
          Сыртқы сервистерді пайдалану шарттары мен деректерді өңдеу саясатын мектеп/тапсырыс
          беруші бекітуі керек.
        </DemoNotice>
      </div>
    </div>
  );
}
