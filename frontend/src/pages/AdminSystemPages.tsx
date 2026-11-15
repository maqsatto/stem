import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Download,
  ExternalLink,
  FileText,
  KeyRound,
  Link2,
  Plus,
  Search,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useState } from "react";

import { downloadFile, errorMessage, http } from "@/shared/api";
import { FileUploader } from "@/shared/components/FileUploader";
import { audienceLabels, formatBytes, formatDateTime, statusLabels } from "@/shared/format";
import { useDebouncedValue, useTitle } from "@/shared/hooks";
import type {
  AdminAssessment,
  AdminUser,
  AlgorithmCard,
  AuditLog,
  Classroom,
  CompetencyCard,
  LessonCard,
  Page,
  PasswordReset,
  ProjectCard,
  Resource,
  TaskCard,
} from "@/shared/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  DemoNotice,
  EmptyState,
  Field,
  PageHeader,
  PageLoader,
  Pagination,
  Select,
  StatCard,
  TextInput,
} from "@/shared/ui";

/* ------------------------------------------------------------------------- */
/* Files and resources                                                        */
/* ------------------------------------------------------------------------- */

const entityTypeLabels: Record<string, string> = {
  algorithm: "ML алгоритмі",
  competency: "STEM құзыреттілігі",
  lesson: "Сабақ",
  task: "Тапсырма",
  project: "Жоба",
  assessment: "Диагностика",
};

function useEntityOptions(entityType: string) {
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
  const tasks = useQuery({
    queryKey: ["admin", "tasks"],
    queryFn: () => http.get<TaskCard[]>("/admin/tasks"),
  });
  const projects = useQuery({
    queryKey: ["admin", "projects"],
    queryFn: () => http.get<ProjectCard[]>("/admin/projects"),
  });
  const assessments = useQuery({
    queryKey: ["admin", "assessments"],
    queryFn: () => http.get<AdminAssessment[]>("/admin/assessments"),
  });
  if (entityType === "algorithm") {
    return (algorithms.data ?? []).map((item) => ({ id: item.id, title: item.title }));
  }
  if (entityType === "competency") {
    return (competencies.data ?? []).map((item) => ({ id: item.id, title: item.title }));
  }
  if (entityType === "lesson") {
    return (lessons.data ?? []).map((item) => ({
      id: item.id,
      title: `${item.order_no}. ${item.title}`,
    }));
  }
  if (entityType === "task") {
    return (tasks.data ?? []).map((item) => ({ id: item.id, title: item.title }));
  }
  if (entityType === "project") {
    return (projects.data ?? []).map((item) => ({ id: item.id, title: item.title }));
  }
  return (assessments.data ?? []).map((item) => ({ id: item.id, title: item.name }));
}

function ResourceManagerPanel() {
  const queryClient = useQueryClient();
  const [entityType, setEntityType] = useState("lesson");
  const [entityId, setEntityId] = useState("");
  const [audience, setAudience] = useState("student");
  const [title, setTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const options = useEntityOptions(entityType);

  const addLink = useMutation({
    mutationFn: () =>
      http.post<Resource>("/admin/resources", {
        entity_type: entityType,
        entity_id: entityId,
        audience,
        title: title.trim(),
        url: linkUrl.trim(),
      }),
    onSuccess: (resource) => {
      setMessage(`«${resource.title}» сілтемесі қосылды.`);
      setError(null);
      setTitle("");
      setLinkUrl("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "resources"] });
    },
    onError: (mutationError) => {
      setMessage(null);
      setError(errorMessage(mutationError));
    },
  });

  return (
    <Card>
      <h2 className="text-lg font-bold text-ink-950">Файл немесе сілтеме қосу</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Алдымен материалды таңдаңыз, содан кейін файл жүктеңіз немесе HTTPS сілтеме қосыңыз.
        Файл өлшемі 25 МБ-қа дейін, MIME және magic-byte тексеріледі.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Материал түрі" htmlFor="resource-entity-type" required>
          <Select
            id="resource-entity-type"
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setEntityId("");
            }}
          >
            {Object.entries(entityTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Материал" htmlFor="resource-entity" required>
          <Select
            id="resource-entity"
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
          >
            <option value="">Таңдаңыз</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Аудитория" htmlFor="resource-audience">
          <Select
            id="resource-audience"
            value={audience}
            onChange={(event) => setAudience(event.target.value)}
          >
            {Object.entries(audienceLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Атауы (міндетті емес)" htmlFor="resource-title">
          <TextInput
            id="resource-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={250}
            placeholder="Файл атауы автоматты қойылады"
          />
        </Field>
      </div>

      <div className="mt-4">
        <FileUploader
          endpoint="/admin/uploads"
          fields={{ entity_type: entityType, entity_id: entityId, audience, title }}
          disabled={!entityId}
          onUploaded={(resource) => {
            setMessage(`«${resource.title}» файлы жүктелді.`);
            setError(null);
            void queryClient.invalidateQueries({ queryKey: ["admin", "resources"] });
          }}
          onRemoved={() => {
            void queryClient.invalidateQueries({ queryKey: ["admin", "resources"] });
          }}
        />
      </div>

      <form
        className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!entityId) {
            setError("Материалды таңдаңыз.");
            return;
          }
          if (!title.trim() || !linkUrl.trim()) {
            setError("Сілтеме үшін атауы мен HTTPS URL қажет.");
            return;
          }
          addLink.mutate();
        }}
      >
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <Link2 className="size-4 text-brand-700" aria-hidden />
          HTTPS сілтеме қосу
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Сілтеме атауы" htmlFor="resource-link-title" required>
            <TextInput
              id="resource-link-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={250}
            />
          </Field>
          <Field label="HTTPS URL" htmlFor="resource-link-url" required>
            <TextInput
              id="resource-link-url"
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://..."
            />
          </Field>
        </div>
        {message ? <Alert tone="success">{message}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Button type="submit" size="sm" variant="secondary" loading={addLink.isPending}>
          <Plus className="size-4" aria-hidden />
          Сілтемені қосу
        </Button>
      </form>
    </Card>
  );
}

export function AdminFilesPage() {
  useTitle("Файлдар");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [audience, setAudience] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editAudience, setEditAudience] = useState("student");
  const [error, setError] = useState<string | null>(null);
  const resources = useQuery({
    queryKey: ["admin", "resources", page, entityType, audience],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (entityType) params.set("entity_type", entityType);
      if (audience) params.set("audience", audience);
      return http.get<Page<Resource>>(`/admin/resources?${params.toString()}`);
    },
  });
  const save = useMutation({
    mutationFn: (id: string) =>
      http.patch<Resource>(`/admin/resources/${id}`, {
        title: editTitle.trim(),
        audience: editAudience,
      }),
    onSuccess: () => {
      setEditId(null);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "resources"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => http.delete<{ message: string }>(`/admin/resources/${id}`),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "resources"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Әкімші"
        title="Файлдар мен ресурстар"
        description="Оқу материалдарына тіркелген файлдар мен сыртқы сілтемелер. Мұғалім файлдары оқушыға көрсетілмейді."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_26rem]">
        <div className="space-y-4">
          <Card>
            <div className="grid gap-3 sm:grid-cols-3">
              <Select
                value={entityType}
                onChange={(event) => {
                  setEntityType(event.target.value);
                  setPage(1);
                }}
                aria-label="Материал түрі"
              >
                <option value="">Барлық материалдар</option>
                {Object.entries(entityTypeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select
                value={audience}
                onChange={(event) => {
                  setAudience(event.target.value);
                  setPage(1);
                }}
                aria-label="Аудитория"
              >
                <option value="">Барлық аудитория</option>
                {Object.entries(audienceLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <p className="self-center text-xs text-slate-500">
                Барлығы: <strong>{resources.data?.total ?? "—"}</strong>
              </p>
            </div>
          </Card>

          {error ? <Alert tone="error">{error}</Alert> : null}
          {resources.isLoading ? (
            <PageLoader />
          ) : resources.isError ? (
            <Alert tone="error">{errorMessage(resources.error)}</Alert>
          ) : (resources.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="Ресурс табылмады"
              description="Оң жақтағы форма арқылы файл немесе сілтеме қосыңыз."
            />
          ) : (
            <div className="space-y-2">
              {resources.data?.items.map((resource) => (
                <Card key={resource.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-bold text-ink-950">
                        {resource.kind === "link" ? (
                          <ExternalLink className="size-4 shrink-0 text-brand-700" aria-hidden />
                        ) : (
                          <FileText className="size-4 shrink-0 text-brand-700" aria-hidden />
                        )}
                        <span className="truncate">{resource.title}</span>
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge tone="slate">{audienceLabels[resource.audience] ?? resource.audience}</Badge>
                        <span>{resource.kind === "link" ? "Сілтеме" : "Файл"}</span>
                        {resource.size ? <span>· {formatBytes(resource.size)}</span> : null}
                        {resource.mime ? <span className="font-mono">· {resource.mime}</span> : null}
                      </p>
                      {resource.url ? (
                        <p className="mt-1 truncate text-xs text-slate-500">{resource.url}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {resource.download_url ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setError(null);
                            void downloadFile(
                              resource.download_url ?? "",
                              resource.original_filename ?? resource.title,
                            ).catch((downloadError) => setError(errorMessage(downloadError)));
                          }}
                        >
                          <Download className="size-4" aria-hidden />
                          Жүктеу
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (editId === resource.id) {
                            setEditId(null);
                            return;
                          }
                          setEditId(resource.id);
                          setEditTitle(resource.title);
                          setEditAudience(resource.audience);
                        }}
                      >
                        Өңдеу
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-rose-700 hover:bg-rose-50"
                        loading={remove.isPending && remove.variables === resource.id}
                        onClick={() => {
                          if (window.confirm("Ресурсты жоюды растайсыз ба?")) {
                            remove.mutate(resource.id);
                          }
                        }}
                      >
                        Жою
                      </Button>
                    </div>
                  </div>
                  {editId === resource.id ? (
                    <form
                      className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        save.mutate(resource.id);
                      }}
                    >
                      <Field label="Атауы" htmlFor={`resource-title-${resource.id}`}>
                        <TextInput
                          id={`resource-title-${resource.id}`}
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          maxLength={250}
                        />
                      </Field>
                      <Field label="Аудитория" htmlFor={`resource-audience-${resource.id}`}>
                        <Select
                          id={`resource-audience-${resource.id}`}
                          value={editAudience}
                          onChange={(event) => setEditAudience(event.target.value)}
                        >
                          {Object.entries(audienceLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" loading={save.isPending}>
                          Сақтау
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditId(null)}
                        >
                          Болдырмау
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </Card>
              ))}
              <Pagination
                page={page}
                total={resources.data?.total ?? 0}
                pageSize={20}
                onPage={setPage}
              />
            </div>
          )}
        </div>
        <div className="space-y-4">
          <ResourceManagerPanel />
          <DemoNotice />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Users                                                                      */
/* ------------------------------------------------------------------------- */

interface InviteResponse {
  user: AdminUser;
  temporary_password: string | null;
  must_change_password: boolean;
}

export function AdminUsersPage() {
  useTitle("Пайдаланушылар");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const query = useDebouncedValue(search.trim(), 300);
  const [invite, setInvite] = useState({
    email: "",
    display_name: "",
    role: "teacher",
    password: "",
  });
  const [inviteResult, setInviteResult] = useState<InviteResponse | null>(null);
  const [resetResult, setResetResult] = useState<PasswordReset | null>(null);
  const [error, setError] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["admin", "users", query, role, status, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), page_size: "20" });
      if (query) params.set("q", query);
      if (role) params.set("role", role);
      if (status) params.set("status", status);
      return http.get<Page<AdminUser>>(`/admin/users?${params.toString()}`);
    },
  });
  const inviteUser = useMutation({
    mutationFn: () =>
      http.post<InviteResponse>("/admin/users/invite-teacher", {
        email: invite.email.trim(),
        display_name: invite.display_name.trim(),
        role: invite.role,
        password: invite.password.trim() || null,
      }),
    onSuccess: (data) => {
      setInviteResult(data);
      setError(null);
      setInvite({ email: "", display_name: "", role: "teacher", password: "" });
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });
  const patchUser = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      http.patch<AdminUser>(`/admin/users/${id}`, payload),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });
  const resetPassword = useMutation({
    mutationFn: (id: string) =>
      http.post<PasswordReset>(`/admin/users/${id}/reset-password`),
    onSuccess: (data) => {
      setResetResult(data);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  return (
    <div>
      <PageHeader
        eyebrow="Әкімші"
        title="Пайдаланушылар"
        description="Оқушылар өздері тіркеледі; мұғалім мен әкімші аккаунттарын тек әкімші шақырады. Уақытша құпиясөзбен кірген пайдаланушы оны бірінші кіруде ауыстыруы керек."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
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
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Аты немесе email..."
                  className="pl-9"
                  aria-label="Пайдаланушы іздеу"
                />
              </div>
              <Select
                value={role}
                onChange={(event) => {
                  setRole(event.target.value);
                  setPage(1);
                }}
                aria-label="Рөл"
              >
                <option value="">Барлық рөлдер</option>
                <option value="student">Оқушы</option>
                <option value="teacher">Мұғалім</option>
                <option value="admin">Әкімші</option>
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
                <option value="active">Белсенді</option>
                <option value="disabled">Өшірілген</option>
              </Select>
            </div>
          </Card>

          {error ? <Alert tone="error">{error}</Alert> : null}
          {resetResult ? (
            <Alert tone="warning" title="Уақытша құпиясөз">
              <p>
                Пайдаланушы ID: <span className="font-mono">{resetResult.user_id}</span>
              </p>
              <p className="mt-1">
                Уақытша құпиясөз:{" "}
                <strong className="font-mono">{resetResult.temporary_password}</strong>
              </p>
              <p className="mt-1 text-xs">
                Бұл құпиясөз бір рет көрсетіледі. Пайдаланушыға қауіпсіз арна арқылы беріңіз.
              </p>
            </Alert>
          ) : null}

          {users.isLoading ? (
            <PageLoader />
          ) : users.isError ? (
            <Alert tone="error">{errorMessage(users.error)}</Alert>
          ) : (users.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="Пайдаланушы табылмады" />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                    <tr>
                      <th className="px-3 py-2.5">Пайдаланушы</th>
                      <th className="px-3 py-2.5">Рөл</th>
                      <th className="px-3 py-2.5">Мәртебе</th>
                      <th className="px-3 py-2.5">Құрылған</th>
                      <th className="px-3 py-2.5 text-right">Әрекеттер</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.data?.items.map((user) => (
                      <tr key={user.id} className="border-t border-slate-100">
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-ink-950">{user.display_name}</p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <Select
                            value={user.role}
                            aria-label={`${user.display_name} рөлі`}
                            onChange={(event) =>
                              patchUser.mutate({
                                id: user.id,
                                payload: { role: event.target.value },
                              })
                            }
                            className="min-w-28 text-xs"
                          >
                            <option value="student">Оқушы</option>
                            <option value="teacher">Мұғалім</option>
                            <option value="admin">Әкімші</option>
                          </Select>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={user.status === "active" ? "green" : "slate"}>
                            {statusLabels[user.status] ?? user.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">
                          {formatDateTime(user.created_at)}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              loading={
                                resetPassword.isPending &&
                                resetPassword.variables === user.id
                              }
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Уақытша құпиясөз жасап, пайдаланушының барлық сессиясын жабуға болады. Жалғастырасыз ба?",
                                  )
                                ) {
                                  resetPassword.mutate(user.id);
                                }
                              }}
                            >
                              <KeyRound className="size-3.5" aria-hidden />
                              Құпиясөз
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                patchUser.mutate({
                                  id: user.id,
                                  payload: {
                                    status: user.status === "active" ? "disabled" : "active",
                                  },
                                })
                              }
                            >
                              {user.status === "active" ? "Өшіру" : "Қосу"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                total={users.data?.total ?? 0}
                pageSize={20}
                onPage={setPage}
              />
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink-950">
              <UserPlus className="size-5 text-brand-700" aria-hidden />
              Мұғалім / әкімші шақыру
            </h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (invite.display_name.trim().length < 2 || !invite.email.trim()) {
                  setError("Аты-жөні мен email толтырылуы керек.");
                  return;
                }
                inviteUser.mutate();
              }}
            >
              <Field label="Аты-жөні" htmlFor="invite-name" required>
                <TextInput
                  id="invite-name"
                  value={invite.display_name}
                  onChange={(event) =>
                    setInvite({ ...invite, display_name: event.target.value })
                  }
                  maxLength={160}
                />
              </Field>
              <Field label="Email" htmlFor="invite-email" required>
                <TextInput
                  id="invite-email"
                  type="email"
                  value={invite.email}
                  onChange={(event) => setInvite({ ...invite, email: event.target.value })}
                />
              </Field>
              <Field label="Рөл" htmlFor="invite-role">
                <Select
                  id="invite-role"
                  value={invite.role}
                  onChange={(event) => setInvite({ ...invite, role: event.target.value })}
                >
                  <option value="teacher">Мұғалім</option>
                  <option value="admin">Әкімші</option>
                </Select>
              </Field>
              <Field
                label="Бастапқы құпиясөз (міндетті емес)"
                htmlFor="invite-password"
                hint="Бос қалдырсаңыз, сервер уақытша құпиясөз жасайды."
              >
                <TextInput
                  id="invite-password"
                  type="text"
                  value={invite.password}
                  onChange={(event) => setInvite({ ...invite, password: event.target.value })}
                  autoComplete="new-password"
                />
              </Field>
              <Button type="submit" loading={inviteUser.isPending} className="w-full">
                <UserPlus className="size-4" aria-hidden />
                Шақыру жасау
              </Button>
            </form>
            {inviteResult ? (
              <div className="mt-4">
                <Alert tone="success" title="Аккаунт жасалды">
                  <p>{inviteResult.user.email}</p>
                  {inviteResult.temporary_password ? (
                    <p className="mt-1">
                      Уақытша құпиясөз:{" "}
                      <strong className="font-mono">{inviteResult.temporary_password}</strong>
                    </p>
                  ) : null}
                  {inviteResult.must_change_password ? (
                    <p className="mt-1 text-xs">Бірінші кіруде құпиясөзді ауыстыру талап етіледі.</p>
                  ) : null}
                </Alert>
              </div>
            ) : null}
          </Card>
          <Card className="bg-slate-50">
            <h2 className="text-sm font-bold text-ink-950">Қауіпсіздік ережелері</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-xs leading-5 text-slate-600">
              <li>Өз аккаунтыңызды өшіру мүмкін емес.</li>
              <li>Уақытша құпиясөз бір рет көрсетіледі — қауіпсіз беріңіз.</li>
              <li>Рөлді өзгерту барлық сессияларда бірден әсер етеді.</li>
              <li>Барлық әрекеттер аудит журналына жазылады.</li>
            </ul>
            <div className="mt-3">
              <a href="/admin/audit" className="inline-flex items-center gap-1 text-xs font-semibold no-underline">
                <ShieldCheck className="size-3.5" aria-hidden />
                Аудит журналын ашу
              </a>
            </div>
          </Card>
          <DemoNotice />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Classes                                                                    */
/* ------------------------------------------------------------------------- */

export function AdminClassesPage() {
  useTitle("Сыныптар");
  const [page, setPage] = useState(1);
  const classes = useQuery({
    queryKey: ["admin", "classes", page],
    queryFn: () => http.get<Page<Classroom>>(`/admin/classes?page=${page}&page_size=20`),
  });
  return (
    <div>
      <PageHeader
        eyebrow="Әкімші"
        title="Сыныптар"
        description="Барлық сыныптар, мұғалімдер және оқушы саны. Сыныптарды мұғалімдер басқарады; әкімші тек бақылайды."
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Сыныптар" value={classes.data?.total ?? "—"} />
        <StatCard
          label="Оқушылар (20 сыныпта)"
          value={(classes.data?.items ?? []).reduce((sum, item) => sum + item.member_count, 0)}
          tone="blue"
        />
        <StatCard
          label="Белсенді"
          value={(classes.data?.items ?? []).filter((item) => item.status === "active").length}
          tone="amber"
        />
      </div>
      {classes.isLoading ? (
        <PageLoader />
      ) : classes.isError ? (
        <Alert tone="error">{errorMessage(classes.error)}</Alert>
      ) : (classes.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="Сынып жоқ" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-2.5">Сынып</th>
                  <th className="px-4 py-2.5">Мұғалім</th>
                  <th className="px-4 py-2.5 text-right">Оқушылар</th>
                  <th className="px-4 py-2.5">Кіру коды</th>
                  <th className="px-4 py-2.5">Мәртебе</th>
                  <th className="px-4 py-2.5">Құрылған</th>
                </tr>
              </thead>
              <tbody>
                {classes.data?.items.map((classroom) => (
                  <tr key={classroom.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-semibold text-ink-950">{classroom.title}</td>
                    <td className="px-4 py-2.5 text-slate-600">{classroom.teacher_name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">{classroom.member_count}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs font-bold text-brand-700">
                        {classroom.join_code ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={classroom.status === "active" ? "green" : "slate"}>
                        {statusLabels[classroom.status] ?? classroom.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {formatDateTime(classroom.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={classes.data?.total ?? 0}
            pageSize={20}
            onPage={setPage}
          />
        </div>
      )}
      <div className="mt-6">
        <DemoNotice />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Audit log                                                                  */
/* ------------------------------------------------------------------------- */

export function AdminAuditPage() {
  useTitle("Аудит журналы");
  const [page, setPage] = useState(1);
  const logs = useQuery({
    queryKey: ["admin", "audit", page],
    queryFn: () => http.get<Page<AuditLog>>(`/admin/audit-logs?page=${page}&page_size=30`),
  });
  return (
    <div>
      <PageHeader
        eyebrow="Әкімші"
        title="Аудит журналы"
        description="Мазмұн жариялау, пайдаланушыларды өзгерту, бағалау және файл әрекеттері. Журнал тек оқуға арналған."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            <Activity className="size-3.5" aria-hidden />
            Тек оқу
          </span>
        }
      />
      {logs.isLoading ? (
        <PageLoader />
      ) : logs.isError ? (
        <Alert tone="error">{errorMessage(logs.error)}</Alert>
      ) : (logs.data?.items.length ?? 0) === 0 ? (
        <EmptyState title="Жазба жоқ" />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-2.5">Уақыт</th>
                  <th className="px-4 py-2.5">Әрекет</th>
                  <th className="px-4 py-2.5">Нысан</th>
                  <th className="px-4 py-2.5">Актор</th>
                  <th className="px-4 py-2.5">Мәлімет</th>
                </tr>
              </thead>
              <tbody>
                {logs.data?.items.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100 align-top">
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap text-slate-500">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone="slate">{log.action}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {log.entity}
                      <p className="font-mono text-[10px] text-slate-400">
                        {log.entity_id ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px] text-slate-500">
                      {log.actor_id ?? "жүйе"}
                    </td>
                    <td className="px-4 py-2.5">
                      <pre className="max-w-xs overflow-x-auto text-[10px] leading-4 text-slate-500">
                        {JSON.stringify(log.details_json)}
                      </pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            total={logs.data?.total ?? 0}
            pageSize={30}
            onPage={setPage}
          />
        </div>
      )}
    </div>
  );
}
