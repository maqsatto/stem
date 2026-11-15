import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { TeacherTasksPage } from "@/pages/TeacherPages";
import { http } from "@/shared/api";

afterEach(() => vi.restoreAllMocks());

it("filters teacher tasks by lesson", async () => {
  vi.spyOn(http, "get").mockImplementation(async (url) => {
    if (url.startsWith("/lessons")) return { items: [{ id: "l", title: "Бірінші сабақ" }] } as never;
    if (url.startsWith("/tasks")) {
      const matches = new URLSearchParams(url.split("?")[1]).get("lesson_id") === "l";
      return { items: matches ? [{ id: "t", title: "Сабақ тапсырмасы", type: "quiz", difficulty: "easy", max_score: 10, competencies: [] }] : [], total: matches ? 1 : 0 } as never;
    }
    return { items: [] } as never;
  });
  const user = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter><TeacherTasksPage /></MemoryRouter></QueryClientProvider>);
  await screen.findByRole("option", { name: "Бірінші сабақ" });
  await user.selectOptions(screen.getByLabelText("Сабақ"), "l");
  expect(await screen.findByRole("link", { name: /Сабақ тапсырмасы/ })).toBeInTheDocument();
});
