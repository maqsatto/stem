import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import type { ReactNode } from "react";

import { http } from "@/shared/api";
import type { AlgorithmCard, CompetencyCard, LessonCard, Page } from "@/shared/types";
import { Select, TextInput } from "@/shared/ui";

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
  children,
}: {
  search: string;
  onSearch: (value: string) => void;
  algorithmId: string;
  onAlgorithmId: (value: string) => void;
  competencyId: string;
  onCompetencyId: (value: string) => void;
  searchLabel: string;
  children?: ReactNode;
}) {
  const refs = useCatalogRefs();
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
          placeholder="Іздеу..."
          className="pl-9"
          aria-label={searchLabel}
        />
      </div>
      <Select
        value={algorithmId}
        onChange={(event) => onAlgorithmId(event.target.value)}
        aria-label="ML алгоритмі"
      >
        <option value="">Барлық ML алгоритмдері</option>
        {refs.algorithms.map((algorithm) => (
          <option key={algorithm.id} value={algorithm.id}>
            {algorithm.title}
          </option>
        ))}
      </Select>
      <Select
        value={competencyId}
        onChange={(event) => onCompetencyId(event.target.value)}
        aria-label="STEM құзыреттілігі"
      >
        <option value="">Барлық құзыреттіліктер</option>
        {refs.competencies.map((competency) => (
          <option key={competency.id} value={competency.id}>
            {competency.title}
          </option>
        ))}
      </Select>
      {children}
    </div>
  );
}

export function LessonFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
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
    <Select value={value} onChange={(event) => onChange(event.target.value)} aria-label="Сабақ">
      <option value="">Барлық сабақтар</option>
      {(lessons.data ?? []).map((lesson) => <option key={lesson.id} value={lesson.id}>{lesson.title}</option>)}
    </Select>
  );
}
