export type ResearchMode = "web" | "hackathons" | "urls";

export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  kind: "website" | "hackathon" | "article";
  access: "retrieved" | "search";
  summary?: string;
};

export type ResearchFinding = {
  id: string;
  title: string;
  problem: string;
  feature: string;
  howItWorks: string;
  adaptation: string;
  sourceIds: string[];
  kind: "feature" | "problem" | "pattern" | "idea";
};

export type ResearchRun = {
  id: string;
  query: string;
  mode: ResearchMode;
  createdAt: number;
  summary: string;
  sources: ResearchSource[];
  findings: ResearchFinding[];
  limitations: string[];
  searchQueries?: string[];
  /** Provider-returned Google Search attribution HTML. Render in a sandbox, never innerHTML. */
  searchEntryPoint?: string;
  source: "live" | "demo";
  engine?: "gemini" | "public-web";
};

export type ResearchEvidence = ResearchFinding & {
  sources: ResearchSource[];
  collectedAt: number;
};

export type ResearchState = {
  runs: ResearchRun[];
  saved: ResearchEvidence[];
};
