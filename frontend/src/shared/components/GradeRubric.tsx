import { useState } from "react";

import { useText } from "@/shared/preferences";
import type { RubricItem } from "@/shared/types";
import { Alert, Button, Field, TextArea, TextInput } from "@/shared/ui";

export function GradeRubric({
  rubric = [],
  maxScore = 100,
  initialGrade,
  initialFeedback,
  onSubmit,
  submitting = false,
}: {
  rubric?: RubricItem[];
  maxScore?: number;
  initialGrade?: number | null;
  initialFeedback?: string | null;
  onSubmit: (payload: {
    grade: number;
    feedback: string;
    return_for_revision: boolean;
  }) => Promise<void> | void;
  submitting?: boolean;
}) {
  const t = useText();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [grade, setGrade] = useState(String(initialGrade ?? ""));
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [returnForRevision, setReturnForRevision] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(index: number) {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelected(next);
    if (rubric.length > 0) {
      const total = [...next].reduce((sum, itemIndex) => sum + rubric[itemIndex].points, 0);
      setGrade(String(Math.min(total, maxScore)));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const numeric = Number(grade);
    if (!Number.isFinite(numeric) || numeric < 0 || numeric > maxScore) {
      setError(t(`Баға 0 мен ${maxScore} аралығында болуы керек.`, `The grade must be between 0 and ${maxScore}.`));
      return;
    }
    if (returnForRevision && !feedback.trim()) {
      setError(t("Қайта өңдеуге қайтару үшін мұғалім пікірі міндетті.", "Feedback is required when returning work for revision."));
      return;
    }
    try {
      await onSubmit({
        grade: numeric,
        feedback: feedback.trim(),
        return_for_revision: returnForRevision,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("Бағаны сақтау мүмкін болмады.", "Could not save the grade."));
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4" noValidate>
      {rubric.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
              <tr>
                <th className="px-3 py-2">{t("Критерий", "Criterion")}</th>
                <th className="px-3 py-2 text-right">{t("Балл", "Points")}</th>
                <th className="px-3 py-2 text-center">{t("Орындалды", "Completed")}</th>
              </tr>
            </thead>
            <tbody>
              {rubric.map((item, index) => (
                <tr key={`${item.criterion}-${index}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{item.criterion}</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-800">
                    {item.points}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(index)}
                      onChange={() => toggle(index)}
                      className="size-4 accent-brand-700"
                      aria-label={t(`${item.criterion} критерийін орындалды деп белгілеу`, `Mark ${item.criterion} as completed`)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          {t("Бұл жұмыс үшін құрылымдық рубрика енгізілмеген. Бағаны қолмен қойыңыз.", "No structured rubric has been added. Enter a grade manually.")}
        </p>
      )}
      <Field label={t("Баға", "Grade")} htmlFor="grade-value" hint={t(`Ең жоғары балл: ${maxScore}`, `Maximum score: ${maxScore}`)} required>
        <TextInput
          id="grade-value"
          type="number"
          min={0}
          max={maxScore}
          value={grade}
          onChange={(event) => setGrade(event.target.value)}
          required
        />
      </Field>
      <Field label={t("Мұғалім пікірі", "Teacher feedback")} htmlFor="grade-feedback" hint={t("Қайта өңдеуге қайтарғанда міндетті.", "Required when returning work for revision.")}>
        <TextArea
          id="grade-feedback"
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder={t("Күшті жақтары мен келесі қадамдары...", "Strengths and next steps...")}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={returnForRevision}
          onChange={(event) => setReturnForRevision(event.target.checked)}
          className="size-4 accent-amber-600"
        />
        {t("Қайта өңдеуге қайтару", "Return for revision")}
      </label>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button type="submit" loading={submitting}>
        {t("Бағаны сақтау", "Save grade")}
      </Button>
    </form>
  );
}
