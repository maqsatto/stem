import { FileText, Trash2, UploadCloud } from "lucide-react";
import { useId, useState } from "react";

import { errorMessage, http } from "@/shared/api";
import { formatBytes } from "@/shared/format";
import type { Resource } from "@/shared/types";
import { Alert, Button } from "@/shared/ui";
import { useText } from "@/shared/preferences";

export function FileUploader({
  endpoint = "/uploads",
  fields = {},
  onUploaded,
  onRemoved,
  accept = ".pdf,.docx,.pptx,.csv,.xlsx,.ipynb,.png,.jpg,.jpeg,.webp",
  label,
  hint,
  disabled = false,
}: {
  endpoint?: string;
  fields?: Record<string, string>;
  onUploaded?: (resource: Resource) => void;
  onRemoved?: (id: string) => void;
  accept?: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const t = useText();
  const inputId = useId();
  const [items, setItems] = useState<Resource[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const resource = await http.upload<Resource>(endpoint, file, fields);
      setItems((current) => [...current, resource]);
      onUploaded?.(resource);
    } catch (uploadError) {
      setError(errorMessage(uploadError));
    } finally {
      setUploading(false);
    }
  }

  async function remove(resource: Resource) {
    setError(null);
    try {
      const path =
        endpoint === "/uploads"
          ? `/uploads/${resource.id}`
          : `/admin/resources/${resource.id}`;
      await http.delete(path);
      setItems((current) => current.filter((item) => item.id !== resource.id));
      onRemoved?.(resource.id);
    } catch (removeError) {
      setError(errorMessage(removeError));
    }
  }

  return (
    <div className="space-y-3">
      <label
        htmlFor={inputId}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-brand-400 hover:bg-brand-50"
        aria-disabled={disabled}
      >
        <UploadCloud className="size-6 text-brand-700" aria-hidden />
        <span className="mt-2 text-sm font-semibold text-slate-800">
          {uploading ? t("Жүктелуде...", "Uploading...") : (label ?? t("Файл жүктеу", "Upload file"))}
        </span>
        <span className="mt-1 text-xs text-slate-500">{hint ?? t("PDF, DOCX, PPTX, CSV, XLSX, IPYNB, PNG, JPG немесе WEBP · 25 МБ-қа дейін", "PDF, DOCX, PPTX, CSV, XLSX, IPYNB, PNG, JPG or WEBP · up to 25 MB")}</span>
        <input
          id={inputId}
          type="file"
          accept={accept}
          className="sr-only"
          disabled={uploading || disabled}
          onChange={(event) => {
            if (disabled) return;
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </label>
      {uploading ? <p className="text-xs text-slate-500">{t("Файл тексеріліп, қауіпсіз сақтауға жүктелуде...", "Checking and uploading your file...")}</p> : null}
      {error ? (
        <Alert tone="error" title={t("Файлды жүктеу мүмкін болмады", "Could not upload file")}>
          {error}
        </Alert>
      ) : null}
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
                <FileText className="size-4 shrink-0 text-brand-700" aria-hidden />
                <span className="truncate">{item.original_filename ?? item.title}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatBytes(item.size)}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void remove(item)}
                aria-label={t(`${item.title} файлын жою`, `Remove ${item.title}`)}
              >
                <Trash2 className="size-4 text-rose-600" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
