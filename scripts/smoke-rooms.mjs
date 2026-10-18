/** Run against a running local server: node scripts/smoke-rooms.mjs http://127.0.0.1:5173 */
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const origin = new URL(process.argv[2] || "http://127.0.0.1:5173").origin;
await mkdir(".offscript-data", { recursive: true });
const temporary = await mkdtemp(join(process.cwd(), ".offscript-data", "http-test-"));
try {
  for (const name of ["perspectives", "preset"]) {
    const source = await readFile(join("lib", `${name}.ts`), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
    await writeFile(join(temporary, `${name}.mjs`), compiled.replace(/(['"])\.\/perspectives\1/, '"./perspectives.mjs"'));
  }
  const { DEMO_BRIEF, INITIAL_EXPLORATIONS } = await import(pathToFileURL(join(temporary, "preset.mjs")).href);
  const state = {
    brief: DEMO_BRIEF, explorations: INITIAL_EXPLORATIONS.map(item => ({ ...item, source: "demo" })),
    selectedIds: [], starredIds: [], stage: 2, blind: true, revealed: false,
    concepts: [{ id: "http-smoke-concept", title: "Departure Ring", pitch: "One quiet signal for the next journey.", perspectives: ["Choreographer"], score: 86, pros: ["A focused demo"], cons: ["Needs context access"], source: "demo" }],
  };
  async function request(path, method, body, expected = 200) {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: { "Content-Type": "application/json", Origin: origin },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json();
    assert.equal(response.status, expected, result.error || `Unexpected HTTP ${response.status}`);
    assert.match(response.headers.get("cache-control") || "", /no-store/);
    return result;
  }
  const host = await request("/api/rooms", "POST", { state, name: "HTTP smoke host" }, 201);
  const roomPath = `/api/rooms/${host.room.id}`;
  const guest = await request(`${roomPath}/join`, "POST", { token: host.token, name: "HTTP smoke guest" });
  const hostAuth = { token: host.token, participantId: host.participantId };
  const guestAuth = { token: host.token, participantId: guest.participantId };
  assert.equal(guest.room.state.explorations.length, 15);
  assert.equal(guest.room.state.explorations[0].source, "demo");
  assert(!JSON.stringify(guest.room).includes(host.participantId));
  await Promise.all([
    request(`${roomPath}/vote`, "POST", { ...hostAuth, conceptId: "http-smoke-concept", value: "fire" }),
    request(`${roomPath}/vote`, "POST", { ...guestAuth, conceptId: "http-smoke-concept", value: "pass" }),
  ]);
  const hidden = await request(`${roomPath}?${new URLSearchParams(hostAuth)}`, "GET");
  assert.deepEqual(hidden.room.votes, {});
  assert.deepEqual(hidden.room.myVotes, { "http-smoke-concept": "fire" });
  assert.equal(hidden.room.participants.length, 2);
  const revealed = await request(`${roomPath}/reveal`, "POST", hostAuth);
  assert.deepEqual(revealed.room.votes, { "http-smoke-concept": { fire: 1, pass: 1 } });
  await request(roomPath, "PATCH", { ...hostAuth, revision: 0, state }, 409);
  const guestRefresh = await request(`${roomPath}?${new URLSearchParams(guestAuth)}`, "GET");
  assert.deepEqual(guestRefresh.room.votes, revealed.room.votes);
  console.log(`PASS HTTP room create, join, concurrent private ballots, reveal, stale revision and refresh at ${origin}`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
