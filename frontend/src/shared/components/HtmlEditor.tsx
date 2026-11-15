import { Bold, Code2, Eye, Heading2, Image, Italic, Link2, List, ListOrdered, Pencil } from "lucide-react";
import { useRef, useState } from "react";

import { RichTextRenderer } from "@/shared/components/RichTextRenderer";
import { cx } from "@/shared/ui";

/**
 * Lightweight HTML editor for the CMS. The backend sanitizes all stored HTML
 * with bleach; the toolbar only helps content editors insert safe tags.
 */
export function HtmlEditor({
  value,
  onChange,
  label = "Мазмұн (HTML)",
  hint = "Мәтінді өңдеп, қажет болса «Алдын ала қарау» режиміне өтіңіз. Сервер HTML-ді тазалайды.",
  rows = 12,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  hint?: string;
  rows?: number;
  id?: string;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function insert(open: string, close = "", placeholder = "мәтін") {
    const node = textarea.current;
    if (!node) return;
    const start = node.selectionStart;
    const end = node.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${open}${selected}${close}${value.slice(end)}`;
    onChange(next);
    window.setTimeout(() => {
      node.focus();
      node.setSelectionRange(start + open.length, start + open.length + selected.length);
    }, 0);
  }

  const tools = [
    { label: "Тақырып 2", icon: Heading2, run: () => insert("<h2>", "</h2>", "Тақырып") },
    { label: "Қалың", icon: Bold, run: () => insert("<strong>", "</strong>") },
    { label: "Курсив", icon: Italic, run: () => insert("<em>", "</em>") },
    { label: "Тізім", icon: List, run: () => insert("<ul>\n  <li>", "</li>\n</ul>", "тармақ") },
    {
      label: "Нөмірленген тізім",
      icon: ListOrdered,
      run: () => insert("<ol>\n  <li>", "</li>\n</ol>", "тармақ"),
    },
    {
      label: "Сілтеме",
      icon: Link2,
      run: () => insert('<a href="https://example.com">', "</a>", "сілтеме"),
    },
    {
      label: "Сурет",
      icon: Image,
      run: () =>
        insert(
          '<img src="https://example.com/image.png" alt="',
          '" />',
          "сурет сипаттамасы",
        ),
    },
    { label: "Код", icon: Code2, run: () => insert("<pre><code>", "</code></pre>", "код") },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-semibold text-slate-800">
          {label}
        </label>
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-xs">
          <button
            type="button"
            className={cx(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold",
              preview ? "text-slate-600" : "bg-brand-50 text-brand-800",
            )}
            onClick={() => setPreview(false)}
          >
            <Pencil className="size-3" aria-hidden /> Өңдеу
          </button>
          <button
            type="button"
            className={cx(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold",
              preview ? "bg-brand-50 text-brand-800" : "text-slate-600",
            )}
            onClick={() => setPreview(true)}
          >
            <Eye className="size-3" aria-hidden /> Алдын ала қарау
          </button>
        </div>
      </div>
      {preview ? (
        <div className="min-h-32 rounded-xl border border-slate-300 bg-white p-4">
          <RichTextRenderer html={value} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-slate-300 bg-slate-50 p-1.5">
            {tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.label}
                  type="button"
                  title={tool.label}
                  aria-label={tool.label}
                  onClick={tool.run}
                  className="rounded-md p-1.5 text-slate-600 hover:bg-white hover:text-brand-800"
                >
                  <Icon className="size-4" aria-hidden />
                </button>
              );
            })}
          </div>
          <textarea
            id={id}
            ref={textarea}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={rows}
            className="w-full rounded-b-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-xs leading-6 text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </>
      )}
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}
