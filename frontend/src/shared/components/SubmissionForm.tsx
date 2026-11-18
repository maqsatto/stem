import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { errorMessage, http } from "@/shared/api";
import { FileUploader } from "@/shared/components/FileUploader";
import type { Resource, Submission } from "@/shared/types";
import { Alert, Button, Field, TextArea, TextInput } from "@/shared/ui";
import { useText } from "@/shared/preferences";

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
  const t = useText();
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
      <Alert tone="success" title={t("Жұмыс тексерілген", "Work reviewed")}>
        <p>
          {t("Баға", "Score")}: <strong>{existing.grade ?? "—"}</strong>
          {existing.max_score ? ` / ${existing.max_score}` : ""}
        </p>
        {existing.feedback ? <p className="mt-1">{t("Мұғалім пікірі", "Teacher feedback")}: {existing.feedback}</p> : null}
      </Alert>
    );
  }

  async function submit(values: FormValues) {
    setFormError(null);
    const text = values.text?.trim() ?? "";
    const link = values.link?.trim() ?? "";
    if (link && !link.startsWith("https://")) {
      setFormError(t("Сілтеме тек HTTPS протоколымен басталуы керек.", "The link must start with HTTPS."));
      return;
    }
    if (!text && !link && fileIds.length === 0) {
      setFormError(t("Мәтін, HTTPS сілтеме немесе файл қосыңыз.", "Add text, an HTTPS link or a file."));
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
        <Alert tone="warning" title={t("Жұмыс қайта өңдеуге қайтарылды", "Work returned for revision")}>
          {existing.feedback ?? t("Мұғалім пікірін қарап, жұмысты түзетіңіз.", "Read the teacher's feedback and revise your work.")}
        </Alert>
      ) : null}
      {showText ? (
        <Field
          label={showLink ? t("Түсіндірме немесе жауап мәтіні", "Explanation or answer") : t("Жауап мәтіні", "Answer")}
          htmlFor="submission-text"
          error={errors.text?.message}
          hint={t("Жұмысыңызды, қолданған әдісіңізді және қорытындыңызды сипаттаңыз.", "Describe your work, method and conclusion.")}
        >
          <TextArea
            id="submission-text"
            placeholder={t("Мысалы: деректер жиынтығын тазалап, модельді оқыттым...", "For example: I cleaned the dataset and trained a model...")}
            {...register("text")}
          />
        </Field>
      ) : null}
      {showLink ? (
        <Field
          label={t("HTTPS сілтеме", "HTTPS link")}
          htmlFor="submission-link"
          error={errors.link?.message}
          hint={t("Google Colab, Teachable Machine немесе басқа ашық HTTPS ресурсы.", "Google Colab, Teachable Machine or another HTTPS resource.")}
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
          label={t("Файл тіркеу", "Attach a file")}
          hint={t("Файл жүктелгеннен кейін жіберу батырмасын басыңыз.", "Submit your work after uploading the file.")}
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
        <p className="text-xs text-slate-500">{t("Тіркелген файл саны", "Attached files")}: {files.length}</p>
      ) : null}
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      <Button type="submit" loading={isSubmitting}>
        {t("Жұмысты жіберу", "Submit work")}
      </Button>
    </form>
  );
}
