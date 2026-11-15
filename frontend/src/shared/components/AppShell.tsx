import { GraduationCap, LogOut, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import { roleHome, useAuth } from "@/shared/auth";
import { roleLabels } from "@/shared/format";
import { buttonClass, DemoNotice } from "@/shared/ui";

const publicNav = [
  { to: "/ml", label: "ML" },
  { to: "/stem", label: "STEM" },
  { to: "/projects", label: "STEM жобалары" },
];

export function Brand({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5 no-underline">
      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-700 text-white shadow-sm transition-transform group-hover:-rotate-3">
        <GraduationCap className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block text-base font-extrabold tracking-tight text-ink-950">
          ML + STEM LAB
        </span>
        <span className="block text-[10px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
          білім беру платформасы
        </span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-brand-800 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Негізгі мазмұнға өту
      </a>
      <header className="public-header sticky top-0 z-40 bg-[#222]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Brand />
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <Link
                  to={roleHome(user.role)}
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 no-underline hover:bg-slate-100"
                >
                  {user.display_name}
                  <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-800 uppercase">
                    {roleLabels[user.role]}
                  </span>
                </Link>
                <button className={buttonClass("ghost", "sm")} onClick={() => void logout()}>
                  <LogOut className="size-4" aria-hidden />
                  Шығу
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={buttonClass("ghost", "sm")}>
                  Кіру
                </Link>
                <Link to="/register" className={buttonClass("primary", "sm")}>
                  Тіркелу
                </Link>
              </>
            )}
          </div>
          <button
            className={buttonClass("ghost", "sm", "md:hidden")}
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="public-mobile-nav"
            aria-label={open ? "Мәзірді жабу" : "Мәзірді ашу"}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
        <div className="hidden border-b border-[#dedede] bg-white md:block">
          <nav className="mx-auto flex max-w-7xl items-center gap-9 px-6 lg:px-8" aria-label="Негізгі навигация">
            {publicNav.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) =>
                `border-b-2 py-3 text-sm font-semibold no-underline transition-colors ${isActive ? "border-brand-600 text-brand-700" : "border-transparent text-slate-600 hover:text-brand-700"}`
              }>{item.label}</NavLink>
            ))}
          </nav>
        </div>
        {open ? (
          <div id="public-mobile-nav" className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Мобильді навигация">
              {publicNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2.5 text-sm font-semibold no-underline ${
                      isActive ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
              <div className="my-2 border-t border-slate-200" />
              {user ? (
                <>
                  <Link
                    to={roleHome(user.role)}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-800 no-underline hover:bg-brand-50"
                  >
                    {roleLabels[user.role]} кабинеті
                  </Link>
                  <button
                    className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setOpen(false);
                      void logout();
                    }}
                  >
                    Шығу
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className={buttonClass("secondary", "sm")}
                  >
                    Кіру
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setOpen(false)}
                    className={buttonClass("primary", "sm")}
                  >
                    Тіркелу
                  </Link>
                </div>
              )}
            </nav>
          </div>
        ) : null}
      </header>
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <footer className="border-t border-slate-200 bg-ink-950 text-slate-300">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
          <div>
            <p className="text-base font-bold text-white">ML + STEM LAB</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
              Машиналық оқыту алгоритмдері арқылы STEM-құзыреттіліктерді дамытатын
              біртұтас оқу платформасы.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-slate-500 uppercase">
              Оқу бағыты
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/ml" className="text-slate-300 no-underline hover:text-white">
                  1. Машиналық оқыту
                </Link>
              </li>
              <li>
                <Link to="/stem" className="text-slate-300 no-underline hover:text-white">
                  2. STEM құзыреттіліктері
                </Link>
              </li>
              <li>
                <Link to="/projects" className="text-slate-300 no-underline hover:text-white">
                  3. STEM жобалары
                </Link>
              </li>
            </ul>
          </div>
          <div className="text-xs leading-5 text-slate-500">
            <p className="font-semibold text-slate-300">Демо-нұсқа</p>
            <p className="mt-2">
              Платформа MVP мақсатында жасалған. Оқу мазмұны мен диагностикалық
              көрсеткіштер демонстрациялық; ғылыми-әдістемелік бекітуді тапсырыс беруші
              жүргізеді.
            </p>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-4 text-center text-xs text-slate-500">
          © 2026 ML + STEM LAB. Барлық деректер бір backend және PostgreSQL қорында сақталады.
        </div>
      </footer>
    </div>
  );
}

export function PublicFooterNotice() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <DemoNotice />
    </div>
  );
}
