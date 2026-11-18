import { LogOut, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import { roleHome, useAuth } from "@/shared/auth";
import { roleLabels } from "@/shared/format";
import { buttonClass, DemoNotice } from "@/shared/ui";
import { PreferenceControls } from "@/shared/components/PreferenceControls";
import { useText } from "@/shared/preferences";

const publicNav = [
  { to: "/ml", label: "ML" },
  { to: "/stem", label: "STEM" },
  { to: "/projects", label: "STEM жобалары" },
];

export function Brand({ to = "/" }: { to?: string }) {
  const t = useText();
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5 no-underline">
      <img
        src="/images/platform-logo.png"
        alt=""
        aria-hidden="true"
        className="size-10 shrink-0 rounded-xl shadow-sm transition-transform group-hover:-rotate-3"
      />
      <span className="leading-tight">
        <span className="block text-base font-extrabold tracking-tight text-ink-950">
          ML + STEM LAB
        </span>
        <span className="block text-[10px] font-semibold tracking-[0.16em] text-brand-700 uppercase">
          {t("білім беру платформасы", "learning platform")}
        </span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const t = useText();

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
          <PreferenceControls darkBar />
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
                  {t("Шығу", "Log out")}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className={buttonClass("ghost", "sm")}>
                  {t("Кіру", "Log in")}
                </Link>
                <Link to="/register" className={buttonClass("primary", "sm")}>
                  {t("Тіркелу", "Sign up")}
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
              }>{item.to === "/projects" ? t(item.label, "STEM projects") : item.label}</NavLink>
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
                  {item.to === "/projects" ? t(item.label, "STEM projects") : item.label}
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
                    {t("Шығу", "Log out")}
                  </button>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className={buttonClass("secondary", "sm")}
                  >
                    {t("Кіру", "Log in")}
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setOpen(false)}
                    className={buttonClass("primary", "sm")}
                  >
                    {t("Тіркелу", "Sign up")}
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
              {t("Машиналық оқыту алгоритмдері арқылы STEM-құзыреттіліктерді дамытатын біртұтас оқу платформасы.", "A learning platform for developing STEM skills with machine learning.")}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-slate-500 uppercase">
              {t("Оқу бағыты", "Learning path")}
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link to="/ml" className="text-slate-300 no-underline hover:text-white">
                  {t("1. Машиналық оқыту", "1. Machine learning")}
                </Link>
              </li>
              <li>
                <Link to="/stem" className="text-slate-300 no-underline hover:text-white">
                  {t("2. STEM құзыреттіліктері", "2. STEM competencies")}
                </Link>
              </li>
              <li>
                <Link to="/projects" className="text-slate-300 no-underline hover:text-white">
                  {t("3. STEM жобалары", "3. STEM projects")}
                </Link>
              </li>
            </ul>
          </div>
          <div className="text-xs leading-5 text-slate-500">
            <p className="font-semibold text-slate-300">{t("Демо-нұсқа", "Demo version")}</p>
            <p className="mt-2">
              {t("Платформа MVP мақсатында жасалған. Оқу мазмұны мен диагностикалық көрсеткіштер демонстрациялық; ғылыми-әдістемелік бекітуді тапсырыс беруші жүргізеді.", "This is a demo. Learning content and assessment indicators require educational approval.")}
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
