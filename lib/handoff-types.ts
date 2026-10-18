export interface FinalDecision {
  conceptId: string;
  problem: string;
  targetUser: string;
  solution: string;
  whyThis: string;
  successCriteria: string;
  at: number;
}

export type HandoffAgent = "codex" | "claude-code" | "general";

export interface AgentHandoff {
  conceptId: string;
  decisionFingerprint: string;
  prompt: string;
  generatedAt: number;
  agent: HandoffAgent;
  source: "live" | "demo";
}
