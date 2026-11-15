import { useState } from "react";

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
      setError(`Баға 0 мен ${maxScore} аралығында болуы керек.`);
      return;
    }
    if (returnForRevision && !feedback.trim()) {
      setError("Қайта өңдеуге қайтару үшін мұғалім пікірі міндетті.");
      return;
    }
    try {
      await onSubmit({
        grade: numeric,
        feedback: feedback.trim(),
        return_for_revision: returnForRevision,
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Бағаны сақтау мүмкін болмады.");
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4" noValidate>
      {rubric.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
              <tr>
                <th className="px-3 py-2">Критерий</th>
                <th className="px-3 py-2 text-right">Балл</th>
                <th className="px-3 py-2 text-center">Орындалды</th>
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
                      aria-label={`${item.criterion} критерийін орындалды деп белгілеу`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Бұл жұмыс үшін құрылымдық рубрика енгізілмеген. Бағаны қолмен қойыңыз.
        </p>
      )}
      <Field label="Баға" htmlFor="grade-value" hint={`Ең жоғары балл: ${maxScore}`} required>
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
      <Field label="Мұғалім пікірі" htmlFor="grade-feedback" hint="Қайта өңдеуге қайтарғанда міндетті.">
        <TextArea
          id="grade-feedback"
          value={feedback}
          onChange={(event) => setFeedback(event.target.value)}
          placeholder="Күшті жақтары мен келесі қадамдары..."
        />
      </Field>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input
          type="checkbox"
          checked={returnForRevision}
          onChange={(event) => setReturnForRevision(event.target.checked)}
          className="size-4 accent-amber-600"
        />
        Қайта өңдеуге қайтару
      </label>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Button type="submit" loading={submitting}>
        Бағаны сақтау
      </Button>
    </form>
  );
}
