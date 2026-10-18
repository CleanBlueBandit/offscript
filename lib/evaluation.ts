export const TRIAL_CONDITIONS = {
  offscript6: "Offscript · 6 perspectives",
  offscript15: "Offscript · 15 perspectives",
  chatgpt: "Plain ChatGPT",
  unaided: "Unaided brainstorming",
} as const;

export type TrialCondition = keyof typeof TRIAL_CONDITIONS;
export type TrialDataSource = "demo" | "live" | "manual";
export type PrototypeOutcome = "pending" | "yes" | "no";
export interface TrialReview {
  reviewer: string;
  originality: number;
  usefulness: number;
  feasibility: number;
  blind: true;
  notes: string;
  at: number;
}
export interface EvaluationTrial {
  id: string;
  at: number;
  condition: TrialCondition;
  source: TrialDataSource;
  briefCode: string;
  teamCode: string;
  ideaSummary: string;
  timeBudgetMinutes: number;
  modelName?: string;
  modelBudget: string;
  minutesToCommit: number | null;
  prototype: PrototypeOutcome;
  notes: string;
  review?: TrialReview;
}

export const EVALUATION_STORAGE_KEY = "offscript-evaluation-trials-v1";
export const MAX_TRIALS = 100;
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length <= max;
const positive = (value: unknown, max: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= max;
const rating = (value: unknown): value is number =>
  Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function isEvaluationTrial(value: unknown): value is EvaluationTrial {
  if (!object(value)) return false;
  const valid =
    text(value.id, 80) &&
    value.id.length > 0 &&
    positive(value.at, 8.64e15) &&
    typeof value.condition === "string" &&
    Object.hasOwn(TRIAL_CONDITIONS, value.condition) &&
    ["demo", "live", "manual"].includes(String(value.source)) &&
    text(value.briefCode, 120) &&
    value.briefCode.trim().length > 0 &&
    text(value.teamCode, 120) &&
    value.teamCode.trim().length > 0 &&
    text(value.ideaSummary, 2000) &&
    value.ideaSummary.trim().length > 0 &&
    positive(value.timeBudgetMinutes, 1440) &&
    (value.modelName === undefined || text(value.modelName, 200)) &&
    text(value.modelBudget, 300) &&
    value.modelBudget.trim().length > 0 &&
    (value.minutesToCommit === null ||
      positive(value.minutesToCommit, 10080)) &&
    ["pending", "yes", "no"].includes(String(value.prototype)) &&
    text(value.notes, 2000);
  if (!valid) return false;
  if (value.review === undefined) return true;
  const review = value.review;
  return (
    object(review) &&
    text(review.reviewer, 120) &&
    rating(review.originality) &&
    rating(review.usefulness) &&
    rating(review.feasibility) &&
    review.blind === true &&
    text(review.notes, 2000) &&
    positive(review.at, 8.64e15)
  );
}

export function parseEvaluationTrials(raw: string | null): EvaluationTrial[] {
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (
    !Array.isArray(parsed) ||
    parsed.length > MAX_TRIALS ||
    !parsed.every(isEvaluationTrial)
  ) {
    throw new Error("The saved trial log has an unsupported format.");
  }
  if (new Set(parsed.map((trial) => trial.id)).size !== parsed.length) {
    throw new Error("The saved trial log contains duplicate records.");
  }
  return parsed;
}

// Quoting alone does not stop spreadsheet formula execution. Prefix values
// beginning with a formula marker (including after whitespace) with an apostrophe.
export function csvCell(value: string | number | null | undefined): string {
  let valueText = value == null ? "" : String(value);
  if (/^[\s\uFEFF]*[=+\-@]/u.test(valueText) || /^[\t\r\n]/u.test(valueText)) {
    valueText = "'" + valueText;
  }
  return '"' + valueText.replaceAll('"', '""') + '"';
}

export function evaluationCsv(trials: EvaluationTrial[]): string {
  const rows: (string | number | null | undefined)[][] = [
    [
      "Trial ID",
      "Recorded at (UTC)",
      "Condition",
      "Idea data source",
      "Brief code",
      "Team code",
      "Idea summary",
      "Time budget (minutes)",
      "Exact model and version",
      "Usage budget",
      "Time to commitment (minutes; blank = not committed)",
      "Working prototype",
      "Trial notes",
      "Blind reviewer",
      "Originality (1–5)",
      "Usefulness (1–5)",
      "Feasibility (1–5)",
      "Reviewer confirmed blind",
      "Review notes",
      "Reviewed at (UTC)",
    ],
  ];
  for (const trial of trials) {
    rows.push([
      trial.id,
      new Date(trial.at).toISOString(),
      TRIAL_CONDITIONS[trial.condition],
      trial.source,
      trial.briefCode,
      trial.teamCode,
      trial.ideaSummary,
      trial.timeBudgetMinutes,
      trial.modelName,
      trial.modelBudget,
      trial.minutesToCommit,
      trial.prototype,
      trial.notes,
      trial.review?.reviewer,
      trial.review?.originality,
      trial.review?.usefulness,
      trial.review?.feasibility,
      trial.review ? "yes" : "",
      trial.review?.notes,
      trial.review ? new Date(trial.review.at).toISOString() : "",
    ]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
