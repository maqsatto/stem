import { expect, it } from "vitest";
import { answerLabels } from "@/shared/answerLabels";

it("shows the selected answer even when another answer is correct", () => {
  const options = [{ id: "wrong", label: "Incorrect choice", order_no: 1, is_correct: false }, { id: "correct", label: "Correct choice", order_no: 2, is_correct: true }];
  expect(answerLabels(["wrong"], options)).toEqual(["Incorrect choice"]);
  expect(answerLabels(["correct"], options)).toEqual(["Correct choice"]);
});
