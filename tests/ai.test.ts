import assert from "node:assert/strict";
import test from "node:test";
import {
  exploreDemo,
  synthesizeDemo,
  mutateDemo,
  crucibleDemo,
  combineDemo,
  assessDemo,
} from "../lib/demo";
import { PERSPECTIVES, selectPerspectives } from "../lib/perspectives";
import {
  canonicalPerspectives,
  exploreLive,
  synthesizeLive,
  MODEL,
} from "../lib/ai";
import type { Brief, Mutation } from "../lib/types";
import {
  ApiError,
  briefSchema,
  conceptSchema,
  containsForbidden,
  crucibleSchema,
  exploreRequestSchema,
  mutateRequestSchema,
  readRequest,
  wordCount,
  combineRequestSchema,
  generatedConceptsSchema,
  generatedCrucibleSchema,
  hasDuplicateMechanisms,
  nearDuplicateText,
} from "../lib/validation";

const brief: Brief = {
  challenge: "Make everyday life feel a little less like admin.",
  observations:
    "Calendar, weather, and commute context are scattered across apps.",
  constraints: "React and Python; one day to build.",
  tracks: ["make-it-better", "mobile-native"],
  judge: {
    who: "Technical builders",
    avoid: "Generic chat wrappers and business models",
    love: "Creativity, autonomous UX, real problems",
    winners: "Flip My Room and Autonomous AI Alarm Clock",
  },
};

test("every demo lens respects atomic word limits and its own banned words", () => {
  const result = exploreDemo(brief, PERSPECTIVES);
  assert.equal(result.length, 100);
  const ids = new Set<string>();
  for (const exploration of result) {
    assert.equal(exploration.ingredients.length, 3);
    for (const ingredient of exploration.ingredients) {
      assert.ok(
        wordCount(ingredient.text) <=
          (ingredient.kind === "provocation" ? 15 : 20),
      );
      assert.equal(
        containsForbidden(
          ingredient.text,
          exploration.perspective.forbiddenWords,
        ),
        false,
        `${exploration.perspective.name}: ${ingredient.text}`,
      );
      assert.equal(ids.has(ingredient.id), false);
      ids.add(ingredient.id);
    }
  }
});

test("selected ingredients affect demo concepts and all five mutations preserve lineage", () => {
  const explorations = exploreDemo(brief, PERSPECTIVES.slice(0, 15));
  const ingredients = [
    explorations[0].ingredients[1],
    explorations[1].ingredients[2],
    explorations[2].ingredients[0],
  ];
  const concepts = synthesizeDemo(brief, ingredients);
  assert.equal(concepts.length, 3);
  assert.equal(new Set(concepts.map((item) => item.pitch)).size, 3);
  const selectedNames = new Set(
    ingredients.map((item) => item.perspectiveName),
  );
  for (const concept of concepts) {
    conceptSchema.parse(concept);
    assert.ok(concept.perspectives.every((name) => selectedNames.has(name)));
    assert.ok(
      concept.pros.some((pro) =>
        ingredients.some((ingredient) =>
          pro.includes(ingredient.perspectiveName),
        ),
      ),
    );
  }
  const pitches = new Set<string>();
  for (const mutation of [
    "autonomous",
    "widget",
    "invert",
    "wildcard",
    "splice",
  ] as Mutation[]) {
    const children = mutateDemo(
      brief,
      concepts[0],
      mutation,
      ingredients[1],
      PERSPECTIVES[25],
    );
    for (const child of children) {
      conceptSchema.parse(child);
      assert.equal(child.parentId, concepts[0].id);
      assert.equal(child.mutation, mutation);
      assert.notEqual(child.id, concepts[0].id);
      pitches.add(child.pitch);
    }
  }
  assert.equal(pitches.size, 5);
  const six = explorations.slice(0, 6).map((item) => item.ingredients[1]);
  const used = new Set(
    synthesizeDemo(brief, six).flatMap((item) => item.perspectives),
  );
  assert.deepEqual(used, new Set(six.map((item) => item.perspectiveName)));
});

test("demo changes with the brief and crucible addresses the selected concept", () => {
  const food = {
    ...brief,
    challenge: "Reduce food waste by making better use of the fridge.",
    observations: "People forget the groceries they already own.",
  };
  const ingredients = exploreDemo(food, PERSPECTIVES.slice(0, 15))
    .slice(0, 2)
    .map((item) => item.ingredients[1]);
  const concepts = synthesizeDemo(food, ingredients);
  assert.ok(concepts[0].pitch.includes("home cooks"));
  const crucible = crucibleDemo(food, concepts[1]);
  crucibleSchema.parse(crucible);
  assert.ok(crucible.verdict.includes(concepts[1].title));
  assert.ok(crucible.weakestAssumption.test.includes("Five-minute"));
  assert.equal(
    crucible.blueprint.demo[crucible.blueprint.demo.length - 1].seconds,
    "45–60s",
  );
});

test("crucible cleans interpolated punctuation and proposes concrete theme-specific adapters", () => {
  const punctuated = {
    ...brief,
    constraints: "React, Python, and browser APIs.",
    judge: {
      who: "Engineers and tinkerers.",
      avoid: "Generic chat wrappers...",
      love: "Seamless, autonomous UX.",
      winners: "One-button prototypes.",
    },
  };
  const ingredients = exploreDemo(punctuated, PERSPECTIVES.slice(0, 15))
    .slice(0, 2)
    .map((item) => item.ingredients[1]);
  const concept = synthesizeDemo(punctuated, ingredients)[0];
  const crucible = crucibleDemo(punctuated, concept);
  crucibleSchema.parse(crucible);
  assert.ok(crucible.judgeReaction.includes("Engineers and tinkerers:"));
  assert.equal(/[.!?][.:]/u.test(JSON.stringify(crucible)), false);
  const architecture = crucible.blueprint.architecture.join(" ");
  for (const expected of [
    "Google Calendar API",
    "ical.js",
    "Open-Meteo",
    "Geolocation API",
    "React + TypeScript",
    "FastAPI",
    "deterministic",
    "fixtures",
    "proposed integrations",
  ]) {
    assert.ok(architecture.includes(expected), `Missing ${expected}`);
  }
  const native = crucibleDemo(
    { ...punctuated, constraints: "SwiftUI for iOS." },
    concept,
  ).blueprint.architecture[0];
  assert.ok(native.includes("SwiftUI for iOS."));
  assert.ok(native.includes("native UI"));
  assert.equal(native.includes("React"), false);
});

test("validation supports small batches and rejects incomplete workshops and dependent mutations", () => {
  assert.equal(
    exploreRequestSchema.safeParse({
      brief,
      perspectives: PERSPECTIVES.slice(0, 14),
      demo: true,
    }).success,
    true,
  );
  assert.equal(
    exploreRequestSchema.safeParse({ brief, perspectives: [], demo: true })
      .success,
    false,
  );
  assert.equal(
    exploreRequestSchema.safeParse({
      brief,
      perspectives: [PERSPECTIVES[0]],
      demo: true,
    }).success,
    true,
  );
  assert.equal(
    exploreRequestSchema.safeParse({
      brief,
      perspectives: PERSPECTIVES.slice(0, 15),
      demo: true,
    }).success,
    true,
  );
  const ingredients = exploreDemo(brief, PERSPECTIVES.slice(0, 15))
    .slice(0, 2)
    .map((item) => item.ingredients[1]);
  const parent = synthesizeDemo(brief, ingredients)[0];
  assert.equal(
    mutateRequestSchema.safeParse({ brief, parent, type: "splice", demo: true })
      .success,
    false,
  );
  assert.equal(
    mutateRequestSchema.safeParse({
      brief,
      parent,
      type: "wildcard",
      demo: true,
    }).success,
    false,
  );
});

test("six selected lenses cover six families, respect exclusions, and do not mutate the library", () => {
  const original = PERSPECTIVES.map((item) => item.id);
  const first = selectPerspectives(6, [], brief);
  assert.equal(first.length, 6);
  assert.equal(new Set(first.map((item) => item.category)).size, 6);
  const second = selectPerspectives(
    6,
    first.map((item) => item.id),
    brief,
  );
  assert.ok(
    second.every((item) => !first.some((previous) => previous.id === item.id)),
  );
  assert.deepEqual(
    PERSPECTIVES.map((item) => item.id),
    original,
  );
  assert.equal(selectPerspectives(500).length, 100);
  assert.equal(selectPerspectives(-1).length, 0);
  for (const count of [1, 3, 6, 12, 15])
    assert.ok(
      exploreRequestSchema.safeParse({
        brief,
        perspectives: PERSPECTIVES.slice(0, count),
      }).success,
    );
  assert.equal(
    exploreRequestSchema.safeParse({
      brief,
      perspectives: PERSPECTIVES.slice(0, 16),
    }).success,
    false,
  );
});

test("new concepts expose distinct mechanisms and reasoned assessments; renamed duplicates fail", () => {
  const ingredients = exploreDemo(brief, selectPerspectives())
    .slice(0, 2)
    .map((item) => item.ingredients[1]);
  const concepts = synthesizeDemo(brief, ingredients);
  generatedConceptsSchema.parse({ concepts });
  assert.equal(hasDuplicateMechanisms(concepts), false);
  for (const concept of concepts) {
    assert.ok(concept.mechanism);
    assert.equal(Object.keys(concept.assessment!).length, 4);
    assert.ok(concept.assumptions!.length);
  }
  assert.equal(
    generatedConceptsSchema.safeParse({
      concepts: [
        concepts[0],
        { ...concepts[0], title: "A completely different name" },
        concepts[2],
      ],
    }).success,
    false,
  );
  assert.ok(
    nearDuplicateText(
      "Use calendar and rain to calculate a departure time",
      "Calculate departure time using rain and calendar",
    ),
  );
  assert.equal(
    nearDuplicateText(
      "Match surplus pantry ingredients between nearby households",
      "Restore an interrupted errand when a calendar gap opens",
    ),
    false,
  );
  const legacy = {
    ...concepts[0],
    mechanism: undefined,
    assessment: undefined,
    assumptions: undefined,
  };
  conceptSchema.parse(legacy);
  assert.equal(
    generatedConceptsSchema.safeParse({
      concepts: [legacy, concepts[1], concepts[2]],
    }).success,
    false,
  );
});

test("combination returns one child with both parents' traceable contributions", () => {
  const ingredients = exploreDemo(brief, selectPerspectives())
    .slice(0, 2)
    .map((item) => item.ingredients[1]);
  const concepts = synthesizeDemo(brief, ingredients);
  const pair: [(typeof concepts)[number], (typeof concepts)[number]] = [
    concepts[0],
    concepts[1],
  ];
  combineRequestSchema.parse({ brief, concepts: pair, demo: true });
  assert.equal(
    combineRequestSchema.safeParse({
      brief,
      concepts: [pair[0], pair[0]],
      demo: true,
    }).success,
    false,
  );
  const children = combineDemo(brief, pair);
  assert.equal(children.length, 1);
  conceptSchema.parse(children[0]);
  assert.equal(children[0].parentId, pair[0].id);
  assert.equal(children[0].mutation, "combine");
  assert.deepEqual(
    children[0].inheritedFrom?.map((item) => item.conceptId),
    pair.map((item) => item.id),
  );
  assert.ok(
    children[0].inheritedFrom?.every((item) => item.contribution.length > 20),
  );
  const plan = crucibleDemo(brief, children[0]);
  generatedCrucibleSchema.parse(plan);
  assert.ok(
    plan.experiment?.steps.some((step) => step.includes("prospective")),
  );
  assert.ok(plan.scope?.mustBuild.some((item) => item.includes("mechanism")));
  assert.ok(plan.scope?.cut.length);
  assert.equal(plan.weakestAssumption.assumption, plan.experiment?.hypothesis);
  assert.equal(plan.weakestAssumption.assumption, children[0].assumptions?.[0]);
  assert.ok(plan.weakestAssumption.test.includes("one prospective user"));
  assert.equal(JSON.stringify(plan).includes("six-scenario"), false);
  assert.ok(plan.blueprint.timeline[0].task.includes("five-minute experiment"));
  const punctuatedAudience = crucibleDemo(
    {
      ...brief,
      targetUser: "Commuters juggling meetings in different places.",
    },
    children[0],
  );
  assert.ok(
    punctuatedAudience.experiment?.steps[0].includes(
      "target group (Commuters juggling meetings in different places)",
    ),
  );
  assert.equal(
    punctuatedAudience.experiment?.steps[0].includes("places. to"),
    false,
  );
  const shortPlan = crucibleDemo(
    { ...brief, constraints: "React team; 6 hours available" },
    children[0],
  );
  assert.equal(shortPlan.blueprint.timeline.at(-1)?.hours, "4.5–6 hours");
});

test("assessment enriches saved concepts without changing the idea, position or provenance", () => {
  const legacy = {
    id: "legacy",
    title: "Keep this title",
    pitch: "Keep this exact proposed behavior.",
    score: 88,
    perspectives: ["Choreographer"],
    pros: ["A visible effect"],
    cons: ["Needs a usable input"],
    parentId: "parent",
    mutation: "widget",
    x: 12,
    y: 34,
    source: "live" as const,
  };
  const assessed = assessDemo(brief, legacy);
  conceptSchema.parse(assessed);
  for (const [key, value] of Object.entries(legacy))
    assert.deepEqual(assessed[key as keyof typeof assessed], value);
  assert.ok(
    assessed.assessment?.originality.includes("not evidence of novelty"),
  );
  assert.ok(assessed.mechanism?.includes(legacy.pitch.replace(/\.$/, "")));
  const source = conceptSchema.parse(legacy).source;
  assert.equal(
    source,
    "live",
    "API validation preserves an existing concept's provenance",
  );
});

test("request body reader rejects oversized and invalid JSON before generation", async () => {
  const large = new Request("https://offscript.test/api/explore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(100_000) }),
  });
  await assert.rejects(
    readRequest(large, briefSchema),
    (error) => error instanceof ApiError && error.status === 413,
  );
  const invalid = new Request("https://offscript.test/api/explore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{bad json",
  });
  await assert.rejects(
    readRequest(invalid, briefSchema),
    (error) => error instanceof ApiError && error.status === 400,
  );
});

test("canonical lenses reject duplicates and replace client-supplied prompt fields", () => {
  assert.throws(
    () => canonicalPerspectives([PERSPECTIVES[0], PERSPECTIVES[0]]),
    (error) => error instanceof ApiError && error.status === 400,
  );
  assert.throws(
    () => canonicalPerspectives([{ ...PERSPECTIVES[0], id: "not-a-lens" }]),
    (error) => error instanceof ApiError && error.status === 400,
  );
  const canonical = canonicalPerspectives([
    { ...PERSPECTIVES[0], axiom: "client-supplied replacement" },
  ]);
  assert.equal(canonical[0].axiom, PERSPECTIVES[0].axiom);
});

test("live exploration without a key fails explicitly instead of generating demo output", async () => {
  const existing = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    assert.equal(MODEL, "gemini-3.8-flash");
    await assert.rejects(
      exploreLive(brief, PERSPECTIVES.slice(0, 15)),
      (error) =>
        error instanceof ApiError &&
        error.status === 503 &&
        error.code === "AI_NOT_CONFIGURED",
    );
  } finally {
    if (existing === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = existing;
  }
});

async function mockGemini<T>(
  reply: (body: Record<string, unknown>, index: number) => unknown,
  run: (requests: Record<string, unknown>[]) => Promise<T>,
) {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  const requests: Record<string, unknown>[] = [];
  process.env.GEMINI_API_KEY = "test-key-never-sent";
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    assert.ok(request.url.includes("generativelanguage.googleapis.com"));
    const body = (await request.json()) as Record<string, unknown>;
    requests.push(body);
    const result = reply(body, requests.length - 1);
    return Response.json({
      candidates: [
        {
          content: { role: "model", parts: [{ text: JSON.stringify(result) }] },
        },
      ],
    });
  };
  try {
    return await run(requests);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  }
}

test("live synthesis repairs duplicate mechanisms once and then fails explicitly if they persist", async () => {
  const ingredients = exploreDemo(brief, selectPerspectives())
    .slice(0, 2)
    .map((item) => item.ingredients[1]);
  const concepts = synthesizeDemo(brief, ingredients);
  const repeated = {
    concepts: [concepts[0], { ...concepts[0], title: "Renamed" }, concepts[2]],
  };
  await mockGemini(
    (_, index) => (index === 0 ? repeated : { concepts }),
    async (requests) => {
      const result = await synthesizeLive(brief, ingredients);
      assert.equal(requests.length, 2);
      assert.equal(hasDuplicateMechanisms(result), false);
      assert.ok(JSON.stringify(requests[1]).includes("repeat a mechanism"));
    },
  );
  await mockGemini(
    () => repeated,
    async (requests) => {
      await assert.rejects(
        synthesizeLive(brief, ingredients),
        (error) =>
          error instanceof ApiError && error.code === "AI_INVALID_OUTPUT",
      );
      assert.equal(
        requests.length,
        2,
        "Repeated invalid output has a bounded repair budget",
      );
    },
  );
});

test("live exploration keeps first calls independent and rerolls only a repeated mechanism", async () => {
  const perspectives = [PERSPECTIVES[0], PERSPECTIVES[1]];
  const first = {
    provocation: "What can disappear?",
    mechanic:
      "Sort incoming requests into urgency buckets before taking the next action.",
    flip: "Remove the lowest impact step.",
  };
  const different = {
    provocation: "What can we preserve?",
    mechanic:
      "Save an interrupted action and restore its exact state when the context returns.",
    flip: "Resume without starting over.",
  };
  await mockGemini(
    (_, index) => (index < 2 ? first : different),
    async (requests) => {
      const result = await exploreLive(brief, perspectives);
      assert.equal(result.length, 2);
      assert.equal(requests.length, 3);
      assert.equal(
        JSON.stringify(requests[0]).includes("avoidMechanisms"),
        false,
      );
      assert.equal(
        JSON.stringify(requests[1]).includes("avoidMechanisms"),
        false,
      );
      assert.ok(JSON.stringify(requests[2]).includes("avoidMechanisms"));
      assert.notEqual(
        result[0].ingredients[1].text,
        result[1].ingredients[1].text,
      );
    },
  );
});
