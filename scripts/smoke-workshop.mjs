/** Run against a local server: node scripts/smoke-workshop.mjs http://127.0.0.1:5173 */
import assert from "node:assert/strict";
import { register } from "node:module";
const loader = `
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
export async function resolve(s,c,n){try{return await n(s,c)}catch(e){if((s.startsWith('./')||s.startsWith('../'))&&!/\\.[a-z]+$/i.test(s))return n(s+'.ts',c);throw e}}
export function load(u,c,n){return u.endsWith('.ts')?{format:'module',source:stripTypeScriptTypes(readFileSync(new URL(u),'utf8'),{mode:'transform'}),shortCircuit:true}:n(u,c)}
`;
register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url);
const { DEMO_BRIEF } = await import("../lib/preset.ts");
const { PERSPECTIVES } = await import("../lib/perspectives.ts");
const origin = new URL(process.argv[2] || "http://127.0.0.1:5173").origin;
async function post(route, body, expected = 200) {
  const r = await fetch(`${origin}/api/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, expected, data.error);
  return data;
}
const base = { brief: DEMO_BRIEF, demo: true };
const { explorations, mode } = await post("explore", {
  ...base,
  perspectives: PERSPECTIVES.slice(0, 15),
});
assert.equal(mode, "demo");
assert.equal(explorations.length, 15);
assert.equal(explorations.flatMap((e) => e.ingredients).length, 45);
const reroll = await post("explore", {
  ...base,
  perspectives: [PERSPECTIVES[50]],
});
assert.equal(reroll.explorations.length, 1);
const six = await post("explore", {
  ...base,
  perspectives: PERSPECTIVES.slice(0, 6),
});
assert.equal(six.explorations.length, 6);
await post("explore", { ...base, perspectives: [] }, 400);
await post(
  "explore",
  { ...base, perspectives: PERSPECTIVES.slice(0, 16) },
  400,
);
const ingredients = explorations.slice(0, 3).map((e) => e.ingredients[1]);
const { concepts } = await post("synthesize", { ...base, ingredients });
assert.equal(concepts.length, 3);
for (const type of ["autonomous", "widget", "invert", "wildcard", "splice"]) {
  const r = await post("mutate", {
    ...base,
    parent: concepts[0],
    type,
    ingredient: explorations[4].ingredients[1],
    perspective: PERSPECTIVES[80],
  });
  assert(r.concepts.length > 0);
  assert.equal(r.concepts[0].parentId, concepts[0].id);
  assert.equal(r.concepts[0].mutation, type);
}
const { crucible } = await post("crucible", { ...base, concept: concepts[0] });
assert(crucible.weakestAssumption.test);
assert(crucible.blueprint.demo.length >= 4);
assert(
  crucible.blueprint.architecture.some((s) => s.includes("Google Calendar")),
);
assert(crucible.experiment.steps.length >= 2);
assert(crucible.scope.mustBuild.length);
const combined = await post("combine", {
  ...base,
  concepts: concepts.slice(0, 2),
});
assert.equal(combined.concepts.length, 1);
assert.deepEqual(
  new Set(combined.concepts[0].inheritedFrom.map((s) => s.conceptId)),
  new Set(concepts.slice(0, 2).map((c) => c.id)),
);
const legacy = {
  ...concepts[0],
  mechanism: undefined,
  assessment: undefined,
  assumptions: undefined,
};
const enriched = await post("assess", { ...base, concept: legacy });
assert.equal(enriched.concept.id, legacy.id);
assert.equal(enriched.concept.pitch, legacy.pitch);
assert(enriched.concept.assessment.feasibility);
await post("combine", { ...base, concepts: [concepts[0], concepts[0]] }, 400);
const status = await (await fetch(`${origin}/api/status`)).json();
assert.equal(status.model, "gemini-3.8-flash");
if (!status.configured)
  await post("synthesize", { ...base, demo: false, ingredients }, 503);
console.log(
  "PASS HTTP 6/15-lens exploration, reroll, validation, synthesis, mutations, combination/provenance, legacy assessment, experiment/scope, and explicit live configuration handling",
);
