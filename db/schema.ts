import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// Atomic compare-and-swap of a complete room keeps workshop edits, participants,
// and private ballots consistent without a multi-statement transaction.
export const rooms = sqliteTable("offscript_rooms", {
  id: text("id").primaryKey(),
  version: integer("version").notNull().default(0),
  payload: text("payload").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
