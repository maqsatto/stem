import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { Badge, Card } from "@/shared/ui";

export function ContentCard({
  to,
  title,
  description,
  meta,
  badges,
  footer,
  icon,
  demo = false,
}: {
  to?: string;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  badges?: ReactNode;
  footer?: ReactNode;
  icon?: ReactNode;
  demo?: boolean;
}) {
  const content = (
    <Card className="flex h-full flex-col border-transparent bg-transparent transition hover:border-[#e3e3e3] hover:bg-white hover:shadow-[4px_8px_20px_rgba(130,130,130,0.16)] max-sm:border-[#e3e3e3] max-sm:bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {icon ? (
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700">
              {icon}
            </span>
          ) : null}
          <div>
            <h3 className="text-lg font-bold leading-6 text-ink-950">{title}</h3>
            {meta ? <div className="mt-1 text-xs text-slate-500">{meta}</div> : null}
          </div>
        </div>
        {demo ? <Badge tone="amber">Демо</Badge> : null}
      </div>
      {description ? (
        <div className="mt-3 line-clamp-4 text-sm leading-6 text-slate-600">{description}</div>
      ) : null}
      {badges ? <div className="mt-4 flex flex-wrap gap-1.5">{badges}</div> : null}
      {footer ? <div className="mt-auto pt-4 text-sm font-semibold text-brand-700">{footer}</div> : null}
    </Card>
  );

  if (!to) return content;
  return (
    <Link to={to} className="block h-full no-underline">
      {content}
    </Link>
  );
}
