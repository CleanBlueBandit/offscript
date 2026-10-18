"use client";
import { useEffect, useState } from "react";
import { Brain, Check, Clock, PencilLine, Target } from "lucide-react";
import type { Brief } from "@/lib/types";
import { TRACKS } from "@/lib/preset";

export function ProblemBrief({
  brief,
  onChange,
}: {
  brief: Brief;
  onChange: (brief: Brief) => void;
}) {
  const set = (key: keyof Brief, value: unknown) =>
    onChange({ ...brief, [key]: value });
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(120);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);
  return (
    <div className="briefing-grid problem-brief">
      <section className="form-panel">
        <div className="form-title">
          <span>
            <Target size={19} />
          </span>
          <div>
            <h2>Describe a real moment of friction</h2>
            <p>
              Specific people and situations give the ideas a useful starting
              point.
            </p>
          </div>
        </div>
        <label className="field-label">
          What problem do you want to explore?
          <textarea
            rows={3}
            maxLength={3000}
            value={brief.challenge}
            onChange={(e) => set("challenge", e.target.value)}
            placeholder="People miss their departure time because they check travel, weather, and meetings separately."
          />
        </label>
        <label className="field-label">
          Who experiences this?
          <textarea
            rows={2}
            maxLength={1000}
            value={brief.targetUser ?? ""}
            onChange={(e) => set("targetUser", e.target.value)}
            placeholder="For example: commuters with changing morning schedules"
          />
        </label>
        <label className="field-label">
          When does it happen?
          <textarea
            rows={2}
            maxLength={1000}
            value={brief.moment ?? ""}
            onChange={(e) => set("moment", e.target.value)}
            placeholder="In the ten minutes before leaving home"
          />
        </label>
        <label className="field-label">
          What do they do today?
          <textarea
            rows={2}
            maxLength={2000}
            value={brief.workaround ?? ""}
            onChange={(e) => set("workaround", e.target.value)}
            placeholder="Open three apps and calculate a departure time themselves. If you don’t know, say so."
          />
        </label>
        <label className="field-label">
          What have you observed? <small>Optional</small>
          <textarea
            rows={3}
            maxLength={3000}
            value={brief.observations}
            onChange={(e) => set("observations", e.target.value)}
            placeholder="A specific example, user quote, or workaround you have actually seen. Separate evidence from assumptions."
          />
        </label>
      </section>
      <div className="brief-secondary">
        <section className="form-panel independent-start">
          <div className="form-title">
            <span>
              <PencilLine size={19} />
            </span>
            <div>
              <h2>Your thoughts come first</h2>
              <p>
                Take two minutes separately before looking at generated
                suggestions.
              </p>
            </div>
          </div>
          <div className="thinking-timer">
            <button
              className="button button-small"
              onClick={() => {
                setRemaining(120);
                setEndsAt(Date.now() + 120000);
              }}
            >
              <Clock size={14} />
              {endsAt ? "Restart two minutes" : "Start two minutes"}
            </button>
            <span role="timer" aria-label="Thinking time remaining">
              {Math.floor(remaining / 60)}:
              {String(remaining % 60).padStart(2, "0")}
            </span>
          </div>
          {endsAt && remaining === 0 && (
            <p role="status" className="small-note">
              Time’s up. Add the thoughts worth keeping, then explore.
            </p>
          )}
          <label className="field-label">
            Initial thoughts from your team <small>Optional</small>
            <textarea
              rows={4}
              maxLength={3000}
              value={brief.ownIdeas ?? ""}
              onChange={(e) => set("ownIdeas", e.target.value)}
              placeholder="One rough idea or observation per line. In a shared room, these notes are visible to your team."
            />
          </label>
          <p className="small-note">
            You can continue whenever you’re ready. These notes stay in the
            brief as you explore.
          </p>
        </section>
        <section className="form-panel">
          <div className="form-title">
            <span>
              <Brain size={19} />
            </span>
            <div>
              <h2>Make the scope realistic</h2>
              <p>Tell us what your team can build and demonstrate.</p>
            </div>
          </div>
          <label className="field-label">
            Team skills, available time & constraints
            <textarea
              rows={3}
              maxLength={2000}
              value={brief.constraints}
              onChange={(e) => set("constraints", e.target.value)}
              placeholder="Three people; React and Python; 24 hours; one phone; no paid APIs."
            />
          </label>
          <details className="brief-options">
            <summary>
              Hackathon tracks & judging context <span>Optional</span>
            </summary>
            <div className="field-label">
              Tracks
              <div className="track-options">
                {TRACKS.map((t) => (
                  <button
                    key={t.id}
                    aria-pressed={brief.tracks.includes(t.id)}
                    className={brief.tracks.includes(t.id) ? "chosen" : ""}
                    onClick={() =>
                      set(
                        "tracks",
                        brief.tracks.includes(t.id)
                          ? brief.tracks.filter((x) => x !== t.id)
                          : [...brief.tracks, t.id],
                      )
                    }
                  >
                    {t.label}
                    {brief.tracks.includes(t.id) && <Check size={12} />}
                  </button>
                ))}
              </div>
            </div>
            {(
              [
                { key: "who", label: "Who is judging?", max: 1500 },
                { key: "love", label: "What do they reward?", max: 2000 },
                {
                  key: "avoid",
                  label: "What should the team avoid?",
                  max: 2000,
                },
                {
                  key: "winners",
                  label: "Known examples or past winners",
                  max: 2500,
                },
              ] as const
            ).map((f) => (
              <label className="field-label" key={f.key}>
                {f.label}
                <textarea
                  rows={2}
                  maxLength={f.max}
                  value={brief.judge[f.key]}
                  onChange={(e) =>
                    onChange({
                      ...brief,
                      judge: { ...brief.judge, [f.key]: e.target.value },
                    })
                  }
                />
              </label>
            ))}
          </details>
        </section>
      </div>
    </div>
  );
}
