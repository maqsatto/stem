import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { http } from "@/shared/api";
import { CatalogFilters } from "@/shared/components/CatalogFilters";

it("shows algorithms and competencies from paginated catalog responses", async () => {
  vi.spyOn(http, "get").mockImplementation(async (url) => ({
    items: url.startsWith("/algorithms")
      ? [{ id: "a", title: "Алгоритм" }]
      : [{ id: "c", title: "Құзыреттілік" }],
    total: 1,
    page: 1,
    page_size: 100,
  }) as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CatalogFilters search="" onSearch={() => {}} algorithmId="" onAlgorithmId={() => {}}
        competencyId="" onCompetencyId={() => {}} searchLabel="Іздеу" />
    </QueryClientProvider>,
  );
  expect(await screen.findByRole("option", { name: "Алгоритм" })).toBeInTheDocument();
  expect(await screen.findByRole("option", { name: "Құзыреттілік" })).toBeInTheDocument();
  vi.restoreAllMocks();
});
