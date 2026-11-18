import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { usePreferences, useText } from "@/shared/preferences";
import type { PrePostComparison } from "@/shared/types";
import { formatDelta, formatPercent } from "@/shared/format";
import { EmptyState } from "@/shared/ui";

export function DiagnosticsChart({
  comparison,
  height = 320,
}: {
  comparison: PrePostComparison | null | undefined;
  height?: number;
}) {
  const t = useText();
  const { language, theme } = usePreferences();
  if (!comparison) {
    return (
      <EmptyState
        title={t("Салыстырмалы диагностика әлі жоқ", "No comparison yet")}
        description={t("Pre-test және post-test талпыныстары аяқталғаннан кейін STEM құзыреттіліктерінің өзгерісі осында пайда болады.", "STEM progress appears here once both pre-test and post-test attempts are complete.")}
      />
    );
  }

  const data = comparison.rows.map((row) => ({
    name: language === "en" ? row.title_en || row.title : row.title,
    pre: row.pre_percent,
    post: row.post_percent,
  }));

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-500">Pre-test</p>
          <p className="text-xl font-bold text-slate-800">{formatPercent(comparison.pre_overall)}</p>
        </div>
        <div className="rounded-xl bg-brand-50 p-3">
          <p className="text-xs font-semibold text-brand-700">Post-test</p>
          <p className="text-xl font-bold text-brand-900">{formatPercent(comparison.post_overall)}</p>
        </div>
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-800">{t("Өзгеріс", "Change")}</p>
          <p className="text-xl font-bold text-amber-950">
            {formatDelta(comparison.overall_delta_pp)}
          </p>
        </div>
      </div>
      <div style={{ width: "100%", height }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 72, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="name"
              interval={0}
              angle={-20}
              textAnchor="end"
              height={72}
              tick={{ fontSize: 11, fill: theme === "dark" ? "#c0c9d5" : "#475569" }}
            />
            <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} width={48} />
            <Tooltip />
            <Legend verticalAlign="top" height={30} />
            <Bar dataKey="pre" name="Pre-test, %" fill="#94a3b8" radius={[4, 4, 0, 0]} />
            <Bar dataKey="post" name="Post-test, %" fill="#0f766e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2">{t("Құзыреттілік", "Competency")}</th>
              <th className="px-3 py-2 text-right">Pre</th>
              <th className="px-3 py-2 text-right">Post</th>
              <th className="px-3 py-2 text-right">{t("Δ п.п.", "Δ pp")}</th>
            </tr>
          </thead>
          <tbody>
            {comparison.rows.map((row) => (
              <tr key={row.competency_id} className="border-t border-slate-100">
                <td className="px-3 py-2 text-slate-700">{language === "en" ? row.title_en || row.title : row.title}</td>
                <td className="px-3 py-2 text-right">{formatPercent(row.pre_percent)}</td>
                <td className="px-3 py-2 text-right">{formatPercent(row.post_percent)}</td>
                <td className="px-3 py-2 text-right font-semibold text-brand-800">
                  {formatDelta(row.delta_pp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {t("Диагностика өлшенген нәтижені көрсетеді, бірақ әдістеменің себептік әсерін дәлелдемейді. Салыстыру бір әдістеме кілті мен бір нұсқа шеңберінде жүргізіледі.", "The assessment shows measured results but does not establish a causal effect. Comparisons use the same methodology key and version.")}
      </p>
    </div>
  );
}
