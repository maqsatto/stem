import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";

import { roleHome, useAuth } from "@/shared/auth";
import { Button, Card, LinkButton, PageLoader } from "@/shared/ui";
import type { Role } from "@/shared/types";

export function AccessGuard({
  roles,
  children,
}: {
  roles?: Role[];
  children: ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

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
            403 · Рұқсат жоқ
          </p>
          <h1 className="mt-3 text-2xl font-bold text-ink-950">
            Бұл бөлімге кіру рұқсатыңыз жоқ
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Сіз {user.display_name} ретінде кірдіңіз. Өз кабинетіңізге оралыңыз немесе
            әкімшіге хабарласыңыз.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <LinkButton to={roleHome(user.role)}>Менің кабинетім</LinkButton>
            <Button variant="secondary" onClick={() => void logout()}>
              Шығу
            </Button>
          </div>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}
