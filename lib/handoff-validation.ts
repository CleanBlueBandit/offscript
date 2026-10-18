import { z } from "zod";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const timestamp = z.number().int().min(1).max(8.64e15);
export const handoffAgentSchema = z.enum(["codex", "claude-code", "general"]);
export const finalDecisionSchema = z.object({
  conceptId: text(1, 150),
  problem: text(10, 3000),
  targetUser: text(3, 1000),
  solution: text(10, 3000),
  whyThis: text(10, 2000),
  successCriteria: text(10, 2000),
  at: timestamp,
});
export const agentHandoffSchema = z.object({
  conceptId: text(1, 150),
  decisionFingerprint: text(1, 100),
  prompt: text(1500, 64000),
  generatedAt: timestamp,
  agent: handoffAgentSchema,
  source: z.enum(["live", "demo"]),
});

const items = (min = 2, max = 8) => z.array(text(15, 1400)).min(min).max(max);
export const engineeringSpecSchema = z.object({
  mvp: items(3),
  nonGoals: items(2),
  journeys: items(2, 5),
  screens: items(2, 6),
  architecture: items(3),
  dataModel: items(2, 6),
  apiContracts: items(2, 6),
  integrations: items(2, 6),
  milestones: items(3, 7),
  acceptanceCriteria: items(4, 10),
  tests: items(4, 8),
  edgeCases: items(3, 8),
  accessibility: items(3, 6),
  security: items(3, 6),
  deliverables: items(3, 7),
  openQuestions: items(1, 6),
});
export type EngineeringSpec = z.infer<typeof engineeringSpecSchema>;
