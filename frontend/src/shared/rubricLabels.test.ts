import { expect, it } from "vitest";
import { remapRubricLabels } from "@/shared/rubricLabels";

it("keeps translations with their criteria after removal or reordering", () => {
  const a = { criterion: "A", points: 2 };
  const b = { criterion: "B", points: 3 };
  expect(remapRubricLabels([a, b], [b, a], ["English A", "English B"])).toEqual(["English B", "English A"]);
  expect(remapRubricLabels([a, b], [b], ["English A", "English B"])).toEqual(["English B"]);
  expect(remapRubricLabels([a], [{ criterion: "Changed", points: 2 }], ["English A"])).toEqual([""]);
});
