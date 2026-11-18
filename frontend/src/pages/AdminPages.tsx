import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  ClipboardList,
  FolderKanban,
  Layers,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { errorMessage, http } from "@/shared/api";
import {
  AdminEditorCard,
  AdminEmptyEditor,
  AdminListButton,
  CriteriaEditor,
  DemoField,
  DraftPreview,
  StatusBadge,
  StatusField,
  TextListEditor,
  editorPath,
  useEditParam,
} from "@/shared/components/AdminShared";
import { HtmlEditor } from "@/shared/components/HtmlEditor";
import { statusLabels } from "@/shared/format";
import { useDebouncedValue, useTitle } from "@/shared/hooks";
import { useLabel, usePreferences, useText } from "@/shared/preferences";
import { localizeAlgorithm, localizeCompetency } from "@/shared/localizeContent";
import type {
  AdminAlgorithm,
  AdminCompetency,
  AlgorithmCard,
  CompetencyCard,
  ContentItem,
  ContentOverview,
  Page,
} from "@/shared/types";
import {
  Alert,
  Button,
  Card,
  DemoNotice,
  EmptyState,
  Field,
  LinkButton,
  PageHeader,
  PageLoader,
  Pagination,
  Select,
  StatCard,
  TextArea,
  TextInput,
} from "@/shared/ui";

const typeLabels: Record<string, string> = {
  algorithm: "ML алгоритмі",
  competency: "STEM құзыреттілігі",
  lesson: "Сабақ",
  task: "Тапсырма",
  project: "Жоба",
  assessment: "Диагностика",
};

const pluralByType: Record<string, string> = {
  algorithm: "algorithms",
  competency: "competencies",
  lesson: "lessons",
  task: "tasks",
  project: "projects",
  assessment: "assessments",
};

export function AdminContentPage() {
  useTitle("Мазмұн каталогы");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const query = useDebouncedValue(search.trim(), 300);
  const overview = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => http.get<ContentOverview>("/admin/overview"),
  });
  const content = useQuery({
    queryKey: ["admin", "content", query, type, status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (query) params.set("q", query);
      if (type) params.set("type", type);
      if (status) params.set("status", status);
      return http.get<Page<ContentItem>>(`/admin/content?${params.toString()}`);
    },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Әкімші · CMS"
        title="Мазмұн каталогы"
        description="Барлық оқу материалы бір тізімде. Жоба, жарияланған және мұрағатталған жазбаларды сүзіп, редакторға өтіңіз."
        actions={
          <>
            <LinkButton to="/admin/algorithms?edit=new" size="sm">
              <Plus className="size-4" aria-hidden />
              ML алгоритмі
            </LinkButton>
            <LinkButton to="/admin/lessons?edit=new" variant="secondary" size="sm">
              <Plus className="size-4" aria-hidden />
              Сабақ
            </LinkButton>
          </>
        }
      />

      {overview.isLoading ? (
        <PageLoader />
      ) : overview.isError ? (
        <Alert tone="error">{errorMessage(overview.error)}</Alert>
      ) : overview.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="ML алгоритмдері" value={overview.data.algorithms} />
          <StatCard label="Құзыреттіліктер" value={overview.data.competencies} tone="blue" />
          <StatCard label="Сабақтар" value={overview.data.lessons} tone="amber" />
          <StatCard label="Тапсырмалар" value={overview.data.tasks} />
          <StatCard label="Жобалар" value={overview.data.projects} tone="blue" />
        </div>
      ) : null}

      <Card className="mt-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400"
              aria-hidden
            />
            <TextInput
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Атауы бойынша іздеу..."
              className="pl-9"
              aria-label="Мазмұн іздеу"
            />
          </div>
          <Select
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setPage(1);
            }}
            aria-label="Мазмұн түрі"
          >
            <option value="">Барлық түрлер</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            aria-label="Мәртебе"
          >
            <option value="">Барлық мәртебе</option>
            <option value="draft">Жоба</option>
            <option value="published">Жарияланған</option>
            <option value="archived">Мұрағат</option>
          </Select>
        </div>

        {content.isLoading ? (
          <div className="mt-4">
            <PageLoader />
          </div>
        ) : content.isError ? (
          <div className="mt-4">
            <Alert tone="error">{errorMessage(content.error)}</Alert>
          </div>
        ) : (content.data?.items.length ?? 0) === 0 ? (
          <div className="mt-4">
            <EmptyState title="Жазба табылмады" description="Сүзгілерді өзгертіп көріңіз." />
          </div>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-3 py-2">Мазмұн</th>
                    <th className="px-3 py-2">Түрі</th>
                    <th className="px-3 py-2">Мәртебе</th>
                    <th className="px-3 py-2">Жаңартылған</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {content.data?.items.map((item) => (
                    <tr key={`${item.type}-${item.id}`} className="border-t border-slate-100">
                      <td className="px-3 py-2.5">
                        <Link
                          to={editorPath(pluralByType[item.type], item.id)}
                          className="font-semibold text-ink-950 no-underline hover:text-brand-800"
                        >
                          {item.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {item.slug ?? "—"} {item.is_demo ? "· демо" : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{typeLabels[item.type]}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">
                        {item.updated_at
                          ? new Date(item.updated_at).toLocaleString("kk-KZ")
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Link
                          to={editorPath(pluralByType[item.type], item.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold no-underline"
                        >
                          Өңдеу <ArrowRight className="size-3.5" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              total={content.data?.total ?? 0}
              pageSize={20}
              onPage={setPage}
            />
          </>
        )}
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/admin/lessons?edit=new", label: "Сабақ жасау", icon: BookOpen },
          { to: "/admin/tasks?edit=new", label: "Тапсырма жасау", icon: ClipboardList },
          { to: "/admin/projects?edit=new", label: "Жоба жасау", icon: FolderKanban },
          { to: "/admin/assessments?edit=new", label: "Диагностика жасау", icon: Layers },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink-950 no-underline hover:border-brand-300 hover:bg-brand-50/40"
            >
              <Icon className="size-5 text-brand-700" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="mt-6">
        <DemoNotice>
          Барлық seed мазмұны демо ретінде белгіленген. Жариялау алдында мәтінді, дереккөзді
          және әдістемелік негіздемені тексеріңіз.
        </DemoNotice>
      </div>
    </div>
  );
}

function AlgorithmEditor({
  initial,
  onSaved,
}: {
  initial?: AdminAlgorithm;
  onSaved: (id: string) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [titleEn, setTitleEn] = useState(initial?.title_en ?? "");
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [translationEn, setTranslationEn] = useState(initial?.translation_en ?? {});
  const [coverImage, setCoverImage] = useState(initial?.cover_image ?? "");
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0));
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [isDemo, setIsDemo] = useState(initial?.is_demo ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        title_en: titleEn.trim() || null,
        summary,
        body,
        translation_en: translationEn,
        cover_image: coverImage.trim() || null,
        sort_order: Number(sortOrder) || 0,
        status,
        is_demo: isDemo,
      };
      if (slug.trim()) payload.slug = slug.trim();
      else if (!initial) payload.slug = null;
      return initial
        ? http.patch<AdminAlgorithm>(`/admin/algorithms/${initial.id}`, payload)
        : http.post<AdminAlgorithm>("/admin/algorithms", payload);
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
      resource="algorithms"
      title={title}
      status={status}
      isDemo={isDemo}
      previewHref={initial?.status === "published" ? `/ml/${initial.slug}` : undefined}
      onSaved={onSaved}
      onDeleted={() => onSaved("")}
    >
      <DraftPreview title={title} sections={[{ label: "Сипаттама", html: summary }, { label: "Мазмұн", html: body }]} />
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
          <Field label="Атауы (қазақша)" htmlFor="algo-title" required>
            <TextInput
              id="algo-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
            />
          </Field>
          <Field label="Ағылшынша атауы" htmlFor="algo-title-en">
            <TextInput
              id="algo-title-en"
              value={titleEn ?? ""}
              onChange={(event) => setTitleEn(event.target.value)}
              maxLength={200}
            />
          </Field>
          <Field
            label="Slug (міндетті емес)"
            htmlFor="algo-slug"
            hint="Бос болса атаудан автоматты жасалады."
          >
            <TextInput
              id="algo-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              maxLength={120}
              className="font-mono text-sm"
            />
          </Field>
          <Field label="Реттік нөмір" htmlFor="algo-order">
            <TextInput
              id="algo-order"
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Қысқаша сипаттама" htmlFor="algo-summary" required>
          <TextArea
            id="algo-summary"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            className="min-h-20"
          />
        </Field>
        <HtmlEditor value={body} onChange={setBody} id="algo-body" label="Толық мәтін (HTML)" />
        <details className="rounded-lg border border-slate-200 p-4">
          <summary className="cursor-pointer font-semibold">English translation (optional)</summary>
          <div className="mt-4 space-y-3">
            <Field label="Summary (English)" htmlFor="algo-summary-en"><TextArea id="algo-summary-en" value={translationEn.summary ?? ""} onChange={(event) => setTranslationEn({ ...translationEn, summary: event.target.value })} /></Field>
            <HtmlEditor id="algo-body-en" label="Full text (English)" value={translationEn.body ?? ""} onChange={(value) => setTranslationEn({ ...translationEn, body: value })} />
          </div>
        </details>
        <Field
          label="Мұқаба суретінің сілтемесі"
          htmlFor="algo-cover"
          hint="Тек HTTPS сілтеме немесе /uploads/ жолы."
        >
          <TextInput
            id="algo-cover"
            value={coverImage ?? ""}
            onChange={(event) => setCoverImage(event.target.value)}
            placeholder="https://..."
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusField value={status} onChange={setStatus} />
          <DemoField checked={isDemo} onChange={setIsDemo} />
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" loading={save.isPending}>
          {initial ? "Өзгерістерді сақтау" : "Жазба жасау"}
        </Button>
      </form>
    </AdminEditorCard>
  );
}

export function AdminAlgorithmsPage() {
  const t = useText();
  const label = useLabel();
  const { language } = usePreferences();
  useTitle(t("ML алгоритмдері", "ML algorithms"));
  const queryClient = useQueryClient();
  const [editId, setEditId] = useEditParam();
  const isNew = editId === "new";
  const selectedId = isNew ? null : editId;
  const list = useQuery({
    queryKey: ["admin", "algorithms"],
    queryFn: () => http.get<AlgorithmCard[]>("/admin/algorithms"),
  });
  const detail = useQuery({
    queryKey: ["admin", "algorithms", "detail", selectedId],
    queryFn: () => http.get<AdminAlgorithm>(`/admin/algorithms/${selectedId}`),
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
        title={t("ML алгоритмдері", "ML algorithms")}
        description={t("Алгоритм карточкасы, теориялық мәтін, STEM байланысы және ресурстар. Жоба ретінде сақтап, дайын болғанда жариялаңыз.", "Edit algorithm details, STEM connections, and resources. Save a draft and publish when ready.")}
        actions={
          <Button type="button" onClick={() => setEditId("new")}>
            <Plus className="size-4" aria-hidden />
            {t("Жаңа алгоритм", "New algorithm")}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="self-start">
          <h2 className="text-sm font-bold text-ink-950">{t("Алгоритмдер", "Algorithms")}</h2>
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
                  title={localizeAlgorithm(item, language).title}
                  meta={`${label(statusLabels[item.status] ?? item.status)}${item.is_demo ? t(" · демо", " · demo") : ""}`}
                  onClick={() => setEditId(item.id)}
                />
              ))}
              {(list.data ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">{t("Әзірге алгоритм жоқ.", "No algorithms yet.")}</p>
              ) : null}
            </div>
          )}
        </Card>

        <div>
          {isNew ? (
            <AlgorithmEditor key="new" onSaved={refreshAndSelect} />
          ) : selectedId ? (
            detail.isLoading ? (
              <PageLoader />
            ) : detail.isError ? (
              <Alert tone="error">{errorMessage(detail.error)}</Alert>
            ) : detail.data ? (
              <AlgorithmEditor
                key={detail.data.id}
                initial={detail.data}
                onSaved={refreshAndSelect}
              />
            ) : null
          ) : (
            <AdminEmptyEditor text={t("Сол жақтан алгоритмді таңдаңыз немесе жаңа жазба жасаңыз.", "Select an algorithm or create a new one.")} />
          )}
        </div>
      </div>
      <div className="mt-6">
        <DemoNotice />
      </div>
    </div>
  );
}

function CompetencyEditor({
  initial,
  onSaved,
}: {
  initial?: AdminCompetency;
  onSaved: (id: string) => void;
}) {
  const [translationEn, setTranslationEn] = useState<NonNullable<AdminCompetency["translation_en"]>>(initial?.translation_en ?? {});
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [indicators, setIndicators] = useState<string[]>(
    initial?.indicators_json?.length ? initial.indicators_json : [""],
  );
  const [criteria, setCriteria] = useState<Record<string, string>>(
    initial?.criteria_json ?? {},
  );
  const [sortOrder, setSortOrder] = useState(String(initial?.sort_order ?? 0));
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [isDemo, setIsDemo] = useState(initial?.is_demo ?? true);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        translation_en: translationEn,
        description,
        indicators_json: indicators.filter((item) => item.trim()),
        criteria_json: Object.fromEntries(
          Object.entries(criteria).filter(([, value]) => value.trim()),
        ),
        sort_order: Number(sortOrder) || 0,
        status,
        is_demo: isDemo,
      };
      if (slug.trim()) payload.slug = slug.trim();
      else if (!initial) payload.slug = null;
      return initial
        ? http.patch<AdminCompetency>(`/admin/competencies/${initial.id}`, payload)
        : http.post<AdminCompetency>("/admin/competencies", payload);
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
      resource="competencies"
      title={title}
      status={status}
      isDemo={isDemo}
      previewHref={initial?.status === "published" ? `/stem/${initial.slug}` : undefined}
      onSaved={onSaved}
      onDeleted={() => onSaved("")}
    >
      <DraftPreview title={title} sections={[{ label: "Сипаттама", html: description }, { label: "Индикаторлар", html: indicators.map((item) => `<p>${item}</p>`).join("") }]} />
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
          <Field label="Атауы" htmlFor="comp-title" required>
            <TextInput
              id="comp-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
            />
          </Field>
          <Field label="Slug (міндетті емес)" htmlFor="comp-slug" hint="Бос болса автоматты жасалады.">
            <TextInput
              id="comp-slug"
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              className="font-mono text-sm"
              maxLength={120}
            />
          </Field>
          <Field label="Реттік нөмір" htmlFor="comp-order">
            <TextInput
              id="comp-order"
              type="number"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Сипаттама" htmlFor="comp-description" required>
          <TextArea
            id="comp-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="min-h-24"
          />
        </Field>
        <TextListEditor
          label="Индикаторлар"
          hint="Әр индикатор жеке тармақ. Оқушыға да, мұғалімге де көрінеді."
          items={indicators}
          onChange={setIndicators}
          placeholder="Индикатор мәтіні"
        />
        <CriteriaEditor value={criteria} onChange={setCriteria} />
        <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">English translation</summary><div className="mt-4 space-y-4">
          {(["title", "description"] as const).map((field) => <Field key={field} label={`English: ${field}`} htmlFor={`competency-en-${field}`}><TextArea id={`competency-en-${field}`} value={translationEn[field] ?? ""} onChange={(event) => setTranslationEn({ ...translationEn, [field]: event.target.value })} /></Field>)}
          <TextListEditor label="English indicators" items={translationEn.indicators_json?.length ? translationEn.indicators_json : [""]} onChange={(items) => setTranslationEn({ ...translationEn, indicators_json: items.filter((item) => item.trim()) })} />
          <p className="text-sm font-semibold">English criteria</p><CriteriaEditor value={translationEn.criteria_json ?? {}} onChange={(value) => setTranslationEn({ ...translationEn, criteria_json: value })} />
        </div></details>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatusField value={status} onChange={setStatus} />
          <DemoField checked={isDemo} onChange={setIsDemo} />
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" loading={save.isPending}>
          {initial ? "Өзгерістерді сақтау" : "Жазба жасау"}
        </Button>
      </form>
    </AdminEditorCard>
  );
}

export function AdminCompetenciesPage() {
  const t = useText();
  const label = useLabel();
  const { language } = usePreferences();
  useTitle(t("STEM құзыреттіліктері", "STEM competencies"));
  const queryClient = useQueryClient();
  const [editId, setEditId] = useEditParam();
  const isNew = editId === "new";
  const selectedId = isNew ? null : editId;
  const list = useQuery({
    queryKey: ["admin", "competencies"],
    queryFn: () => http.get<CompetencyCard[]>("/admin/competencies"),
  });
  const detail = useQuery({
    queryKey: ["admin", "competencies", "detail", selectedId],
    queryFn: () => http.get<AdminCompetency>(`/admin/competencies/${selectedId}`),
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
        title={t("STEM құзыреттіліктері", "STEM competencies")}
        description={t("Бес бағыт: индикаторлар, деңгей критерийлері және ML алгоритмдерімен байланыс. Диагностика нәтижелері осы құзыреттіліктер бойынша есептеледі.", "Manage indicators, level criteria, and links to ML algorithms for the five competencies.")}
        actions={
          <Button type="button" onClick={() => setEditId("new")}>
            <Plus className="size-4" aria-hidden />
            {t("Жаңа құзыреттілік", "New competency")}
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card className="self-start">
          <h2 className="text-sm font-bold text-ink-950">{t("Құзыреттіліктер", "Competencies")}</h2>
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
                  title={localizeCompetency(item, language).title}
                  meta={`${label(statusLabels[item.status] ?? item.status)}${item.is_demo ? t(" · демо", " · demo") : ""}`}
                  onClick={() => setEditId(item.id)}
                />
              ))}
            </div>
          )}
        </Card>
        <div>
          {isNew ? (
            <CompetencyEditor key="new" onSaved={refreshAndSelect} />
          ) : selectedId ? (
            detail.isLoading ? (
              <PageLoader />
            ) : detail.isError ? (
              <Alert tone="error">{errorMessage(detail.error)}</Alert>
            ) : detail.data ? (
              <CompetencyEditor
                key={detail.data.id}
                initial={detail.data}
                onSaved={refreshAndSelect}
              />
            ) : null
          ) : (
            <AdminEmptyEditor text={t("Құзыреттілікті таңдаңыз немесе жаңасын жасаңыз.", "Select a competency or create a new one.")} />
          )}
        </div>
      </div>
      <div className="mt-6">
        <DemoNotice>
          Индикаторлар мен критерийлер демо-рубрика болып табылады. Ғылыми негізделген
          түпкілікті нұсқаны тапсырыс беруші бекітеді.
        </DemoNotice>
      </div>
    </div>
  );
}
