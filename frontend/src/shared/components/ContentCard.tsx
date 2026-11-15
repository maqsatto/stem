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
    <Card className="flex h-full flex-col transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {icon ? (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              {icon}
            </span>
          ) : null}
          <div>
            <h3 className="text-base font-bold leading-6 text-ink-950">{title}</h3>
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
