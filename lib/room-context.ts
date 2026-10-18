import { AsyncLocalStorage } from "node:async_hooks";

// A request-scoped binding works in the Worker and does not couple Next.js to
// the cloudflare:workers module. An absent hosted binding must fail closed;
// the local filesystem is only for a separately running Next.js server.
const databases = new AsyncLocalStorage<{ database?: D1Database }>();

export function runWithRoomDatabase<T>(
  database: D1Database | undefined,
  run: () => T,
): T {
  return databases.run({ database }, run);
}

export function getRoomDatabaseContext() {
  return databases.getStore();
}
