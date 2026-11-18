import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "kk" | "en";
type Theme = "light" | "dark";
type Preferences = {
  language: Language;
  setLanguage: (language: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const defaultPreferences: Preferences = {
  language: "kk", setLanguage: () => {}, theme: "light", setTheme: () => {},
};
const PreferencesContext = createContext<Preferences>(defaultPreferences);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem("mlstem-language") === "en" ? "en" : "kk");
  const [theme, setTheme] = useState<Theme>(() => localStorage.getItem("mlstem-theme") === "dark" ? "dark" : "light");
  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem("mlstem-language", language);
  }, [language]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("mlstem-theme", theme);
  }, [theme]);
  const value = useMemo(() => ({ language, setLanguage, theme, setTheme }), [language, theme]);
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() { return useContext(PreferencesContext); }

export function useText() {
  const { language } = usePreferences();
  return (kazakh: string, english: string) => language === "en" ? english : kazakh;
}

const englishLabels: Record<string, string> = {
  "Бір дұрыс жауап": "Single choice", "Бірнеше дұрыс жауап": "Multiple choice",
  "Ашық жауап": "Open response", "Файл жүктеу": "File upload", "Сілтеме": "Link",
  "Жеңіл": "Easy", "Орташа": "Medium", "Қиын": "Hard", "Төмен": "Low", "Жоғары": "High",
  "Тапсырылды": "Submitted", "Тексерілді": "Reviewed", "Қайта өңдеуге": "Returned",
  "ML алгоритмдері": "ML algorithms", "STEM жобалары": "STEM projects", "STEM құзыреттіліктері": "STEM competencies",
  "Сабақтар": "Lessons", "Тапсырмалар": "Tasks", "Жобалар": "Projects", "Сыныптар": "Classes",
  "Тағайындаулар": "Assignments", "Тексерулер": "Reviews", "Диагностика": "Assessments", "Диагностикалар": "Assessments",
  "Нәтижелер": "Results", "Файлдар мен ресурстар": "Files and resources", "Пайдаланушылар": "Users", "Аудит журналы": "Audit log",
  "Мазмұн каталогы": "Content library", "Әкімші · CMS": "Administrator · CMS", "Кітапхана": "Library", "Оқу бағдарламасы": "Curriculum",
  "Сабақ жоспарлары мен материалдар": "Lesson plans and materials", "Сабақтар картасы": "Lesson map", "Мұғалімге арналған материалдар": "Teacher materials",
  "Мұғалімге арналған практикалық нұсқаулық": "Practical guide for teachers", "Сыртқы ML құралдары": "External ML tools",
  "Профиль және қауіпсіздік": "Profile and security", "Аккаунт": "Account", "Пайдаланушы табылмады": "No users found",
  "Ресурс табылмады": "No resources found", "Жазба жоқ": "No records", "Жазба табылмады": "No records found",
  "Әзірге тапсырылған жұмыс жоқ": "No submissions yet", "Сүзгілерді өзгертіп көріңіз.": "Try changing the filters.",
  "Диагностика әлі пройдена емес": "Assessment not completed yet", "Алғашқы сыныпты жасап, оқушыларға қосылу кодын беріңіз.": "Create your first class and share its join code with students.",
  "Оқушылар жұмысты жібергенде ол осы жерде пайда болады.": "Student submissions will appear here.",
  "Дұрыс email енгізіңіз.": "Enter a valid email address.", "Құпиясөзді енгізіңіз.": "Enter a password.",
  "Аты-жөні кемінде 2 таңба болуы керек.": "The name must contain at least 2 characters.",
  "Құпиясөз кемінде 8 таңба болуы керек.": "The password must contain at least 8 characters.",
  "Жаңа құпиясөз кемінде 8 таңба болуы керек.": "The new password must contain at least 8 characters.",
  "Құпиясөзде әріп болуы керек.": "The password must contain a letter.", "Құпиясөзде цифр болуы керек.": "The password must contain a number.",
  "Құпиясөздер сәйкес келмейді.": "Passwords do not match.", "Ағымдағы құпиясөзді енгізіңіз.": "Enter your current password.",
  "Кемінде 8 таңба, әріп және цифр.": "At least 8 characters, including a letter and a number.",
  "Оқу материалдарына тіркелген файлдар мен сыртқы сілтемелер. Мұғалім файлдары оқушыға көрсетілмейді.": "Files and external links attached to learning materials. Teacher-only files are hidden from students.",
  "Оқушылар өздері тіркеледі; мұғалім мен әкімші аккаунттарын тек әкімші шақырады. Уақытша құпиясөзбен кірген пайдаланушы оны бірінші кіруде ауыстыруы керек.": "Students register themselves; administrators invite teachers and administrators. Users must change temporary passwords at their first login.",
  "Барлық сыныптар, мұғалімдер және оқушы саны. Сыныптарды мұғалімдер басқарады; әкімші тек бақылайды.": "All classes, teachers, and student counts. Teachers manage classes; administrators can view them.",
  "Мазмұн жариялау, пайдаланушыларды өзгерту, бағалау және файл әрекеттері. Журнал тек оқуға арналған.": "Content publishing, user changes, grading, and file actions. The log is read-only.",
  "Барлық оқу материалы бір тізімде. Жоба, жарияланған және мұрағатталған жазбаларды сүзіп, редакторға өтіңіз.": "Browse all learning materials, filter by status, and open the editor.",
  "Оң жақтағы форма арқылы файл немесе сілтеме қосыңыз.": "Use the form to add a file or link.",
  "Әкімші": "Administrator", "Файлдар": "Files", "Оқушы": "Student", "Мұғалім": "Teacher",
  "Сақтау": "Save", "Өзгерістерді сақтау": "Save changes", "Жазба жасау": "Create item", "Жаңа жазба": "New item",
  "Жариялау": "Publish", "Алдын ала қарау": "Preview", "Өңдеу": "Edit", "Жою": "Delete",
  "Жабу": "Close", "Болдырмау": "Cancel", "Қосу": "Add", "Тармақ қосу": "Add item", "Ашу": "Open",
  "Жүктеу": "Download", "Көшіру": "Copy", "Жаңарту": "Refresh", "Іздеу": "Search",
  "Тағайындау": "Assign", "Сыныпқа тағайындау": "Assign to class", "Тексеру": "Review",
  "Қайта ашу": "Reopen", "Нәтижелерге өту": "View results", "Кабинетке оралу": "Back to dashboard",
  "Атауы": "Title", "Атауы (қазақша)": "Title (Kazakh)", "Ағылшынша атауы": "English title",
  "Slug (міндетті емес)": "Slug (optional)", "Сипаттама": "Description", "Қысқаша сипаттама": "Summary",
  "Мәртебе": "Status", "Түрі": "Type", "Қиындығы": "Difficulty", "Балл": "Points",
  "Максималды балл": "Maximum score", "Талпыныс лимиті": "Attempt limit", "Реттік нөмір": "Order",
  "Сабақ": "Lesson", "Тапсырма": "Task", "Материал": "Material",
  "Материал түрі": "Material type", "ML алгоритмі": "ML algorithm", "Құзыреттіліктер": "Competencies",
  "Сабақ мақсаты": "Lesson goal", "Рефлексия сұрағы": "Reflection question", "Ұзақтығы (мин)": "Duration (minutes)",
  "Сабақ мазмұны (HTML)": "Lesson content (HTML)", "Тапсырма мәтіні (HTML)": "Task text (HTML)",
  "Нұсқаулық (HTML)": "Instructions (HTML)", "Толық мәтін (HTML)": "Full text (HTML)",
  "Мақсат (HTML)": "Goal (HTML)", "Мәселе (HTML)": "Problem (HTML)", "Жоба сипаттамасы (HTML)": "Project description (HTML)",
  "Күтілетін нәтиже": "Expected result", "Мұқаба суретінің сілтемесі": "Cover image URL",
  "Сынып": "Class", "Сынып атауы": "Class name", "Рөл": "Role", "Аудитория": "Audience",
  "Сілтеме атауы": "Link title", "Әдістеме кілті": "Methodology key", "Нұсқа": "Version",
  "Төмен деңгей шегі (%)": "Low level threshold (%)", "Орташа деңгей шегі (%)": "Medium level threshold (%)",
  "Ағымдағы құпиясөз": "Current password", "Жаңа құпиясөз": "New password", "Жаңа құпиясөзді қайталау": "Repeat new password",
  "Бастапқы құпиясөз (міндетті емес)": "Initial password (optional)", "Аты-жөні": "Full name",
  "Жоба": "Project", "Жарияланған": "Published", "Мұрағатталған": "Archived",
  "Басталмаған": "Not started", "Орындалуда": "In progress", "Белсенді": "Active", "Жабық": "Closed",
};

export function useLabel() {
  const { language } = usePreferences();
  return (label: string) => language === "en" ? (englishLabels[label] ?? label) : label;
}
