import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { roleHome, useAuth } from "@/shared/auth";
import { Button, Card, LinkButton, PageLoader } from "@/shared/ui";
import type { Role } from "@/shared/types";
import { useText } from "@/shared/preferences";

export function AccessGuard({
  roles,
  children,
}: {
  roles?: Role[];
  children: ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const t = useText();

  if (loading) return <PageLoader />;
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <Card className="text-center">
          <p className="text-xs font-bold tracking-[0.18em] text-rose-600 uppercase">
            {t("403 · Рұқсат жоқ", "403 · Access denied")}
          </p>
          <h1 className="mt-3 text-2xl font-bold text-ink-950">
            {t("Бұл бөлімге кіру рұқсатыңыз жоқ", "You do not have access to this section")}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t(`Сіз ${user.display_name} ретінде кірдіңіз. Өз кабинетіңізге оралыңыз немесе әкімшіге хабарласыңыз.`, `You are signed in as ${user.display_name}. Return to your dashboard or contact an administrator.`)}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <LinkButton to={roleHome(user.role)}>{t("Менің кабинетім", "My dashboard")}</LinkButton>
            <Button variant="secondary" onClick={() => void logout()}>
              {t("Шығу", "Log out")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}
