"use client";

import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Concept } from "@/lib/types";
import "@/app/decision-workbench.css";

export interface DecisionWorkbenchProps {
  concepts: Concept[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  commitment?: { conceptId: string; at: number };
  onCommit: (id: string) => void;
  onEvaluate: (id: string) => void;
  onAssess?: (id: string) => void;
  busy: boolean;
}

const criteria = [
  ["userValue", "User value"],
  ["originality", "Originality"],
  ["feasibility", "Build feasibility"],
  ["demoClarity", "Demo clarity"],
] as const;
type ComparisonCriterion = (typeof criteria)[number][0] | "uncertainty";

export function DecisionWorkbench({
  concepts,
  selectedId,
  onSelect,
  commitment,
  onCommit,
  onEvaluate,
  onAssess,
  busy,
}: DecisionWorkbenchProps) {
  const [comparisonCriterion, setComparisonCriterion] =
    useState<ComparisonCriterion>("userValue");
  const active = concepts.filter((concept) => !concept.dimmed);
  const selected = active.find((concept) => concept.id === selectedId);
  const selectedNeedsAssessment =
    selected &&
    (!selected.mechanism?.trim() ||
      criteria.some(([key]) => !selected.assessment?.[key]?.trim()));
  const committed = concepts.find(
    (concept) => concept.id === commitment?.conceptId,
  );

  return (
    <section className="decision-workbench" aria-labelledby="decision-heading">
      <div className="decision-heading-row">
        <div>
          <h2 id="decision-heading">Choose what is worth building.</h2>
          <p>
            Compare the reasons, discuss the unknowns, then commit to a test.
          </p>
        </div>
        {committed && (
          <span className="decision-commit-status">
            <Check size={15} aria-hidden="true" />
            Chosen: {committed.title}
          </span>
        )}
      </div>

      {active.length ? (
        <>
          <p className="decision-caveat">
            These are working assessments, not validated outcomes. Demo concepts
            use illustrative reasoning.
          </p>
          <div className="decision-compact-controls">
            <label>
              Compare by
              <select
                value={comparisonCriterion}
                onChange={(event) =>
                  setComparisonCriterion(
                    event.target.value as ComparisonCriterion,
                  )
                }
              >
                {criteria.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
                <option value="uncertainty">Key uncertainty</option>
              </select>
            </label>
            <p>Compare one criterion at a time.</p>
          </div>
          <div
            className="decision-comparison"
            role="region"
            aria-label="Compare concept assessments"
            tabIndex={0}
          >
            <table data-criterion={comparisonCriterion}>
              <caption className="decision-sr-only">
                Compare active concepts and select one to develop.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Concept</th>
                  {criteria.map(([key, label]) => (
                    <th key={key} scope="col" data-column={key}>
                      {label}
                    </th>
                  ))}
                  <th scope="col" data-column="uncertainty">
                    Key uncertainty
                  </th>
                </tr>
              </thead>
              <tbody>
                {active.map((concept) => (
                  <tr
                    key={concept.id}
                    data-selected={selectedId === concept.id}
                  >
                    <th scope="row">
                      <button
                        className="decision-concept-select"
                        onClick={() => onSelect(concept.id)}
                        aria-pressed={selectedId === concept.id}
                      >
                        <span className="decision-radio" aria-hidden="true">
                          {selectedId === concept.id && <Check size={12} />}
                        </span>
                        {concept.title}
                      </button>
                      {concept.mechanism && (
                        <>
                          <p className="decision-mechanism">
                            {concept.mechanism}
                          </p>
                          <details className="decision-compact-mechanism">
                            <summary>Mechanism</summary>
                            <p>{concept.mechanism}</p>
                          </details>
                        </>
                      )}
                      {concept.id === commitment?.conceptId && (
                        <span className="decision-chosen-label">
                          Team choice
                        </span>
                      )}
                    </th>
                    {criteria.map(([key]) => (
                      <td key={key} data-column={key}>
                        {concept.assessment?.[key]?.trim() || (
                          <span className="decision-unassessed">
                            Needs assessment
                          </span>
                        )}
                      </td>
                    ))}
                    <td data-column="uncertainty">
                      {concept.assumptions?.[0]?.trim() || (
                        <span className="decision-unassessed">
                          Needs assessment
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="decision-next-step">
            <div>
              <strong>
                {selected
                  ? selected.title
                  : "Select an idea to make a decision."}
              </strong>
              <p>
                {selected
                  ? commitment?.conceptId === selected.id
                    ? "Your team’s choice is saved. Turn its biggest uncertainty into a small experiment."
                    : "You can change your choice as you learn. Pruned ideas remain outside this comparison."
                  : "Use the concept names above or select a card on the canvas."}
              </p>
            </div>
            <div className="decision-actions">
              {selected && selectedNeedsAssessment && onAssess && (
                <button
                  className="button"
                  onClick={() => onAssess(selected.id)}
                  disabled={busy}
                >
                  Assess this idea
                </button>
              )}
              {selected && commitment?.conceptId !== selected.id && (
                <button
                  className="button button-lime"
                  onClick={() => onCommit(selected.id)}
                  disabled={busy}
                >
                  Choose this idea <Check size={15} aria-hidden="true" />
                </button>
              )}
              <button
                className={`button ${selected && commitment?.conceptId === selected.id ? "button-lime" : ""}`}
                onClick={() => selected && onEvaluate(selected.id)}
                disabled={!selected || busy}
              >
                {busy ? (
                  <Loader2 size={15} className="spin" aria-hidden="true" />
                ) : (
                  <ArrowRight size={15} aria-hidden="true" />
                )}
                Plan a five-minute test
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="decision-empty">
          Your active concepts will appear here. Generate a few directions or
          restore a pruned idea to compare them.
        </div>
      )}
    </section>
  );
}
