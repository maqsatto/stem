import { useState } from "react";

import type { AssessmentQuestion } from "@/shared/types";
import { Alert, Button, Card } from "@/shared/ui";
import { RichTextRenderer } from "@/shared/components/RichTextRenderer";

export interface QuizAnswer {
  question_id: string;
  answer_json: { selected_option_ids?: string[]; text?: string };
}

export type QuizInitialValues = Record<string, { selected: string[]; text?: string }>;

export function QuizForm({
  questions,
  initialValues,
  onSubmit,
  onSave,
  submitting = false,
  submitLabel = "Жауаптарды жіберу",
  disabled = false,
}: {
  questions: AssessmentQuestion[];
  initialValues?: QuizInitialValues;
  onSubmit: (answers: QuizAnswer[]) => Promise<void> | void;
  onSave?: (answers: QuizAnswer[]) => Promise<void> | void;
  submitting?: boolean;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const [values, setValues] = useState<QuizInitialValues>(() => initialValues ?? {});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function selected(questionId: string): string[] {
    return values[questionId]?.selected ?? [];
  }

  function setSelected(questionId: string, next: string[]) {
    setSaved(false);
    setValues((current) => ({
      ...current,
      [questionId]: { ...current[questionId], selected: next },
    }));
  }

  function toggle(question: AssessmentQuestion, optionId: string) {
    const current = selected(question.id);
    if (question.type === "single_choice") {
      setSelected(question.id, [optionId]);
      return;
    }
    setSelected(
      question.id,
      current.includes(optionId)
        ? current.filter((item) => item !== optionId)
        : [...current, optionId],
    );
  }

  function setText(questionId: string, text: string) {
    setSaved(false);
    setValues((current) => ({
      ...current,
      [questionId]: { ...current[questionId], selected: [], text },
    }));
  }

  const answeredCount = questions.filter((question) => {
    const value = values[question.id];
    if (question.type === "open_text") return Boolean(value?.text?.trim());
    return Boolean(value?.selected.length);
  }).length;

  function collectAnswers(): QuizAnswer[] {
    return questions.map((question) => {
      const value = values[question.id];
      return {
        question_id: question.id,
        answer_json: question.type === "open_text"
          ? { text: value?.text ?? "" }
          : { selected_option_ids: value?.selected ?? [] },
      };
    });
  }

  async function saveDraft() {
    if (!onSave) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await onSave(collectAnswers());
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Жауаптарды сақтау мүмкін болмады.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const missing = questions.filter((question) => {
      const value = values[question.id];
      if (question.type === "open_text") return !value?.text?.trim();
      return !value?.selected.length;
    });
    if (missing.length > 0) {
      setError("Барлық сұраққа жауап беріңіз. Жауапсыз қалған сұрақтар бар.");
      return;
    }
    try {
      await onSubmit(collectAnswers());
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Жауаптарды жіберу мүмкін болмады.",
      );
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
      {questions.map((question, index) => {
        const current = selected(question.id);
        const isOpen = question.type === "open_text";
        return (
          <Card key={question.id} as="section" className="border-slate-200">
            <fieldset>
              <legend className="w-full">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-brand-700 text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
                    {question.points} балл
                  </span>
                  {question.competency_title ? (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-800">
                      {question.competency_title}
                    </span>
                  ) : null}
                </span>
                <RichTextRenderer html={question.body} className="mt-3 text-sm" />
                <span className="mt-1 block text-xs text-slate-500">
                  {question.type === "single_choice"
                    ? "Бір дұрыс жауапты таңдаңыз."
                    : question.type === "multiple_choice"
                      ? "Бірнеше дұрыс жауапты таңдауға болады."
                      : "Жауабыңызды мәтін түрінде жазыңыз."}
                </span>
              </legend>
              {isOpen ? (
                <textarea
                  className="mt-4 min-h-28 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  value={values[question.id]?.text ?? ""}
                  onChange={(event) => setText(question.id, event.target.value)}
                  disabled={disabled || saving || submitting}
                  aria-label={`${index + 1}-сұраққа жауап`}
                />
              ) : (
                <div className="mt-4 space-y-2">
                  {question.options.map((option) => {
                    const checked = current.includes(option.id);
                    return (
                      <label
                        key={option.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm transition ${
                          checked
                            ? "border-brand-400 bg-brand-50 text-brand-950"
                            : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"
                        }`}
                      >
                        <input
                          type={question.type === "single_choice" ? "radio" : "checkbox"}
                          name={`question-${question.id}`}
                          value={option.id}
                          checked={checked}
                          onChange={() => toggle(question, option.id)}
                          disabled={disabled || saving || submitting}
                          className="mt-0.5 size-4 accent-brand-700"
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
          </Card>
        );
      })}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <p role="status" className="text-sm text-emerald-700">Жауаптар сақталды.</p> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Жауап берілді: <strong>{answeredCount}</strong> / {questions.length}
        </p>
        <div className="flex flex-wrap gap-2">
          {onSave ? <Button type="button" variant="secondary" loading={saving} disabled={disabled || submitting} onClick={() => void saveDraft()}>Жауаптарды сақтау</Button> : null}
          <Button type="submit" loading={submitting} disabled={disabled || saving}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
