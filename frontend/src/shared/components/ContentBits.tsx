import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Download, ExternalLink, FileText } from "lucide-react";
import { useState } from "react";

import { downloadFile, errorMessage, http } from "@/shared/api";
import type { Assignment, Classroom, Page, Resource } from "@/shared/types";
import { Alert, Button, Field, Select, TextArea, TextInput } from "@/shared/ui";

export function ResourceList({
  resources,
  title = "Материалдар мен сілтемелер",
}: {
  resources: Resource[];
  title?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  if (!resources.length) return null;
  return (
    <div>
      <h2 className="text-base font-bold text-ink-950">{title}</h2>
      <ul className="mt-3 space-y-2">
        {resources.map((resource) => (
          <li
            key={resource.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5"
          >
            <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
              <FileText className="size-4 shrink-0 text-brand-700" aria-hidden />
              <span className="truncate">{resource.title}</span>
              {resource.audience === "teacher" ? (
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                  мұғалімге
                </span>
              ) : null}
            </span>
            {resource.download_url ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
                onClick={() => {
                  setError(null);
                  void downloadFile(
                    resource.download_url ?? "",
                    resource.original_filename ?? resource.title,
                  ).catch((downloadError) => setError(errorMessage(downloadError)));
                }}
              >
                <Download className="size-3.5" aria-hidden />
                Жүктеу
              </button>
            ) : resource.url ? (
              <a
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
              >
                <ExternalLink className="size-3.5" aria-hidden />
                Ашу
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      {error ? (
        <div className="mt-2">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
    </div>
  );
}

export function AssignToClass({
  contentType,
  contentId,
  label = "Сыныпқа тағайындау",
}: {
  contentType: "lesson" | "task" | "project" | "assessment";
  contentId: string;
  label?: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [classroomId, setClassroomId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const classes = useQuery({
    queryKey: ["classes", "assign"],
    queryFn: () => http.get<Page<Classroom>>("/classes?page_size=100"),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: () =>
      http.post<Assignment>("/assignments", {
        classroom_id: classroomId,
        content_type: contentType,
        content_id: contentId,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        notes: notes.trim() || null,
      }),
    onSuccess: (assignment) => {
      setMessage(`«${assignment.classroom_title}» сыныбына тағайындалды.`);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["assignments"] });
      void queryClient.invalidateQueries({ queryKey: ["teacher-dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["class-results"] });
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" aria-hidden />
        {label}
      </Button>
    );
  }

  return (
    <form
      className="w-full space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!classroomId) {
          setError("Сыныпты таңдаңыз.");
          return;
        }
        mutation.mutate();
      }}
    >
      <Field label="Сынып" htmlFor="assign-class" required>
        <Select
          id="assign-class"
          value={classroomId}
          onChange={(event) => setClassroomId(event.target.value)}
        >
          <option value="">Сыныпты таңдаңыз</option>
          {(classes.data?.items ?? []).map((classroom) => (
            <option key={classroom.id} value={classroom.id}>
              {classroom.title} ({classroom.member_count} оқушы)
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Дедлайн (міндетті емес)" htmlFor="assign-due">
        <TextInput
          id="assign-due"
          type="datetime-local"
          value={dueAt}
          onChange={(event) => setDueAt(event.target.value)}
        />
      </Field>
      <Field label="Ескертпе (міндетті емес)" htmlFor="assign-notes">
        <TextArea
          id="assign-notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="min-h-20"
        />
      </Field>
      {message ? <Alert tone="success">{message}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={mutation.isPending}>
          Тағайындау
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Жабу
        </Button>
      </div>
    </form>
  );
}
