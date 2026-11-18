import type { TaskOption } from "@/shared/types";

/** Resolve selected IDs independently from the answer key. */
export function answerLabels(ids: string[], options: TaskOption[]): string[] {
  const labels = new Map(options.map((option) => [option.id, option.label]));
  return ids.map((id) => labels.get(id) ?? id);
}
