import type { ResearchEvidence, ResearchState } from "./research-types";
import type { AgentHandoff, FinalDecision } from "./handoff-types";

export type Category =
  | "Physical & Kinetic"
  | "Biological & Natural"
  | "Economic & Game Theory"
  | "Systems & Chaos"
  | "Sensory & Human"
  | "Historical & Analog";
export interface Perspective {
  id: string;
  name: string;
  category: Category;
  axiom: string;
  operator: string;
  forbiddenWords: string[];
}
export interface JudgeProfile {
  who: string;
  avoid: string;
  love: string;
  winners: string;
}
export interface Brief {
  research?: ResearchEvidence[];
  challenge: string;
  targetUser?: string;
  moment?: string;
  workaround?: string;
  ownIdeas?: string;
  observations: string;
  constraints: string;
  tracks: string[];
  judge: JudgeProfile;
}
export type IngredientKind = "provocation" | "mechanic" | "flip";
export interface Ingredient {
  id: string;
  perspectiveId: string;
  perspectiveName: string;
  kind: IngredientKind;
  text: string;
}
export interface Exploration {
  source?: "demo" | "live";
  perspective: Perspective;
  ingredients: Ingredient[];
}
export interface Concept {
  source?: "demo" | "live";
  id: string;
  title: string;
  pitch: string;
  mechanism?: string;
  assessment?: {
    userValue: string;
    originality: string;
    feasibility: string;
    demoClarity: string;
  };
  assumptions?: string[];
  inheritedFrom?: { conceptId: string; contribution: string }[];
  perspectives: string[];
  score: number;
  pros: string[];
  cons: string[];
  parentId?: string;
  mutation?: string;
  dimmed?: boolean;
  x?: number;
  y?: number;
}
export type Mutation =
  | "autonomous"
  | "widget"
  | "invert"
  | "wildcard"
  | "splice";
export interface Crucible {
  source?: "demo" | "live";
  verdict: string;
  score: number;
  judgeReaction: string;
  benchmark: string;
  pros: string[];
  cons: string[];
  weakestAssumption: { assumption: string; fix: string; test: string };
  experiment?: { hypothesis: string; steps: string[]; successSignal: string };
  scope?: { mustBuild: string[]; cut: string[] };
  blueprint: {
    signals: string[];
    architecture: string[];
    timeline: { hours: string; task: string }[];
    demo: { seconds: string; action: string }[];
  };
}
export interface IdeaConnection {
  id: string;
  source: string;
  target: string;
}
export interface WorkshopState {
  research?: ResearchState;
  finalDecision?: FinalDecision;
  handoff?: AgentHandoff;
  brief: Brief;
  explorations: Exploration[];
  selectedIds: string[];
  starredIds: string[];
  concepts: Concept[];
  connections?: IdeaConnection[];
  commitment?: { conceptId: string; at: number };
  startedAt?: number;
  plan?: { conceptId: string; crucible: Crucible };
  stage: number;
  blind: boolean;
  revealed: boolean;
}
export interface VoteCount {
  fire: number;
  pass: number;
}
export interface RoomSnapshot {
  id: string;
  revision: number;
  state: WorkshopState;
  participants: { id: string; name: string; lastSeen: number }[];
  votes: Record<string, VoteCount>;
  myVotes: Record<string, "fire" | "pass">;
}
