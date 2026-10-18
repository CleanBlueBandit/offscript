/** Minimal JSON-schema helpers (previously imported from @google/genai). Upper-case names are lower-cased when sent. */
export const Type = {
  STRING: "STRING",
  NUMBER: "NUMBER",
  INTEGER: "INTEGER",
  BOOLEAN: "BOOLEAN",
  ARRAY: "ARRAY",
  OBJECT: "OBJECT",
} as const;

export type Schema = {
  type?: string;
  description?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: string[];
  propertyOrdering?: string[];
  [key: string]: unknown;
};
