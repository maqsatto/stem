import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QuizForm } from "@/shared/components/QuizForm";
import { PreferencesProvider } from "@/shared/preferences";
import type { AssessmentQuestion } from "@/shared/types";

const questions: AssessmentQuestion[] = [
  {
    id: "q1",
    type: "single_choice",
    body: "<p>ML дегеніміз не?</p>",
    points: 2,
    competency_id: "c1",
    competency_title: "Сыни ойлау",
    order_no: 1,
    options: [
      { id: "o1", label: "Машиналық оқыту", order_no: 1 },
      { id: "o2", label: "Мәтіндік редактор", order_no: 2 },
    ],
  },
  {
    id: "q2",
    type: "multiple_choice",
    body: "<p>STEM бағыттарын таңдаңыз</p>",
    points: 2,
    competency_id: null,
    competency_title: null,
    order_no: 2,
    options: [
      { id: "o3", label: "Ғылым", order_no: 1 },
      { id: "o4", label: "Технология", order_no: 2 },
      { id: "o5", label: "Әдебиет", order_no: 3 },
    ],
  },
  {
    id: "q3",
    type: "open_text",
    body: "<p>Қорытындыңызды жазыңыз</p>",
    points: 1,
    competency_id: null,
    competency_title: null,
    order_no: 3,
    options: [],
  },
];

describe("QuizForm", () => {
  it("uses English controls and validation when English is selected", async () => {
    localStorage.setItem("mlstem-language", "en");
    const user = userEvent.setup();
    render(<PreferencesProvider><QuizForm questions={[questions[0]]} onSubmit={vi.fn()} onSave={vi.fn()} /></PreferencesProvider>);
    expect(screen.getByText("Select one answer.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save answers" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit answers" }));
    expect(screen.getByText("Answer every question before submitting.")).toBeInTheDocument();
  });
  it("saves incomplete answers as a draft without submitting the test", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onSubmit = vi.fn();
    render(<QuizForm questions={questions} onSave={onSave} onSubmit={onSubmit} />);
    await user.click(screen.getByLabelText("Машиналық оқыту"));
    await user.click(screen.getByRole("button", { name: "Жауаптарды сақтау" }));
    expect(onSave).toHaveBeenCalledWith([
      { question_id: "q1", answer_json: { selected_option_ids: ["o1"] } },
      { question_id: "q2", answer_json: { selected_option_ids: [] } },
      { question_id: "q3", answer_json: { text: "" } },
    ]);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByText("Жауаптар сақталды." )).toBeInTheDocument();
  });
  it("blocks submission until every question is answered", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<QuizForm questions={questions} onSubmit={onSubmit} />);

    await user.click(screen.getByRole("button", { name: "Жауаптарды жіберу" }));

    expect(
      screen.getByText("Барлық сұраққа жауап беріңіз. Жауапсыз қалған сұрақтар бар."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("collects single, multiple and open answers", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<QuizForm questions={questions} onSubmit={onSubmit} />);

    await user.click(screen.getByLabelText("Машиналық оқыту"));
    await user.click(screen.getByLabelText("Ғылым"));
    await user.click(screen.getByLabelText("Технология"));
    await user.click(screen.getByRole("button", { name: "Жауаптарды жіберу" }));
    expect(onSubmit).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText("3-сұраққа жауап"),
      "ML — деректерден заңдылық табатын әдіс.",
    );
    await user.click(screen.getByRole("button", { name: "Жауаптарды жіберу" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const answers = onSubmit.mock.calls[0][0] as Array<{
      question_id: string;
      answer_json: { selected_option_ids?: string[]; text?: string };
    }>;
    expect(answers).toEqual([
      { question_id: "q1", answer_json: { selected_option_ids: ["o1"] } },
      { question_id: "q2", answer_json: { selected_option_ids: ["o3", "o4"] } },
      {
        question_id: "q3",
        answer_json: { text: "ML — деректерден заңдылық табатын әдіс." },
      },
    ]);
  });

  it("shows the answered counter and server-side errors", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("Сервер қатесі"));
    render(<QuizForm questions={[questions[0]]} onSubmit={onSubmit} />);

    await user.click(screen.getByLabelText("Машиналық оқыту"));
    expect(screen.getByText("1", { selector: "strong" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Жауаптарды жіберу" }));

    expect(await screen.findByText("Сервер қатесі")).toBeInTheDocument();
  });
});
