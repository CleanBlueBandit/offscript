import { z } from "zod";
import { getRoomDatabaseContext } from "./room-context";
import { crucibleSchema } from "./validation";
import { researchEvidenceSchema, researchStateSchema } from "./research-validation";
import { finalDecisionSchema, agentHandoffSchema } from "./handoff-validation";
import type { RoomSnapshot, WorkshopState, VoteCount } from "./types";

// Research retains up to six runs plus twelve evidence snapshots; a detailed
// coding-agent prompt can add another 64k characters. Keep an explicit byte cap.
const MAX_BODY_BYTES = 512 * 1024;
const MAX_PARTICIPANTS = 32;
const credential = z.string().regex(/^[a-f0-9]{32}$/);
const identifier = z
  .string()
  .min(1)
  .max(100)
  .refine(
    (value) => !["__proto__", "prototype", "constructor"].includes(value),
    "Invalid identifier.",
  );
const shortText = z.string().max(200);
const prose = z.string().max(12_000);
const source = z.enum(["demo", "live"]).optional();
const category = z.enum([
  "Physical & Kinetic",
  "Biological & Natural",
  "Economic & Game Theory",
  "Systems & Chaos",
  "Sensory & Human",
  "Historical & Analog",
]);
const perspective = z.object({
  id: identifier,
  name: shortText,
  category,
  axiom: prose,
  operator: prose,
  forbiddenWords: z.array(shortText).max(30),
});
const ingredient = z.object({
  id: identifier,
  perspectiveId: identifier,
  perspectiveName: shortText,
  kind: z.enum(["provocation", "mechanic", "flip"]),
  text: prose,
});
const concept = z.object({
  id: identifier,
  title: shortText,
  pitch: prose,
  mechanism: prose.optional(),
  assessment: z
    .object({
      userValue: prose,
      originality: prose,
      feasibility: prose,
      demoClarity: prose,
    })
    .optional(),
  assumptions: z.array(prose).max(6).optional(),
  inheritedFrom: z
    .array(z.object({ conceptId: identifier, contribution: prose }))
    .max(2)
    .optional(),
  perspectives: z.array(shortText).max(30),
  score: z.number().finite().min(0).max(100),
  pros: z.array(prose).max(20),
  cons: z.array(prose).max(20),
  source,
  parentId: identifier.optional(),
  mutation: shortText.optional(),
  dimmed: z.boolean().optional(),
  x: z.number().finite().min(-100_000).max(100_000).optional(),
  y: z.number().finite().min(-100_000).max(100_000).optional(),
});
const workshopSchema = z.object({
  research: researchStateSchema.optional(),
  finalDecision: finalDecisionSchema.optional(),
  handoff: agentHandoffSchema.optional(),
  brief: z.object({
    research: z.array(researchEvidenceSchema).max(12).optional(),
    challenge: prose,
    targetUser: prose.optional(),
    moment: prose.optional(),
    workaround: prose.optional(),
    ownIdeas: prose.optional(),
    observations: prose,
    constraints: prose,
    tracks: z.array(shortText).max(30),
    judge: z.object({ who: prose, avoid: prose, love: prose, winners: prose }),
  }),
  explorations: z
    .array(
      z.object({
        perspective,
        source,
        ingredients: z.array(ingredient).max(50),
      }),
    )
    .max(64),
  selectedIds: z.array(identifier).max(300),
  starredIds: z.array(identifier).max(300),
  concepts: z.array(concept).max(150),
  connections: z
    .array(z.object({ id: identifier, source: identifier, target: identifier }))
    .max(300)
    .optional(),
  commitment: z
    .object({ conceptId: identifier, at: z.number().finite().nonnegative() })
    .optional(),
  startedAt: z.number().finite().nonnegative().optional(),
  plan: z
    .object({
      conceptId: identifier,
      crucible: crucibleSchema.extend({ source }),
    })
    .optional(),
  stage: z.number().int().min(0).max(8),
  blind: z.boolean(),
  revealed: z.boolean(),
});
const nameSchema = z.string().trim().min(1).max(48);
const memberSchema = z.object({ token: credential, participantId: credential });
const createSchema = z.object({ state: workshopSchema, name: nameSchema });
const joinSchema = z.object({ token: credential, name: nameSchema });
const updateSchema = memberSchema.extend({
  revision: z.number().int().nonnegative(),
  state: workshopSchema,
});
const voteSchema = memberSchema.extend({
  conceptId: identifier,
  value: z.enum(["fire", "pass"]),
});
type Ballot = "fire" | "pass";
interface Participant {
  publicId: string;
  name: string;
  lastSeen: number;
}
interface StoredRoom {
  id: string;
  tokenHash: string;
  revision: number;
  state: WorkshopState;
  // Keys are hashes of private member credentials. Neither hashes nor another
  // member's credential are included in an API response.
  participants: Record<string, Participant>;
  ballots: Record<string, Record<string, Ballot>>;
  createdAt: number;
}
interface RoomRow {
  version: number;
  payload: string;
}
type Mutation<T> = (room: StoredRoom) => T;

export class RoomError extends Error {
  constructor(
    public status: number,
    message: string,
    public room?: RoomSnapshot,
  ) {
    super(message);
    this.name = "RoomError";
  }
}

function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}
async function hash(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new RoomError(
      400,
      result.error.issues[0]?.message ?? "Invalid room request.",
    );
  return result.data;
}
function validateRoomId(id: string) {
  if (!/^[a-f0-9]{32}$/.test(id))
    throw new RoomError(404, "This room was not found.");
}
function validateState(state: WorkshopState) {
  const conceptIds = new Set(state.concepts.map((c) => c.id));
  if (state.commitment && !conceptIds.has(state.commitment.conceptId)) {
    throw new RoomError(
      400,
      "Choose an existing idea before committing to it.",
    );
  }
  if (state.plan && !conceptIds.has(state.plan.conceptId)) {
    throw new RoomError(400, "The build plan must belong to an existing idea.");
  }
  if (state.finalDecision && !conceptIds.has(state.finalDecision.conceptId)) {
    throw new RoomError(400, "The final decision must belong to an existing idea.");
  }
  if (state.finalDecision && state.commitment &&
      state.finalDecision.conceptId !== state.commitment.conceptId) {
    throw new RoomError(400, "The final decision must match the team's chosen idea.");
  }
  if (state.handoff && (!conceptIds.has(state.handoff.conceptId) ||
      !state.finalDecision || state.handoff.conceptId !== state.finalDecision.conceptId)) {
    throw new RoomError(400, "The coding-agent prompt must belong to the confirmed final decision.");
  }
  // A previous prompt may be kept when the brief changes. Its content fingerprint
  // lets the client mark it outdated and require regeneration before exporting.
  const researchGroups = [state.research?.runs, state.research?.saved, state.brief.research];
  if (researchGroups.some((items) => items && new Set(items.map((item) => item.id)).size !== items.length)) {
    throw new RoomError(400, "Research runs and saved findings must each have unique IDs.");
  }
  const connectionIds = new Set<string>();
  const pairs = new Set(
    state.concepts
      .filter((c) => c.parentId)
      .map((c) => JSON.stringify([c.parentId, c.id])),
  );
  for (const connection of state.connections ?? []) {
    const pair = JSON.stringify([connection.source, connection.target]);
    if (
      !conceptIds.has(connection.source) ||
      !conceptIds.has(connection.target) ||
      connection.source === connection.target
    ) {
      throw new RoomError(
        400,
        "Connections must join two different existing ideas.",
      );
    }
    if (connectionIds.has(connection.id) || pairs.has(pair)) {
      throw new RoomError(400, "This connection already exists.");
    }
    connectionIds.add(connection.id);
    pairs.add(pair);
  }
  if (
    new Set(state.concepts.map((concept) => concept.id)).size !==
    state.concepts.length
  ) {
    throw new RoomError(400, "Each concept must have a unique ID.");
  }
  if (
    new TextEncoder().encode(JSON.stringify(state)).length >
    MAX_BODY_BYTES - 4096
  ) {
    throw new RoomError(413, "This workshop is too large to share.");
  }
}
function authorize(
  room: StoredRoom,
  tokenHash: string,
  participantHash?: string,
) {
  if (room.tokenHash !== tokenHash)
    throw new RoomError(403, "The room invitation is invalid.");
  if (participantHash && !Object.hasOwn(room.participants, participantHash)) {
    throw new RoomError(403, "Join this room again to continue.");
  }
}

/** Only this projection may leave the server. Blind ballots stay server-side. */
export function projectRoom(
  room: StoredRoom,
  participantHash: string,
  participantId: string,
): RoomSnapshot {
  const votes: Record<string, VoteCount> = {};
  const myVotes: Record<string, Ballot> = {};
  for (const concept of room.state.concepts) {
    const ballots = room.ballots[concept.id] ?? {};
    if (ballots[participantHash])
      myVotes[concept.id] = ballots[participantHash];
    if (!room.state.blind || room.state.revealed) {
      votes[concept.id] = Object.values(ballots).reduce(
        (total, ballot) => {
          total[ballot] += 1;
          return total;
        },
        { fire: 0, pass: 0 },
      );
    }
  }
  return {
    id: room.id,
    revision: room.revision,
    state: structuredClone(room.state),
    participants: Object.entries(room.participants).map(
      ([memberHash, member]) => ({
        // The viewer can recognize themselves. Every other ID is a public alias,
        // never a reusable participant credential.
        id: memberHash === participantHash ? participantId : member.publicId,
        name: member.name,
        lastSeen: member.lastSeen,
      }),
    ),
    votes,
    myVotes,
  };
}

function storageContext() {
  const context = getRoomDatabaseContext();
  if (context && !context.database) {
    throw new RoomError(
      503,
      "Room storage is unavailable. The hosted DB binding must be configured.",
    );
  }
  return context?.database;
}
async function localPaths(id: string) {
  const { join } = await import("node:path");
  const directory = join(process.cwd(), ".offscript-data");
  return {
    directory,
    file: join(directory, `${id}.json`),
    lock: join(directory, `${id}.lock`),
  };
}
function hasErrorCode(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
async function withLocalLock<T>(
  id: string,
  task: (file: string) => Promise<T>,
): Promise<T> {
  const fs = await import("node:fs/promises");
  const paths = await localPaths(id);
  await fs.mkdir(paths.directory, { recursive: true, mode: 0o700 });
  let acquired = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      await fs.mkdir(paths.lock, { mode: 0o700 });
      acquired = true;
      break;
    } catch (error) {
      if (!hasErrorCode(error, "EEXIST")) throw error;
      try {
        // These private, mutable runtime files are never build-time assets.
        const stat = await fs.stat(/* turbopackIgnore: true */ paths.lock);
        if (Date.now() - stat.mtimeMs > 30_000)
          await fs.rm(paths.lock, { recursive: true, force: true });
      } catch (lockError) {
        if (!hasErrorCode(lockError, "ENOENT")) throw lockError;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
  if (!acquired)
    throw new RoomError(503, "The room is busy. Please try again.");
  try {
    return await task(paths.file);
  } finally {
    await fs.rm(paths.lock, { recursive: true, force: true });
  }
}
async function localRead(file: string): Promise<RoomRow> {
  const fs = await import("node:fs/promises");
  try {
    return JSON.parse(
      await fs.readFile(/* turbopackIgnore: true */ file, "utf8"),
    ) as RoomRow;
  } catch (error) {
    if (hasErrorCode(error, "ENOENT"))
      throw new RoomError(404, "This room was not found.");
    throw error;
  }
}
async function localWrite(file: string, row: RoomRow) {
  const fs = await import("node:fs/promises");
  const temporary = `${file}.${randomToken()}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(row), { mode: 0o600 });
  try {
    await fs.rename(temporary, file);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
async function insertRoom(room: StoredRoom) {
  const database = storageContext();
  if (database) {
    await database
      .prepare(
        "INSERT INTO offscript_rooms (id, version, payload, created_at, updated_at) VALUES (?, 0, ?, ?, ?)",
      )
      .bind(room.id, JSON.stringify(room), room.createdAt, room.createdAt)
      .run();
  } else {
    await withLocalLock(room.id, async (file) => {
      const fs = await import("node:fs/promises");
      // wx prevents even an astronomically unlikely random-ID collision from
      // replacing an existing local room.
      await fs.writeFile(
        file,
        JSON.stringify({ version: 0, payload: JSON.stringify(room) }),
        { flag: "wx", mode: 0o600 },
      );
    });
  }
}
async function changeRoom<T>(id: string, change: Mutation<T>): Promise<T> {
  validateRoomId(id);
  const database = storageContext();
  if (!database) {
    return withLocalLock(id, async (file) => {
      const row = await localRead(file);
      const room = JSON.parse(row.payload) as StoredRoom;
      const result = change(room);
      await localWrite(file, {
        version: row.version + 1,
        payload: JSON.stringify(room),
      });
      return result;
    });
  }
  // D1 serializes the UPDATE. A failed CAS reloads the entire room before
  // retrying, so simultaneous votes/joins never overwrite one another.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const row = await database
      .prepare("SELECT version, payload FROM offscript_rooms WHERE id = ?")
      .bind(id)
      .first<RoomRow>();
    if (!row) throw new RoomError(404, "This room was not found.");
    const room = JSON.parse(row.payload) as StoredRoom;
    const result = change(room);
    const saved = await database
      .prepare(
        "UPDATE offscript_rooms SET version = version + 1, payload = ?, updated_at = ? WHERE id = ? AND version = ?",
      )
      .bind(JSON.stringify(room), Date.now(), id, row.version)
      .run();
    if (saved.meta.changes === 1) return result;
  }
  throw new RoomError(503, "The room is busy. Please try again.");
}

export async function createRoom(input: unknown) {
  const { state, name } = parse(createSchema, input);
  validateState(state);
  const token = randomToken();
  const participantId = randomToken();
  const participantHash = await hash(participantId);
  const now = Date.now();
  const room: StoredRoom = {
    id: randomToken(),
    tokenHash: await hash(token),
    revision: 0,
    state: { ...state, revealed: false },
    participants: {
      [participantHash]: { publicId: randomToken(), name, lastSeen: now },
    },
    ballots: {},
    createdAt: now,
  };
  await insertRoom(room);
  return {
    room: projectRoom(room, participantHash, participantId),
    token,
    participantId,
  };
}
export async function joinRoom(id: string, input: unknown) {
  const { token, name } = parse(joinSchema, input);
  const participantId = randomToken();
  const participantHash = await hash(participantId);
  const tokenHash = await hash(token);
  const publicId = randomToken();
  return changeRoom(id, (room) => {
    authorize(room, tokenHash);
    if (Object.keys(room.participants).length >= MAX_PARTICIPANTS)
      throw new RoomError(409, "This room has reached its 32-person limit.");
    room.participants[participantHash] = {
      publicId,
      name,
      lastSeen: Date.now(),
    };
    return {
      room: projectRoom(room, participantHash, participantId),
      participantId,
    };
  });
}
export async function getRoom(id: string, input: unknown) {
  const { token, participantId } = parse(memberSchema, input);
  const [tokenHash, participantHash] = await Promise.all([
    hash(token),
    hash(participantId),
  ]);
  return changeRoom(id, (room) => {
    authorize(room, tokenHash, participantHash);
    room.participants[participantHash].lastSeen = Date.now();
    return { room: projectRoom(room, participantHash, participantId) };
  });
}
export async function updateRoom(id: string, input: unknown) {
  const { token, participantId, revision, state } = parse(updateSchema, input);
  validateState(state);
  const [tokenHash, participantHash] = await Promise.all([
    hash(token),
    hash(participantId),
  ]);
  return changeRoom(id, (room) => {
    authorize(room, tokenHash, participantHash);
    if (room.revision !== revision) {
      throw new RoomError(
        409,
        "A teammate updated this workshop. The latest version is ready.",
        projectRoom(room, participantHash, participantId),
      );
    }
    if (
      room.state.blind &&
      !room.state.revealed &&
      !state.blind &&
      Object.keys(room.ballots).length > 0
    ) {
      throw new RoomError(
        409,
        "Reveal the current ballots before switching off blind voting.",
        projectRoom(room, participantHash, participantId),
      );
    }
    // Reveal is a separate explicit action; posted JSON cannot inject ballots
    // or bypass it by forging the revealed field.
    const revealed =
      state.blind && !room.state.blind ? false : room.state.revealed;
    room.state = { ...state, revealed };
    room.revision += 1;
    room.participants[participantHash].lastSeen = Date.now();
    const conceptIds = new Set(state.concepts.map((concept) => concept.id));
    for (const conceptId of Object.keys(room.ballots)) {
      if (!conceptIds.has(conceptId)) delete room.ballots[conceptId];
    }
    return { room: projectRoom(room, participantHash, participantId) };
  });
}
export async function voteRoom(id: string, input: unknown) {
  const { token, participantId, conceptId, value } = parse(voteSchema, input);
  const [tokenHash, participantHash] = await Promise.all([
    hash(token),
    hash(participantId),
  ]);
  return changeRoom(id, (room) => {
    authorize(room, tokenHash, participantHash);
    if (!room.state.concepts.some((concept) => concept.id === conceptId))
      throw new RoomError(404, "That concept is no longer in this workshop.");
    // One replaceable ballot per person per concept, never an increment sent by
    // the browser. This also makes retries idempotent.
    const ballots = Object.hasOwn(room.ballots, conceptId)
      ? room.ballots[conceptId]
      : {};
    ballots[participantHash] = value;
    Object.defineProperty(room.ballots, conceptId, {
      value: ballots,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    room.participants[participantHash].lastSeen = Date.now();
    return { room: projectRoom(room, participantHash, participantId) };
  });
}
export async function revealRoom(id: string, input: unknown) {
  const { token, participantId } = parse(memberSchema, input);
  const [tokenHash, participantHash] = await Promise.all([
    hash(token),
    hash(participantId),
  ]);
  return changeRoom(id, (room) => {
    authorize(room, tokenHash, participantHash);
    if (!room.state.revealed) {
      room.state.revealed = true;
      room.revision += 1;
    }
    room.participants[participantHash].lastSeen = Date.now();
    return { room: projectRoom(room, participantHash, participantId) };
  });
}

export function roomResponse(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store, private",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
export function roomErrorResponse(error: unknown) {
  if (error instanceof RoomError)
    return roomResponse(
      { error: error.message, ...(error.room ? { room: error.room } : {}) },
      error.status,
    );
  console.error(
    "Room storage request failed",
    error instanceof Error ? error.message : "Unknown error",
  );
  return roomResponse(
    { error: "Room storage is temporarily unavailable. Please try again." },
    503,
  );
}
export async function readRoomBody(request: Request) {
  const origin = request.headers.get("origin");
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) {
    throw new RoomError(403, "Room changes must come from this site.");
  }
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw new RoomError(415, "Send room changes as JSON.");
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES)
    throw new RoomError(413, "This workshop is too large to share.");
  const reader = request.body?.getReader();
  if (!reader) throw new RoomError(400, "A JSON request body is required.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RoomError(413, "This workshop is too large to share.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    body.set(chunk, position);
    position += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new RoomError(400, "The request body must contain valid JSON.");
  }
}
