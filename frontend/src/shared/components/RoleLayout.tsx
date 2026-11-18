import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Compass,
  FileText,
  FolderKanban,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Library,
  LineChart,
  ListChecks,
  LogOut,
  Network,
  Presentation,
  School,
  Target,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "@/shared/auth";
import { Brand } from "@/shared/components/AppShell";
import { PreferenceControls } from "@/shared/components/PreferenceControls";
import { useText } from "@/shared/preferences";
import { AccessGuard } from "@/shared/components/AccessGuard";
import { roleLabels } from "@/shared/format";
import { buttonClass } from "@/shared/ui";
import type { Role } from "@/shared/types";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const roleNavigation: Record<Role, NavItem[]> = {
  student: [
    { to: "/student/dashboard", label: "Менің оқуым", icon: LayoutDashboard, end: true },
    { to: "/student/lessons", label: "Сабақтар", icon: BookOpen },
    { to: "/student/tasks", label: "Тапсырмалар", icon: ClipboardList },
    { to: "/student/projects", label: "Жобалар", icon: FolderKanban },
    { to: "/student/assessments", label: "Диагностика", icon: ListChecks },
    { to: "/student/results", label: "Нәтижелер", icon: BarChart3 },
    { to: "/student/class", label: "Менің сыныбым", icon: Users },
    { to: "/student/practice", label: "Практика", icon: Compass },
  ],
  teacher: [
    { to: "/teacher/dashboard", label: "Шолу", icon: LayoutDashboard, end: true },
    { to: "/teacher/methodology", label: "Әдістеме", icon: Network },
    { to: "/teacher/curriculum", label: "Оқу бағдарламасы", icon: Layers },
    { to: "/teacher/lessons", label: "Сабақтар", icon: BookOpen },
    { to: "/teacher/tasks", label: "Тапсырмалар", icon: ClipboardList },
    { to: "/teacher/projects", label: "Жобалар", icon: FolderKanban },
    { to: "/teacher/classes", label: "Сыныптар", icon: School },
    { to: "/teacher/assignments", label: "Тағайындаулар", icon: CalendarDays },
    { to: "/teacher/reviews", label: "Тексерулер", icon: CheckCircle2 },
    { to: "/teacher/diagnostics", label: "Диагностика", icon: ListChecks },
    { to: "/teacher/results", label: "Нәтижелер", icon: LineChart },
    { to: "/teacher/tools", label: "Құралдар", icon: Wrench },
  ],
  admin: [
    { to: "/admin/content", label: "Мазмұн каталогы", icon: Library, end: true },
    { to: "/admin/algorithms", label: "ML алгоритмдері", icon: GraduationCap },
    { to: "/admin/competencies", label: "STEM құзыреттіліктері", icon: Target },
    { to: "/admin/lessons", label: "Сабақтар", icon: BookOpen },
    { to: "/admin/tasks", label: "Тапсырмалар", icon: ClipboardList },
    { to: "/admin/projects", label: "Жобалар", icon: FolderKanban },
    { to: "/admin/assessments", label: "Диагностикалар", icon: ListChecks },
    { to: "/admin/files", label: "Файлдар", icon: FileText },
    { to: "/admin/users", label: "Пайдаланушылар", icon: UserCog },
    { to: "/admin/classes", label: "Сыныптар", icon: School },
  ],
};

const roleDescriptions: Record<Role, string> = {
  student: "Оқу, тапсырмалар және STEM динамикасы",
  teacher: "Сыныптар, тағайындаулар және диагностика",
  admin: "Мазмұнды басқару және платформа әкімшілігі",
};

function RoleNav({ role, mobile = false }: { role: Role; mobile?: boolean }) {
  const t = useText();
  const translations: Record<string, string> = {
    "Менің оқуым": "My learning", "Сабақтар": "Lessons", "Тапсырмалар": "Tasks",
    "Жобалар": "Projects", "Диагностика": "Assessment", "Нәтижелер": "Results",
    "Менің сыныбым": "My class", "Практика": "Practice", "Шолу": "Overview",
    "Әдістеме": "Methodology", "Оқу бағдарламасы": "Curriculum", "Сыныптар": "Classes",
    "Тағайындаулар": "Assignments", "Тексерулер": "Reviews", "Құралдар": "Tools",
    "Мазмұн каталогы": "Content library", "ML алгоритмдері": "ML algorithms",
    "STEM құзыреттіліктері": "STEM competencies", "Диагностикалар": "Assessments",
    "Файлдар": "Files", "Пайдаланушылар": "Users",
  };
  return (
    <nav
      aria-label={`${roleLabels[role]} кабинетінің навигациясы`}
      className={
        mobile
          ? "flex gap-1 overflow-x-auto px-4 py-2"
          : "flex flex-col gap-1 px-3 py-4"
      }
    >
      {roleNavigation[role].map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              mobile
                ? `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold no-underline ${
                    isActive
                      ? "bg-brand-50 text-brand-800"
                      : "text-slate-600 hover:bg-slate-100"
                  }`
                : `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold no-underline transition-colors ${
                    isActive
                      ? "bg-brand-50 text-brand-800"
                      : "text-slate-600 hover:bg-slate-100 hover:text-ink-950"
                  }`
            }
          >
            <Icon className={mobile ? "size-3.5" : "size-4"} aria-hidden />
            {t(item.label, translations[item.label] ?? item.label)}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function RoleLayout({ role }: { role: Role }) {
  const { user, logout } = useAuth();
  const t = useText();
  const roleName = { student: t("Оқушы", "Student"), teacher: t("Мұғалім", "Teacher"), admin: t("Әкімші", "Administrator") }[role];
  const roleDescription = {
    student: t(roleDescriptions.student, "Learning, assignments and STEM progress"),
    teacher: t(roleDescriptions.teacher, "Classes, assignments and assessments"),
    admin: t(roleDescriptions.admin, "Content and platform administration"),
  }[role];

  return (
    <AccessGuard roles={[role]}>
      <div className="min-h-screen bg-slate-50">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-slate-200 bg-white lg:flex">
          <div className="border-b border-slate-200 px-5 py-4">
            <Brand />
            <p className="mt-3 text-xs leading-5 text-slate-500">{roleDescription}</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <RoleNav role={role} />
          </div>
          <div className="border-t border-slate-200 p-4">
            <div className="mb-3 rounded-xl bg-slate-50 p-3">
              <p className="truncate text-sm font-semibold text-ink-950">{user?.display_name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
              <p className="mt-1 text-[10px] font-bold tracking-wide text-brand-700 uppercase">
                {roleName}
              </p>
            </div>
            <button
              className={buttonClass("secondary", "sm", "w-full")}
              onClick={() => void logout()}
            >
              <LogOut className="size-4" aria-hidden />
              {t("Шығу", "Log out")}
            </button>
          </div>
        </aside>

        <div className="lg:pl-72">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="lg:hidden">
                <Brand />
              </div>
              <div className="hidden lg:block">
                <p className="text-xs font-bold tracking-[0.18em] text-brand-700 uppercase">
                  {t(`${roleLabels[role]} кабинеті`, `${roleName} dashboard`)}
                </p>
                <p className="text-sm text-slate-500">{roleDescription}</p>
              </div>
              <div className="flex items-center gap-3">
                <PreferenceControls />
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-ink-950">{user?.display_name}</p>
                  <p className="text-xs text-slate-500">{roleName}</p>
                </div>
                <button
                  className={buttonClass("ghost", "sm")}
                  onClick={() => void logout()}
                  aria-label={t("Аккаунттан шығу", "Log out")}
                >
                  <LogOut className="size-4" aria-hidden />
                  <span className="hidden sm:inline">{t("Шығу", "Log out")}</span>
                </button>
              </div>
            </div>
            <div className="border-t border-slate-100 lg:hidden">
              <RoleNav role={role} mobile />
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>
    </AccessGuard>
  );
}

export function TeacherResourceBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-800 uppercase">
      <Presentation className="size-3" aria-hidden />
      Мұғалімге
    </span>
  );
}
