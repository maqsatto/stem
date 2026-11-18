import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BrainCircuit,
  Compass,
  Database,
  FlaskConical,
  FolderKanban,
  GraduationCap,
  Layers,
  Lightbulb,
  Search,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { errorMessage, http } from "@/shared/api";
import { roleHome, useAuth } from "@/shared/auth";
import { ContentCard } from "@/shared/components/ContentCard";
import { ResourceList } from "@/shared/components/ContentBits";
import { RichTextRenderer } from "@/shared/components/RichTextRenderer";
import { difficultyLabels, formatDate, levelLabels, taskTypeLabels } from "@/shared/format";
import { useDebouncedValue, useTitle } from "@/shared/hooks";
import { usePreferences, useText } from "@/shared/preferences";
import { localizeAlgorithm, localizeCompetency, localizeProject, localizeRefTitle } from "@/shared/localizeContent";
import type {
  AlgorithmCard,
  AlgorithmDetail,
  CompetencyCard,
  CompetencyDetail,
  Page,
  ProjectCard,
  ProjectDetail,
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
  TextInput,
} from "@/shared/ui";

const iconList = [BrainCircuit, Database, FlaskConical, Layers, Lightbulb];

function publicContentLink(
  role: string | undefined,
  type: "lesson" | "task" | "project",
  id: string,
): string {
  if (type === "project") return `/projects/${id}`;
  if (role === "student") return `/student/${type}s/${id}`;
  if (role === "teacher") return `/teacher/${type}s/${id}`;
  if (role === "admin") return `/admin/${type}s?edit=${id}`;
  return "/login";
}

export function HomePage() {
  const t = useText();
  const { language } = usePreferences();
  useTitle(t("Басты бет", "Home"));
  const { user } = useAuth();
  const algorithms = useQuery({
    queryKey: ["public", "algorithms", "home"],
    queryFn: () => http.get<Page<AlgorithmCard>>("/algorithms?page_size=3"),
  });
  const competencies = useQuery({
    queryKey: ["public", "competencies", "home"],
    queryFn: () => http.get<Page<CompetencyCard>>("/competencies?page_size=5"),
  });
  const projects = useQuery({
    queryKey: ["public", "projects", "home"],
    queryFn: () => http.get<Page<ProjectCard>>("/projects?page_size=4"),
  });

  return (
    <div>
      <section className="relative overflow-hidden bg-[#f5f6fa] text-ink-950">
        <div
          className="pointer-events-none absolute -top-32 -right-24 size-[36rem] rounded-full bg-brand-100/50 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 size-[30rem] rounded-full bg-white/50 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-md bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
              <Sparkles className="size-3.5" aria-hidden />
              {t("Машиналық оқыту · STEM · Жобалар", "Machine learning · STEM · Projects")}
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              ML + STEM LAB
              <span className="mt-3 block text-2xl font-semibold text-brand-600 sm:text-3xl">
                {t("STEM-құзыреттіліктерді ML алгоритмдері арқылы дамыту", "Build STEM skills with machine learning")}
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600">
              {t("Біртұтас оқу платформасы: алгоритмді үйрену → зерттеу жүргізу → STEM жобасын қорғау → диагностика арқылы өзгерісті өлшеу. Мұғалім сыныпты басқарады, оқушы өз қарқынымен оқиды, әкімші мазмұнды өз бетінше жариялайды.", "Learn algorithms, explore ideas, build STEM projects and track your progress. Teachers manage classes while students learn at their own pace.")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/ml" size="lg">
                {t("ML каталогын ашу", "Explore ML")}
                <ArrowRight className="size-4" aria-hidden />
              </LinkButton>
              <LinkButton
                to={user ? roleHome(user.role) : "/login"}
                size="lg"
                variant="secondary"
                className="border-slate-300 bg-white text-slate-800 hover:border-brand-400 hover:bg-brand-50"
              >
                {user ? t("Менің кабинетім", "My dashboard") : t("Кіру", "Log in")}
              </LinkButton>
            </div>
            <div className="mt-8 max-w-xl">
              <DemoNotice>
                {t("Демо-контент: 3 ML алгоритмі, 5 STEM құзыреттілігі, 6 демо-сабақ, 18 тапсырма, 4 жоба және pre/post диагностика үлгісі. Нақты ғылыми-әдістемелік мазмұнды тапсырыс беруші бекітеді.", "Demo content: 3 ML algorithms, 5 STEM competencies, 6 lessons, 18 tasks, 4 projects and sample pre/post assessments. Educational content requires approval.")}
              </DemoNotice>
            </div>
          </div>
          <div className="grid content-start gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              {
                step: "01",
                title: t("ML алгоритм", "ML algorithms"),
                text: t("Классификация, регрессия, шешім ағаштары — қарапайым тілмен және мысалдармен.", "Classification, regression and decision trees explained through examples."),
                icon: BrainCircuit,
                to: "/ml",
              },
              {
                step: "02",
                title: t("STEM құзыреттілік", "STEM competencies"),
                text: t("Логика, деректер, зерттеу, инженерия және шығармашылық — әрқайсысы өлшенетін индикаторлармен.", "Develop logic, data, research, engineering and creative skills."),
                icon: Target,
                to: "/stem",
              },
              {
                step: "03",
                title: t("STEM жоба", "STEM projects"),
                text: t("Нақты мәселені ML құралдарымен шешу: идеядан нәтижеге дейінгі қадамдар.", "Use ML tools to solve a real problem, from idea to result."),
                icon: FolderKanban,
                to: "/projects",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.step}
                  to={item.to}
                  className="group rounded-md border border-[#dedede] bg-white p-5 no-underline transition hover:border-brand-300 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-md bg-brand-50 text-brand-700">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-xs font-bold tracking-[0.2em] text-slate-500">
                      {item.step}
                    </span>
                  </div>
                  <p className="mt-3 text-base font-bold text-ink-950">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5">
            <p className="text-xs font-bold tracking-wide text-brand-700 uppercase">
              {t("ML алгоритмдері", "ML algorithms")}
            </p>
            <p className="mt-2 text-4xl font-extrabold text-brand-900">
              {algorithms.data?.total ?? "—"}
            </p>
            <p className="mt-1 text-xs text-brand-700">{t("Теория + STEM-байланыс", "Theory and STEM connections")}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">
              {t("STEM құзыреттіліктері", "STEM competencies")}
            </p>
            <p className="mt-2 text-4xl font-extrabold text-amber-950">
              {competencies.data?.total ?? "—"}
            </p>
            <p className="mt-1 text-xs text-amber-800">{t("Индикаторлар мен деңгейлер", "Indicators and levels")}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              {t("STEM жобалары", "STEM projects")}
            </p>
            <p className="mt-2 text-4xl font-extrabold text-ink-950">
              {projects.data?.total ?? "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">{t("Практикалық сценарийлер", "Practical scenarios")}</p>
          </div>
        </div>

        <div className="mt-14 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-brand-700 uppercase">
              {t("Оқу бағыты", "Learning path")}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">
              {t("ML → STEM → жоба", "ML → STEM → project")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {t("Әр алгоритм STEM құзыреттіліктерімен байланысады, ал әр құзыреттілік нақты сабақтар, тапсырмалар және жобалар арқылы дамиды.", "Each algorithm connects to STEM competencies, developed through lessons, tasks and projects.")}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {algorithms.isLoading ? (
            <PageLoader />
          ) : algorithms.isError ? (
            <Alert tone="error">{errorMessage(algorithms.error)}</Alert>
          ) : (algorithms.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="Әзірге жарияланған алгоритм жоқ" />
          ) : (
            algorithms.data?.items.map((algorithm) => (
              <ContentCard
                key={algorithm.id}
                to={`/ml/${algorithm.slug}`}
                title={t(algorithm.title, algorithm.title_en || algorithm.title)}
                meta={algorithm.title_en}
                description={localizeAlgorithm(algorithm, language).summary}
                icon={<BrainCircuit className="size-5" aria-hidden />}
                demo={algorithm.is_demo}
                footer={
                  <span className="inline-flex items-center gap-1">
                    {t("Толығырақ", "Learn more")} <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                }
              />
            ))
          )}
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink-950">{t("STEM құзыреттіліктері", "STEM competencies")}</h2>
              <Link to="/stem" className="text-xs font-semibold no-underline">
                {t("Барлығы", "View all")}
              </Link>
            </div>
            <ul className="mt-4 space-y-2">
              {(competencies.data?.items ?? []).map((item, index) => (
                <li key={item.id}>
                  <Link
                    to={`/stem/${item.slug}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 no-underline transition hover:border-brand-200 hover:bg-brand-50"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-brand-700 shadow-sm">
                      {index + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-950">
                        {localizeCompetency(item, language).title}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {localizeCompetency(item, language).description}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink-950">{t("STEM жобалары", "STEM projects")}</h2>
              <Link to="/projects" className="text-xs font-semibold no-underline">
                {t("Барлығы", "View all")}
              </Link>
            </div>
            <ul className="mt-4 space-y-2">
              {(projects.data?.items ?? []).slice(0, 4).map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/projects/${item.id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 no-underline transition hover:border-brand-200 hover:bg-brand-50"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand-700 shadow-sm">
                      <Compass className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-950">
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500">{item.summary}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="mt-14">
          <h2 className="text-2xl font-bold tracking-tight text-ink-950">
            {t("Платформа кімге арналған?", "Who is it for?")}
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Card>
              <GraduationCap className="size-7 text-brand-700" aria-hidden />
              <h3 className="mt-3 text-lg font-bold text-ink-950">{t("Оқушы", "Student")}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {t("Сабақтар, тапсырмалар, жобалар, диагностика және өз STEM динамикасы.", "Lessons, tasks, projects, assessments and personal progress.")}
              </p>
              <p className="mt-3 text-xs text-slate-500">Кіру: student@mlstem.kz / Student123!</p>
            </Card>
            <Card>
              <Users className="size-7 text-brand-700" aria-hidden />
              <h3 className="mt-3 text-lg font-bold text-ink-950">{t("Мұғалім", "Teacher")}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {t("Сыныптар, тағайындаулар, тексерулер, әдістеме және CSV есептер.", "Classes, assignments, grading, teaching resources and CSV reports.")}
              </p>
              <p className="mt-3 text-xs text-slate-500">Кіру: teacher@mlstem.kz / Teacher123!</p>
            </Card>
            <Card>
              <BadgeCheck className="size-7 text-brand-700" aria-hidden />
              <h3 className="mt-3 text-lg font-bold text-ink-950">{t("Әкімші", "Administrator")}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                {t("CMS, файлдар, пайдаланушылар, сыныптар және публикация аудиті.", "Manage content, files, users, classes and publication history.")}
              </p>
              <p className="mt-3 text-xs text-slate-500">Кіру: admin@mlstem.kz / Admin123!</p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}

export function MlPage() {
  const t = useText();
  const { language } = usePreferences();
  useTitle(t("Машиналық оқыту", "Machine learning"));
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = useState(1);
  const algorithms = useQuery({
    queryKey: ["public", "algorithms", query, page],
    queryFn: () =>
      http.get<Page<AlgorithmCard>>(
        `/algorithms?page=${page}&page_size=9${query ? `&q=${encodeURIComponent(query)}` : ""}`,
      ),
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={t("1-қадам · ML", "Step 1 · ML")}
        title={t("Машиналық оқыту алгоритмдері", "Machine learning algorithms")}
        description={
          <>
            {t("Әр алгоритм — оқу әрекетінің бастауы. Мұнда теория, қолдану мысалдары және сол алгоритм дамытатын STEM құзыреттіліктері көрсетіледі. Келесі қадам — STEM құзыреттіліктері, содан кейін жоба.", "Explore the theory, examples and STEM competencies associated with each algorithm, then continue to projects.")}
          </>
        }
        actions={<LinkButton to="/stem" variant="secondary">{t("STEM-ке өту", "Explore STEM")}</LinkButton>}
      />
      <div className="mb-6 max-w-md">
        <label htmlFor="algorithm-search" className="sr-only">
          {t("Алгоритм іздеу", "Search algorithms")}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400" aria-hidden />
          <TextInput
            id="algorithm-search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t("Алгоритм атауы немесе сипаттамасы...", "Algorithm name or description...")}
            className="pl-9"
          />
        </div>
      </div>
      {algorithms.isLoading ? (
        <PageLoader />
      ) : algorithms.isError ? (
        <Alert tone="error">{errorMessage(algorithms.error)}</Alert>
      ) : (algorithms.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title={t("Алгоритмдер табылмады", "No algorithms found")}
          description={t("Іздеу сөзін өзгертіп көріңіз немесе барлық материалдарды қараңыз.", "Try a different search or browse all materials.")}
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {algorithms.data?.items.map((algorithm) => (
              <ContentCard
                key={algorithm.id}
                to={`/ml/${algorithm.slug}`}
                title={t(algorithm.title, algorithm.title_en || algorithm.title)}
                meta={algorithm.title_en}
                description={localizeAlgorithm(algorithm, language).summary}
                icon={<BrainCircuit className="size-5" aria-hidden />}
                demo={algorithm.is_demo}
                footer={
                  <span className="inline-flex items-center gap-1">
                    {t("Алгоритмді ашу", "Open algorithm")} <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                }
              />
            ))}
          </div>
          <Pagination
            page={page}
            total={algorithms.data?.total ?? 0}
            pageSize={9}
            onPage={setPage}
          />
        </>
      )}
      <div className="mt-10">
        <DemoNotice />
      </div>
    </div>
  );
}

export function MlDetailPage() {
  const { language } = usePreferences();
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const algorithm = useQuery({
    queryKey: ["public", "algorithm", slug],
    queryFn: () => http.get<AlgorithmDetail>(`/algorithms/${slug}`),
  });
  useTitle(algorithm.data ? localizeAlgorithm(algorithm.data, language).title : "ML алгоритмі");

  if (algorithm.isLoading) return <PageLoader />;
  if (algorithm.isError)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert tone="error" title="Алгоритм ашылмады">
          {errorMessage(algorithm.error)}
        </Alert>
        <div className="mt-4">
          <LinkButton to="/ml" variant="secondary">
            ML каталогына оралу
          </LinkButton>
        </div>
      </div>
    );

  const data = algorithm.data ? localizeAlgorithm(algorithm.data, language) : undefined;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/ml" className="text-sm font-semibold no-underline">
        ← ML каталогы
      </Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <article>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">ML алгоритмі</Badge>
            {data.is_demo ? <Badge tone="amber">Демо</Badge> : null}
            {data.status !== "published" ? <Badge tone="slate">Жоба</Badge> : null}
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink-950">{data.title}</h1>
          {data.title_en && data.title_en !== data.title ? <p className="mt-1 text-lg text-slate-500">{data.title_en}</p> : null}
          <p className="mt-4 text-base leading-7 text-slate-600">{data.summary}</p>
          {data.cover_image ? (
            <img
              src={data.cover_image}
              alt={`${data.title} иллюстрациясы`}
              className="mt-6 max-h-96 w-full rounded-2xl border border-slate-200 object-cover"
            />
          ) : null}
          <div className="mt-8">
            <RichTextRenderer html={data.body} />
          </div>

          {data.lessons.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-xl font-bold text-ink-950">Байланысты сабақтар</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.lessons.map((lesson) => (
                  <ContentCard
                    key={lesson.id}
                    to={publicContentLink(user?.role, "lesson", lesson.id)}
                    title={localizeRefTitle(lesson, language)}
                    meta={`${lesson.order_no}-сабақ`}
                    icon={<BookOpen className="size-4" aria-hidden />}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {data.tasks.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-xl font-bold text-ink-950">Байланысты тапсырмалар</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.tasks.map((task) => (
                  <ContentCard
                    key={task.id}
                    to={publicContentLink(user?.role, "task", task.id)}
                    title={localizeRefTitle(task, language)}
                    meta={`${taskTypeLabels[task.type] ?? task.type} · ${
                      difficultyLabels[task.difficulty] ?? task.difficulty
                    }`}
                    icon={<ClipboardIcon />}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {data.projects.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-xl font-bold text-ink-950">STEM жобалары</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.projects.map((project) => (
                  <ContentCard
                    key={project.id}
                    to={`/projects/${project.id}`}
                    title={localizeRefTitle(project, language)}
                    description={project.summary}
                    icon={<FolderKanban className="size-4" aria-hidden />}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {data.resources.length > 0 ? (
            <section className="mt-10">
              <ResourceList resources={data.resources} />
            </section>
          ) : null}
        </article>

        <aside className="space-y-4">
          <Card>
            <h2 className="text-sm font-bold text-ink-950">Дамытатын STEM құзыреттіліктері</h2>
            <ul className="mt-3 space-y-2">
              {data.competencies.map((competency) => (
                <li key={competency.id}>
                  <Link
                    to={`/stem/${competency.slug}`}
                    className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800 no-underline hover:bg-brand-100"
                  >
                    <Target className="size-4 shrink-0" aria-hidden />
                    {localizeRefTitle(competency, language)}
                  </Link>
                </li>
              ))}
              {data.competencies.length === 0 ? (
                <li className="text-sm text-slate-500">Құзыреттіліктер әлі байланыстырылмаған.</li>
              ) : null}
            </ul>
          </Card>
          <Card>
            <h2 className="text-sm font-bold text-ink-950">Оқу тізбегі</h2>
            <ol className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="font-bold text-brand-700">1.</span> Осы алгоритмді оқу
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-brand-700">2.</span> STEM құзыреттіліктерін
                зерттеу
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-brand-700">3.</span> Жобаны орындау және
                қорғау
              </li>
            </ol>
            <div className="mt-4">
              <LinkButton
                to={user ? roleHome(user.role) : "/login"}
                className="w-full"
                size="sm"
              >
                {user ? "Кабинетке өту" : "Оқуды бастау"}
              </LinkButton>
            </div>
          </Card>
          <DemoNotice />
        </aside>
      </div>
    </div>
  );
}

function ClipboardIcon() {
  return <Layers className="size-4" aria-hidden />;
}

export function StemPage() {
  const { language } = usePreferences();
  const t = useText();
  useTitle(t("STEM құзыреттіліктері", "STEM competencies"));
  const competencies = useQuery({
    queryKey: ["public", "competencies"],
    queryFn: () => http.get<Page<CompetencyCard>>("/competencies?page_size=20"),
  });
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={t("2-қадам · STEM", "Step 2 · STEM")}
        title={t("Бес STEM құзыреттілігі", "Five STEM competencies")}
        description={
          <>
            {t("Құзыреттіліктер — алгоритм мен жобаны байланыстыратын өзек. Әр құзыреттілік индикаторлар, критерийлер және оқу әрекеттері арқылы сипатталады. Диагностика нәтижелері осы бес бағыт бойынша есептеледі.", "Competencies connect algorithms to projects. Each has indicators, criteria and learning activities; assessments measure progress across these five areas.")}
          </>
        }
        actions={<LinkButton to="/projects" variant="secondary">{t("Жобаларға өту", "Explore projects")}</LinkButton>}
      />
      {competencies.isLoading ? (
        <PageLoader />
      ) : competencies.isError ? (
        <Alert tone="error">{errorMessage(competencies.error)}</Alert>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(competencies.data?.items ?? []).map((competency, index) => {
            const Icon = iconList[index % iconList.length];
            return (
              <ContentCard
                key={competency.id}
                to={`/stem/${competency.slug}`}
                title={localizeCompetency(competency, language).title}
                description={localizeCompetency(competency, language).description}
                icon={<Icon className="size-5" aria-hidden />}
                demo={competency.is_demo}
                meta={t(`${index + 1}-құзыреттілік`, `Competency ${index + 1}`)}
                footer={
                  <span className="inline-flex items-center gap-1">
                    {t("Индикаторларды көру", "View indicators")} <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                }
              />
            );
          })}
        </div>
      )}
      <div className="mt-10">
        <DemoNotice>
          {t("Құзыреттіліктердің мазмұны, индикаторлары және деңгей критерийлері демо-үлгі ретінде берілген. Ғылыми негізделген түпкілікті рубриканы тапсырыс беруші бекітеді.", "Competencies, indicators and levels are demonstration examples; the final rubric requires approval.")}
        </DemoNotice>
      </div>
    </div>
  );
}

export function StemDetailPage() {
  const { language } = usePreferences();
  const t = useText();
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const competency = useQuery({
    queryKey: ["public", "competency", slug],
    queryFn: () => http.get<CompetencyDetail>(`/competencies/${slug}`),
  });
  useTitle(competency.data ? localizeCompetency(competency.data, language).title : t("STEM құзыреттілігі", "STEM competency"));

  if (competency.isLoading) return <PageLoader />;
  if (competency.isError)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert tone="error" title={t("Құзыреттілік ашылмады", "Could not open competency")}>
          {errorMessage(competency.error)}
        </Alert>
        <div className="mt-4">
          <LinkButton to="/stem" variant="secondary">
            {t("STEM тізіміне оралу", "Back to competencies")}
          </LinkButton>
        </div>
      </div>
    );

  const data = competency.data ? localizeCompetency(competency.data, language) : undefined;
  if (!data) return null;
  const criteria = Object.entries(data.criteria_json ?? {});

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/stem" className="text-sm font-semibold no-underline">
        ← {t("STEM құзыреттіліктері", "STEM competencies")}
      </Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <article>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{t("STEM құзыреттілігі", "STEM competency")}</Badge>
            {data.is_demo ? <Badge tone="amber">{t("Демо", "Demo")}</Badge> : null}
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink-950">{data.title}</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">{data.description}</p>

          <section className="mt-8">
            <h2 className="text-xl font-bold text-ink-950">{t("Индикаторлар", "Indicators")}</h2>
            <ul className="mt-3 space-y-2">
              {(data.indicators_json ?? []).map((indicator, index) => (
                <li
                  key={`${indicator}-${index}`}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3.5 text-sm text-slate-700"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-800">
                    {index + 1}
                  </span>
                  {indicator}
                </li>
              ))}
            </ul>
          </section>

          {criteria.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-xl font-bold text-ink-950">{t("Деңгей критерийлері", "Level criteria")}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {criteria.map(([level, description]) => (
                  <Card key={level} className="bg-slate-50">
                    <p className="text-xs font-bold tracking-wide text-brand-700 uppercase">
                      {language === "en" ? ({ low: "Low", medium: "Medium", high: "High" } as Record<string, string>)[level] ?? level : levelLabels[level] ?? level}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {data.lessons.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-xl font-bold text-ink-950">{t("Байланысты сабақтар", "Related lessons")}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.lessons.map((lesson) => (
                  <ContentCard
                    key={lesson.id}
                    to={publicContentLink(user?.role, "lesson", lesson.id)}
                    title={localizeRefTitle(lesson, language)}
                    meta={`${lesson.order_no}-сабақ`}
                    icon={<BookOpen className="size-4" aria-hidden />}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {data.tasks.length > 0 || data.projects.length > 0 ? (
            <section className="mt-10 grid gap-6 sm:grid-cols-2">
              <div>
                <h2 className="text-xl font-bold text-ink-950">{t("Тапсырмалар", "Tasks")}</h2>
                <ul className="mt-3 space-y-2">
                  {data.tasks.map((task) => (
                    <li key={task.id}>
                      <Link
                        to={publicContentLink(user?.role, "task", task.id)}
                        className="block rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-800 no-underline hover:border-brand-300"
                      >
                        {localizeRefTitle(task, language)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink-950">{t("Жобалар", "Projects")}</h2>
                <ul className="mt-3 space-y-2">
                  {data.projects.map((project) => (
                    <li key={project.id}>
                      <Link
                        to={`/projects/${project.id}`}
                        className="block rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-800 no-underline hover:border-brand-300"
                      >
                        {localizeRefTitle(project, language)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
        </article>

        <aside className="space-y-4">
          <Card>
            <h2 className="text-sm font-bold text-ink-950">{t("Байланысты ML алгоритмдері", "Related ML algorithms")}</h2>
            <ul className="mt-3 space-y-2">
              {data.algorithms.map((algorithm) => (
                <li key={algorithm.id}>
                  <Link
                    to={`/ml/${algorithm.slug}`}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-brand-50"
                  >
                    <BrainCircuit className="size-4 shrink-0 text-brand-700" aria-hidden />
                    {language === "en" && algorithm.title_en ? algorithm.title_en : algorithm.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="text-sm font-bold text-ink-950">{t("Бұл құзыреттілік қалай дамиды?", "How is this competency developed?")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t("Оқушы алгоритмді үйренеді, оны қолданатын тапсырманы орындайды, жобада нақты мәселені шешеді. Даму деңгейі pre/post диагностика арқылы өлшенеді.", "Students learn an algorithm, apply it in a task, and solve a real problem in a project. Progress is measured with pre/post assessments.")}
            </p>
            <div className="mt-4">
              <LinkButton to={user ? roleHome(user.role) : "/login"} size="sm" className="w-full">
                {user ? t("Кабинетке өту", "Go to dashboard") : t("Кіру", "Sign in")}
              </LinkButton>
            </div>
          </Card>
          <DemoNotice>
            {t("Бұл беттегі индикаторлар мен критерийлер — демо. Нақты өлшеу әдістемесін ғылыми жетекші бекітуі қажет.", "The indicators and criteria on this page are examples. The final assessment methodology requires academic approval.")}
          </DemoNotice>
        </aside>
      </div>
    </div>
  );
}

export function ProjectsPage() {
  const t = useText();
  const { language } = usePreferences();
  useTitle(t("STEM жобалары", "STEM projects"));
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("order");
  const [page, setPage] = useState(1);
  const query = useDebouncedValue(search.trim(), 300);
  const projects = useQuery({
    queryKey: ["public", "projects", query, sort, page],
    queryFn: () =>
      http.get<Page<ProjectCard>>(
        `/projects?page=${page}&page_size=12&sort=${sort}${query ? `&q=${encodeURIComponent(query)}` : ""}`,
      ),
  });
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow={t("3-қадам · STEM жобалары", "Step 3 · STEM projects")}
        title={t("STEM жобалары", "STEM projects")}
        description={
          <>
            {t("Жоба — білімді практикада қолдану. Әр жобада мәселе, мақсат, қадамдар, құралдар және бағалау критерийлері көрсетіледі. Толық орындауға кіру қажет; жобаны мұғалім сыныпқа тағайындайды.", "Apply your knowledge through projects with a problem, goal, steps, tools and assessment criteria. Sign in to submit assigned work.")}
          </>
        }
      />
      <div className="mb-6 flex max-w-2xl flex-wrap items-center gap-3">
        <label htmlFor="project-search" className="sr-only">
          {t("Жоба іздеу", "Search projects")}
        </label>
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400" aria-hidden />
          <TextInput
            id="project-search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder={t("Жоба атауы немесе сипаттамасы...", "Project name or description...")}
            className="pl-9"
          />
        </div>
        <Select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }} aria-label={t("Сұрыптау", "Sort")} className="max-w-56">
          <option value="order">{t("Реті бойынша", "Default order")}</option>
          <option value="title">{t("Атауы бойынша", "Title")}</option>
          <option value="date">{t("Жаңа материалдар алдымен", "Newest first")}</option>
        </Select>
      </div>
      {projects.isLoading ? (
        <PageLoader />
      ) : projects.isError ? (
        <Alert tone="error">{errorMessage(projects.error)}</Alert>
      ) : (projects.data?.items.length ?? 0) === 0 ? (
        <EmptyState title={t("Жобалар табылмады", "No projects found")} />
      ) : (
        <>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.data?.items.map((project) => (
            <ContentCard
              key={project.id}
              to={`/projects/${project.id}`}
              title={localizeProject(project, language).title}
              image="/images/stem-project.png"
              description={localizeProject(project, language).summary}
              icon={<Compass className="size-5" aria-hidden />}
              demo={project.is_demo}
              badges={
                <>
                  {project.algorithm ? <Badge tone="brand">{localizeRefTitle(project.algorithm, language)}</Badge> : null}
                  {project.competencies.slice(0, 2).map((competency) => (
                    <Badge key={competency.id} tone="slate">
                      {localizeRefTitle(competency, language)}
                    </Badge>
                  ))}
                </>
              }
              footer={
                <span className="inline-flex items-center gap-1">
                  {t("Жобаны ашу", "Open project")} <ArrowRight className="size-3.5" aria-hidden />
                </span>
              }
            />
          ))}
        </div>
        <Pagination page={page} total={projects.data?.total ?? 0} pageSize={12} onPage={setPage} />
        </>
      )}
      <div className="mt-10">
        <DemoNotice />
      </div>
    </div>
  );
}

export function PublicProjectPage() {
  const t = useText();
  const { language } = usePreferences();
  const { id = "" } = useParams();
  const { user } = useAuth();
  const project = useQuery({
    queryKey: ["public", "project", id],
    queryFn: () => http.get<ProjectDetail>(`/projects/${id}`),
  });
  useTitle(project.data ? localizeProject(project.data, language).title : t("STEM жобасы", "STEM project"));

  if (project.isLoading) return <PageLoader />;
  if (project.isError)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert tone="error" title={t("Жоба ашылмады", "Could not open project")}>
          {errorMessage(project.error)}
        </Alert>
        <div className="mt-4">
          <LinkButton to="/projects" variant="secondary">
            {t("Жобаларға оралу", "Back to projects")}
          </LinkButton>
        </div>
      </div>
    );

  const data = project.data ? localizeProject(project.data, language) : undefined;
  if (!data) return null;
  const actionPath =
    user?.role === "student"
      ? `/student/projects/${data.id}`
      : user?.role === "teacher"
        ? `/teacher/projects/${data.id}`
        : user?.role === "admin"
          ? `/admin/projects?edit=${data.id}`
          : "/login";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/projects" className="text-sm font-semibold no-underline">
        ← {t("STEM жобалары", "STEM projects")}
      </Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_21rem]">
        <article>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">{t("STEM жобасы", "STEM project")}</Badge>
            {data.is_demo ? <Badge tone="amber">{t("Демо", "Demo")}</Badge> : null}
            {data.algorithm ? <Badge tone="slate">{localizeRefTitle(data.algorithm, language)}</Badge> : null}
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink-950">{data.title}</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">{data.summary}</p>

          <section className="mt-8 grid gap-4 sm:grid-cols-3">
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
          </section>

          <section className="mt-8">
            <RichTextRenderer html={data.body} />
          </section>

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
              <h2 className="text-base font-bold text-ink-950">{t("Бағалау критерийлері", "Assessment criteria")}</h2>
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
            <h2 className="text-sm font-bold text-ink-950">{t("Жобаны орындау", "Complete the project")}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {t("Толық нұсқаулық, файлдар және нәтижені жіберу мүмкіндігі кабинетте қолжетімді. Жобаны мұғалім сыныпқа тағайындайды.", "Full instructions, files, and submissions are available in your dashboard. Your teacher assigns projects to the class.")}
            </p>
            <div className="mt-4">
              <LinkButton to={actionPath} className="w-full" size="sm">
                {user ? t("Кабинетте ашу", "Open in dashboard") : t("Кіріп, орындауды бастау", "Sign in to start")}
              </LinkButton>
            </div>
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
          <Card className="bg-slate-50">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              {t("Жарияланған", "Published")}
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {formatDate(null)}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {t("Жоба нәтижесін мұғалім рубрика бойынша бағалайды.", "The teacher assesses the project using the rubric.")}
            </p>
          </Card>
          <DemoNotice />
        </aside>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  useTitle("Бет табылмады");
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="text-xs font-bold tracking-[0.2em] text-brand-700 uppercase">404</p>
      <h1 className="mt-3 text-3xl font-bold text-ink-950">Бет табылмады</h1>
      <p className="mt-2 text-sm text-slate-600">
        Сілтеме ескірген немесе материал жарияланбаған болуы мүмкін.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <LinkButton to="/">Басты бетке</LinkButton>
        <LinkButton to="/ml" variant="secondary">
          ML каталогы
        </LinkButton>
      </div>
    </div>
  );
}
