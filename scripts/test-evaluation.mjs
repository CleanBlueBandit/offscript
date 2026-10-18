import { strict as assert } from "node:assert";
import { register } from "node:module";

register(
  `data:text/javascript,${encodeURIComponent(`
  import { readFileSync } from 'node:fs';
  import { stripTypeScriptTypes } from 'node:module';
  export function load(url, context, nextLoad) {
    if (url.endsWith('.ts')) return {
      format: 'module',
      source: stripTypeScriptTypes(readFileSync(new URL(url), 'utf8'), { mode: 'transform' }),
      shortCircuit: true,
    };
    return nextLoad(url, context);
  }
`)}`,
  import.meta.url,
);

const { csvCell, evaluationCsv, isEvaluationTrial, parseEvaluationTrials } =
  await import("../lib/evaluation.ts");
const trial = {
  id: "observed-trial-1",
  at: 1792290000000,
  condition: "offscript6",
  source: "live",
  briefCode: "commute-01",
  teamCode: "team-a",
  ideaSummary: "An actual observed idea, with a specific mechanism.",
  timeBudgetMinutes: 20,
  modelBudget: "same-model / 10 calls",
  minutesToCommit: 12.5,
  prototype: "pending",
  notes: "No invented results.",
};

assert.equal(isEvaluationTrial(trial), true);
assert.equal(isEvaluationTrial({ ...trial, minutesToCommit: null }), true);
assert.deepEqual(parseEvaluationTrials(JSON.stringify([trial])), [trial]);
assert.deepEqual(parseEvaluationTrials(null), []);
for (const mutation of [
  { minutesToCommit: -1 },
  { minutesToCommit: Infinity },
  { at: 9e15 },
  { timeBudgetMinutes: 0 },
  { condition: "magic" },
  { condition: "constructor" },
  { source: "simulated-live" },
  { prototype: "probably" },
  { briefCode: "  " },
  { teamCode: "" },
  { ideaSummary: "" },
  { modelBudget: "" },
])
  assert.equal(
    isEvaluationTrial({ ...trial, ...mutation }),
    false,
    JSON.stringify(mutation),
  );
assert.throws(() => parseEvaluationTrials("not JSON"));
assert.throws(() => parseEvaluationTrials(JSON.stringify([trial, trial])));
assert.throws(() =>
  parseEvaluationTrials(JSON.stringify([{ ...trial, prototype: "unknown" }])),
);

const review = {
  reviewer: "reviewer-a",
  originality: 4,
  usefulness: 3,
  feasibility: 5,
  blind: true,
  notes: "Reasons",
  at: 1792290060000,
};
assert.equal(isEvaluationTrial({ ...trial, review }), true);
for (const mutation of [
  { originality: 0 },
  { usefulness: 6 },
  { feasibility: 2.5 },
  { blind: false },
]) {
  assert.equal(
    isEvaluationTrial({ ...trial, review: { ...review, ...mutation } }),
    false,
  );
}

for (const value of [
  '=HYPERLINK("bad")',
  "+SUM(1,2)",
  "-1+2",
  "@SUM(1,2)",
  "  =1+2",
  "\t=1+2",
  "\ntext",
]) {
  assert.ok(
    csvCell(value).startsWith("\"'"),
    `Formula-safe: ${JSON.stringify(value)}`,
  );
}
assert.equal(csvCell('A "quoted", value'), '"A ""quoted"", value"');
assert.equal(csvCell(12.5), '"12.5"');
const csv = evaluationCsv([
  { ...trial, review, ideaSummary: "=FORMULA()", minutesToCommit: null },
]);
assert.ok(csv.includes('"\'=FORMULA()"'));
assert.ok(csv.includes('"Offscript · 6 perspectives"'));
assert.ok(csv.includes('"reviewer-a","4","3","5","yes"'));
assert.ok(csv.includes('"same-model / 10 calls","","pending"'));
assert.equal(
  evaluationCsv([]).split("\r\n").length,
  2,
  "Empty exports include only headers",
);
console.log(
  "Evaluation trial validation, blind-review constraints, missing outcomes, and CSV safety checks passed.",
);
