import { Moon, Sun } from "lucide-react";
import { usePreferences } from "@/shared/preferences";

export function PreferenceControls({ darkBar = false }: { darkBar?: boolean }) {
  const { language, setLanguage, theme, setTheme } = usePreferences();
  const foreground = darkBar ? "text-white hover:bg-white/10" : "text-slate-700 hover:bg-slate-100";
  return (
    <div className="flex shrink-0 items-center gap-1">
      <select aria-label={language === "en" ? "Language" : "Тіл"} value={language}
        onChange={(event) => setLanguage(event.target.value === "en" ? "en" : "kk")}
        className={`cursor-pointer rounded-md border-0 bg-transparent px-2 py-2 text-xs font-bold ${foreground}`}>
        <option value="kk">ҚАЗ</option><option value="en">ENG</option>
      </select>
      <button type="button" aria-label={language === "en" ? (theme === "light" ? "Switch to dark theme" : "Switch to light theme") : (theme === "light" ? "Қараңғы тақырып" : "Жарық тақырып")}
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        className={`rounded-md p-2 ${foreground}`}>
        {theme === "light" ? <Moon className="size-4" aria-hidden /> : <Sun className="size-4" aria-hidden />}
      </button>
    </div>
  );
}
