import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { errorMessage, http } from "@/shared/api";
import { FileUploader } from "@/shared/components/FileUploader";
import type { Resource, Submission } from "@/shared/types";
import { Alert, Button, Field, TextArea, TextInput } from "@/shared/ui";

const schema = z.object({
  text: z.string().max(20000, "Мәтін 20 000 таңбадан аспауы керек").optional(),
  link: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function SubmissionForm({
  assignmentId,
  mode = "all",
  existing,
  onSubmitted,
}: {
  assignmentId: string;
  mode?: "all" | "open_text" | "file" | "link";
  existing?: Submission | null;
  onSubmitted?: (submission: Submission) => void;
}) {
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [files, setFiles] = useState<Resource[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { text: existing?.text ?? "", link: existing?.link ?? "" },
  });

  if (existing?.status === "reviewed") {
    return (
      <Alert tone="success" title="Жұмыс тексерілген">
        <p>
          Баға: <strong>{existing.grade ?? "—"}</strong>
          {existing.max_score ? ` / ${existing.max_score}` : ""}
        </p>
        {existing.feedback ? <p className="mt-1">Мұғалім пікірі: {existing.feedback}</p> : null}
      </Alert>
    );
  }

  async function submit(values: FormValues) {
    setFormError(null);
    const text = values.text?.trim() ?? "";
    const link = values.link?.trim() ?? "";
    if (link && !link.startsWith("https://")) {
      setFormError("Сілтеме тек HTTPS протоколымен басталуы керек.");
      return;
    }
    if (!text && !link && fileIds.length === 0) {
      setFormError("Мәтін, HTTPS сілтеме немесе файл қосыңыз.");
      return;
    }
    try {
      const submission = await http.post<Submission>(
        `/assignments/${assignmentId}/submissions`,
        {
          text: text || null,
          link: link || null,
          file_ids: fileIds,
        },
      );
      onSubmitted?.(submission);
    } catch (submitError) {
      setFormError(errorMessage(submitError));
    }
  }

  const showText = mode !== "link";
  const showLink = mode === "all" || mode === "link";
  const showFiles = mode === "all" || mode === "file";

  return (
    <form onSubmit={(event) => void handleSubmit(submit)(event)} className="space-y-5">
      {existing?.status === "returned" ? (
        <Alert tone="warning" title="Жұмыс қайта өңдеуге қайтарылды">
          {existing.feedback ?? "Мұғалім пікірін қарап, жұмысты түзетіңіз."}
        </Alert>
      ) : null}
      {showText ? (
        <Field
          label={showLink ? "Түсіндірме немесе жауап мәтіні" : "Жауап мәтіні"}
          htmlFor="submission-text"
          error={errors.text?.message}
          hint="Жұмысыңызды, қолданған әдісіңізді және қорытындыңызды сипаттаңыз."
        >
          <TextArea
            id="submission-text"
            placeholder="Мысалы: деректер жиынтығын тазалап, модельді оқыттым..."
            {...register("text")}
          />
        </Field>
      ) : null}
      {showLink ? (
        <Field
          label="HTTPS сілтеме"
          htmlFor="submission-link"
          error={errors.link?.message}
          hint="Google Colab, Teachable Machine немесе басқа ашық HTTPS ресурсы."
        >
          <TextInput
            id="submission-link"
            type="url"
            placeholder="https://colab.research.google.com/..."
            {...register("link")}
          />
        </Field>
      ) : null}
      {showFiles ? (
        <Field
          label="Файл тіркеу"
          hint="Файл жүктелгеннен кейін жіберу батырмасын басыңыз."
        >
          <FileUploader
            onUploaded={(resource) => {
              setFiles((current) => [...current, resource]);
              setFileIds((current) => [...current, resource.id]);
            }}
            onRemoved={(id) => {
              setFiles((current) => current.filter((item) => item.id !== id));
              setFileIds((current) => current.filter((item) => item !== id));
            }}
          />
        </Field>
      ) : null}
      {files.length > 0 ? (
        <p className="text-xs text-slate-500">Тіркелген файл саны: {files.length}</p>
      ) : null}
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <Button type="submit" loading={isSubmitting}>
        Жұмысты жіберу
      </Button>
    </form>
  );
}
