"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bookmark, Check, ExternalLink, Globe2, Link2, Loader2, Search, Trophy, X } from "lucide-react";
import type { ResearchEvidence, ResearchFinding, ResearchRun, ResearchState } from "@/lib/research-types";
import { researchRunSchema } from "@/lib/research-validation";

const emptyResearch: ResearchState = { runs: [], saved: [] };
const modes = [
  { id: "web", label: "Across the web", icon: Globe2 },
  { id: "hackathons", label: "Past hackathons", icon: Trophy },
  { id: "urls", label: "Specific websites", icon: Link2 },
] as const;

function safeLink(value: string) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function ResearchWorkbench({ research = emptyResearch, onUpdate, onStartBrief, onContinue }: {
  research?: ResearchState;
  configured?: boolean;
  onUpdate: (change: (current: ResearchState) => ResearchState) => void;
  onStartBrief: (evidence: ResearchEvidence) => void;
  onContinue: () => void;
}) {
  const [query, setQuery] = useState(research.runs[0]?.query ?? "");
  const [mode, setMode] = useState<ResearchRun["mode"]>("web");
  const [urls, setUrls] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  const run = research.runs.find((item) => item.id === activeId) ?? research.runs[0];

  async function researchTopic(event: React.FormEvent) {
    event.preventDefault();
    if (pending) return;
    const enteredUrls = urls.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean);
    if (mode === "urls" && !enteredUrls.length) { setError("Add at least one public website URL."); return; }
    if (enteredUrls.length > 5) { setError("Research up to five websites at a time."); return; }
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/research", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify({ query: query.trim(), mode, urls: enteredUrls, demo: false }),
      });
      const result: unknown = await response.json().catch(() => null);
      const payload = result && typeof result === "object" ? result as Record<string, unknown> : {};
      if (!response.ok) throw new Error(typeof payload.error === "string" ? payload.error : "Research could not finish. Try a narrower topic or another URL.");
      const parsed = researchRunSchema.safeParse(payload.run);
      if (!parsed.success) throw new Error("The research response was incomplete. Please try again.");
      const nextRun = parsed.data;
      if (controller.signal.aborted) return;
      onUpdate((current) => ({ ...current, runs: [nextRun, ...current.runs].slice(0, 6) }));
      setActiveId(nextRun.id);
      setNotice(`${nextRun.findings.length} findings ready to review.`);
      requestAnimationFrame(() => resultsRef.current?.focus());
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Research could not finish. Try again.");
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  function collect(finding: ResearchFinding, currentRun: ResearchRun) {
    const alreadySaved = research.saved.some((item) => item.id === finding.id);
    if (!alreadySaved && research.saved.length >= 12) { setError("Your collection has 12 findings. Remove one before adding another."); return; }
    onUpdate((current) => ({
      ...current,
      saved: alreadySaved ? current.saved.filter((item) => item.id !== finding.id) : [...current.saved, {
        ...finding, sources: currentRun.sources.filter((source) => finding.sourceIds.includes(source.id)), collectedAt: Date.now(),
      }],
    }));
    setNotice(alreadySaved ? "Finding removed from the brief’s research." : "Finding saved. It will inform your brief, ideas, and build prompt.");
  }

  return <div className="research-workbench">
    <div className="page-heading">
      <div><h1>Find your next idea.</h1><p>Search real products and past hackathon projects. Collect ideas and features worth building on.</p></div>
      <button className="button" onClick={onContinue}>Go to Briefing <ArrowRight size={16} /></button>
    </div>
    <form className="research-form" onSubmit={researchTopic} aria-label="Research websites and projects">
      <label className="field-label" htmlFor="research-topic">What would you like to explore?
        <textarea id="research-topic" rows={2} value={query} maxLength={1000} onChange={(event) => setQuery(event.target.value)} placeholder="For example: tools that help students find a project partner, or memorable accessibility hackathon demos" required minLength={3} />
      </label>
      <fieldset className="research-modes"><legend>Where to look</legend><div>
        {modes.map(({ id, label, icon: Icon }) => <label key={id} className={mode === id ? "selected" : ""}>
          <input type="radio" name="research-mode" value={id} checked={mode === id} onChange={() => setMode(id)} />
          <Icon size={16} aria-hidden="true" /><span>{label}</span>
        </label>)}
      </div></fieldset>
      {mode === "urls" ? <label className="field-label" htmlFor="research-urls">Website URLs <small>Up to five, one per line</small>
        <textarea id="research-urls" rows={3} maxLength={10000} value={urls} onChange={(event) => setUrls(event.target.value)} placeholder="https://example.com/product" />
        <span className="field-help">Public pages only. Pages behind a login or blocking automated access may be unavailable.</span>
      </label> : <details className="research-url-option"><summary>Add specific websites <span>Optional</span></summary>
        <label className="field-label" htmlFor="research-extra-urls">Include these URLs in the research
          <textarea id="research-extra-urls" rows={3} maxLength={10000} value={urls} onChange={(event) => setUrls(event.target.value)} placeholder="Up to five public URLs, one per line" />
        </label>
      </details>}
      <div className="research-submit-row">
        <p>The AI searches the live web and lists its sources. Open each link to verify.</p>
        <button className="button button-lime" type="submit" disabled={pending || query.trim().length < 3}>
          {pending ? <Loader2 size={16} className="spin" /> : <Search size={16} />}
          {pending ? "Finding ideas…" : mode === "urls" ? "Find ideas on these sites" : "Find ideas"}
        </button>
      </div>
    </form>
    {error && <div className="research-error" role="alert">{error}</div>}
    <p className="research-status" role="status" aria-live="polite">{pending ? "Looking for source material and extracting useful features. You can keep your existing findings." : notice}</p>
    <div className="research-content">
      <section className="research-results" aria-labelledby="research-results-title" aria-busy={pending}>
        <div className="research-section-heading"><h2 id="research-results-title" tabIndex={-1} ref={resultsRef}>{run ? "What we found" : "Look beyond the first idea"}</h2>
          {research.runs.length > 1 && <label className="research-history">Previous research<select value={run?.id ?? ""} onChange={(event) => setActiveId(event.target.value)}>{research.runs.map((item) => <option key={item.id} value={item.id}>{item.query.slice(0, 75)}</option>)}</select></label>}
        </div>
        {run ? <>
          <p className="research-summary">{run.summary}</p>
          <p className="research-meta">{run.source === "demo" ? "Illustrative example" : run.engine === "public-web" ? "Live web results · DuckDuckGo" : "Live web search (AI)"} · {run.sources.length} sources · {new Date(run.createdAt).toLocaleDateString()}</p>
          {run.limitations.length > 0 && <details className="research-limitations"><summary>Research limits and missing information</summary><ul>{run.limitations.map((item, i) => <li key={i}>{item}</li>)}</ul></details>}
          <div className="research-findings">{run.findings.map((finding) => {
            const saved = research.saved.some((item) => item.id === finding.id);
            const sources = run.sources.filter((source) => finding.sourceIds.includes(source.id));
            return <article className="research-finding" key={finding.id}>
              <div className="research-finding-heading"><h3>{finding.title}</h3><button className={`button button-small ${saved ? "research-saved" : ""}`} aria-pressed={saved} onClick={() => collect(finding, run)}>{saved ? <Check size={14} /> : <Bookmark size={14} />}{saved ? "Saved" : "Save finding"}</button></div>
              <p className="research-feature">{finding.feature}</p>
              {finding.kind === "idea" ? <p className="research-lead-note">A source-linked idea to investigate. Open the original page to review the problem, features, and implementation.</p> : <dl><div><dt>Problem it addresses</dt><dd>{finding.problem}</dd></div><div><dt>How it works</dt><dd>{finding.howItWorks}</dd></div><div><dt>A direction to explore</dt><dd>{finding.adaptation}</dd></div></dl>}
              <div className="research-source-links">{sources.length ? sources.map((source) => <a key={source.id} href={safeLink(source.url)} target="_blank" rel="noopener noreferrer">{source.title}<ExternalLink size={12} /><span className="research-source-access">{source.access === "retrieved" ? "Page reviewed" : "Search source"}</span></a>) : <span>Illustrative example. No verified source.</span>}</div>
            </article>;
          })}</div>
          {run.searchQueries && run.searchQueries.length > 0 && <details className="research-limitations"><summary>Searches used</summary><ul>{run.searchQueries.map((item, i) => <li key={i}>{item}</li>)}</ul></details>}
          {run.searchEntryPoint && <iframe className="research-search-suggestions" title="Google Search suggestions" srcDoc={run.searchEntryPoint} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" />}
        </> : <div className="research-empty"><Search size={26} aria-hidden="true"/><p>Start with a topic, a hackathon theme, or websites you admire.</p><p>Research separates the original feature from a possible adaptation. Save what is relevant, then define your own problem in Briefing.</p><div className="research-examples">{["Accessibility projects from past hackathons", "Tools for finding a project partner"].map((example) => <button className="button button-small" key={example} onClick={() => { setQuery(example); setMode(example.includes("hackathons") ? "hackathons" : "web"); }}>{example}<ArrowRight size={14}/></button>)}</div></div>}
      </section>
      <aside className="research-collection" aria-label="Saved research">
        <div className="research-section-heading"><h2>Your collection</h2><span>{research.saved.length}/12</span></div>
        <p>Saved findings travel with your brief and the final coding-agent prompt.</p>
        {research.saved.length ? <ul>{research.saved.map((item) => <li key={item.id}>
          <div><strong>{item.title}</strong><button className="icon-button" aria-label={`Remove ${item.title} from research`} onClick={() => onUpdate((current) => ({...current, saved: current.saved.filter((saved) => saved.id !== item.id)}))}><X size={15}/></button></div>
          <p>{item.kind === "idea" ? item.feature : item.problem}</p>
          <button className="research-use-problem" onClick={() => onStartBrief(item)}>{item.kind === "idea" ? "Explore this idea in Briefing" : "Use this problem in Briefing"} <ArrowRight size={14}/></button>
        </li>)}</ul> : <div className="research-collection-empty"><Bookmark size={22}/><p>Save a useful feature or problem to keep its sources close.</p></div>}
        <button className="button button-lime" onClick={onContinue}>Shape your brief <ArrowRight size={16}/></button>
      </aside>
    </div>
  </div>;
}
