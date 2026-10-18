"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Download,
  FlaskConical,
  Plus,
  ArrowLeft,
  Check,
} from "lucide-react";
import {
  EVALUATION_STORAGE_KEY,
  MAX_TRIALS,
  TRIAL_CONDITIONS,
  evaluationCsv,
  isEvaluationTrial,
  parseEvaluationTrials,
  type EvaluationTrial,
  type PrototypeOutcome,
  type TrialCondition,
  type TrialDataSource,
  type TrialReview,
} from "@/lib/evaluation";
import "@/app/decision-workbench.css";

export interface EvaluationLabProps {
  defaultDataSource?: TrialDataSource;
}

const ratingLabels = ["1 · Low", "2", "3 · Moderate", "4", "5 · High"];

export function EvaluationLab({
  defaultDataSource = "manual",
}: EvaluationLabProps) {
  const [trials, setTrials] = useState<EvaluationTrial[]>([]);
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewId, setReviewId] = useState("");
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const storageUsable = useRef(true);

  useEffect(() => {
    // Read the device-only store after hydration; cancel if this view unmounts.
    const frame = window.requestAnimationFrame(() => {
      try {
        setTrials(
          parseEvaluationTrials(
            window.localStorage.getItem(EVALUATION_STORAGE_KEY),
          ),
        );
      } catch {
        storageUsable.current = false;
        setStorageError(
          "The saved trial log could not be read. New records will stay in this session; export them before leaving. Existing saved data has not been changed.",
        );
      }
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function save(next: EvaluationTrial[]) {
    setTrials(next);
    if (!storageUsable.current) return;
    try {
      window.localStorage.setItem(EVALUATION_STORAGE_KEY, JSON.stringify(next));
    } catch {
      storageUsable.current = false;
      setStorageError(
        "This browser could not save the trial log. Your records are still here; export CSV before leaving this page.",
      );
    }
  }

  function addTrial(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (key: string) => String(data.get(key) || "").trim();
    const time = field("minutesToCommit");
    const trial: EvaluationTrial = {
      id: crypto.randomUUID(),
      at: Date.now(),
      condition: field("condition") as TrialCondition,
      source: field("source") as TrialDataSource,
      briefCode: field("briefCode"),
      teamCode: field("teamCode"),
      ideaSummary: field("ideaSummary"),
      timeBudgetMinutes: Number(field("timeBudgetMinutes")),
      modelName: field("modelName") || undefined,
      modelBudget: field("modelBudget"),
      minutesToCommit: time ? Number(time) : null,
      prototype: field("prototype") as PrototypeOutcome,
      notes: field("notes"),
    };
    if (!isEvaluationTrial(trial) || trials.length >= MAX_TRIALS) {
      setMessage(
        "Check the trial fields. The log holds up to 100 trials; export your records when it is full.",
      );
      return;
    }
    save([...trials, trial]);
    setShowForm(false);
    setMessage(
      "Trial recorded. Add a blind review and update the prototype outcome when they are ready.",
    );
  }

  function addReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trial = trials.find((entry) => entry.id === reviewId);
    if (!trial) return;
    const data = new FormData(event.currentTarget);
    const review: TrialReview = {
      reviewer: String(data.get("reviewer") || "").trim(),
      originality: Number(data.get("originality")),
      usefulness: Number(data.get("usefulness")),
      feasibility: Number(data.get("feasibility")),
      blind: true,
      notes: String(data.get("reviewNotes") || "").trim(),
      at: Date.now(),
    };
    if (!data.get("blind") || !isEvaluationTrial({ ...trial, review })) {
      setMessage(
        "Choose all three ratings and confirm the reviewer did not know the idea’s method.",
      );
      return;
    }
    save(
      trials.map((entry) =>
        entry.id === trial.id ? { ...entry, review } : entry,
      ),
    );
    setReviewId("");
    setMessage("Blind review saved. The method is still hidden in this view.");
  }

  function exportTrials() {
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", evaluationCsv(trials)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "offscript-team-trials.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "CSV exported with trial conditions, observed outcomes, and separate reviewer ratings.",
    );
  }

  const unreviewed = trials.filter((trial) => !trial.review);
  const reviewTrial = unreviewed.find((trial) => trial.id === reviewId);

  return (
    <details className="evaluation-lab">
      <summary>
        <FlaskConical size={17} aria-hidden="true" />
        <span>Does this process help your team?</span>
        <span className="evaluation-summary-note">Optional trial log</span>
        <ChevronDown
          size={17}
          className="evaluation-chevron"
          aria-hidden="true"
        />
      </summary>
      <div className="evaluation-body">
        <div className="evaluation-intro">
          <h2>Test the process with real teams.</h2>
          <p>
            Compare small and large perspective sets with plain ChatGPT and
            unaided brainstorming. No results are generated for you.
          </p>
        </div>
        {storageError && (
          <p className="evaluation-error" role="alert">
            {storageError}
          </p>
        )}
        <p className="evaluation-message" role="status" aria-live="polite">
          {message}
        </p>
        {!reviewMode ? (
          <>
            <details className="evaluation-method">
              <summary>Keep the comparison fair</summary>
              <ol>
                <li>
                  Use comparable teams, the same brief and time limit, and
                  comparable usage budgets. Record the exact model and version.
                  Comparing Offscript with ChatGPT can also measure model
                  differences; it does not isolate the interface’s effect.
                </li>
                <li>
                  To test the number of perspectives, keep the model, brief,
                  total generation budget, and time limit the same for
                  Offscript’s 6- and 15-perspective conditions.
                </li>
                <li>
                  Randomly assign methods where possible. If teams try more than
                  one, vary the order and use comparable new briefs to reduce
                  learning effects.
                </li>
                <li>
                  Measure time from the start of brainstorming to a committed
                  idea. Leave it blank if the team did not commit. Count
                  distinct mechanisms separately from polished wording.
                </li>
                <li>
                  Give an independent reviewer the brief and anonymized idea
                  summary. Hide the method and perspective count. Rate
                  originality, usefulness, and feasibility separately using the
                  same rubric.
                </li>
                <li>
                  Check whether a working prototype is completed within the same
                  build deadline. Keep demo and live results separate; a small
                  trial is evidence to investigate, not proof.
                </li>
              </ol>
            </details>
            <div className="evaluation-toolbar">
              <button
                className="button"
                disabled={!ready || trials.length >= MAX_TRIALS}
                onClick={() => {
                  setShowForm(!showForm);
                  setMessage("");
                }}
              >
                <Plus size={15} aria-hidden="true" />
                {showForm ? "Close trial form" : "Record a trial"}
              </button>
              <button
                className="button"
                disabled={!unreviewed.length}
                onClick={() => {
                  setReviewMode(true);
                  setShowForm(false);
                  setMessage("");
                }}
              >
                Open blind review
              </button>
              <button
                className="button"
                disabled={!trials.length}
                onClick={exportTrials}
              >
                <Download size={15} aria-hidden="true" />
                Export CSV
              </button>
            </div>

            {showForm && (
              <form className="evaluation-form" onSubmit={addTrial}>
                <h3>Record an observed trial</h3>
                <div className="evaluation-fields">
                  <label>
                    Method
                    <select name="condition" defaultValue="offscript6">
                      {Object.entries(TRIAL_CONDITIONS).map(
                        ([value, label]) => (
                          <option value={value} key={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    Idea data source
                    <select name="source" defaultValue={defaultDataSource}>
                      <option value="demo">Illustrative demo</option>
                      <option value="live">Live AI generation</option>
                      <option value="manual">Human / manually entered</option>
                    </select>
                  </label>
                  <label>
                    Brief code
                    <input
                      name="briefCode"
                      required
                      maxLength={120}
                      placeholder="e.g. commute-01"
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Team code
                    <input
                      name="teamCode"
                      required
                      maxLength={120}
                      placeholder="Use a code, not personal names"
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Time limit, minutes
                    <input
                      name="timeBudgetMinutes"
                      type="number"
                      required
                      min="0.1"
                      max="1440"
                      step="0.1"
                      defaultValue="20"
                    />
                  </label>
                  <label>
                    Minutes to committed idea
                    <input
                      name="minutesToCommit"
                      type="number"
                      min="0.1"
                      max="10080"
                      step="0.1"
                      placeholder="Blank if no commitment"
                    />
                    <span className="evaluation-field-hint">
                      Enter an observed time, not the target.
                    </span>
                  </label>
                  <label>
                    Exact model and version
                    <input
                      name="modelName"
                      maxLength={200}
                      placeholder="Record the provider/model; No AI if unaided"
                    />
                    <span className="evaluation-field-hint">
                      If unavailable, note that the model is unknown.
                    </span>
                  </label>
                  <label>
                    Usage budget
                    <input
                      name="modelBudget"
                      required
                      maxLength={300}
                      placeholder="Token/call cap, or No AI for unaided"
                    />
                  </label>
                  <label className="evaluation-field-wide">
                    Anonymized idea summary
                    <textarea
                      name="ideaSummary"
                      required
                      rows={3}
                      maxLength={2000}
                      placeholder="Describe the user, mechanism, and build scope. Omit the method and perspective count."
                    />
                    <span className="evaluation-field-hint">
                      This is what the blind reviewer will see. Share the brief
                      separately.
                    </span>
                  </label>
                  <label>
                    Working prototype by the deadline
                    <select name="prototype" defaultValue="pending">
                      <option value="pending">Not checked yet</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                  <label className="evaluation-field-wide">
                    Trial notes{" "}
                    <span className="evaluation-optional">(optional)</span>
                    <textarea
                      name="notes"
                      rows={2}
                      maxLength={2000}
                      placeholder="Build deadline, team experience, distinct mechanisms, or anything affecting the comparison."
                    />
                  </label>
                </div>
                <div className="evaluation-form-actions">
                  <button type="submit" className="button button-lime">
                    Save observed trial
                  </button>
                  <button
                    type="button"
                    className="button"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {trials.length ? (
              <div
                className="evaluation-records"
                role="region"
                aria-label="Recorded team trials"
                tabIndex={0}
              >
                <table>
                  <caption>
                    {trials.length}{" "}
                    {trials.length === 1 ? "observed trial" : "observed trials"}{" "}
                    · stored on this device, separate from shared rooms
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Trial / brief</th>
                      <th scope="col">Method</th>
                      <th scope="col">Commitment</th>
                      <th scope="col">Prototype</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trials.map((trial) => (
                      <tr key={trial.id}>
                        <th scope="row">
                          <span>
                            {trial.teamCode} · {trial.briefCode}
                          </span>
                          <small>
                            {trial.source} ·{" "}
                            {new Date(trial.at).toLocaleDateString()}
                          </small>
                        </th>
                        <td>{TRIAL_CONDITIONS[trial.condition]}</td>
                        <td>
                          {trial.minutesToCommit === null
                            ? "Not committed"
                            : `${trial.minutesToCommit} min`}
                          <small>{trial.timeBudgetMinutes} min limit</small>
                        </td>
                        <td>
                          <label
                            className="decision-sr-only"
                            htmlFor={`prototype-${trial.id}`}
                          >
                            Prototype outcome for {trial.teamCode},{" "}
                            {trial.briefCode}
                          </label>
                          <select
                            id={`prototype-${trial.id}`}
                            value={trial.prototype}
                            onChange={(event) =>
                              save(
                                trials.map((entry) =>
                                  entry.id === trial.id
                                    ? {
                                        ...entry,
                                        prototype: event.target
                                          .value as PrototypeOutcome,
                                      }
                                    : entry,
                                ),
                              )
                            }
                          >
                            <option value="pending">Not checked</option>
                            <option value="yes">Completed</option>
                            <option value="no">Not completed</option>
                          </select>
                        </td>
                        <td>
                          {trial.review ? (
                            <span className="evaluation-reviewed">
                              <Check size={14} aria-hidden="true" />
                              Recorded
                              <small>
                                O {trial.review.originality} · U{" "}
                                {trial.review.usefulness} · F{" "}
                                {trial.review.feasibility}
                              </small>
                            </span>
                          ) : (
                            "Awaiting review"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="evaluation-empty">
                No trials recorded yet. Run a timed session with a team, then
                record what happened. This log makes no claim that Offscript
                improves creativity.
              </p>
            )}
            <p className="evaluation-privacy">
              Local to this browser. Export CSV to keep a copy or compare
              results; clearing browser data removes the log.
            </p>
          </>
        ) : (
          <div className="evaluation-blind-review">
            <button
              className="button button-small"
              onClick={() => {
                setReviewMode(false);
                setReviewId("");
                setMessage("");
              }}
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Return to trial log
            </button>
            <h3>Independent blind review</h3>
            <p>
              Hand this view to a reviewer who has not seen the methods. Give
              them the matching brief and build constraints separately.
              Conditions and team details are hidden here.
            </p>
            {unreviewed.length ? (
              <>
                <label className="evaluation-review-picker">
                  Idea to review
                  <select
                    value={reviewId}
                    onChange={(event) => {
                      setReviewId(event.target.value);
                      setMessage("");
                    }}
                  >
                    <option value="">Select an anonymized idea</option>
                    {unreviewed.map((trial) => (
                      <option value={trial.id} key={trial.id}>
                        Idea {trial.id.slice(-6).toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                {reviewTrial && (
                  <form
                    key={reviewTrial.id}
                    className="evaluation-form"
                    onSubmit={addReview}
                  >
                    <p className="evaluation-review-idea">
                      {reviewTrial.ideaSummary}
                    </p>
                    <p className="evaluation-field-hint">
                      Use the same 1–5 rubric for every idea: originality = how
                      unusual the mechanism is; usefulness = value for the
                      stated user; feasibility = achievable with the stated team
                      and deadline. Low = 1, moderate = 3, high = 5.
                    </p>
                    <div className="evaluation-fields evaluation-ratings">
                      {(
                        ["originality", "usefulness", "feasibility"] as const
                      ).map((name) => (
                        <label key={name}>
                          {name.charAt(0).toUpperCase() + name.slice(1)}
                          <select name={name} required defaultValue="">
                            <option value="" disabled>
                              Choose a rating
                            </option>
                            {ratingLabels.map((label, index) => (
                              <option key={index} value={index + 1}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <label>
                      Reviewer code{" "}
                      <span className="evaluation-optional">(optional)</span>
                      <input
                        name="reviewer"
                        maxLength={120}
                        placeholder="e.g. reviewer-a"
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      Review notes{" "}
                      <span className="evaluation-optional">(optional)</span>
                      <textarea
                        name="reviewNotes"
                        rows={2}
                        maxLength={2000}
                        placeholder="Reasons behind the ratings and unresolved questions."
                      />
                    </label>
                    <label className="evaluation-blind-confirm">
                      <input name="blind" type="checkbox" required />I did not
                      know which method produced this idea when rating it.
                    </label>
                    <button className="button button-lime" type="submit">
                      Save blind review
                    </button>
                  </form>
                )}
              </>
            ) : (
              <p className="evaluation-empty">
                All recorded ideas have a review. Return to the log to export
                the results.
              </p>
            )}
          </div>
        )}
      </div>
    </details>
  );
}
