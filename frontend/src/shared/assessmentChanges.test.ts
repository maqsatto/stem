import { expect, it } from "vitest";
import { omitUnchangedAssessmentStructure } from "@/shared/assessmentChanges";

it("allows metadata edits while preserving structural changes for version protection", () => {
  const original = { kind: "pre", version: 1, methodologyKey: "method", questions: [{ body: "Question" }], scoring: { low: 50 } };
  const payload = { name: "New title", kind: "pre", version: 1, methodology_key: "method", questions: original.questions, scoring_config_json: original.scoring };
  expect(omitUnchangedAssessmentStructure(payload, original, original)).toEqual({ name: "New title" });
  expect(omitUnchangedAssessmentStructure(payload, { ...original, questions: [{ body: "Changed" }] }, original)).toHaveProperty("questions");
});
