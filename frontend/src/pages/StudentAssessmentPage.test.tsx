import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { StudentAssessmentDetailPage } from "@/pages/StudentPages";
import { http } from "@/shared/api";

afterEach(() => vi.restoreAllMocks());

it("does not start a diagnostic before assignments have loaded", async () => {
  let resolveAssignments!: (value: unknown) => void;
  const assignmentRequest = new Promise((resolve) => { resolveAssignments = resolve; });
  vi.spyOn(http, "get").mockImplementation(async (url) => {
    if (url.startsWith("/assignments")) return await assignmentRequest as never;
    return { name: "Диагностика", kind: "pre", question_count: 1, max_score: 1,
      attempts_used: 0, attempts_limit: 1, best_score: null, can_attempt: true,
      questions: [], description: "" } as never;
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/student/assessments/a"]}>
    <Routes><Route path="/student/assessments/:id" element={<StudentAssessmentDetailPage />} /></Routes>
  </MemoryRouter></QueryClientProvider>);
  const start = await screen.findByRole("button", { name: "Талпынысты бастау" });
  expect(start).toBeDisabled();
  resolveAssignments({ items: [], total: 0, page: 1, page_size: 100 });
  await vi.waitFor(() => expect(start).toBeEnabled());
});
