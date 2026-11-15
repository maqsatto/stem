import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GradeRubric } from "@/shared/components/GradeRubric";

const rubric = [
  { criterion: "Мәселені түсіну", points: 30 },
  { criterion: "Деректерді талдау", points: 40 },
  { criterion: "Қорытынды", points: 30 },
];

describe("GradeRubric", () => {
  it("sums selected criteria into the grade field", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<GradeRubric rubric={rubric} maxScore={100} onSubmit={onSubmit} />);

    await user.click(
      screen.getByLabelText("Мәселені түсіну критерийін орындалды деп белгілеу"),
    );
    await user.click(
      screen.getByLabelText("Деректерді талдау критерийін орындалды деп белгілеу"),
    );
    expect(screen.getByLabelText(/^Баға/)).toHaveValue(70);

    await user.type(screen.getByLabelText("Мұғалім пікірі"), "Жақсы жұмыс");
    await user.click(screen.getByRole("button", { name: "Бағаны сақтау" }));

    expect(onSubmit).toHaveBeenCalledWith({
      grade: 70,
      feedback: "Жақсы жұмыс",
      return_for_revision: false,
    });
  });

  it("rejects an out-of-range grade", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<GradeRubric rubric={[]} maxScore={50} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^Баға/), "80");
    await user.click(screen.getByRole("button", { name: "Бағаны сақтау" }));

    expect(screen.getByText("Баға 0 мен 50 аралығында болуы керек.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("requires feedback when returning for revision", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<GradeRubric rubric={[]} maxScore={100} onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText(/^Баға/), "55");
    await user.click(screen.getByLabelText("Қайта өңдеуге қайтару"));
    await user.click(screen.getByRole("button", { name: "Бағаны сақтау" }));

    expect(
      screen.getByText("Қайта өңдеуге қайтару үшін мұғалім пікірі міндетті."),
    ).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows a manual-grade hint when there is no rubric", () => {
    render(<GradeRubric rubric={[]} onSubmit={vi.fn()} />);
    expect(
      screen.getByText("Бұл жұмыс үшін құрылымдық рубрика енгізілмеген. Бағаны қолмен қойыңыз."),
    ).toBeInTheDocument();
  });
});
