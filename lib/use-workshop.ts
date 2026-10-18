"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_BRIEF } from "./preset";
import type { RoomSnapshot, WorkshopState } from "./types";

export const initialWorkshop: WorkshopState = {
  brief: {
    ...DEMO_BRIEF,
    challenge: "",
    observations: "",
    constraints: "",
    targetUser: "",
    moment: "",
    workaround: "",
    ownIdeas: "",
    tracks: [],
    judge: { who: "", avoid: "", love: "", winners: "" },
  },
  explorations: [],
  selectedIds: [],
  starredIds: [],
  concepts: [],
  connections: [],
  research: { runs: [], saved: [] },
  stage: 4,
  blind: false,
  revealed: false,
};

class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public room?: RoomSnapshot,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new RequestError(
      "The server returned an unreadable response. Please try again.",
      response.status,
    );
  }
  if (!response.ok) {
    const failure =
      result && typeof result === "object"
        ? (result as { error?: string; room?: RoomSnapshot })
        : {};
    throw new RequestError(
      failure.error || "Something went wrong. Please try again.",
      response.status,
      failure.room,
    );
  }
  return result as T;
}

type Credentials = { id: string; token: string; participantId: string };
type Connection = { credentials: Credentials; generation: number };
const credentialPattern = /^[a-f0-9]{32}$/;
const sameStateExceptReveal = (a: WorkshopState, b: WorkshopState) =>
  JSON.stringify({ ...a, revealed: false }) ===
  JSON.stringify({ ...b, revealed: false });

export function useWorkshop(notify: (message: string) => void) {
  const [state, setState] = useState<WorkshopState>(initialWorkshop);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const current = useRef(state);
  const roomRef = useRef<RoomSnapshot | null>(null);
  const credentialsRef = useRef<Credentials | null>(null);
  const generation = useRef(0);
  const dirty = useRef(false);
  const changeVersion = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pollQueued = useRef(false);
  const storageWarning = useRef(false);

  const setWorkshop = useCallback((next: WorkshopState) => {
    current.current = next;
    setState(next);
  }, []);
  const setSnapshot = useCallback((next: RoomSnapshot | null) => {
    roomRef.current = next;
    setRoom(next);
  }, []);
  const enqueue = useCallback(<T>(task: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(task, task);
    // A failed request must never poison the queue for subsequent retries.
    queue.current = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }, []);
  const connection = useCallback(
    (): Connection | null =>
      credentialsRef.current
        ? {
            credentials: credentialsRef.current,
            generation: generation.current,
          }
        : null,
    [],
  );
  const isCurrent = useCallback(
    (context: Connection) =>
      context.generation === generation.current &&
      credentialsRef.current?.id === context.credentials.id &&
      credentialsRef.current.participantId ===
        context.credentials.participantId,
    [],
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem("offscript-workshop-v1");
      if (saved) {
        const restored = JSON.parse(saved);
        if (
          restored.brief?.judge &&
          Array.isArray(restored.explorations) &&
          Array.isArray(restored.concepts) &&
          Array.isArray(restored.selectedIds) &&
          Array.isArray(restored.starredIds) &&
          Number.isInteger(restored.stage) &&
          restored.stage >= 0 &&
          restored.stage <= 4
        ) {
          setWorkshop({
            ...restored,
            connections: Array.isArray(restored.connections)
              ? restored.connections
              : [],
            blind: Boolean(restored.blind),
            revealed: Boolean(restored.revealed),
          });
        }
      }
      const savedCredentials = sessionStorage.getItem("offscript-room");
      if (savedCredentials) {
        const restored = JSON.parse(savedCredentials);
        if (
          [restored.id, restored.token, restored.participantId].every(
            (value) =>
              typeof value === "string" && credentialPattern.test(value),
          )
        ) {
          credentialsRef.current = restored;
          setCredentials(restored);
        }
      }
    } catch {
      /* A blocked or malformed browser store should not prevent using the workshop. */
    }
    setReady(true);
    return () => {
      generation.current += 1;
    };
  }, [setWorkshop]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem("offscript-workshop-v1", JSON.stringify(state));
    } catch {
      if (!storageWarning.current) {
        storageWarning.current = true;
        notify(
          "Browser storage is unavailable. Keep this tab open to preserve your local workshop.",
        );
      }
    }
  }, [state, ready, notify]);

  const update = useCallback(
    (
      change: Partial<WorkshopState> | ((s: WorkshopState) => WorkshopState),
    ) => {
      const next =
        typeof change === "function"
          ? change(current.current)
          : { ...current.current, ...change };
      dirty.current = true;
      changeVersion.current += 1;
      setWorkshop(next);
    },
    [setWorkshop],
  );

  // This runs inside the queue. If typing continues during a save, save the
  // newer version too before an operation that depends on the room contents.
  const flush = useCallback(
    async (context: Connection) => {
      while (isCurrent(context) && dirty.current && roomRef.current) {
        const version = changeVersion.current;
        const baseRevision = roomRef.current.revision;
        const localState = current.current;
        setSyncing(true);
        let result: { room: RoomSnapshot };
        try {
          result = await api(
            `/api/rooms/${context.credentials.id}`,
            {
              ...context.credentials,
              revision: baseRevision,
              state: localState,
            },
            "PATCH",
          );
        } catch (error) {
          if (
            isCurrent(context) &&
            error instanceof RequestError &&
            error.status === 409 &&
            error.room
          ) {
            // Whole-workshop conflicts are explicit: keep the server version and
            // preserve its actual error (including blind-ballot guardrails).
            dirty.current = false;
            changeVersion.current += 1;
            setWorkshop(error.room.state);
            setSnapshot(error.room);
          }
          throw error;
        }
        if (!isCurrent(context)) return;
        setSnapshot(result.room);
        if (changeVersion.current === version) {
          dirty.current = false;
          setWorkshop(result.room.state);
        }
      }
    },
    [isCurrent, setSnapshot, setWorkshop],
  );

  const receive = useCallback(
    (snapshot: RoomSnapshot, revealBase?: RoomSnapshot) => {
      const base = roomRef.current;
      if (!dirty.current) {
        setSnapshot(snapshot);
        setWorkshop(snapshot.state);
        return;
      }
      if (!base) {
        // Restoring tab credentials has no known server base yet. The local
        // browser copy cannot safely be posted over an unseen shared workshop.
        dirty.current = false;
        changeVersion.current += 1;
        setSnapshot(snapshot);
        setWorkshop(snapshot.state);
        notify(
          "The shared workshop is now connected. Changes made before it connected were replaced with the team’s latest version.",
        );
        return;
      }
      if (snapshot.revision === base.revision) {
        // Ballots and presence can change without changing workshop content.
        setSnapshot(snapshot);
        return;
      }
      if (
        revealBase &&
        snapshot.revision === revealBase.revision + 1 &&
        sameStateExceptReveal(snapshot.state, revealBase.state)
      ) {
        // Our reveal is the only server-side state change. Preserve edits made
        // during that request and rebase them on its known revealed-field change.
        setWorkshop({ ...current.current, revealed: snapshot.state.revealed });
        setSnapshot(snapshot);
        return;
      }
      // Never pair stale local content with a newer server revision. Keep our
      // base revision so the next PATCH detects the conflict instead of silently
      // overwriting the teammate. Presence/ballots can still refresh safely.
      setSnapshot({
        ...base,
        participants: snapshot.participants,
        votes: snapshot.votes,
        myVotes: snapshot.myVotes,
      });
    },
    [notify, setSnapshot, setWorkshop],
  );

  useEffect(() => {
    if (!credentials) return;
    let disposed = false;
    const tick = () => {
      if (disposed || pollQueued.current) return;
      const context = connection();
      if (!context) return;
      pollQueued.current = true;
      void enqueue(async () => {
        if (!isCurrent(context)) return;
        if (dirty.current && roomRef.current) await flush(context);
        else {
          const c = context.credentials;
          const result = await api<{ room: RoomSnapshot }>(
            `/api/rooms/${c.id}?token=${encodeURIComponent(c.token)}&participantId=${encodeURIComponent(c.participantId)}`,
            undefined,
            "GET",
          );
          if (isCurrent(context)) receive(result.room);
        }
      })
        .catch((error) => {
          if (!disposed && isCurrent(context))
            notify(
              error instanceof Error
                ? error.message
                : "Room connection interrupted.",
            );
        })
        .finally(() => {
          pollQueued.current = false;
          if (!disposed && isCurrent(context)) setSyncing(false);
        });
    };
    tick();
    const timer = setInterval(tick, 1500);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [credentials, connection, enqueue, flush, isCurrent, notify, receive]);

  function connect(
    snapshot: RoomSnapshot,
    nextCredentials: Credentials,
    preserveChanges = false,
  ) {
    generation.current += 1;
    credentialsRef.current = nextCredentials;
    dirty.current = preserveChanges;
    if (!preserveChanges) setWorkshop(snapshot.state);
    setSnapshot(snapshot);
    setCredentials(nextCredentials);
    setSyncing(false);
    try {
      sessionStorage.setItem("offscript-room", JSON.stringify(nextCredentials));
    } catch {
      notify(
        "The room is connected, but this browser cannot remember membership after a reload.",
      );
    }
  }

  function createRoom(name: string) {
    const requestedGeneration = generation.current;
    return enqueue(async () => {
      if (requestedGeneration !== generation.current)
        throw new Error("The workshop connection changed. Please try again.");
      const version = changeVersion.current;
      const result = await api<{
        room: RoomSnapshot;
        token: string;
        participantId: string;
      }>("/api/rooms", { state: current.current, name });
      if (requestedGeneration !== generation.current)
        throw new Error(
          "The workshop connection changed before the room was ready.",
        );
      connect(
        result.room,
        {
          id: result.room.id,
          token: result.token,
          participantId: result.participantId,
        },
        version !== changeVersion.current,
      );
      return `${location.origin}/#room=${result.room.id}&token=${result.token}`;
    });
  }

  function joinRoom(id: string, token: string, name: string) {
    const requestedGeneration = generation.current;
    return enqueue(async () => {
      if (requestedGeneration !== generation.current)
        throw new Error("The workshop connection changed. Please try again.");
      const result = await api<{ room: RoomSnapshot; participantId: string }>(
        `/api/rooms/${id}/join`,
        { token, name },
      );
      if (requestedGeneration !== generation.current)
        throw new Error(
          "The workshop connection changed before the room was ready.",
        );
      connect(result.room, { id, token, participantId: result.participantId });
      history.replaceState(null, "", location.pathname + location.search);
    });
  }

  function vote(conceptId: string, value: "fire" | "pass") {
    const context = connection();
    if (!context) return Promise.resolve();
    return enqueue(async () => {
      if (!isCurrent(context)) return;
      setSyncing(true);
      try {
        await flush(context);
        if (!isCurrent(context)) return;
        const result = await api<{ room: RoomSnapshot }>(
          `/api/rooms/${context.credentials.id}/vote`,
          { ...context.credentials, conceptId, value },
        );
        if (isCurrent(context)) {
          receive(result.room);
          await flush(context);
        }
      } finally {
        if (isCurrent(context)) setSyncing(false);
      }
    });
  }

  function reveal() {
    const context = connection();
    if (!context) {
      update({ revealed: true });
      return Promise.resolve();
    }
    return enqueue(async () => {
      if (!isCurrent(context)) return;
      setSyncing(true);
      try {
        await flush(context);
        if (!isCurrent(context)) return;
        const base = roomRef.current ?? undefined;
        const result = await api<{ room: RoomSnapshot }>(
          `/api/rooms/${context.credentials.id}/reveal`,
          context.credentials,
        );
        if (isCurrent(context)) {
          receive(result.room, base);
          await flush(context);
        }
      } finally {
        if (isCurrent(context)) setSyncing(false);
      }
    });
  }

  function leaveRoom() {
    generation.current += 1;
    credentialsRef.current = null;
    setCredentials(null);
    setSnapshot(null);
    dirty.current = false;
    setSyncing(false);
    try {
      sessionStorage.removeItem("offscript-room");
    } catch {
      /* Local mode still works. */
    }
    notify("You are now working in a local workshop.");
  }
  return {
    state,
    update,
    room,
    credentials,
    syncing,
    createRoom,
    joinRoom,
    vote,
    reveal,
    leaveRoom,
  };
}
