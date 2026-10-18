"use client";

import { Check, Copy, Download, FileCode2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Brief, Concept, WorkshopState } from "@/lib/types";
import type { AgentHandoff, FinalDecision, HandoffAgent } from "@/lib/handoff-types";
import { agentHandoffSchema, finalDecisionSchema } from "@/lib/handoff-validation";
import { handoffFingerprint, isHandoffCurrent, sameDecision, type HandoffInput } from "@/lib/handoff";

export interface DecisionHandoffProps {
  brief: Brief;
  concept: Concept | null;
  plan?: WorkshopState["plan"];
  decision?: FinalDecision;
  handoff?: AgentHandoff;
  demo: boolean;
  onSaveDecision: (decision: FinalDecision) => void;
  onSaveHandoff: (handoff: AgentHandoff) => void;
  notify: (message: string) => void;
}

const decisionLabels = [
  ["problem", "Problem to solve", "Describe the concrete friction, rather than the feature you want to build.", 3000],
  ["targetUser", "Who it is for", "Name a specific person or group and their situation.", 1000],
  ["solution", "Solution we will build", "Explain the input, main interaction and useful outcome.", 3000],
  ["whyThis", "Why this direction", "Use the comparison above: user value, distinct mechanism and what your team can finish.", 2000],
  ["successCriteria", "Success looks like", "State an observable outcome and how you will check it.", 2000],
] as const;

export function DecisionHandoff(props: DecisionHandoffProps) {
  if (!props.concept) return (
    <section className="decision-handoff" aria-labelledby="handoff-heading">
      <h2 id="handoff-heading">Turn your choice into a build prompt.</h2>
      <p className="handoff-intro">Save a team choice above. Then confirm the problem and solution, and give Codex or Claude Code a detailed implementation brief.</p>
    </section>
  );
  return <DecisionHandoffEditor key={`${props.concept.id}:${props.decision?.at || 0}`} {...props} concept={props.concept} />;
}

function DecisionHandoffEditor({ brief, concept, plan, decision, handoff, demo, onSaveDecision, onSaveHandoff, notify }: DecisionHandoffProps & { concept: Concept }) {
  const matchingPlan = plan?.conceptId === concept.id ? plan.crucible : undefined;
  const [draft, setDraft] = useState<Omit<FinalDecision, "at">>(() => decision?.conceptId === concept.id ? decision : {
    conceptId: concept.id,
    problem: brief.challenge,
    targetUser: brief.targetUser || "",
    solution: concept.mechanism ? `${concept.pitch}\n\n${concept.mechanism}` : concept.pitch,
    whyThis: [concept.assessment?.userValue, concept.assessment?.feasibility].filter(Boolean).join(" "),
    successCriteria: matchingPlan?.experiment?.successSignal || "",
  });
  const [agent, setAgent] = useState<HandoffAgent>(handoff?.agent || "codex");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestController = useRef<AbortController | null>(null);
  useEffect(() => () => requestController.current?.abort(), []);
  const confirmed = sameDecision(draft, decision);
  const input: HandoffInput = { brief, concept, decision: { ...draft, at: decision?.at || 1 }, plan: matchingPlan, agent, demo };
  const fingerprint = handoffFingerprint(input);
  const latestFingerprint = useRef(fingerprint);
  useEffect(() => { latestFingerprint.current = fingerprint; }, [fingerprint]);
  const current = confirmed && isHandoffCurrent(handoff, input);
  const label = agent === "claude-code" ? "Claude Code" : agent === "codex" ? "Codex" : "your coding agent";

  function confirmDecision(event: React.FormEvent) {
    event.preventDefault();
    const result = finalDecisionSchema.safeParse({ ...draft, at: Date.now() });
    if (!result.success) {
      const issue = result.error.issues[0];
      const name = decisionLabels.find(([key]) => key === issue.path[0])?.[1] || "Decision";
      setError(`${name}: ${issue.message}`);
      return;
    }
    setError("");
    onSaveDecision(result.data);
    notify("Final problem and solution confirmed.");
  }

  async function generate() {
    if (!confirmed || !decision || busy) return;
    setError("");
    setBusy(true);
    const requestedFingerprint = fingerprint;
    const controller = new AbortController();
    requestController.current = controller;
    const timeout = setTimeout(() => controller.abort("timeout"), 125_000);
    try {
      const response = await fetch("/api/handoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, decision }),
        signal: controller.signal,
      });
      const result = await response.json() as { error?: unknown; handoff?: unknown };
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Could not create the build prompt. Please retry.");
      const parsed = agentHandoffSchema.safeParse(result.handoff);
      if (!parsed.success) throw new Error("The generated prompt was incomplete. Please retry; your decision is saved.");
      if (latestFingerprint.current !== requestedFingerprint) {
        setError("Your inputs changed while the prompt was being prepared. Confirm the latest decision and generate again.");
        return;
      }
      if (!isHandoffCurrent(parsed.data, input)) throw new Error("The prompt does not match your current inputs. Please regenerate it.");
      onSaveHandoff(parsed.data);
      notify("Build prompt ready to copy or download.");
    } catch (cause) {
      if (controller.signal.aborted && controller.signal.reason !== "timeout") return;
      setError(controller.signal.reason === "timeout" ? "Generation took too long. Your decision is saved; try again." : cause instanceof Error ? cause.message : "Could not create the build prompt. Please retry.");
    } finally {
      clearTimeout(timeout);
      requestController.current = null;
      setBusy(false);
    }
  }

  async function copy() {
    if (!current || !handoff) return;
    try {
      await navigator.clipboard.writeText(handoff.prompt);
      notify(`Prompt copied. Paste it into ${label}.`);
    } catch {
      setError("Clipboard access was unavailable. Download the Markdown file instead.");
    }
  }

  function download() {
    if (!current || !handoff) return;
    const url = URL.createObjectURL(new Blob([handoff.prompt], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `offscript-${concept.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project"}-${agent}.md`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Build prompt downloaded.");
  }

  return (
    <section className="decision-handoff" aria-labelledby="handoff-heading">
      <div className="handoff-heading-row">
        <div>
          <h2 id="handoff-heading">Confirm the problem. Define the build.</h2>
          <p className="handoff-intro">Your team chose <strong>{concept.title}</strong>. Make the final call in your own words, then prepare a detailed prompt for a coding agent.</p>
        </div>
        {confirmed && <span className="handoff-confirmed"><Check size={15} aria-hidden="true" /> Decision confirmed</span>}
      </div>
      <form className="handoff-decision-form" onSubmit={confirmDecision}>
        <div className="handoff-fields">
          {decisionLabels.map(([key, title, hint, maxLength]) => (
            <label key={key} className={key === "solution" ? "handoff-field-wide" : undefined}>
              <span>{title}</span>
              <textarea value={draft[key]} rows={key === "solution" ? 4 : 3} maxLength={maxLength} required minLength={key === "targetUser" ? 3 : 10} onChange={(event) => { setDraft({ ...draft, [key]: event.target.value }); setError(""); }} aria-describedby={`handoff-${key}-hint`} />
              <small id={`handoff-${key}-hint`}>{hint}</small>
            </label>
          ))}
        </div>
        <div className="handoff-confirm-row">
          <button className="button" type="submit" disabled={confirmed || busy}><Check size={15} aria-hidden="true" />{confirmed ? "Decision confirmed" : "Confirm decision"}</button>
          <p>{confirmed ? "This wording will be preserved in the build prompt." : "Review these suggestions before confirming. You can refine the decision as you learn."}</p>
        </div>
      </form>

      <div className="handoff-build-area">
        <div>
          <h3>A complete brief for your coding agent.</h3>
          <p>Scope, user flows, architecture, data and API contracts, implementation steps, tests, and source references.</p>
        </div>
        <div className="handoff-build-controls">
          <label>Prepare for<select value={agent} onChange={(event) => setAgent(event.target.value as HandoffAgent)} disabled={busy}><option value="codex">Codex</option><option value="claude-code">Claude Code</option><option value="general">Any coding agent</option></select></label>
          <button className="button button-lime" type="button" onClick={generate} disabled={!confirmed || busy}>{busy ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <FileCode2 size={16} aria-hidden="true" />}{busy ? "Preparing build prompt…" : handoff ? "Regenerate build prompt" : "Create build prompt"}</button>
        </div>
        <p className="handoff-mode-note">{demo ? "Demo mode creates a detailed, editable template. It does not use live AI." : "Live mode uses AI to propose a specification around your confirmed decision. Review it before building."}{!confirmed && " Confirm the decision above to continue."}</p>
      </div>
      {error && <p className="handoff-error" role="alert">{error}</p>}
      {busy && <p className="handoff-loading" role="status">Preparing the engineering details. Your confirmed decision is saved.</p>}
      {handoff && (
        <div className="handoff-output">
          <div className="handoff-output-heading">
            <div><h3>{current ? "Your build prompt is ready." : "This prompt needs an update."}</h3><p>{current ? `Paste the full prompt into ${label}, or attach the Markdown file. ${handoff.source === "demo" ? "Demo template." : "AI-generated proposal."}` : "The decision, research, build plan, mode or agent has changed. Confirm your latest decision and regenerate before exporting."}</p></div>
            <div className="handoff-export-actions"><button className="button" type="button" onClick={copy} disabled={!current || busy}><Copy size={15} aria-hidden="true" />Copy prompt</button><button className="button" type="button" onClick={download} disabled={!current || busy}><Download size={15} aria-hidden="true" />Download .md</button></div>
          </div>
          <details className="handoff-preview" open={current}>
            <summary>{current ? "Read the full build prompt" : "View previous prompt"}</summary>
            <div className="handoff-prompt-text" tabIndex={0} aria-label={current ? "Build prompt preview" : "Previous build prompt; outdated"}>
              {handoff.prompt.split("\n").map((line, index) => {
                if (line.startsWith("### ")) return <h5 key={index}>{line.slice(4)}</h5>;
                if (line.startsWith("## ")) return <h4 key={index}>{line.slice(3)}</h4>;
                if (line.startsWith("# ")) return <h4 className="handoff-prompt-title" key={index}>{line.slice(2)}</h4>;
                if (!line.trim()) return null;
                return <p key={index} className={line.startsWith("> ") ? "handoff-quoted" : undefined}>{line.replace(/^> /, "")}</p>;
              })}
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
