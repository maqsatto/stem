import { expect, it } from "vitest";
import { pairedClassAverages } from "@/shared/classAverages";
import type { ClassStudentResult } from "@/shared/types";

it("averages only students with both results, including zero scores", () => {
  const student = (pre: number | null, post: number | null) => ({ pre_overall: pre, post_overall: post }) as ClassStudentResult;
  expect(pairedClassAverages([student(0, 40), student(60, 80), student(90, null)])).toEqual({ pre: 30, post: 60, delta: 30 });
});
