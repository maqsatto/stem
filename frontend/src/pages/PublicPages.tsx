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
  useTitle("Басты бет");
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
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div
          className="pointer-events-none absolute -top-32 -right-24 size-[36rem] rounded-full bg-brand-600/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-40 -left-24 size-[30rem] rounded-full bg-amber-400/10 blur-3xl"
          aria-hidden
        />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-brand-200">
              <Sparkles className="size-3.5" aria-hidden />
              Машиналық оқыту · STEM · Жобалар
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              ML + STEM LAB
              <span className="mt-3 block text-2xl font-semibold text-brand-200 sm:text-3xl">
                STEM-құзыреттіліктерді ML алгоритмдері арқылы дамыту
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">
              Біртұтас оқу платформасы: алгоритмді үйрену → зерттеу жүргізу → STEM жобасын
              қорғау → диагностика арқылы өзгерісті өлшеу. Мұғалім сыныпты басқарады,
              оқушы өз қарқынымен оқиды, әкімші мазмұнды өз бетінше жариялайды.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/ml" size="lg">
                ML каталогын ашу
                <ArrowRight className="size-4" aria-hidden />
              </LinkButton>
              <LinkButton
                to={user ? roleHome(user.role) : "/login"}
                size="lg"
                variant="secondary"
                className="border-white/20 bg-white/10 text-white hover:border-white/40 hover:bg-white/15"
              >
                {user ? "Менің кабинетім" : "Кіру"}
              </LinkButton>
            </div>
            <div className="mt-8 max-w-xl">
              <DemoNotice>
                Демо-контент: 3 ML алгоритмі, 5 STEM құзыреттілігі, 6 демо-сабақ, 18 тапсырма,
                4 жоба және pre/post диагностика үлгісі. Нақты ғылыми-әдістемелік мазмұнды
                тапсырыс беруші бекітеді.
              </DemoNotice>
            </div>
          </div>
          <div className="grid content-start gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {[
              {
                step: "01",
                title: "ML алгоритм",
                text: "Классификация, регрессия, шешім ағаштары — қарапайым тілмен және мысалдармен.",
                icon: BrainCircuit,
                to: "/ml",
              },
              {
                step: "02",
                title: "STEM құзыреттілік",
                text: "Логика, деректер, зерттеу, инженерия және шығармашылық — әрқайсысы өлшенетін индикаторлармен.",
                icon: Target,
                to: "/stem",
              },
              {
                step: "03",
                title: "STEM жоба",
                text: "Нақты мәселені ML құралдарымен шешу: идеядан нәтижеге дейінгі қадамдар.",
                icon: FolderKanban,
                to: "/projects",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.step}
                  to={item.to}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-5 no-underline transition hover:border-brand-300/40 hover:bg-white/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-200">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-xs font-bold tracking-[0.2em] text-slate-500">
                      {item.step}
                    </span>
                  </div>
                  <p className="mt-3 text-base font-bold text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-400">{item.text}</p>
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
              ML алгоритмдері
            </p>
            <p className="mt-2 text-4xl font-extrabold text-brand-900">
              {algorithms.data?.total ?? "—"}
            </p>
            <p className="mt-1 text-xs text-brand-700">Теория + STEM-байланыс</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-xs font-bold tracking-wide text-amber-800 uppercase">
              STEM құзыреттіліктері
            </p>
            <p className="mt-2 text-4xl font-extrabold text-amber-950">
              {competencies.data?.total ?? "—"}
            </p>
            <p className="mt-1 text-xs text-amber-800">Индикаторлар мен деңгейлер</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              STEM жобалары
            </p>
            <p className="mt-2 text-4xl font-extrabold text-ink-950">
              {projects.data?.total ?? "—"}
            </p>
            <p className="mt-1 text-xs text-slate-500">Практикалық сценарийлер</p>
          </div>
        </div>

        <div className="mt-14 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-brand-700 uppercase">
              Оқу бағыты
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-ink-950">
              ML → STEM → жоба
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Әр алгоритм STEM құзыреттіліктерімен байланысады, ал әр құзыреттілік нақты
              сабақтар, тапсырмалар және жобалар арқылы дамиды. Бұл — бір оқу тізбегі, үш
              бөлек сайт емес.
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
                title={algorithm.title}
                meta={algorithm.title_en}
                description={algorithm.summary}
                icon={<BrainCircuit className="size-5" aria-hidden />}
                demo={algorithm.is_demo}
                footer={
                  <span className="inline-flex items-center gap-1">
                    Толығырақ <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                }
              />
            ))
          )}
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink-950">STEM құзыреттіліктері</h2>
              <Link to="/stem" className="text-xs font-semibold no-underline">
                Барлығы
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
                        {item.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-ink-950">STEM жобалары</h2>
              <Link to="/projects" className="text-xs font-semibold no-underline">
                Барлығы
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
            Платформа кімге арналған?
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <Card>
              <GraduationCap className="size-7 text-brand-700" aria-hidden />
              <h3 className="mt-3 text-lg font-bold text-ink-950">Оқушы</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Сабақтар, тапсырмалар, жобалар, диагностика және өз STEM динамикасы.
              </p>
              <p className="mt-3 text-xs text-slate-500">Кіру: student@mlstem.kz / Student123!</p>
            </Card>
            <Card>
              <Users className="size-7 text-brand-700" aria-hidden />
              <h3 className="mt-3 text-lg font-bold text-ink-950">Мұғалім</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Сыныптар, тағайындаулар, тексерулер, әдістеме және CSV есептер.
              </p>
              <p className="mt-3 text-xs text-slate-500">Кіру: teacher@mlstem.kz / Teacher123!</p>
            </Card>
            <Card>
              <BadgeCheck className="size-7 text-brand-700" aria-hidden />
              <h3 className="mt-3 text-lg font-bold text-ink-950">Әкімші</h3>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                CMS, файлдар, пайдаланушылар, сыныптар және публикация аудиті.
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
  useTitle("Машиналық оқыту");
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
        eyebrow="1-қадам · ML"
        title="Машиналық оқыту алгоритмдері"
        description={
          <>
            Әр алгоритм — оқу әрекетінің бастауы. Мұнда теория, қолдану мысалдары және сол
            алгоритм дамытатын STEM құзыреттіліктері көрсетіледі. Келесі қадам — STEM
            құзыреттіліктері, содан кейін жоба.
          </>
        }
        actions={<LinkButton to="/stem" variant="secondary">STEM-ке өту</LinkButton>}
      />
      <div className="mb-6 max-w-md">
        <label htmlFor="algorithm-search" className="sr-only">
          Алгоритм іздеу
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
            placeholder="Алгоритм атауы немесе сипаттамасы..."
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
          title="Алгоритмдер табылмады"
          description="Іздеу сөзін өзгертіп көріңіз немесе барлық материалдарды қараңыз."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {algorithms.data?.items.map((algorithm) => (
              <ContentCard
                key={algorithm.id}
                to={`/ml/${algorithm.slug}`}
                title={algorithm.title}
                meta={algorithm.title_en}
                description={algorithm.summary}
                icon={<BrainCircuit className="size-5" aria-hidden />}
                demo={algorithm.is_demo}
                footer={
                  <span className="inline-flex items-center gap-1">
                    Алгоритмді ашу <ArrowRight className="size-3.5" aria-hidden />
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
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const algorithm = useQuery({
    queryKey: ["public", "algorithm", slug],
    queryFn: () => http.get<AlgorithmDetail>(`/algorithms/${slug}`),
  });
  useTitle(algorithm.data?.title ?? "ML алгоритмі");

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

  const data = algorithm.data;
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
          {data.title_en ? <p className="mt-1 text-lg text-slate-500">{data.title_en}</p> : null}
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
                    title={lesson.title}
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
                    title={task.title}
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
                    title={project.title}
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
                    {competency.title}
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
  useTitle("STEM құзыреттіліктері");
  const competencies = useQuery({
    queryKey: ["public", "competencies"],
    queryFn: () => http.get<Page<CompetencyCard>>("/competencies?page_size=20"),
  });
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="2-қадам · STEM"
        title="Бес STEM құзыреттілігі"
        description={
          <>
            Құзыреттіліктер — алгоритм мен жобаны байланыстыратын өзек. Әр құзыреттілік
            индикаторлар, критерийлер және оқу әрекеттері арқылы сипатталады. Диагностика
            нәтижелері осы бес бағыт бойынша есептеледі.
          </>
        }
        actions={<LinkButton to="/projects" variant="secondary">Жобаларға өту</LinkButton>}
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
                title={competency.title}
                description={competency.description}
                icon={<Icon className="size-5" aria-hidden />}
                demo={competency.is_demo}
                meta={`${index + 1}-құзыреттілік`}
                footer={
                  <span className="inline-flex items-center gap-1">
                    Индикаторларды көру <ArrowRight className="size-3.5" aria-hidden />
                  </span>
                }
              />
            );
          })}
        </div>
      )}
      <div className="mt-10">
        <DemoNotice>
          Құзыреттіліктердің мазмұны, индикаторлары және деңгей критерийлері демо-үлгі
          ретінде берілген. Ғылыми негізделген түпкілікті рубриканы тапсырыс беруші бекітеді.
        </DemoNotice>
      </div>
    </div>
  );
}

export function StemDetailPage() {
  const { slug = "" } = useParams();
  const { user } = useAuth();
  const competency = useQuery({
    queryKey: ["public", "competency", slug],
    queryFn: () => http.get<CompetencyDetail>(`/competencies/${slug}`),
  });
  useTitle(competency.data?.title ?? "STEM құзыреттілігі");

  if (competency.isLoading) return <PageLoader />;
  if (competency.isError)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert tone="error" title="Құзыреттілік ашылмады">
          {errorMessage(competency.error)}
        </Alert>
        <div className="mt-4">
          <LinkButton to="/stem" variant="secondary">
            STEM тізіміне оралу
          </LinkButton>
        </div>
      </div>
    );

  const data = competency.data;
  if (!data) return null;
  const criteria = Object.entries(data.criteria_json ?? {});

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Link to="/stem" className="text-sm font-semibold no-underline">
        ← STEM құзыреттіліктері
      </Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <article>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">STEM құзыреттілігі</Badge>
            {data.is_demo ? <Badge tone="amber">Демо</Badge> : null}
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink-950">{data.title}</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">{data.description}</p>

          <section className="mt-8">
            <h2 className="text-xl font-bold text-ink-950">Индикаторлар</h2>
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
              <h2 className="text-xl font-bold text-ink-950">Деңгей критерийлері</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {criteria.map(([level, description]) => (
                  <Card key={level} className="bg-slate-50">
                    <p className="text-xs font-bold tracking-wide text-brand-700 uppercase">
                      {levelLabels[level] ?? level}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}

          {data.lessons.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-xl font-bold text-ink-950">Байланысты сабақтар</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.lessons.map((lesson) => (
                  <ContentCard
                    key={lesson.id}
                    to={publicContentLink(user?.role, "lesson", lesson.id)}
                    title={lesson.title}
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
                <h2 className="text-xl font-bold text-ink-950">Тапсырмалар</h2>
                <ul className="mt-3 space-y-2">
                  {data.tasks.map((task) => (
                    <li key={task.id}>
                      <Link
                        to={publicContentLink(user?.role, "task", task.id)}
                        className="block rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-800 no-underline hover:border-brand-300"
                      >
                        {task.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="text-xl font-bold text-ink-950">Жобалар</h2>
                <ul className="mt-3 space-y-2">
                  {data.projects.map((project) => (
                    <li key={project.id}>
                      <Link
                        to={`/projects/${project.id}`}
                        className="block rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-semibold text-slate-800 no-underline hover:border-brand-300"
                      >
                        {project.title}
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
            <h2 className="text-sm font-bold text-ink-950">Байланысты ML алгоритмдері</h2>
            <ul className="mt-3 space-y-2">
              {data.algorithms.map((algorithm) => (
                <li key={algorithm.id}>
                  <Link
                    to={`/ml/${algorithm.slug}`}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-brand-50"
                  >
                    <BrainCircuit className="size-4 shrink-0 text-brand-700" aria-hidden />
                    {algorithm.title}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="text-sm font-bold text-ink-950">Бұл құзыреттілік қалай дамиды?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Оқушы алгоритмді үйренеді, оны қолданатын тапсырманы орындайды, жобада нақты
              мәселені шешеді. Даму деңгейі pre/post диагностика арқылы өлшенеді.
            </p>
            <div className="mt-4">
              <LinkButton to={user ? roleHome(user.role) : "/login"} size="sm" className="w-full">
                {user ? "Кабинетке өту" : "Кіру"}
              </LinkButton>
            </div>
          </Card>
          <DemoNotice>
            Бұл беттегі индикаторлар мен критерийлер — демо. Нақты өлшеу әдістемесін ғылыми
            жетекші бекітуі қажет.
          </DemoNotice>
        </aside>
      </div>
    </div>
  );
}

export function ProjectsPage() {
  useTitle("STEM жобалары");
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), 300);
  const projects = useQuery({
    queryKey: ["public", "projects", query],
    queryFn: () =>
      http.get<Page<ProjectCard>>(
        `/projects?page_size=20${query ? `&q=${encodeURIComponent(query)}` : ""}`,
      ),
  });
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="3-қадам · STEM жобалары"
        title="STEM жобалары"
        description={
          <>
            Жоба — білімді практикада қолдану. Әр жобада мәселе, мақсат, қадамдар, құралдар
            және бағалау критерийлері көрсетіледі. Толық орындауға кіру қажет; жобаны мұғалім
            сыныпқа тағайындайды.
          </>
        }
      />
      <div className="mb-6 max-w-md">
        <label htmlFor="project-search" className="sr-only">
          Жоба іздеу
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400" aria-hidden />
          <TextInput
            id="project-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Жоба атауы немесе сипаттамасы..."
            className="pl-9"
          />
        </div>
      </div>
      {projects.isLoading ? (
        <PageLoader />
      ) : projects.isError ? (
        <Alert tone="error">{errorMessage(projects.error)}</Alert>
      ) : (projects.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="Жобалар табылмады" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.data?.items.map((project) => (
            <ContentCard
              key={project.id}
              to={`/projects/${project.id}`}
              title={project.title}
              description={project.summary}
              icon={<Compass className="size-5" aria-hidden />}
              demo={project.is_demo}
              badges={
                <>
                  {project.algorithm ? <Badge tone="brand">{project.algorithm.title}</Badge> : null}
                  {project.competencies.slice(0, 2).map((competency) => (
                    <Badge key={competency.id} tone="slate">
                      {competency.title}
                    </Badge>
                  ))}
                </>
              }
              footer={
                <span className="inline-flex items-center gap-1">
                  Жобаны ашу <ArrowRight className="size-3.5" aria-hidden />
                </span>
              }
            />
          ))}
        </div>
      )}
      <div className="mt-10">
        <DemoNotice />
      </div>
    </div>
  );
}

export function PublicProjectPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const project = useQuery({
    queryKey: ["public", "project", id],
    queryFn: () => http.get<ProjectDetail>(`/projects/${id}`),
  });
  useTitle(project.data?.title ?? "STEM жобасы");

  if (project.isLoading) return <PageLoader />;
  if (project.isError)
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <Alert tone="error" title="Жоба ашылмады">
          {errorMessage(project.error)}
        </Alert>
        <div className="mt-4">
          <LinkButton to="/projects" variant="secondary">
            Жобаларға оралу
          </LinkButton>
        </div>
      </div>
    );

  const data = project.data;
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
        ← STEM жобалары
      </Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_21rem]">
        <article>
          <div className="flex flex-wrap gap-2">
            <Badge tone="brand">STEM жобасы</Badge>
            {data.is_demo ? <Badge tone="amber">Демо</Badge> : null}
            {data.algorithm ? <Badge tone="slate">{data.algorithm.title}</Badge> : null}
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink-950">{data.title}</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">{data.summary}</p>

          <section className="mt-8 grid gap-4 sm:grid-cols-3">
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
          </section>

          <section className="mt-8">
            <RichTextRenderer html={data.body} />
          </section>

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
            <h2 className="text-sm font-bold text-ink-950">Жобаны орындау</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Толық нұсқаулық, файлдар және нәтижені жіберу мүмкіндігі кабинетте қолжетімді.
              Жобаны мұғалім сыныпқа тағайындайды.
            </p>
            <div className="mt-4">
              <LinkButton to={actionPath} className="w-full" size="sm">
                {user ? "Кабинетте ашу" : "Кіріп, орындауды бастау"}
              </LinkButton>
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
          <Card className="bg-slate-50">
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              Жарияланған
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {formatDate(null)}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Жоба нәтижесін мұғалім рубрика бойынша бағалайды.
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
