import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Plus, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";

import { errorMessage, http } from "@/shared/api";
import { statusLabels } from "@/shared/format";
import type { ContentStatus, RubricItem, TaskOption } from "@/shared/types";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  LinkButton,
  Select,
  TextArea,
  TextInput,
  cx,
} from "@/shared/ui";

export interface RefOption {
  id: string;
  title: string;
}

export function useEditParam(): [string | null, (id: string | null) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  function setEditId(id: string | null) {
    const next = new URLSearchParams(searchParams);
    if (id) next.set("edit", id);
    else next.delete("edit");
    setSearchParams(next, { replace: true });
  }
  return [editId, setEditId];
}

export function editorPath(plural: string, id: string): string {
  return `/admin/${plural}?edit=${id}`;
}

export function StatusBadge({ status }: { status: ContentStatus | string }) {
  const tone = status === "published" ? "green" : status === "archived" ? "slate" : "amber";
  return <Badge tone={tone}>{statusLabels[status] ?? status}</Badge>;
}

export function AdminEditorCard({
  id,
  resource,
  title,
  status,
  isDemo,
  previewHref,
  extraActions,
  onSaved,
  onDeleted,
  children,
}: {
  id: string | null;
  resource: string;
  title: string;
  status?: ContentStatus;
  isDemo?: boolean;
  previewHref?: string;
  extraActions?: ReactNode;
  onSaved: (id: string) => void;
  onDeleted: () => void;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const publish = useMutation({
    mutationFn: () => http.post<{ id: string; status: string }>(`/admin/${resource}/${id}/publish`),
    onSuccess: () => {
      setError(null);
      setNotice("Материал жарияланды.");
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      if (id) onSaved(id);
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  const remove = useMutation({
    mutationFn: () => http.delete<{ message: string }>(`/admin/${resource}/${id}`),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["admin"] });
      onDeleted();
    },
    onError: (mutationError) => setError(errorMessage(mutationError)),
  });

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold tracking-[0.18em] text-brand-700 uppercase">
            {id ? "Өңдеу" : "Жаңа жазба"}
          </p>
          <h2 className="mt-1 truncate text-xl font-bold text-ink-950">{title || "Атауын енгізіңіз"}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {status ? <StatusBadge status={status} /> : <Badge tone="slate">Жоба</Badge>}
            {isDemo ? <Badge tone="amber">Демо</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {previewHref ? (
            <LinkButton to={previewHref} variant="ghost" size="sm">
              <Eye className="size-4" aria-hidden />
              Алдын ала қарау
            </LinkButton>
          ) : null}
          {extraActions}
          {id ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={publish.isPending}
              onClick={() => publish.mutate()}
            >
              <CheckCircle2 className="size-4" aria-hidden />
              Жариялау
            </Button>
          ) : null}
          {id ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-rose-700 hover:bg-rose-50"
              loading={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Жазбаны жоюды растайсыз ба? Жарияланған материалды жою мүмкін емес — оны архивтеңіз.",
                  )
                ) {
                  remove.mutate();
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden />
              Жою
            </Button>
          ) : null}
        </div>
      </div>
      {notice ? (
        <div className="mt-3">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {error ? (
        <div className="mt-3">
          <Alert tone="error">{error}</Alert>
        </div>
      ) : null}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export function AdminEmptyEditor({ text }: { text: string }) {
  return (
    <Card className="flex min-h-72 flex-col items-center justify-center text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Plus className="size-6" aria-hidden />
      </div>
      <p className="mt-3 max-w-sm text-sm text-slate-600">{text}</p>
    </Card>
  );
}

export function StatusField({
  value,
  onChange,
}: {
  value: ContentStatus;
  onChange: (value: ContentStatus) => void;
}) {
  return (
    <Field label="Мәртебе" htmlFor="admin-status">
      <Select
        id="admin-status"
        value={value}
        onChange={(event) => onChange(event.target.value as ContentStatus)}
      >
        <option value="draft">Жоба</option>
        <option value="published">Жарияланған</option>
        <option value="archived">Мұрағат</option>
      </Select>
    </Field>
  );
}

export function DemoField({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-950">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 accent-amber-600"
      />
      <span>
        <span className="font-semibold">Демо-контент</span>
        <span className="mt-0.5 block text-xs leading-5 text-amber-800">
          Ақырындап «Демо» белгісі көрсетіледі. Нақты ғылыми-әдістемелік мазмұнды тапсырыс
          беруші бекіткенде белгіні алып тастаңыз.
        </span>
      </span>
    </label>
  );
}

export function TextListEditor({
  label,
  hint,
  items,
  onChange,
  placeholder = "Жаңа тармақ",
}: {
  label: string;
  hint?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">{label}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <TextInput
              value={item}
              onChange={(event) => {
                const next = [...items];
                next[index] = event.target.value;
                onChange(next);
              }}
              placeholder={placeholder}
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Тармақты жою"
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onChange([...items, ""])}
        >
          <Plus className="size-4" aria-hidden />
          Тармақ қосу
        </Button>
      </div>
    </div>
  );
}

export function RubricEditor({
  items,
  onChange,
}: {
  items: RubricItem[];
  onChange: (items: RubricItem[]) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">Бағалау рубрикасы</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Критерийлер мен балдар. Балдар жиыны максималды балға сәйкес болғаны жөн.
      </p>
      <div className="mt-2 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <TextInput
              value={item.criterion}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, criterion: event.target.value };
                onChange(next);
              }}
              placeholder="Критерий сипаттамасы"
              className="min-w-48 flex-1"
            />
            <TextInput
              type="number"
              min={0}
              value={item.points}
              onChange={(event) => {
                const next = [...items];
                next[index] = { ...item, points: Number(event.target.value) || 0 };
                onChange(next);
              }}
              className="w-24"
              aria-label="Балл"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Критерийді жою"
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => onChange([...items, { criterion: "", points: 1 }])}
        >
          <Plus className="size-4" aria-hidden />
          Критерий қосу
        </Button>
      </div>
    </div>
  );
}

export function CriteriaEditor({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}) {
  const levels = ["low", "medium", "high"];
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">Деңгей критерийлері</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Төмен / орташа / жоғары деңгейлер үшін қысқаша сипаттама.
      </p>
      <div className="mt-2 grid gap-2 lg:grid-cols-3">
        {levels.map((level) => (
          <div key={level}>
            <label
              htmlFor={`criteria-${level}`}
              className="text-xs font-bold tracking-wide text-slate-500 uppercase"
            >
              {level === "low" ? "Төмен" : level === "medium" ? "Орташа" : "Жоғары"}
            </label>
            <TextArea
              id={`criteria-${level}`}
              value={value[level] ?? ""}
              onChange={(event) => onChange({ ...value, [level]: event.target.value })}
              className="mt-1 min-h-24"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompetencyPicker({
  options,
  selected,
  onChange,
}: {
  options: RefOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">STEM құзыреттіліктері</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Бұл материал қай құзыреттіліктерді дамытады? Кемінде біреуін таңдаған жөн.
      </p>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.id}
            className={cx(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
              selected.includes(option.id)
                ? "border-brand-300 bg-brand-50 text-brand-950"
                : "border-slate-200 bg-white text-slate-700",
            )}
          >
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={() =>
                onChange(
                  selected.includes(option.id)
                    ? selected.filter((id) => id !== option.id)
                    : [...selected, option.id],
                )
              }
              className="size-4 accent-brand-700"
            />
            {option.title}
          </label>
        ))}
      </div>
    </div>
  );
}

export interface OptionDraft {
  label: string;
  is_correct: boolean;
  order_no: number;
}

export function OptionEditor({
  options,
  multiple,
  onChange,
  labels,
  hint,
}: {
  options: OptionDraft[];
  multiple: boolean;
  onChange: (options: OptionDraft[]) => void;
  labels: { add: string; correct: string; empty: string };
  hint?: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-800">Жауап нұсқалары</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {hint ?? "Дұрыс жауапты белгілеңіз. Оқушы бұл белгіні көрмейді."}
      </p>
      <div className="mt-2 space-y-2">
        {options.length === 0 ? (
          <p className="text-xs text-slate-500">{labels.empty}</p>
        ) : null}
        {options.map((option, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 p-2">
            <TextInput
              value={option.label}
              onChange={(event) => {
                const next = [...options];
                next[index] = { ...option, label: event.target.value };
                onChange(next);
              }}
              placeholder={`${index + 1}-нұсқа`}
              className="min-w-40 flex-1"
            />
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <input
                type={multiple ? "checkbox" : "radio"}
                name="option-correct"
                checked={option.is_correct}
                onChange={() => {
                  onChange(
                    multiple
                      ? options.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, is_correct: !item.is_correct }
                            : item,
                        )
                      : options.map((item, itemIndex) => ({
                          ...item,
                          is_correct: itemIndex === index,
                        })),
                  );
                }}
                className="size-4 accent-emerald-600"
              />
              {labels.correct}
            </label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-label="Нұсқаны жою"
              onClick={() => onChange(options.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() =>
            onChange([...options, { label: "", is_correct: false, order_no: options.length + 1 }])
          }
        >
          <Plus className="size-4" aria-hidden />
          {labels.add}
        </Button>
      </div>
    </div>
  );
}

export function optionFromApi(option: TaskOption): OptionDraft {
  return {
    label: option.label,
    is_correct: Boolean(option.is_correct),
    order_no: option.order_no,
  };
}

export function AdminListButton({
  active,
  title,
  meta,
  onClick,
}: {
  active: boolean;
  title: string;
  meta?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "w-full rounded-xl border px-3 py-2.5 text-left transition",
        active
          ? "border-brand-400 bg-brand-50"
          : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40",
      )}
    >
      <span className="block truncate text-sm font-semibold text-ink-950">{title}</span>
      {meta ? <span className="mt-0.5 block text-xs text-slate-500">{meta}</span> : null}
    </button>
  );
}
