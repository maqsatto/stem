import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

import { http } from "@/shared/api";
import type { AlgorithmCard, Classroom, CompetencyCard, LessonCard, Page } from "@/shared/types";
import { Select, TextInput } from "@/shared/ui";
import { usePreferences, useText } from "@/shared/preferences";
import { localizeAlgorithm, localizeCompetency, localizeLesson } from "@/shared/localizeContent";

/**
 * Shared reference data for catalog filters. TanStack Query caches the two
 * requests, so using the hook on several pages does not duplicate traffic.
 */
export function useCatalogRefs() {
  const algorithms = useQuery({
    queryKey: ["catalog", "algorithms", "filters"],
    queryFn: () => http.get<Page<AlgorithmCard>>("/algorithms?page_size=100"),
  });
  const competencies = useQuery({
    queryKey: ["catalog", "competencies", "filters"],
    queryFn: () => http.get<Page<CompetencyCard>>("/competencies?page_size=100"),
  });
  return {
    algorithms: algorithms.data?.items ?? [],
    competencies: competencies.data?.items ?? [],
  };
}

export function CatalogFilters({
  search,
  onSearch,
  algorithmId,
  onAlgorithmId,
  competencyId,
  onCompetencyId,
  searchLabel,
  sort,
  onSort,
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  algorithmId: string;
  onAlgorithmId: (value: string) => void;
  competencyId: string;
  onCompetencyId: (value: string) => void;
  searchLabel: string;
  sort?: string;
  onSort?: (value: string) => void;
  children?: ReactNode;
}) {
  const refs = useCatalogRefs();
  const { language } = usePreferences();
  const t = useText();
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-3 left-3 size-4 text-slate-400"
          aria-hidden
        />
        <TextInput
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={t("Іздеу...", "Search...")}
          className="pl-9"
          aria-label={searchLabel}
        />
      </div>
      <Select
        value={algorithmId}
        onChange={(event) => onAlgorithmId(event.target.value)}
        aria-label={t("ML алгоритмі", "ML algorithm")}
      >
        <option value="">{t("Барлық ML алгоритмдері", "All ML algorithms")}</option>
        {refs.algorithms.map((algorithm) => (
          <option key={algorithm.id} value={algorithm.id}>
            {localizeAlgorithm(algorithm, language).title}
          </option>
        ))}
      </Select>
      <Select
        value={competencyId}
        onChange={(event) => onCompetencyId(event.target.value)}
        aria-label={t("STEM құзыреттілігі", "STEM competency")}
      >
        <option value="">{t("Барлық құзыреттіліктер", "All competencies")}</option>
        {refs.competencies.map((competency) => (
          <option key={competency.id} value={competency.id}>
            {localizeCompetency(competency, language).title}
          </option>
        ))}
      </Select>
      {onSort ? <Select value={sort ?? "order"} onChange={(event) => onSort(event.target.value)} aria-label={t("Сұрыптау", "Sort")}>
        <option value="order">{t("Реті бойынша", "Default order")}</option>
        <option value="title">{t("Атауы бойынша", "Title")}</option>
        <option value="date">{t("Жаңа материалдар алдымен", "Newest first")}</option>
      </Select> : null}
      {children}
    </div>
  );
}

export function LessonFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { language } = usePreferences();
  const t = useText();
  const lessons = useQuery({
    queryKey: ["catalog", "lessons", "filters"],
    queryFn: async () => {
      const items: LessonCard[] = [];
      let page = 1;
      let total = 0;
      do {
        const result = await http.get<Page<LessonCard>>(`/lessons?page=${page}&page_size=100`);
        if (result.items.length === 0) break;
        items.push(...result.items);
        total = result.total;
        page += 1;
      } while (items.length < total);
      return items;
    },
  });
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label={t("Сабақ", "Lesson")}>
      <option value="">{t("Барлық сабақтар", "All lessons")}</option>
      {(lessons.data ?? []).map((lesson) => <option key={lesson.id} value={lesson.id}>{localizeLesson(lesson, language).title}</option>)}
    </Select>
  );
}

export function ClassFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useText();
  const classes = useQuery({
    queryKey: ["catalog", "classes", "filters"],
    queryFn: () => http.get<Page<Classroom>>("/classes?page_size=100"),
  });
  return <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label={t("Сынып", "Class")}>
    <option value="">{t("Барлық сыныптар", "All classes")}</option>
    {(classes.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
  </Select>;
}
