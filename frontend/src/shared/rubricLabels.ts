import type { RubricItem } from "@/shared/types";

/** Keep translations only for uniquely identifiable unchanged criteria. */
export function remapRubricLabels(previous: RubricItem[], next: RubricItem[], labels: string[]): string[] {
  return next.map((item) => {
    const matches = previous.flatMap((old, index) => old.criterion === item.criterion ? [index] : []);
    const nextMatches = next.filter((candidate) => candidate.criterion === item.criterion);
    return matches.length === 1 && nextMatches.length === 1 ? labels[matches[0]] ?? "" : "";
  });
}
