import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  GraduationCap,
  ListChecks,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { downloadFile, errorMessage, http } from "@/shared/api";
import { answerLabels } from "@/shared/answerLabels";
import { pairedClassAverages } from "@/shared/classAverages";
import { AssignToClass } from "@/shared/components/ContentBits";
import { DiagnosticsChart } from "@/shared/components/DiagnosticsChart";
import { GradeRubric } from "@/shared/components/GradeRubric";
import { RichTextRenderer } from "@/shared/components/RichTextRenderer";
import {
  assessmentKindLabels,
  contentPath,
  formatDate,
  formatDateTime,
  formatDelta,
  formatPercent,
} from "@/shared/format";
import { useTitle } from "@/shared/hooks";
import { usePreferences, useText } from "@/shared/preferences";
import { localizeAssessment, localizeLesson, localizeProject, localizeTask } from "@/shared/localizeContent";
import type {
  AssessmentCard,
  Assignment,
  ClassResults,
  Classroom,
  ClassroomDetail,
  Page,
  ProjectCard,
  ProjectDetail,
  Submission,
  SubmissionList,
  LessonCard,
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
  ProgressBar,
  Select,
  StatCard,
  TextArea,
  TextInput,
} from "@/shared/ui";

function AssignmentStatusBadge({ status }: { status: string | null | undefined }) {
  const t = useText();
  if (status === "not_started") return <Badge tone="slate">{t("Басталмаған", "Not started")}</Badge>;
  if (status === "in_progress") return <Badge tone="blue">{t("Орындалуда", "In progress")}</Badge>;
  if (status === "submitted") return <Badge tone="amber">{t("Тапсырылды", "Submitted")}</Badge>;
  if (status === "reviewed") return <Badge tone="green">{t("Тексерілді", "Reviewed")}</Badge>;
  if (status === "returned") return <Badge tone="rose">{t("Қайта өңдеуге", "Returned")}</Badge>;
  if (status === "active") return <Badge tone="green">{t("Белсенді", "Active")}</Badge>;
  if (status === "closed") return <Badge tone="slate">{t("Жабық", "Closed")}</Badge>;
  return <Badge tone="slate">—</Badge>;
}

function toLocalInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function TeacherClassesPage() {
  const t = useText();
  useTitle(t("Сыныптар", "Classes"));
  const queryClient = useQueryClient();
  const classes = useQuery({
    queryKey: ["classes", "teacher"],
    queryFn: () => http.get<Page<Classroom>>("/classes?page_size=100"),
  });
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => http.post<Classroom>("/classes", { title: title.trim() }),
    onSuccess: () => {
      setTitle("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-dashboard"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  return (
    <div>
      <PageHeader
        eyebrow={t("Сыныптар", "Classes")}
        title={t("Сыныптарды басқару", "Manage classes")}
        description={t("Сынып жасаңыз, қосылу кодын оқушыларға беріңіз және тағайындауларды осы жерден бақылаңыз.", "Create a class, share its join code with students, and manage assignments here.")}
      />
      <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
        <Card>
          <h2 className="text-lg font-bold text-ink-950">{t("Жаңа сынып", "New class")}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {t("Атауы сынып журналындағыдай болсын, мысалы «9-А сыныбы».", "Use the class name from your register, for example Class 9-A.")}
          </p>
          <form
            className="mt-4 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (title.trim().length < 2) {
                setError(t("Сынып атауы кемінде 2 таңба болуы керек.", "The class name must contain at least two characters."));
                return;
              }
              create.mutate();
            }}
          >
            <Field label={t("Сынып атауы", "Class name")} htmlFor="class-title" required>
              <TextInput
                id="class-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("9-А сыныбы", "Class 9-A")}
                maxLength={160}
              />
            </Field>
            {error ? <Alert tone="error">{error}</Alert> : null}
            <Button type="submit" loading={create.isPending} className="w-full">
              <Plus className="size-4" aria-hidden />
              {t("Сынып жасау", "Create class")}
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          {classes.isLoading ? (
            <PageLoader />
          ) : classes.isError ? (
            <Alert tone="error">{errorMessage(classes.error)}</Alert>
          ) : (classes.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title={t("Сынып әлі жасалмаған", "No classes yet")}
              description={t("Сол жақтағы форма арқылы алғашқы сыныпты жасаңыз.", "Use the form to create your first class.")}
            />
          ) : (
            classes.data?.items.map((classroom) => (
              <Card key={classroom.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      to={`/teacher/classes/${classroom.id}`}
                      className="text-lg font-bold text-ink-950 no-underline hover:text-brand-800"
                    >
                      {classroom.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3.5" aria-hidden />
                        {classroom.member_count} {t("оқушы", "students")}
                      </span>
                      <span>·</span>
                      <span>
                        {t("Кіру коды", "Join code")}:{" "}
                        <span className="font-mono text-sm font-bold text-brand-700">
                          {classroom.join_code ?? "—"}
                        </span>
                      </span>
                      <span>·</span>
                      <span>{t("Құрылған", "Created")}: {formatDate(classroom.created_at)}</span>
                    </p>
                  </div>
                  <AssignmentStatusBadge status={classroom.status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <LinkButton to={`/teacher/classes/${classroom.id}`} size="sm">
                    {t("Сыныпты ашу", "Open class")}
                  </LinkButton>
                  <LinkButton
                    to={`/teacher/results?class=${classroom.id}`}
                    variant="secondary"
                    size="sm"
                  >
                    <BarChart3 className="size-4" aria-hidden />
                    {t("Нәтижелер", "Results")}
                  </LinkButton>
                  <LinkButton
                    to={`/teacher/assignments?class=${classroom.id}`}
                    variant="secondary"
                    size="sm"
                  >
                    <CalendarClock className="size-4" aria-hidden />
                    {t("Тағайындау", "Assign work")}
                  </LinkButton>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function TeacherClassDetailPage() {
  const { language } = usePreferences();
  const t = useText();
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const classroom = useQuery({
    queryKey: ["class", id],
    queryFn: () => http.get<ClassroomDetail>(`/classes/${id}`),
  });
  const assignments = useQuery({
    queryKey: ["assignments", "class", id],
    queryFn: () => http.get<Page<Assignment>>(`/assignments?page_size=100&classroom_id=${id}`),
  });
  const results = useQuery({
    queryKey: ["class-results", id],
    queryFn: () => http.get<ClassResults>(`/teacher/classes/${id}/results`),
    enabled: Boolean(id),
  });
  const [status, setStatus] = useState("");
  const update = useMutation({
    mutationFn: (payload: { title?: string; status?: string }) =>
      http.patch<Classroom>(`/classes/${id}`, payload),
    onSuccess: () => {
      setStatus("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["class", id] });
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });
  const regenerate = useMutation({
    mutationFn: () => http.post<Classroom>(`/classes/${id}/regenerate-code`),
    onSuccess: (updated) => {
      queryClient.setQueryData(["class", id], (current: ClassroomDetail | undefined) =>
        current ? { ...current, join_code: updated.join_code } : current,
      );
      setCopyMessage(t("Жаңа код берілді. Ескі код енді жұмыс істемейді.", "A new code was generated. The old code no longer works."));
      void queryClient.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  useTitle(classroom.data?.title ?? t("Сынып", "Class"));

  if (classroom.isLoading) return <PageLoader />;
  if (classroom.isError)
    return (
      <Alert tone="error" title={t("Сынып ашылмады", "Could not open class")}>
        {errorMessage(classroom.error)}
      </Alert>
    );
  const data = classroom.data;
  if (!data) return null;
  const pendingReviews =
    (assignments.data?.items ?? []).reduce(
      (sum, assignment) => sum + Math.max(0, assignment.submitted_count - assignment.reviewed_count),
      0,
    );

  async function copyCode() {
    if (!data?.join_code) return;
    try {
      await navigator.clipboard.writeText(data.join_code);
      setCopyMessage(t("Код көшірілді.", "Code copied."));
    } catch {
      setCopyMessage(`Код: ${data.join_code} (қолмен көшіріңіз)`);
    }
  }

  return (
    <div>
      <Link
        to="/teacher/classes"
        className="inline-flex items-center gap-1 text-sm font-semibold no-underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t("Сыныптар", "Classes")}
      </Link>
      <div className="mt-3">
        <PageHeader
          eyebrow={t("Сынып", "Class")}
          title={data.title}
          description={`Мұғалім: ${data.teacher_name ?? "—"} · Құрылған: ${formatDate(
            data.created_at,
          )} · Оқушылар: ${data.member_count}`}
          actions={
            <>
              <LinkButton to={`/teacher/assignments?class=${data.id}`} size="sm">
                <CalendarClock className="size-4" aria-hidden />
                Тағайындау
              </LinkButton>
              <LinkButton
                to={`/teacher/results?class=${data.id}`}
                variant="secondary"
                size="sm"
              >
                <BarChart3 className="size-4" aria-hidden />
                Нәтижелер
              </LinkButton>
            </>
          }
        />
      </div>

      {error ? (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("Оқушылар", "Students")} value={data.member_count} />
        <StatCard label={t("Тағайындаулар", "Assignments")} value={assignments.data?.total ?? 0} tone="blue" />
        <StatCard label={t("Тексеруді күтіп тұр", "Awaiting review")} value={pendingReviews} tone="amber" />
      </div>

      {results.data?.competency_averages.length ? (
        <Card className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-ink-950">{t("STEM динамикасы (орташа)", "STEM progress (average)")}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {t("Pre/post жұптары бар оқушылар бойынша орташа өзгеріс.", "Average change among students with paired pre/post results.")}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setError(null);
                void downloadFile(
                  `/teacher/classes/${data.id}/results.csv`,
                  `class-${data.title.replace(/\s+/g, "-")}-results.csv`,
                ).catch((downloadError) => setError(errorMessage(downloadError)));
              }}
            >
              <Download className="size-4" aria-hidden />
              {t("CSV жүктеу", "Download CSV")}
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.data.competency_averages.map((row) => (
              <div key={row.competency_id} className="rounded-xl border border-slate-200 p-3.5">
                <p className="text-sm font-semibold text-slate-800">{row.title}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Pre: {formatPercent(row.pre_average)} · Post: {formatPercent(row.post_average)}
                </p>
                <p className="mt-1 text-sm font-bold text-brand-700">
                  {formatDelta(row.delta_average_pp)}
                </p>
                <div className="mt-2">
                  <ProgressBar value={row.post_average ?? 0} />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Деректер: pre {row.students_with_pre} · post {row.students_with_post} оқушы
                </p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Card>
            <h2 className="text-lg font-bold text-ink-950">{t("Оқушылар", "Students")}</h2>
            {data.members.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                {t("Әзірге оқушы қосылмаған. Кіру кодын беріңіз.", "No students have joined yet. Share the join code.")}
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2">{t("Оқушы", "Student")}</th>
                      <th className="px-3 py-2">{t("Қосылған күні", "Joined")}</th>
                      <th className="px-3 py-2 text-right">{t("Нәтиже", "Result")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.members.map((member) => (
                      <tr key={member.student_id} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-800">
                          {member.display_name}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{formatDate(member.joined_at)}</td>
                        <td className="px-3 py-2 text-right">
                          <Link
                            to={`/teacher/results?class=${data.id}`}
                            className="text-xs font-semibold no-underline"
                          >
                            {t("Қарау", "View")}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink-950">{t("Тағайындаулар", "Assignments")}</h2>
              <Link
                to={`/teacher/assignments?class=${data.id}`}
                className="text-xs font-semibold no-underline"
              >
                {t("Барлығын басқару", "Manage all")}
              </Link>
            </div>
            {assignments.isLoading ? (
              <PageLoader />
            ) : assignments.isError ? (
              <div className="mt-3">
                <Alert tone="error">{errorMessage(assignments.error)}</Alert>
              </div>
            ) : (assignments.data?.items.length ?? 0) === 0 ? (
              <div className="mt-3">
                <EmptyState
                  title={t("Тағайындау жоқ", "No assignments")}
                  description={t("Сабақ, тапсырма, жоба немесе диагностика тағайындаңыз.", "Assign a lesson, task, project, or assessment.")}
                  action={
                    <LinkButton to={`/teacher/assignments?class=${data.id}`}>
                      {t("Тағайындау жасау", "Create assignment")}
                    </LinkButton>
                  }
                />
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {assignments.data?.items.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div className="min-w-0">
                      <Link
                        to={`/teacher/reviews/${assignment.id}`}
                        className="block truncate text-sm font-semibold text-ink-950 no-underline hover:text-brand-800"
                      >
                        {language === "en" ? assignment.content_title_en || assignment.content_title : assignment.content_title}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {assignment.content_type === "assessment" ? "Диагностика" : "Жұмыс"} ·
                        дедлайн: {formatDateTime(assignment.due_at)} · тапсырылды:{" "}
                        {assignment.submitted_count}/{assignment.total_students} · тексерілді:{" "}
                        {assignment.reviewed_count}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <AssignmentStatusBadge status={assignment.status} />
                      <Link
                        to={`/teacher/reviews/${assignment.id}`}
                        className="text-xs font-semibold no-underline"
                      >
                        {t("Тексеру", "Review")}
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4">
          <Card>
            <h2 className="text-sm font-bold text-ink-950">{t("Қосылу коды", "Join code")}</h2>
            <p className="mt-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-3 text-center font-mono text-2xl font-extrabold tracking-[0.25em] text-brand-900">
              {data.join_code ?? "—"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => void copyCode()}>
                <Copy className="size-4" aria-hidden />
                {t("Көшіру", "Copy")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                loading={regenerate.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      "Кодты жаңартқанда ескі код жұмыс істемейді. Жалғастырасыз ба?",
                    )
                  ) {
                    regenerate.mutate();
                  }
                }}
              >
                <RefreshCw className="size-4" aria-hidden />
                {t("Жаңарту", "Regenerate")}
              </Button>
            </div>
            {copyMessage ? (
              <p className="mt-2 text-xs font-semibold text-brand-700">{copyMessage}</p>
            ) : null}
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Кодты тек сынып оқушыларына беріңіз. Оқушы «Менің сыныбым» бетінде енгізеді.
            </p>
          </Card>

          <Card>
            <h2 className="text-sm font-bold text-ink-950">{t("Сынып мәртебесі", "Class status")}</h2>
            <div className="mt-2"><AssignmentStatusBadge status={data.status} /></div>
            <form
              className="mt-3 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!status) return;
                update.mutate({ status });
              }}
            >
              <Field label={t("Мәртебені өзгерту", "Change status")} htmlFor="class-status">
                <Select
                  id="class-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="">{t("Таңдаңыз", "Select")}</option>
                  <option value="active">{t("Белсенді", "Active")}</option>
                  <option value="archived">{t("Мұрағаттау", "Archive")}</option>
                </Select>
              </Field>
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                loading={update.isPending}
                disabled={!status}
              >
                {t("Сақтау", "Save")}
              </Button>
            </form>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Мұрағатталған сыныпқа жаңа тағайындау жасау шектелуі мүмкін; бұрынғы жұмыстар
              сақталады.
            </p>
          </Card>
          <DemoNotice />
        </aside>
      </div>
    </div>
  );
}

function useContentOptions(type: string) {
  const { language } = usePreferences();
  return useQuery({
    queryKey: ["content-options", type, language],
    enabled: Boolean(type),
    queryFn: async () => {
      if (type === "assessment") {
        const data = await http.get<Page<AssessmentCard>>("/assessments?page_size=100");
        return data.items.map((item) => ({ id: item.id, title: localizeAssessment(item, language).name }));
      }
      if (type === "lesson") {
        const data = await http.get<Page<LessonCard>>("/lessons?page_size=100");
        return data.items.map((item) => ({ id: item.id, title: localizeLesson(item, language).title }));
      }
      if (type === "task") {
        const data = await http.get<Page<TaskCard>>("/tasks?page_size=100");
        return data.items.map((item) => ({ id: item.id, title: localizeTask(item, language).title }));
      }
      const data = await http.get<Page<ProjectCard>>("/projects?page_size=100");
      return data.items.map((item) => ({ id: item.id, title: localizeProject(item, language).title }));
    },
  });
}

function AssignmentBuilder({
  classes,
  defaultClassId,
  onCreated,
}: {
  classes: Classroom[];
  defaultClassId?: string;
  onCreated: () => void;
}) {
  const t = useText();
  const [classroomId, setClassroomId] = useState(defaultClassId ?? "");
  const [contentType, setContentType] = useState<"lesson" | "task" | "project" | "assessment">(
    "lesson",
  );
  const [contentId, setContentId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const options = useContentOptions(contentType);

  const create = useMutation({
    mutationFn: () =>
      http.post<Assignment>("/assignments", {
        classroom_id: classroomId,
        content_type: contentType,
        content_id: contentId,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        notes: notes.trim() || null,
      }),
    onSuccess: (assignment) => {
      setMessage(t(`«${assignment.content_title}» «${assignment.classroom_title}» сыныбына тағайындалды.`, `“${assignment.content_title}” was assigned to ${assignment.classroom_title}.`));
      setError(null);
      setContentId("");
      onCreated();
    },
    onError: (mutationError) => {
      setMessage(null);
      setError(errorMessage(mutationError));
    },
  });

  return (
    <Card>
      <h2 className="text-lg font-bold text-ink-950">{t("Жаңа тағайындау", "New assignment")}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {t("Тек жарияланған материалдарды тағайындауға болады. Бір материалды бір сыныпқа қайта тағайындау дубль жасамайды.", "Only published material can be assigned. Assigning the same material to a class again does not create a duplicate.")}
      </p>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (!classroomId || !contentId) {
            setError(t("Сынып пен материалды таңдаңыз.", "Select a class and material."));
            return;
          }
          create.mutate();
        }}
      >
        <Field label={t("Сынып", "Class")} htmlFor="builder-class" required>
          <Select
            id="builder-class"
            value={classroomId}
            onChange={(event) => setClassroomId(event.target.value)}
          >
            <option value="">{t("Таңдаңыз", "Select")}</option>
            {classes.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.title} ({classroom.member_count} {t("оқушы", "students")})
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Материал түрі", "Material type")} htmlFor="builder-type" required>
          <Select
            id="builder-type"
            value={contentType}
            onChange={(event) => {
              setContentType(
                event.target.value as "lesson" | "task" | "project" | "assessment",
              );
              setContentId("");
            }}
          >
            <option value="lesson">{t("Сабақ", "Lesson")}</option>
            <option value="task">{t("Тапсырма", "Task")}</option>
            <option value="project">{t("Жоба", "Project")}</option>
            <option value="assessment">{t("Диагностика", "Assessment")}</option>
          </Select>
        </Field>
        <Field
          label={t("Материал", "Material")}
          htmlFor="builder-content"
          required
          hint={options.isLoading ? t("Жүктелуде...", "Loading...") : undefined}
        >
          <Select
            id="builder-content"
            value={contentId}
            onChange={(event) => setContentId(event.target.value)}
            disabled={options.isLoading || options.isError}
          >
            <option value="">{t("Таңдаңыз", "Select")}</option>
            {(options.data ?? []).map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("Дедлайн (міндетті емес)", "Deadline (optional)")} htmlFor="builder-due">
          <TextInput
            id="builder-due"
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("Ескертпе (міндетті емес)", "Notes (optional)")} htmlFor="builder-notes">
            <TextArea
              id="builder-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-20"
              maxLength={1000}
              placeholder={t("Орындау шарттары, қосымша нұсқаулық...", "Requirements or additional instructions...")}
            />
          </Field>
        </div>
        {options.isError ? (
          <div className="sm:col-span-2">
            <Alert tone="error">{errorMessage(options.error)}</Alert>
          </div>
        ) : null}
        {message ? (
          <div className="sm:col-span-2">
            <Alert tone="success">{message}</Alert>
          </div>
        ) : null}
        {error ? (
          <div className="sm:col-span-2">
            <Alert tone="error">{error}</Alert>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <Button type="submit" loading={create.isPending}>
            <Plus className="size-4" aria-hidden />
            {t("Тағайындау", "Assign")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function TeacherAssignmentsPage() {
  const t = useText();
  const { language } = usePreferences();
  useTitle(t("Тағайындаулар", "Assignments"));
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const classFilter = searchParams.get("class") ?? "";
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editDue, setEditDue] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const classes = useQuery({
    queryKey: ["classes", "teacher"],
    queryFn: () => http.get<Page<Classroom>>("/classes?page_size=100"),
  });
  const assignments = useQuery({
    queryKey: ["assignments", "teacher", "manage", classFilter, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page_size: "100" });
      if (classFilter) params.set("classroom_id", classFilter);
      if (typeFilter) params.set("content_type", typeFilter);
      return http.get<Page<Assignment>>(`/assignments?${params.toString()}`);
    },
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["assignments"] });
    void queryClient.invalidateQueries({ queryKey: ["teacher-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["class-results"] });
  };

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      http.patch<Assignment>(`/assignments/${id}`, { status }),
    onSuccess: refresh,
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });
  const updateDetails = useMutation({
    mutationFn: (id: string) =>
      http.patch<Assignment>(`/assignments/${id}`, {
        due_at: editDue ? new Date(editDue).toISOString() : null,
        notes: editNotes.trim() || null,
      }),
    onSuccess: () => {
      setEditId(null);
      setError(null);
      refresh();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (assignments.data?.items ?? []).filter((assignment) => {
      if (statusFilter && assignment.status !== statusFilter) return false;
      if (!term) return true;
      return (
        assignment.content_title.toLowerCase().includes(term) || (assignment.content_title_en ?? "").toLowerCase().includes(term) ||
        assignment.classroom_title.toLowerCase().includes(term)
      );
    });
  }, [assignments.data?.items, statusFilter, search]);

  return (
    <div>
      <PageHeader
        eyebrow={t("Тағайындаулар", "Assignments")}
        title={t("Сынып жұмыстары", "Class assignments")}
        description={t("Сабақ, тапсырма, жоба және диагностиканы сыныпқа тағайындаңыз. Мұнда дедлайнды өзгертіп, тағайындауды жабуға болады.", "Assign lessons, tasks, projects, and assessments to a class. Change deadlines or close assignments here.")}
        actions={
          <LinkButton to="/teacher/reviews" variant="secondary">
            <ClipboardCheck className="size-4" aria-hidden />
            {t("Тексерулер", "Reviews")}
          </LinkButton>
        }
      />

      {error ? (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <div className="space-y-4">
          <Card>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400"
                  aria-hidden
                />
                <TextInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("Іздеу...", "Search...")}
                  className="pl-9"
                  aria-label={t("Тағайындау іздеу", "Search assignments")}
                />
              </div>
              <Select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label={t("Материал түрі", "Material type")}
              >
                <option value="">{t("Барлық түрлер", "All types")}</option>
                <option value="lesson">{t("Сабақ", "Lesson")}</option>
                <option value="task">{t("Тапсырма", "Task")}</option>
                <option value="project">{t("Жоба", "Project")}</option>
                <option value="assessment">{t("Диагностика", "Assessment")}</option>
              </Select>
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label={t("Тағайындау мәртебесі", "Assignment status")}
              >
                <option value="">{t("Барлық мәртебе", "All statuses")}</option>
                <option value="active">{t("Белсенді", "Active")}</option>
                <option value="closed">{t("Жабық", "Closed")}</option>
              </Select>
            </div>
            {classFilter ? (
              <p className="mt-3 text-xs text-slate-500">
                {t("Сынып бойынша сүзілген", "Filtered by class")}:{" "}
                <strong>
                  {classes.data?.items.find((item) => item.id === classFilter)?.title ?? classFilter}
                </strong>
                .{" "}
                <Link to="/teacher/assignments" className="font-semibold no-underline">
                  {t("Сүзгіні тазалау", "Clear filter")}
                </Link>
              </p>
            ) : null}
          </Card>

          {assignments.isLoading ? (
            <PageLoader />
          ) : assignments.isError ? (
            <Alert tone="error">{errorMessage(assignments.error)}</Alert>
          ) : filtered.length === 0 ? (
            <EmptyState
              title={t("Тағайындау табылмады", "No assignments found")}
              description={t("Сүзгілерді өзгертіңіз немесе жаңа тағайындау жасаңыз.", "Change the filters or create an assignment.")}
            />
          ) : (
            filtered.map((assignment) => (
              <Card key={assignment.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink-950">{language === "en" ? assignment.content_title_en || assignment.content_title : assignment.content_title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {assignment.classroom_title} · {t("Дедлайн", "Deadline")}: {formatDateTime(assignment.due_at)} ·{" "}
                      {assignment.submitted_count}/{assignment.total_students} {t("тапсырылды", "submitted")} ·{" "}
                      {assignment.reviewed_count} {t("тексерілді", "reviewed")}
                    </p>
                    {assignment.notes ? (
                      <p className="mt-1 text-xs text-slate-600">{assignment.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <AssignmentStatusBadge status={assignment.status} />
                    <Badge tone="slate">
                      {assignment.content_type === "assessment"
                        ? t("Диагностика", "Assessment")
                        : assignment.content_type === "lesson"
                          ? t("Сабақ", "Lesson")
                          : assignment.content_type === "task"
                            ? t("Тапсырма", "Task")
                            : t("Жоба", "Project")}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {assignment.content_type !== "assessment" ? (
                    <Link
                      to={contentPath("teacher", assignment.content_type, assignment.content_id)}
                      className="text-xs font-semibold no-underline"
                    >
                      {t("Материалды ашу", "Open material")}
                    </Link>
                  ) : null}
                  <Link
                    to={`/teacher/reviews/${assignment.id}`}
                    className="text-xs font-semibold no-underline"
                  >
                    {t("Жұмыстарды тексеру", "Review submissions")}
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (editId === assignment.id) {
                        setEditId(null);
                        return;
                      }
                      setEditId(assignment.id);
                      setEditDue(toLocalInput(assignment.due_at));
                      setEditNotes(assignment.notes ?? "");
                    }}
                  >
                    <FileText className="size-3.5" aria-hidden />
                    {t("Өңдеу", "Edit")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    loading={
                      updateStatus.isPending && updateStatus.variables?.id === assignment.id
                    }
                    onClick={() =>
                      updateStatus.mutate({
                        id: assignment.id,
                        status: assignment.status === "active" ? "closed" : "active",
                      })
                    }
                  >
                    {assignment.status === "active" ? t("Жабу", "Close") : t("Қайта ашу", "Reopen")}
                  </Button>
                </div>
                {editId === assignment.id ? (
                  <form
                    className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      updateDetails.mutate(assignment.id);
                    }}
                  >
                    <Field label={t("Дедлайн", "Deadline")} htmlFor={`due-${assignment.id}`}>
                      <TextInput
                        id={`due-${assignment.id}`}
                        type="datetime-local"
                        value={editDue}
                        onChange={(event) => setEditDue(event.target.value)}
                      />
                    </Field>
                    <Field label={t("Ескертпе", "Notes")} htmlFor={`notes-${assignment.id}`}>
                      <TextArea
                        id={`notes-${assignment.id}`}
                        value={editNotes}
                        onChange={(event) => setEditNotes(event.target.value)}
                        className="min-h-20"
                        maxLength={1000}
                      />
                    </Field>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        loading={updateDetails.isPending}
                      >
                        {t("Сақтау", "Save")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditId(null)}
                      >
                        {t("Болдырмау", "Cancel")}
                      </Button>
                    </div>
                  </form>
                ) : null}
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          {classes.isLoading ? (
            <PageLoader />
          ) : (
            <AssignmentBuilder
              classes={classes.data?.items ?? []}
              defaultClassId={classFilter || undefined}
              onCreated={refresh}
            />
          )}
          <Card className="bg-slate-50">
            <h2 className="text-sm font-bold text-ink-950">{t("Тағайындау ережелері", "Assignment rules")}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-5 text-slate-600">
              <li>{t("Тек жарияланған материалдар қолжетімді.", "Only published materials are available.")}</li>
              <li>{t("Жабылған тағайындауға оқушы жаңа жауап жібере алмайды.", "Students cannot submit new work to a closed assignment.")}</li>
              <li>{t("Дедлайн өткенімен, мұғалім қайта аша алады.", "A teacher can reopen an assignment after its deadline.")}</li>
              <li>{t("Бір материал бір сыныпқа бір рет тағайындалады.", "Each material can be assigned once per class.")}</li>
            </ul>
          </Card>
          <DemoNotice />
        </div>
      </div>
    </div>
  );
}

export function TeacherReviewsPage() {
  const t = useText();
  const { language } = usePreferences();
  useTitle(t("Тексерулер", "Reviews"));
  const [search, setSearch] = useState("");
  const assignments = useQuery({
    queryKey: ["assignments", "teacher", "reviews"],
    queryFn: () => http.get<Page<Assignment>>("/assignments?page_size=100"),
  });
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (assignments.data?.items ?? []).filter((assignment) => {
      if (assignment.content_type === "lesson") return false;
      if (!term) return true;
      return (
        assignment.content_title.toLowerCase().includes(term) || (assignment.content_title_en ?? "").toLowerCase().includes(term) ||
        assignment.classroom_title.toLowerCase().includes(term)
      );
    });
  }, [assignments.data?.items, search]);
  const pending = rows.reduce(
    (sum, assignment) => sum + Math.max(0, assignment.submitted_count - assignment.reviewed_count),
    0,
  );

  return (
    <div>
      <PageHeader
        eyebrow={t("Тексерулер", "Reviews")}
        title={t("Оқушы жұмыстарын тексеру", "Review student work")}
        description={t("Жабық тесттер серверде автоматты тексеріледі; ашық жұмыстар мен жобаларды мұғалім рубрика бойынша бағалайды.", "Closed questions are graded automatically; teachers assess open work and projects using rubrics.")}
        actions={
          <LinkButton to="/teacher/assignments" variant="secondary">
            <CalendarClock className="size-4" aria-hidden />
            {t("Тағайындаулар", "Assignments")}
          </LinkButton>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label={t("Тағайындаулар", "Assignments")} value={rows.length} />
        <StatCard label={t("Тексеруді күтіп тұр", "Awaiting review")} value={pending} tone="amber" />
        <StatCard
          label={t("Тексерілген жұмыстар", "Reviewed work")}
          value={rows.reduce((sum, item) => sum + item.reviewed_count, 0)}
          tone="blue"
        />
      </div>
      <div className="mb-4 max-w-md">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400"
            aria-hidden
          />
          <TextInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("Материал немесе сынып бойынша іздеу...", "Search by material or class...")}
            className="pl-9"
            aria-label={t("Тексеру іздеу", "Search reviews")}
          />
        </div>
      </div>
      {assignments.isLoading ? (
        <PageLoader />
      ) : assignments.isError ? (
        <Alert tone="error">{errorMessage(assignments.error)}</Alert>
      ) : (assignments.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title={t("Тексеруге жұмыс жоқ", "No work to review")}
          description={t("Алдымен сыныпқа тапсырма немесе жоба тағайындаңыз.", "First assign a task or project to a class.")}
          action={<LinkButton to="/teacher/assignments">{t("Тағайындау жасау", "Create assignment")}</LinkButton>}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-2.5">{t("Материал", "Material")}</th>
                  <th className="px-4 py-2.5">{t("Сынып", "Class")}</th>
                  <th className="px-4 py-2.5 text-right">{t("Тапсырылды", "Submitted")}</th>
                  <th className="px-4 py-2.5 text-right">{t("Тексерілді", "Reviewed")}</th>
                  <th className="px-4 py-2.5 text-right">{t("Күтіп тұр", "Pending")}</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((assignment) => {
                  const waiting = Math.max(
                    0,
                    assignment.submitted_count - assignment.reviewed_count,
                  );
                  return (
                    <tr key={assignment.id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-ink-950">{language === "en" ? assignment.content_title_en || assignment.content_title : assignment.content_title}</p>
                        <p className="text-xs text-slate-500">
                          {t("Дедлайн", "Deadline")}: {formatDateTime(assignment.due_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{assignment.classroom_title}</td>
                      <td className="px-4 py-3 text-right">
                        {assignment.submitted_count}/{assignment.total_students}
                      </td>
                      <td className="px-4 py-3 text-right">{assignment.reviewed_count}</td>
                      <td className="px-4 py-3 text-right">
                        {waiting > 0 ? (
                          <Badge tone="amber">{waiting}</Badge>
                        ) : (
                          <Badge tone="green">0</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/teacher/reviews/${assignment.id}`}
                          className="text-xs font-semibold no-underline"
                        >
                          {t("Ашу", "Open")}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="mt-6">
        <DemoNotice />
      </div>
    </div>
  );
}

export function TeacherReviewDetailPage() {
  const t = useText();
  const { language } = usePreferences();
  const { id = "" } = useParams();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const assignment = useQuery({
    queryKey: ["assignment", id],
    queryFn: () => http.get<Assignment>(`/assignments/${id}`),
  });
  const submissions = useQuery({
    queryKey: ["assignment-submissions", id],
    queryFn: () => http.get<SubmissionList>(`/assignments/${id}/submissions`),
  });
  const task = useQuery({
    queryKey: ["review-task", assignment.data?.content_id],
    queryFn: () => http.get<TaskDetail>(
      `/tasks/${assignment.data?.content_id}`,
    ),
    enabled: Boolean(assignment.data && assignment.data.content_type === "task"),
  });
  const project = useQuery({
    queryKey: ["review-project", assignment.data?.content_id],
    queryFn: () =>
      http.get<ProjectDetail>(
        `/projects/${assignment.data?.content_id}`,
      ),
    enabled: Boolean(assignment.data && assignment.data.content_type === "project"),
  });
  const selected =
    submissions.data?.items.find((item) => item.id === selectedId) ??
    submissions.data?.items[0] ??
    null;

  const review = useMutation({
    mutationFn: (payload: {
      grade: number;
      feedback: string;
      return_for_revision: boolean;
    }) => http.patch<Submission>(`/submissions/${selected?.id}/review`, payload),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["assignment-submissions", id] });
      void queryClient.invalidateQueries({ queryKey: ["assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["class-results"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-dashboard"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  useTitle(assignment.data ? (language === "en" ? assignment.data.content_title_en || assignment.data.content_title : assignment.data.content_title) : t("Тексеру", "Review"));

  if (assignment.isLoading) return <PageLoader />;
  if (assignment.isError)
    return (
      <Alert tone="error" title={t("Тағайындау ашылмады", "Could not open assignment")}>
        {errorMessage(assignment.error)}
      </Alert>
    );
  const data = assignment.data;
  if (!data) return null;
  const rubric = task.data ? localizeTask(task.data, language).rubric_json : project.data ? localizeProject(project.data, language).rubric_json : [];
  const maxScore = selected?.max_score ?? data.max_score ?? 100;
  const closedAnswers = selected?.answers_json?.selected_option_ids ?? [];

  return (
    <div>
      <Link
        to="/teacher/reviews"
        className="inline-flex items-center gap-1 text-sm font-semibold no-underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t("Тексерулер", "Reviews")}
      </Link>
      <PageHeader
        eyebrow={`${data.classroom_title} · ${formatDateTime(data.due_at)}`}
        title={language === "en" ? data.content_title_en || data.content_title : data.content_title}
        description={`Барлығы ${submissions.data?.total_students ?? data.total_students} оқушы · тапсырылды ${
          submissions.data?.submitted_count ?? data.submitted_count
        } · тексерілді ${submissions.data?.reviewed_count ?? data.reviewed_count}`}
      />

      {error ? (
        <div className="mb-4">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}

      {submissions.data?.students.length ? (
        <Card className="mb-6">
          <h2 className="text-sm font-bold text-ink-950">{t("Сынып оқушыларының мәртебесі", "Student status in this class")}</h2>
          <ul className="mt-3 divide-y divide-slate-200">
            {submissions.data.students.map((student) => (
              <li key={student.student_id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>{student.display_name}</span><AssignmentStatusBadge status={student.status} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {submissions.isLoading ? (
        <PageLoader />
      ) : submissions.isError ? (
        <Alert tone="error">{errorMessage(submissions.error)}</Alert>
      ) : (submissions.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title={t("Әзірге тапсырылған жұмыс жоқ", "No submissions yet")}
          description={t("Оқушылар жұмысты жібергенде ол осы жерде пайда болады.", "Student submissions will appear here.")}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
          <Card className="self-start">
            <h2 className="text-sm font-bold text-ink-950">{t("Оқушы жұмыстары", "Student submissions")}</h2>
            <ul className="mt-3 space-y-1.5">
              {submissions.data?.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                      selected?.id === item.id
                        ? "border-brand-400 bg-brand-50"
                        : "border-slate-200 bg-white hover:border-brand-300"
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink-950">
                        {item.student_name ?? t("Оқушы", "Student")}
                      </span>
                      <AssignmentStatusBadge status={item.status} />
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {formatDateTime(item.submitted_at)} · {t("баға", "grade")}: {item.grade ?? "—"}/
                      {item.max_score ?? data.max_score ?? "—"}
                    </span>
                    {item.auto_checked ? (
                      <span className="mt-1 inline-flex text-[10px] font-bold text-brand-700 uppercase">
                        {t("Автоматты тексерілген", "Automatically graded")}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <div className="space-y-4">
            {selected ? (
              <>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="text-lg font-bold text-ink-950">
                        {selected.student_name ?? t("Оқушының жауабы", "Student response")}
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        {t("Тапсырылған", "Submitted")}: {formatDateTime(selected.submitted_at)} · {t("Талпыныс", "Attempt")}:{" "}
                        {selected.attempts_count}
                      </p>
                    </div>
                    <AssignmentStatusBadge status={selected.status} />
                  </div>

                  {selected.text ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                        {t("Мәтіндік жауап", "Text response")}
                      </p>
                      <div className="mt-2 text-sm leading-6 text-slate-700">
                        <RichTextRenderer html={selected.text} />
                      </div>
                    </div>
                  ) : null}

                  {selected.link ? (
                    <p className="mt-3 text-sm">
                      {t("Сілтеме", "Link")}:{" "}
                      <a
                        href={selected.link}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold break-all"
                      >
                        {selected.link}
                      </a>
                    </p>
                  ) : null}

                  {selected.files.length > 0 ? (
                    <div className="mt-4">
                      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                        {t("Файлдар", "Files")}
                      </p>
                      <ul className="mt-2 space-y-1.5">
                        {selected.files.map((file) => (
                          <li
                            key={file.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          >
                            <span className="truncate">{file.filename}</span>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700"
                              onClick={() => {
                                setError(null);
                                void downloadFile(file.download_url, file.filename).catch(
                                  (downloadError) => setError(errorMessage(downloadError)),
                                );
                              }}
                            >
                              <Download className="size-3.5" aria-hidden />
                              {t("Жүктеу", "Download")}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {closedAnswers.length > 0 ? (
                    <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3.5">
                      <p className="text-xs font-bold tracking-wide text-brand-800 uppercase">
                        {t("Таңдалған жауаптар", "Selected answers")}
                      </p>
                      <p className="mt-1 text-sm text-brand-950">
                        {answerLabels(closedAnswers, task.data ? localizeTask(task.data, language).options : []).join(", ")}
                      </p>
                      {selected.correct_labels?.length ? (
                        <p className="mt-1 text-xs text-brand-700">
                          {t("Дұрыс жауап", "Correct answer")}: {answerLabels(selected.correct_option_ids ?? [], task.data ? localizeTask(task.data, language).options : []).join(", ") || selected.correct_labels.join(", ")}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {selected.feedback ? (
                    <div className="mt-4">
                      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                        {t("Соңғы пікір", "Latest feedback")}
                      </p>
                      <p className="mt-1 text-sm text-slate-700">{selected.feedback}</p>
                    </div>
                  ) : null}
                </Card>

                <Card>
                  <h2 className="text-lg font-bold text-ink-950">
                    {selected.auto_checked ? t("Бағаны растау / өзгерту", "Confirm or change grade") : t("Бағалау", "Grade")}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {selected.auto_checked
                      ? t("Жабық тапсырма автоматты тексерілді. Қажет болса бағаны мұғалім ретінде өзгерте аласыз.", "This task was graded automatically. You can change the grade if needed.")
                      : t("Рубрика критерийлерін белгілеңіз немесе бағаны қолмен қойыңыз.", "Select rubric criteria or enter a grade manually.")}
                  </p>
                  <div className="mt-4">
                    <GradeRubric
                      key={selected.id}
                      rubric={rubric}
                      maxScore={maxScore}
                      initialGrade={selected.grade}
                      initialFeedback={selected.feedback}
                      submitting={review.isPending}
                      onSubmit={async (payload) => {
                        await review.mutateAsync(payload);
                      }}
                    />
                  </div>
                </Card>
              </>
            ) : null}
          </div>
        </div>
      )}
      <div className="mt-6">
        <DemoNotice />
      </div>
    </div>
  );
}

export function TeacherDiagnosticsPage() {
  const t = useText();
  const { language } = usePreferences();
  useTitle(t("Диагностика", "Assessments"));
  const [kind, setKind] = useState("");
  const assessments = useQuery({
    queryKey: ["teacher-assessments", kind],
    queryFn: () =>
      http.get<Page<AssessmentCard>>(
        `/assessments?page_size=100${kind ? `&kind=${kind}` : ""}`,
      ),
  });
  const classes = useQuery({
    queryKey: ["classes", "teacher"],
    queryFn: () => http.get<Page<Classroom>>("/classes?page_size=100"),
  });

  return (
    <div>
      <PageHeader
        eyebrow={t("Диагностика", "Assessments")}
        title={t("Pre-test және post-test", "Pre-test and post-test")}
        description={t("Мұғалім диагностиканы сыныпқа тағайындайды. Нәтижелер оқушының «Нәтижелер» бетінде және сынып есебінде агрегатталады.", "Assign assessments to a class. Results appear in student results and class reports.")}
        actions={
          <LinkButton to="/teacher/results" variant="secondary">
            <BarChart3 className="size-4" aria-hidden />
            {t("Сынып нәтижелері", "Class results")}
          </LinkButton>
        }
      />
      <div className="mb-5 max-w-xs">
        <Select
          value={kind}
          onChange={(event) => setKind(event.target.value)}
          aria-label={t("Диагностика түрі", "Assessment type")}
        >
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
        <EmptyState
          title={t("Диагностика табылмады", "No assessments found")}
          description={t("Әкімші CMS-те диагностика жасап, жариялауы керек.", "An administrator must create and publish an assessment.")}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {assessments.data?.items.map((assessment) => (
            <Card key={assessment.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-ink-950">{localizeAssessment(assessment, language).name}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {assessmentKindLabels[assessment.kind] ?? assessment.kind} ·{" "}
                    {assessment.question_count} {t("сұрақ", "questions")} · {assessment.max_score} {t("балл", "points")} · v
                    {assessment.version}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {assessment.is_demo ? <Badge tone="amber">{t("Демо", "Demo")}</Badge> : null}
                  <Badge tone="slate">{t("Әдістеме", "Methodology")}: {assessment.methodology_key}</Badge>
                </div>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{localizeAssessment(assessment, language).description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <GraduationCap className="size-3.5" aria-hidden />
                  {t("Талпыныс лимиті", "Attempt limit")}: {assessment.attempts_limit}
                </span>

              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <AssignToClass
                  contentType="assessment"
                  contentId={assessment.id}
                  label={t("Сыныпқа тағайындау", "Assign to class")}
                />
                <LinkButton
                  to={`/teacher/results?assessment=${assessment.id}`}
                  variant="secondary"
                  size="sm"
                >
                  {t("Нәтижелер", "Results")}
                </LinkButton>
              </div>
            </Card>
          ))}
        </div>
      )}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(classes.data?.items ?? []).map((classroom) => (
          <Link
            key={classroom.id}
            to={`/teacher/results?class=${classroom.id}`}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 no-underline hover:border-brand-300"
          >
            <span>
              <span className="block text-sm font-semibold text-ink-950">{classroom.title}</span>
              <span className="text-xs text-slate-500">{classroom.member_count} {t("оқушы", "students")}</span>
            </span>
            <BarChart3 className="size-4 text-brand-700" aria-hidden />
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <DemoNotice>
          {t("Порогтық деңгейлер мен scoring конфигурациясы демо-үлгіде. Pre/post салыстыруы бір әдістеме кілті шегінде ғана жүргізіледі.", "Thresholds and scoring settings are demo values. Pre/post comparisons use the same methodology key.")}
        </DemoNotice>
      </div>
    </div>
  );
}

export function TeacherResultsPage() {
  const { language } = usePreferences();
  const t = useText();
  useTitle(t("Нәтижелер", "Results"));
  const [searchParams, setSearchParams] = useSearchParams();
  const classParam = searchParams.get("class") ?? "";
  const [error, setError] = useState<string | null>(null);
  const classes = useQuery({
    queryKey: ["classes", "teacher"],
    queryFn: () => http.get<Page<Classroom>>("/classes?page_size=100"),
  });
  const classId = classParam || classes.data?.items[0]?.id || "";
  const results = useQuery({
    queryKey: ["class-results", classId],
    queryFn: () => http.get<ClassResults>(`/teacher/classes/${classId}/results`),
    enabled: Boolean(classId),
  });

  const pairedAverage = pairedClassAverages(results.data?.students ?? []);

  return (
    <div>
      <PageHeader
        eyebrow={t("Нәтижелер", "Results")}
        title={t("Сынып нәтижелері және CSV", "Class results and CSV")}
        description={t("Оқушы прогресі, орташа бағалар және STEM құзыреттіліктері бойынша pre/post өзгерісі. CSV Excel үшін UTF-8 BOM форматында беріледі.", "Student progress, average grades, and pre/post changes in STEM competencies. CSV uses UTF-8 BOM for Excel.")}
        actions={
          results.data ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setError(null);
                void downloadFile(
                  `/teacher/classes/${results.data?.classroom_id}/results.csv`,
                  `class-${results.data?.classroom_title.replace(/\s+/g, "-")}-results.csv`,
                ).catch((downloadError) => setError(errorMessage(downloadError)));
              }}
            >
              <Download className="size-4" aria-hidden />
              {t("CSV жүктеу", "Download CSV")}
            </Button>
          ) : undefined
        }
      />

      {classes.isLoading ? (
        <PageLoader />
      ) : classes.isError ? (
        <Alert tone="error">{errorMessage(classes.error)}</Alert>
      ) : (classes.data?.items.length ?? 0) === 0 ? (
        <EmptyState
          title={t("Сынып жоқ", "No classes")}
          description={t("Нәтижені көру үшін алдымен сынып жасаңыз.", "Create a class to see its results.")}
          action={<LinkButton to="/teacher/classes">{t("Сынып жасау", "Create class")}</LinkButton>}
        />
      ) : (
        <>
          <div className="mb-5 max-w-md">
            <Field label={t("Сынып", "Class")} htmlFor="results-class">
              <Select
                id="results-class"
                value={classId}
                onChange={(event) => {
                  const next = new URLSearchParams(searchParams);
                  next.set("class", event.target.value);
                  setSearchParams(next);
                }}
              >
                {classes.data?.items.map((classroom) => (
                  <option key={classroom.id} value={classroom.id}>
                    {classroom.title} ({classroom.member_count} {t("оқушы", "students")})
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {error ? (
            <div className="mb-4">
              <Alert tone="error">{error}</Alert>
            </div>
          ) : null}

          {results.isLoading ? (
            <PageLoader />
          ) : results.isError ? (
            <Alert tone="error">{errorMessage(results.error)}</Alert>
          ) : !results.data ? null : (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard label={t("Оқушылар", "Students")} value={results.data.students_total} />
                <StatCard
                  label={t("Pre-test бар", "Pre-test completed")}
                  value={`${results.data.students.filter((student) => student.pre_overall !== null).length}/${results.data.students_total} (${formatPercent(results.data.students_total ? results.data.students.filter((student) => student.pre_overall !== null).length * 100 / results.data.students_total : 0)})`}
                  tone="blue"
                />
                <StatCard
                  label={t("Post-test бар", "Post-test completed")}
                  value={`${results.data.students.filter((student) => student.post_overall !== null).length}/${results.data.students_total} (${formatPercent(results.data.students_total ? results.data.students.filter((student) => student.post_overall !== null).length * 100 / results.data.students_total : 0)})`}
                  tone="amber"
                />
              </div>

              {results.data.students.some(
                (student) =>
                  student.pre_overall !== null && student.post_overall !== null,
              ) ? (
                <Card>
                  <h2 className="text-lg font-bold text-ink-950">{t("Жалпы өзгеріс", "Overall change")}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {t("Тек екі талпынысы да бар оқушылар кіреді. Бұл көрсеткіш себептік әсерді дәлелдемейді.", "Only students with both attempts are included. This does not establish a causal effect.")}
                  </p>
                  <div className="mt-4">
                    <DiagnosticsChart
                      comparison={{
                        methodology_key: "class-average",
                        pre_assessment: "Pre-test орташа",
                        post_assessment: "Post-test орташа",
                        pre_date: "",
                        post_date: "",
                        overall_delta_pp: pairedAverage.delta,
                        demo_notice: results.data.demo_notice,
                        rows: results.data.competency_averages.filter((row) => row.delta_average_pp !== null).map((row) => ({
                          competency_id: row.competency_id,
                          title: row.title,
                          title_en: row.title_en,
                          slug: row.slug,
                          pre_percent: row.paired_pre_average ?? 0,
                          post_percent: row.paired_post_average ?? 0,
                          delta_pp: row.delta_average_pp ?? 0,
                          level: null,
                        })),
                        pre_overall: pairedAverage.pre,
                        post_overall: pairedAverage.post,
                      }}
                    />
                  </div>
                </Card>
              ) : null}

              {results.data.competency_averages.length > 0 ? (
                <Card>
                  <h2 className="text-lg font-bold text-ink-950">
                    {t("Құзыреттіліктер бойынша орташа", "Average by competency")}
                  </h2>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[36rem] text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                        <tr>
                          <th className="px-3 py-2">{t("Құзыреттілік", "Competency")}</th>
                          <th className="px-3 py-2 text-right">Pre</th>
                          <th className="px-3 py-2 text-right">Post</th>
                          <th className="px-3 py-2 text-right">Δ</th>
                          <th className="px-3 py-2 text-right">{t("Оқушылар", "Students")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.data.competency_averages.map((row) => (
                          <tr key={row.competency_id} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-medium text-slate-700">{language === "en" ? row.title_en || row.title : row.title}</td>
                            <td className="px-3 py-2 text-right">{formatPercent(row.pre_average)}</td>
                            <td className="px-3 py-2 text-right">{formatPercent(row.post_average)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-brand-700">
                              {formatDelta(row.delta_average_pp)}
                            </td>
                            <td className="px-3 py-2 text-right text-xs text-slate-500">
                              {row.students_with_pre}/{row.students_with_post}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : null}

              <Card>
                <h2 className="text-lg font-bold text-ink-950">{t("Оқушылар бойынша", "By student")}</h2>
                {results.data.students.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">{t("Сыныпта оқушы жоқ.", "There are no students in this class.")}</p>
                ) : (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[52rem] text-left text-sm">
                      <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                        <tr>
                          <th className="px-3 py-2">{t("Оқушы", "Student")}</th>
                          <th className="px-3 py-2 text-right">{t("Сабақ", "Lessons")}</th>
                          <th className="px-3 py-2 text-right">{t("Тапсырылды", "Submitted")}</th>
                          <th className="px-3 py-2 text-right">{t("Тексерілді", "Reviewed")}</th>
                          <th className="px-3 py-2 text-right">{t("Орташа балл", "Average score")}</th>
                          <th className="px-3 py-2 text-right">Pre</th>
                          <th className="px-3 py-2 text-right">Post</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.data.students.map((student) => (
                          <tr key={student.student_id} className="border-t border-slate-100">
                            <td className="px-3 py-2 font-medium text-slate-800">
                              {student.display_name}
                            </td>
                            <td className="px-3 py-2 text-right">{student.lessons_completed}</td>
                            <td className="px-3 py-2 text-right">{student.tasks_submitted}</td>
                            <td className="px-3 py-2 text-right">{student.tasks_reviewed}</td>
                            <td className="px-3 py-2 text-right">
                              {formatPercent(student.average_grade)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatPercent(student.pre_overall)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {formatPercent(student.post_overall)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>

              {results.data.demo_notice ? (
                <DemoNotice>{results.data.demo_notice}</DemoNotice>
              ) : (
                <DemoNotice />
              )}
            </div>
          )}
        </>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <LinkButton to="/teacher/classes" variant="secondary">
          <Users className="size-4" aria-hidden />
          {t("Сыныптар", "Classes")}
        </LinkButton>
        <LinkButton to="/teacher/diagnostics" variant="secondary">
          <ListChecks className="size-4" aria-hidden />
          {t("Диагностика", "Assessments")}
        </LinkButton>
        <LinkButton to="/teacher/reviews" variant="secondary">
          <CheckCircle2 className="size-4" aria-hidden />
          {t("Тексерулер", "Reviews")}
        </LinkButton>
      </div>
    </div>
  );
}
