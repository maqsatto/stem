import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { TeacherProjectsPage } from "@/pages/TeacherPages";
import { http } from "@/shared/api";

afterEach(() => vi.restoreAllMocks());

it("filters the teacher project catalog by search, algorithm and competency", async () => {
  const get = vi.spyOn(http, "get").mockImplementation(async (url) => {
    if (url.startsWith("/algorithms")) return { items: [{ id: "a", title: "Алгоритм" }] } as never;
    if (url.startsWith("/competencies")) return { items: [{ id: "c", title: "Құзыреттілік" }] } as never;
    const params = new URLSearchParams(url.split("?")[1]);
    const matches = params.get("q") === "Ауа" && params.get("algorithm_id") === "a" && params.get("competency_id") === "c";
    return { items: matches ? [{ id: "p", title: "Ауа жобасы", summary: "", competencies: [] }] : [], total: matches ? 1 : 0 } as never;
  });
  const user = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><TeacherProjectsPage /></MemoryRouter></QueryClientProvider>);

  await user.type(screen.getByLabelText("Жоба іздеу"), "Ауа");
  await user.selectOptions(await screen.findByLabelText("ML алгоритмі"), "a");
  await user.selectOptions(await screen.findByLabelText("STEM құзыреттілігі"), "c");
  expect(await screen.findByRole("link", { name: /Ауа жобасы/ })).toBeInTheDocument();
  expect(get).toHaveBeenCalled();
});
