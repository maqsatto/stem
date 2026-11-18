/** Omit unchanged structural fields so metadata remains editable after attempts start. */
export function omitUnchangedAssessmentStructure(
  payload: Record<string, unknown>,
  current: { kind: string; version: number; methodologyKey: string; questions: unknown; scoring: unknown },
  initial: { kind: string; version: number; methodologyKey: string; questions: unknown; scoring: unknown },
) {
  const result = { ...payload };
  if (current.kind === initial.kind) delete result.kind;
  if (current.version === initial.version) delete result.version;
  if (current.methodologyKey === initial.methodologyKey) delete result.methodology_key;
  if (JSON.stringify(current.questions) === JSON.stringify(initial.questions)) delete result.questions;
  if (JSON.stringify(current.scoring) === JSON.stringify(initial.scoring)) delete result.scoring_config_json;
  return result;
}
