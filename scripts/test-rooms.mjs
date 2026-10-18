/** Run with: node scripts/test-rooms.mjs (after installing dependencies). */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const project = process.cwd();
await mkdir(join(project, ".offscript-data"), { recursive: true });
const temporary = await mkdtemp(join(project, ".offscript-data", "test-"));
try {
  // Keep the test dependency-free: compile the server modules with the
  // TypeScript compiler already used by this application.
  const modules = ["room-context", "research-validation", "handoff-validation", "validation", "rooms"];
  for (const name of modules) {
    const source = await readFile(join(project, "lib", `${name}.ts`), "utf8");
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
      },
    }).outputText;
    await writeFile(
      join(temporary, `${name}.mjs`),
      modules.reduce((output, module) => output.replaceAll(`"./${module}"`, `"./${module}.mjs"`), compiled),
    );
  }
  const api = await import(pathToFileURL(join(temporary, "rooms.mjs")).href);
  const { runWithRoomDatabase } = await import(
    pathToFileURL(join(temporary, "room-context.mjs")).href
  );
  process.chdir(temporary);
  const state = {
    brief: {
      challenge: "Make a better demo",
      observations: "",
      constraints: "",
      tracks: [],
      judge: { who: "", avoid: "", love: "", winners: "" },
    },
    explorations: [],
    selectedIds: [],
    starredIds: [],
    concepts: [
      {
        id: "concept-one",
        title: "A concept",
        pitch: "A testable idea",
        perspectives: [],
        score: 87,
        pros: [],
        cons: [],
        source: "live",
      },
    ],
    stage: 2,
    blind: true,
    revealed: false,
  };

  async function exerciseStorage(label) {
    const host = await api.createRoom({ name: "Host", state });
    assert.equal(host.room.state.concepts[0].source, "live");
    const id = host.room.id;
    const member = { token: host.token, participantId: host.participantId };
    const guest = await api.joinRoom(id, { token: host.token, name: "Guest" });
    const guestMember = {
      token: host.token,
      participantId: guest.participantId,
    };
    assert.equal(guest.room.participants.length, 2);
    assert(
      !JSON.stringify(guest.room).includes(host.participantId),
      "Host credential must never leak to a teammate",
    );
    const publicHost = guest.room.participants.find(
      (person) => person.name === "Host",
    ).id;
    await assert.rejects(
      api.getRoom(id, { token: host.token, participantId: publicHost }),
      (error) => error.status === 403,
    );
    await assert.rejects(
      api.getRoom(id, {
        token: "0".repeat(32),
        participantId: host.participantId,
      }),
      (error) => error.status === 403,
    );

    await Promise.all([
      api.voteRoom(id, { ...member, conceptId: "concept-one", value: "fire" }),
      api.voteRoom(id, {
        ...guestMember,
        conceptId: "concept-one",
        value: "pass",
      }),
    ]);
    // Retrying a vote is idempotent, and changing it replaces the same ballot.
    await api.voteRoom(id, {
      ...member,
      conceptId: "concept-one",
      value: "fire",
    });
    const hidden = await api.getRoom(id, member);
    assert.deepEqual(hidden.room.votes, {});
    assert.deepEqual(hidden.room.myVotes, { "concept-one": "fire" });
    assert(!JSON.stringify(hidden).includes("ballots"));
    assert(!JSON.stringify(hidden).includes(guest.participantId));
    const forged = await api.updateRoom(id, {
      ...member,
      revision: hidden.room.revision,
      state: {
        ...state,
        revealed: true,
        ballots: { "concept-one": { fire: 100 } },
      },
    });
    assert.equal(forged.room.state.revealed, false);
    assert.deepEqual(forged.room.votes, {});
    assert(!("ballots" in forged.room.state));
    await assert.rejects(
      api.updateRoom(id, {
        ...member,
        revision: forged.room.revision,
        state: { ...state, blind: false },
      }),
      (error) =>
        error.status === 409 && Object.keys(error.room.votes).length === 0,
    );

    const concurrent = await Promise.allSettled([
      api.updateRoom(id, {
        ...member,
        revision: forged.room.revision,
        state: { ...state, brief: { ...state.brief, challenge: "Edit one" } },
      }),
      api.updateRoom(id, {
        ...guestMember,
        revision: forged.room.revision,
        state: { ...state, brief: { ...state.brief, challenge: "Edit two" } },
      }),
    ]);
    assert.equal(
      concurrent.filter((result) => result.status === "fulfilled").length,
      1,
      "Only one edit can win the same revision",
    );
    const conflict = concurrent.find(
      (result) => result.status === "rejected",
    ).reason;
    assert.equal(conflict.status, 409);
    assert.deepEqual(
      conflict.room.votes,
      {},
      "Conflict responses must also mask blind ballots",
    );
    assert.equal(conflict.room.revision, forged.room.revision + 1);

    const guests = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        api.joinRoom(id, { token: host.token, name: `Concurrent guest ${i}` }),
      ),
    );
    await Promise.all(
      guests.map((person) =>
        api.voteRoom(id, {
          token: host.token,
          participantId: person.participantId,
          conceptId: "concept-one",
          value: "fire",
        }),
      ),
    );
    const revealed = await api.revealRoom(id, member);
    assert.deepEqual(revealed.room.votes, {
      "concept-one": { fire: 6, pass: 1 },
    });
    assert.equal(revealed.room.participants.length, 7);
    const reopened = await api.getRoom(id, guestMember);
    assert.deepEqual(reopened.room.votes, revealed.room.votes);
    assert.deepEqual(reopened.room.myVotes, { "concept-one": "pass" });
    console.log(
      `PASS ${label}: private blind ballots, credential isolation, deduplication, concurrent joins/votes, stale-edit rejection, persistence`,
    );
  }

  async function exerciseConnections(label) {
    const concepts = [
      state.concepts[0],
      { ...state.concepts[0], id: "concept-two", title: "Second idea" },
      { ...state.concepts[0], id: "concept-child", parentId: "concept-one" },
    ];
    const link = {
      id: "manual-one",
      source: "concept-one",
      target: "concept-two",
    };
    const linkedState = { ...state, concepts, connections: [link] };
    const host = await api.createRoom({ name: "Host", state: linkedState });
    const member = { token: host.token, participantId: host.participantId };
    const guest = await api.joinRoom(host.room.id, {
      token: host.token,
      name: "Guest",
    });
    assert.deepEqual(
      guest.room.state.connections,
      [link],
      "A teammate receives saved lines",
    );
    const fetched = await api.getRoom(host.room.id, member);
    assert.deepEqual(
      fetched.room.state.connections,
      [link],
      "Connections survive storage reload",
    );
    for (const connections of [
      [{ ...link, target: link.source }],
      [{ ...link, target: "missing" }],
      [link, { ...link, id: "duplicate-pair" }],
      [link, { ...link, source: "concept-two", target: "concept-child" }],
      [{ ...link, target: "concept-child" }],
    ]) {
      await assert.rejects(
        api.updateRoom(host.room.id, {
          ...member,
          revision: fetched.room.revision,
          state: { ...linkedState, connections },
        }),
        (error) => error.status === 400,
      );
    }
    const removed = await api.updateRoom(host.room.id, {
      ...member,
      revision: fetched.room.revision,
      state: { ...linkedState, connections: [] },
    });
    assert.deepEqual(removed.room.state.connections, []);
    assert.equal(
      removed.room.state.concepts[2].parentId,
      "concept-one",
      "Removing a manual line preserves mutation lineage",
    );
    const guestView = await api.getRoom(host.room.id, {
      token: host.token,
      participantId: guest.participantId,
    });
    assert.deepEqual(
      guestView.room.state.connections,
      [],
      "Line removals reach teammates",
    );
    console.log(
      `PASS ${label}: connection persistence, sharing, removal, endpoint and duplicate validation, mutation lineage`,
    );
  }

  async function exercisePlanning(label) {
    const crucible = {
      source: "demo",
      verdict: "Test before building",
      score: 0,
      judgeReaction: "A simulated reaction",
      benchmark: "Compare with the current workaround",
      pros: ["Clear mechanism", "Small scope"],
      cons: ["Unproven demand", "Input quality"],
      weakestAssumption: {
        assumption: "It saves time",
        fix: "Narrow the situation",
        test: "Observe one user",
      },
      experiment: {
        hypothesis: "One user completes the action",
        steps: ["Show a prototype", "Observe without help"],
        successSignal: "The user completes the action",
      },
      scope: {
        mustBuild: ["One complete interaction"],
        cut: ["A second integration"],
      },
      blueprint: {
        signals: ["One event", "A timestamp"],
        architecture: ["A fixture", "One rule"],
        timeline: [
          { hours: "0–1", task: "Test" },
          { hours: "1–2", task: "Build" },
          { hours: "2–3", task: "Demo" },
        ],
        demo: [
          { seconds: "0–20", action: "Problem" },
          { seconds: "20–40", action: "Action" },
          { seconds: "40–60", action: "Result" },
        ],
      },
    };
    const enriched = {
      ...state,
      brief: {
        ...state.brief,
        targetUser: "Commuters",
        moment: "Before leaving",
        workaround: "Check three apps",
        ownIdeas: "A departure cue",
      },
      concepts: [
        {
          ...state.concepts[0],
          mechanism: "Subtract journey time from arrival time",
          assessment: {
            userValue: "Saves checks",
            originality: "Combines context",
            feasibility: "One rule",
            demoClarity: "Move a meeting",
          },
          assumptions: ["Journey time is useful"],
        },
      ],
      commitment: { conceptId: "concept-one", at: 1234 },
      startedAt: 1000,
      plan: { conceptId: "concept-one", crucible },
    };
    const host = await api.createRoom({ name: "Host", state: enriched });
    const guest = await api.joinRoom(host.room.id, {
      token: host.token,
      name: "Guest",
    });
    assert.deepEqual(
      guest.room.state,
      enriched,
      "New brief, assessment, commitment and plan survive storage and sharing",
    );
    const member = { token: host.token, participantId: host.participantId };
    for (const patch of [
      { commitment: { conceptId: "missing", at: 1000 } },
      { plan: { conceptId: "missing", crucible } },
    ]) {
      await assert.rejects(
        api.updateRoom(host.room.id, {
          ...member,
          revision: guest.room.revision,
          state: { ...enriched, ...patch },
        }),
        (error) => error.status === 400,
      );
    }
    console.log(
      `PASS ${label}: grounded brief, assessments, commitment and build plan round-trip; dangling references rejected`,
    );
  }

  const researchSource = {
    id: "source-1",
    title: "A public project description",
    url: "https://devpost.com/software/research-fixture",
    kind: "hackathon",
    access: "search",
  };
  const finding = {
    id: "finding-1", title: "Resumable work", kind: "pattern",
    problem: "People lose context when interrupted.",
    feature: "Save a draft and offer a resume action.",
    howItWorks: "A local draft remembers the last completed step.",
    adaptation: "Proposed adaptation: test one resumable action with a target user.",
    sourceIds: [researchSource.id],
  };
  const researchRun = {
    id: "run-1", query: "interrupted work", mode: "hackathons", createdAt: 1000,
    summary: "A source-linked report of a resumable interaction.",
    sources: [researchSource], findings: [finding], limitations: ["User demand is untested."],
    searchQueries: ["hackathon resumable draft"], searchEntryPoint: "<div>Google Search attribution</div>",
    source: "live",
  };
  const savedFinding = { ...finding, sources: [researchSource], collectedAt: 1001 };
  const finalDecision = {
    conceptId: "concept-one", problem: "People lose useful work when an interruption occurs.",
    targetUser: "People coordinating everyday tasks",
    solution: "Remember the last step and provide an immediate resume action.",
    whyThis: "One small interaction can demonstrate the whole mechanism.",
    successCriteria: "A prospective user resumes the task without repeating a completed step.",
    at: 1002,
  };
  const handoff = {
    conceptId: "concept-one", decisionFingerprint: "handoff-v1-fixture",
    prompt: "Build one resumable task interaction. Preserve the confirmed decision and test the complete journey.\n".repeat(30).trim(),
    generatedAt: 1003, agent: "codex", source: "live",
  };
  const researchedState = {
    ...state,
    brief: { ...state.brief, research: [savedFinding] },
    research: { runs: [researchRun], saved: [savedFinding] },
    commitment: { conceptId: "concept-one", at: 1002 },
    finalDecision, handoff,
  };

  async function exerciseResearchHandoff(label) {
    const host = await api.createRoom({ name: "Host", state: researchedState });
    const guest = await api.joinRoom(host.room.id, { token: host.token, name: "Guest" });
    assert.deepEqual(guest.room.state, researchedState,
      "Research citations, saved evidence, final decision, prompt, agent and fingerprint survive sharing");
    const member = { token: host.token, participantId: host.participantId };
    const reopened = await api.getRoom(host.room.id, member);
    assert.deepEqual(reopened.room.state, researchedState,
      "The complete research-to-agent workflow survives a storage reload");

    for (const patch of [
      { finalDecision: { ...finalDecision, conceptId: "missing" } },
      { finalDecision: undefined },
      { handoff: { ...handoff, conceptId: "missing" } },
      { concepts: [...state.concepts, { ...state.concepts[0], id: "concept-two" }], handoff: { ...handoff, conceptId: "concept-two" } },
      { concepts: [...state.concepts, { ...state.concepts[0], id: "concept-two" }], commitment: { conceptId: "concept-two", at: 1004 } },
      { research: { runs: [researchRun], saved: [{ ...savedFinding, sourceIds: ["missing-source"] }] } },
      { research: { runs: [{ ...researchRun, findings: [{ ...finding, sourceIds: ["missing-source"] }] }], saved: [] } },
      { research: { runs: [researchRun, researchRun], saved: [savedFinding] } },
      { research: { runs: [researchRun], saved: [savedFinding, savedFinding] } },
      { brief: { ...state.brief, research: [savedFinding, savedFinding] } },
    ]) {
      await assert.rejects(api.updateRoom(host.room.id, {
        ...member, revision: reopened.room.revision, state: { ...researchedState, ...patch },
      }), (error) => error.status === 400, "Dangling or ambiguous research/decision references must be rejected");
    }
    const afterRejected = await api.getRoom(host.room.id, member);
    assert.equal(afterRejected.room.revision, reopened.room.revision,
      "Invalid references do not change the saved revision");
    assert.deepEqual(afterRejected.room.state, researchedState);

    const changed = {
      ...researchedState,
      // Old runs can be trimmed without destroying self-contained saved evidence.
      research: { runs: [], saved: [savedFinding] },
      brief: { ...researchedState.brief, challenge: "A revised challenge; the prompt now needs regeneration" },
    };
    const updated = await api.updateRoom(host.room.id, {
      ...member, revision: reopened.room.revision, state: changed,
    });
    assert.deepEqual(updated.room.state, changed,
      "Retained evidence and an outdated prompt fingerprint remain available for review/regeneration");
    const guestView = await api.getRoom(host.room.id, { token: host.token, participantId: guest.participantId });
    assert.deepEqual(guestView.room.state, changed);
    console.log(`PASS ${label}: research and agent-prompt round-trip, teammate updates, dangling references, snapshot retention and stale-prompt preservation`);
  }

  async function exerciseLargeResearchState(label) {
    const expandedFinding = {
      ...finding, problem: "P".repeat(500), feature: "F".repeat(500),
      howItWorks: "M".repeat(700), adaptation: "A".repeat(700),
    };
    const saved = Array.from({ length: 12 }, (_, index) => ({
      ...expandedFinding, id: `saved-${index}`, sources: [researchSource], collectedAt: 1000 + index,
    }));
    const largeState = {
      ...researchedState,
      brief: { ...researchedState.brief, research: saved },
      research: {
        saved,
        runs: Array.from({ length: 6 }, (_, index) => ({
          ...researchRun, id: `run-${index}`,
          findings: Array.from({ length: 6 }, (_, child) => ({ ...expandedFinding, id: `finding-${index}-${child}` })),
          searchEntryPoint: `<div>${" ".repeat(11989)}</div>`,
        })),
      },
      handoff: { ...handoff, prompt: "A".repeat(64000) },
    };
    const body = JSON.stringify({ name: "Large research workshop", state: largeState });
    assert(Buffer.byteLength(body) > 256 * 1024,
      "A bounded set of research runs, saved snapshots and a detailed prompt can exceed the old cap");
    assert(Buffer.byteLength(body) < 512 * 1024);
    const parsed = await api.readRoomBody(new Request("https://offscript.example/api/rooms", {
      method: "POST", headers: { "Content-Type": "application/json" }, body,
    }));
    const host = await api.createRoom(parsed);
    const fetched = await api.getRoom(host.room.id, { token: host.token, participantId: host.participantId });
    assert.deepEqual(fetched.room.state, largeState);
    await assert.rejects(api.createRoom({ name: "Too much content", state: {
      ...largeState,
      concepts: Array.from({ length: 30 }, (_, index) => ({
        ...state.concepts[0], id: index === 0 ? "concept-one" : `large-concept-${index}`, pitch: "X".repeat(12000),
      })),
    } }), (error) => error.status === 413);
    console.log(`PASS ${label}: bounded research/prompt state above 256 KiB persists; state above 512 KiB is rejected`);
  }

  await exerciseStorage("Next.js file storage");
  await exerciseConnections("Next.js file storage");
  await exercisePlanning("Next.js file storage");
  await exerciseResearchHandoff("Next.js file storage");
  await exerciseLargeResearchState("Next.js file storage");

  // A deliberately interleaving D1 adapter exercises the production CAS path.
  // It implements only the three SQL statements owned by the room repository.
  const rows = new Map();
  const database = {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              await Promise.resolve();
              const row = rows.get(args[0]);
              return row ? { ...row } : null;
            },
            async run() {
              await Promise.resolve();
              if (sql.startsWith("INSERT")) {
                const [id, payload] = args;
                assert(!rows.has(id));
                rows.set(id, { version: 0, payload });
                return { meta: { changes: 1 } };
              }
              const [payload, , id, version] = args;
              const row = rows.get(id);
              if (!row || row.version !== version)
                return { meta: { changes: 0 } };
              rows.set(id, { version: version + 1, payload });
              return { meta: { changes: 1 } };
            },
          };
        },
      };
    },
  };
  await runWithRoomDatabase(database, () =>
    exerciseStorage("D1 compare-and-swap"),
  );
  await runWithRoomDatabase(database, () =>
    exerciseConnections("D1 compare-and-swap"),
  );
  await runWithRoomDatabase(database, () =>
    exercisePlanning("D1 compare-and-swap"),
  );
  await runWithRoomDatabase(database, () =>
    exerciseResearchHandoff("D1 compare-and-swap"),
  );
  await runWithRoomDatabase(database, () =>
    exerciseLargeResearchState("D1 compare-and-swap"),
  );
  await runWithRoomDatabase(undefined, async () => {
    await assert.rejects(
      api.createRoom({ state, name: "Host" }),
      (error) => error.status === 503,
    );
  });
  await assert.rejects(
    api.readRoomBody(
      new Request("https://offscript.example/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://other.example",
        },
        body: "{}",
      }),
    ),
    (error) => error.status === 403,
  );
  await assert.rejects(
    api.readRoomBody(
      new Request("https://offscript.example/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "{}",
      }),
    ),
    (error) => error.status === 415,
  );
  await assert.rejects(
    api.readRoomBody(
      new Request("https://offscript.example/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    ),
    (error) => error.status === 400,
  );
  await assert.rejects(
    api.readRoomBody(
      new Request("https://offscript.example/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "x".repeat(512 * 1024 + 1),
      }),
    ),
    (error) => error.status === 413,
  );
  await assert.rejects(
    api.readRoomBody(new Request("https://offscript.example/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": String(512 * 1024 + 1) },
      body: "{}",
    })),
    (error) => error.status === 413,
  );
  await assert.rejects(
    api.createRoom({
      name: "Host",
      state: {
        ...state,
        concepts: [{ ...state.concepts[0], id: "__proto__" }],
      },
    }),
    (error) => error.status === 400,
  );
  console.log(
    "PASS request origin, JSON/size/identifier validation, and missing hosted DB fail closed",
  );
} finally {
  process.chdir(project);
  await rm(temporary, { recursive: true, force: true });
}
