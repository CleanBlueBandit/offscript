import assert from "node:assert/strict";
import test from "node:test";
import { composeHandoffPrompt, demoEngineeringSpec, handoffFingerprint, isHandoffCurrent, sameDecision, type HandoffInput } from "../lib/handoff";
import { agentHandoffSchema, engineeringSpecSchema, finalDecisionSchema } from "../lib/handoff-validation";
import { handoffRequestSchema, POST } from "../app/api/handoff/route";
import type { AgentHandoff } from "../lib/handoff-types";
import { crucibleDemo } from "../lib/demo";

const input: HandoffInput = {
  brief: {
    challenge: "Reduce the delay between learning an event moved and deciding when to leave.",
    targetUser: "Students traveling between campus events",
    moment: "An event room changes just before departure.",
    workaround: "Check several apps and recalculate the walk.",
    observations: "The event details and travel timing live in different places.",
    constraints: "Two people, React and TypeScript, twelve hours, no paid providers.",
    tracks: ["everyday-friction"],
    judge: { who: "Technical builders", avoid: "Chat wrappers", love: "Clear demo", winners: "" },
    research: [{
      id: "research-1", title: "Calendar change cue", problem: "Late changes are easy to miss.", feature: "A visible departure cue", howItWorks: "A reminder reacts to a changed event location.", adaptation: "Propose a user-confirmed route update.", sourceIds: ["source-1"], kind: "feature", collectedAt: 100,
      sources: [{ id: "source-1", title: "Example project", url: "https://example.com/project", kind: "hackathon", access: "search" }],
    }],
  },
  concept: { id: "concept-1", title: "Ready Again", pitch: "Give students a single departure decision after an event change.", mechanism: "Compare the old and new event location, request a manual travel estimate, and show the departure change.", assumptions: ["A timely cue prevents missed changes."], perspectives: ["Choreographer"], score: 0, pros: ["Clear demo"], cons: ["Notification permissions may be denied."] },
  decision: { conceptId: "concept-1", problem: "Students miss last-minute room changes and leave too late.", targetUser: "Students moving between campus events", solution: "Let a student enter a room change and walking time, then show one revised leave-by cue with undo.", whyThis: "A manual entry flow is feasible in twelve hours and makes the effect visible.", successCriteria: "Four of five testers identify the revised departure time without opening another app.", at: 1000 },
  agent: "codex",
  demo: true,
};

function handoffFor(value = input): AgentHandoff {
  return { conceptId: value.concept.id, decisionFingerprint: handoffFingerprint(value), prompt: composeHandoffPrompt(value, demoEngineeringSpec(value)), generatedAt: 1001, agent: value.agent, source: value.demo ? "demo" : "live" };
}

test("confirmed fields are validated, preserved verbatim, and required before generation", () => {
  assert.equal(finalDecisionSchema.safeParse(input.decision).success, true);
  for (const field of ["problem", "targetUser", "solution", "whyThis", "successCriteria"] as const) {
    assert.equal(finalDecisionSchema.safeParse({ ...input.decision, [field]: " " }).success, false);
    assert.ok(handoffFor().prompt.includes(`> ${input.decision[field]}`));
  }
  assert.equal(sameDecision({ ...input.decision, solution: ` ${input.decision.solution} ` }, input.decision), true);
  assert.equal(sameDecision({ ...input.decision, solution: "A changed solution." }, input.decision), false);
  assert.equal(handoffRequestSchema.safeParse({ ...input, decision: { ...input.decision, conceptId: "other" } }).success, false);
  assert.throws(() => composeHandoffPrompt({ ...input, decision: { ...input.decision, conceptId: "other" } }, demoEngineeringSpec(input)), /Confirm a decision/);
});

test("a prompt cannot be exported after decision, concept, source, agent, mode or plan changes", () => {
  const handoff = handoffFor();
  assert.equal(isHandoffCurrent(handoff, input), true);
  const changes: HandoffInput[] = [
    { ...input, decision: { ...input.decision, solution: "A materially different interaction." } },
    { ...input, concept: { ...input.concept, id: "other" } },
    { ...input, concept: { ...input.concept, mechanism: "Different mechanism" } },
    { ...input, brief: { ...input.brief, constraints: "Only two hours left." } },
    { ...input, brief: { ...input.brief, research: [] } },
    { ...input, agent: "claude-code" },
    { ...input, demo: false },
  ];
  for (const changed of changes) assert.equal(isHandoffCurrent(handoff, changed), false);
  assert.equal(isHandoffCurrent(handoff, { ...input, decision: { ...input.decision, at: 9999 }, concept: { ...input.concept, x: 440, y: 20, score: 85 } }), true, "timestamps and canvas position do not alter the engineering brief");
  assert.equal(handoffFingerprint({ ...input, brief: { ...input.brief, challenge: ` ${input.brief.challenge} ` } }), handoffFingerprint(input), "server trimming must not make a fresh prompt stale");
  const withPlan = { ...input, plan: crucibleDemo(input.brief, input.concept) };
  const planPrompt = handoffFor(withPlan);
  assert.equal(isHandoffCurrent(planPrompt, withPlan), true);
  assert.equal(isHandoffCurrent(planPrompt, { ...withPlan, plan: { ...withPlan.plan, experiment: { hypothesis: "The new hypothesis is materially different.", steps: ["Observe the user.", "Try the revised task."], successSignal: "The user completes it unaided." } } }), false);
  assert.equal(isHandoffCurrent(planPrompt, { ...withPlan, plan: undefined }), false);
});

test("the template covers the full engineering contract with honest research provenance", () => {
  const spec = demoEngineeringSpec(input);
  assert.equal(engineeringSpecSchema.safeParse(spec).success, true);
  const handoff = handoffFor();
  assert.equal(agentHandoffSchema.safeParse(handoff).success, true);
  for (const heading of ["Confirmed product decision", "MVP requirements", "Non-goals and cut list", "User journeys", "Screens and components", "Architecture and stack", "Data model", "API contracts", "Integrations and mock boundaries", "Implementation milestones", "Acceptance criteria", "Test plan", "Edge cases and recovery", "Accessibility", "Security and privacy", "Deliverables and run instructions", "Research and provenance", "Completion report"]) assert.ok(handoff.prompt.includes(`## ${heading}`), heading);
  assert.ok(handoff.prompt.includes(input.brief.constraints));
  assert.ok(handoff.prompt.includes("https://example.com/project"));
  assert.ok(handoff.prompt.includes("search result only; page contents unverified"));
  assert.ok(handoff.prompt.includes("DEMO TEMPLATE"));
  assert.ok(handoff.prompt.includes("Proposed adaptation:"));
  assert.equal(engineeringSpecSchema.safeParse({ ...spec, acceptanceCriteria: [] }).success, false);
  assert.equal(agentHandoffSchema.safeParse({ ...handoff, prompt: "Looks good, build it" }).success, false);
  assert.equal(engineeringSpecSchema.safeParse(demoEngineeringSpec({ ...input, brief: { ...input.brief, constraints: "A".repeat(2000) }, decision: { ...input.decision, solution: "B".repeat(3000), successCriteria: "C".repeat(2000) } })).success, true, "long valid decisions keep the template within spec limits without removing the full authoritative fields");
});

test("a materially changed final decision never inherits an earlier plan's scope or experiment", () => {
  const stalePlan = {
    ...crucibleDemo(input.brief, input.concept),
    experiment: {
      hypothesis: "Obsolete: wearable haptic cues will improve walking pace.",
      steps: ["Obsolete step: install a wearable vibration controller.", "Obsolete step: ask the user to walk to a physical pulse."],
      successSignal: "Obsolete success: synchronized footsteps.",
    },
    scope: { mustBuild: ["Obsolete scope: Bluetooth wearable integration."], cut: ["Obsolete cut: remove all manual event entry."] },
    weakestAssumption: { assumption: "Obsolete assumption: everyone owns a wearable.", fix: "Use a wristband.", test: "Track pulse pacing." },
  };
  const revised = { ...input, plan: stalePlan };
  const prompt = composeHandoffPrompt(revised, demoEngineeringSpec(revised));
  for (const obsolete of [stalePlan.experiment.hypothesis, ...stalePlan.experiment.steps, stalePlan.experiment.successSignal, ...stalePlan.scope.mustBuild, ...stalePlan.scope.cut, stalePlan.weakestAssumption.assumption]) {
    assert.equal(prompt.includes(obsolete), false, `Must not carry over: ${obsolete}`);
  }
  const validation = prompt.split("## Validation experiment\n")[1].split("## Research and provenance")[0];
  assert.ok(validation.includes(input.decision.solution));
  assert.ok(validation.includes(input.decision.successCriteria));
  assert.ok(validation.includes("only as unverified context"));
  const previousFormat = { ...handoffFor(revised), decisionFingerprint: handoffFingerprint(revised).replace("handoff-v2-", "handoff-v1-") };
  assert.equal(isHandoffCurrent(previousFormat, revised), false, "Previously generated prompts need regeneration after the stale-plan fix");
});

test("API rejects a mismatched concept and returns a current prompt for a valid demo request", async () => {
  const request = (body: unknown) => new Request("http://localhost/api/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const invalid = await POST(request({ ...input, decision: { ...input.decision, conceptId: "other" } }));
  assert.equal(invalid.status, 400);
  const response = await POST(request(input));
  assert.equal(response.status, 200);
  const body = await response.json() as { handoff: AgentHandoff };
  assert.equal(body.handoff.source, "demo");
  assert.equal(isHandoffCurrent(body.handoff, input), true);
});

test("live mode without a configured provider fails rather than silently generating a demo", async () => {
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    const response = await POST(new Request("http://localhost/api/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, demo: false }) }));
    assert.equal(response.status, 503);
    const body = await response.json() as { code: string; handoff?: unknown };
    assert.equal(body.code, "AI_NOT_CONFIGURED");
    assert.equal(body.handoff, undefined);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previous;
  }
});
