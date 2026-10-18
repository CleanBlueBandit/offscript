"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Shuffle,
  RotateCw,
  Star,
  Search,
  SlidersHorizontal,
  Zap,
  Sprout,
  GitBranch,
  Scale,
  Layers,
  Users,
  Copy,
  CheckCheck,
  Settings2,
  BookOpen,
  Sparkles,
  Brain,
  Move,
  Leaf,
  Coins,
  Orbit,
  ScanEye,
  Landmark,
  FlaskConical,
  Eye,
  EyeOff,
  Flame,
  Ghost,
  MousePointer2,
  Scissors,
  Dices,
  Download,
  Loader2,
  Target,
  Clock,
  Radio,
  PanelLeftClose,
  Workflow,
  LogOut,
} from "lucide-react";
import {
  CATEGORIES,
  drawPerspectives,
  selectPerspectives,
} from "@/lib/perspectives";
import { DEMO_BRIEF } from "@/lib/preset";
import { ProblemBrief } from "./problem-brief";
import { DecisionWorkbench } from "./decision-workbench";
import { EvaluationLab } from "./evaluation-lab";
import { ResearchWorkbench } from "./research-workbench";
import { DecisionHandoff } from "./decision-handoff";
import { api, useWorkshop } from "@/lib/use-workshop";
import type {
  Category,
  Concept,
  Crucible,
  Exploration,
  Ingredient,
  Mutation,
} from "@/lib/types";
const IdeaTree = dynamic(() => import("./idea-tree"), {
  ssr: false,
  loading: () => (
    <div className="canvas-loading">
      <Loader2 className="spin" />
      Preparing your canvas…
    </div>
  ),
});
const categoryMeta: Record<
  Category,
  { icon: typeof Move; color: string; short: string }
> = {
  "Physical & Kinetic": { icon: Move, color: "peach", short: "Physical" },
  "Biological & Natural": { icon: Leaf, color: "green", short: "Biological" },
  "Economic & Game Theory": { icon: Coins, color: "yellow", short: "Economic" },
  "Systems & Chaos": { icon: Orbit, color: "blue", short: "Systems" },
  "Sensory & Human": { icon: ScanEye, color: "purple", short: "Human" },
  "Historical & Analog": { icon: Landmark, color: "pink", short: "Historical" },
};
const kinds = {
  provocation: { icon: Zap, label: "Provocation" },
  mechanic: { icon: Settings2, label: "Mechanic" },
  flip: { icon: RotateCw, label: "Constraint flip" },
};
const stages = [
  {
    name: "Briefing",
    short: "Briefing",
    icon: SlidersHorizontal,
    caption: "Set the scene",
  },
  {
    name: "Perspectives",
    short: "Perspectives",
    icon: Orbit,
    caption: "Think in different directions",
  },
  {
    name: "Idea tree",
    short: "Idea tree",
    icon: GitBranch,
    caption: "Let good ideas evolve",
  },
  {
    name: "Decide & build",
    short: "Decide & build",
    icon: Scale,
    caption: "Make it worth building",
  },
];
const researchStage = { name: "Research", short: "Research", icon: Search, caption: "Find useful problems and features" };
const GENERATION_MODE_KEY = "offscript-generation-mode-v1";
export default function Workshop() {
  const [toast, setToast] = useState("");
  const notify = useCallback((s: string) => setToast(s), []);
  const w = useWorkshop(notify);
  const { state, update } = w;
  const [filter, setFilter] = useState("All perspectives");
  const [search, setSearch] = useState("");
  const [starOnly, setStarOnly] = useState(false);
  const [busy, setBusy] = useState("");
  const [rolling, setRolling] = useState(false);
  const [visibleCount, setVisibleCount] = useState(6);
  const [batchSize, setBatchSize] = useState<6 | 15>(6);
  const [demo, setDemo] = useState(true);
  const [configured, setConfigured] = useState(false);
  const modePreference = useRef<"demo" | "live" | null>(null);
  const chooseMode = (nextDemo: boolean) => {
    if (!nextDemo && !configured) return;
    const preference = nextDemo ? "demo" : "live";
    modePreference.current = preference;
    setDemo(nextDemo);
    try {
      localStorage.setItem(GENERATION_MODE_KEY, preference);
    } catch {
      // The choice still applies for this visit if browser storage is unavailable.
    }
  };
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const crucible = state.plan?.crucible ?? null;
  const crucibleConcept =
    state.concepts.find((c) => c.id === state.plan?.conceptId) ?? null;
  const [drawer, setDrawer] = useState(false);
  const [modal, setModal] = useState<
    "invite" | "help" | "settings" | "splice" | null
  >(null);
  const [memberName, setMemberName] = useState("");
  const [invite, setInvite] = useState("");
  const [join, setJoin] = useState<{ id: string; token: string } | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [compactNav, setCompactNav] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 999px)");
    const sync = () => {
      setCompactNav(query.matches);
      if (!query.matches) setMobileMenu(false);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const [localVotes, setLocalVotes] = useState<Record<string, "fire" | "pass">>(
    {},
  );
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [state.stage]);
  useEffect(() => {
    let active = true;
    try {
      const savedMode = localStorage.getItem(GENERATION_MODE_KEY);
      if (
        modePreference.current === null &&
        (savedMode === "demo" || savedMode === "live")
      ) {
        modePreference.current = savedMode;
      }
    } catch {
      // Server availability determines the default when storage is unavailable.
    }
    api<{ configured: boolean }>("/api/status", undefined, "GET")
      .then((s) => {
        if (!active) return;
        setConfigured(s.configured);
        setDemo(!s.configured || modePreference.current === "demo");
      })
      .catch(() => {
        if (!active) return;
        setConfigured(false);
        setDemo(true);
      });
    const hash = new URLSearchParams(location.hash.slice(1));
    if (hash.get("room") && hash.get("token")) {
      setJoin({ id: hash.get("room")!, token: hash.get("token")! });
      setModal("invite");
    }
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!modal && !drawer) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    const paddingRight = document.body.style.paddingRight;
    const scrollbarWidth = Math.max(
      0,
      window.innerWidth - document.body.clientWidth,
    );
    if (scrollbarWidth)
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    document.body.style.overflow = "hidden";
    const focusFirst = requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>(
        ".modal, .crucible-drawer",
      );
      panel
        ?.querySelector<HTMLElement>(
          "input:not([readonly]), button:not([disabled]), a[href], textarea",
        )
        ?.focus();
    });
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const panel = document.querySelector<HTMLElement>(
        ".modal, .crucible-drawer",
      );
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
      );
      const first = focusable[0],
        last = focusable[focusable.length - 1];
      if (!first) return;
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          !panel.contains(document.activeElement))
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last ||
          !panel.contains(document.activeElement))
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      cancelAnimationFrame(focusFirst);
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
      document.removeEventListener("keydown", trap);
      previous?.focus();
    };
  }, [modal, drawer]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setDrawer(false);
        setMobileMenu(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  const briefReady = [
    state.brief.challenge,
    state.brief.targetUser,
    state.brief.moment,
    state.brief.workaround,
  ].every((value) => (value?.trim().length ?? 0) >= 3);
  const liveExplorations = state.explorations.filter(
    (e) => e.source === "live",
  ).length;
  const explorationLabel =
    liveExplorations === state.explorations.length
      ? "Live AI ingredients"
      : liveExplorations === 0
        ? "Demo ingredients"
        : "Demo + live ingredients";
  const ingredients = state.explorations.flatMap((e) => e.ingredients);
  const selected = ingredients.filter((i) => state.selectedIds.includes(i.id));
  const activeConcept =
    state.concepts.find(
      (c) => c.id === selectedNode && (state.stage === 2 || !c.dimmed),
    ) ||
    state.concepts.find(
      (c) => c.id === state.commitment?.conceptId && !c.dimmed,
    ) ||
    state.concepts.find((c) => !c.dimmed);
  const filtered = state.explorations.filter(
    (e) =>
      (filter === "All perspectives" || e.perspective.category === filter) &&
      (!starOnly ||
        e.ingredients.some((i) => state.starredIds.includes(i.id))) &&
      `${e.perspective.name} ${e.perspective.axiom} ${e.ingredients.map((i) => i.text).join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const votes =
    w.room?.votes ||
    Object.fromEntries(
      Object.entries(localVotes).map(([id, v]) => [
        id,
        { fire: v === "fire" ? 1 : 0, pass: v === "pass" ? 1 : 0 },
      ]),
    );
  const myVotes = w.room?.myVotes || localVotes;
  function toggleIngredient(i: Ingredient) {
    if (state.selectedIds.includes(i.id))
      update({ selectedIds: state.selectedIds.filter((id) => id !== i.id) });
    else if (selected.length < 6)
      update({ selectedIds: [...state.selectedIds, i.id] });
    else notify("Your tray holds 6 ingredients. Remove one to make room.");
  }
  function star(i: Ingredient) {
    update({
      starredIds: state.starredIds.includes(i.id)
        ? state.starredIds.filter((id) => id !== i.id)
        : [...state.starredIds, i.id],
    });
  }
  async function explore(rerollId?: string, append = false) {
    if (busy) return;
    if (!briefReady) {
      update({ stage: 0 });
      notify(
        "Add who experiences the problem, when it happens, and today’s workaround before exploring.",
      );
      return;
    }
    setBusy(rerollId || "explore");
    setRolling(!rerollId && !append);
    try {
      const count = rerollId
        ? 1
        : append
          ? Math.min(6, 60 - state.explorations.length)
          : batchSize;
      if (count <= 0) return;
      const drawn = selectPerspectives(
        count,
        state.explorations.map((e) => e.perspective.id),
        state.brief,
      );
      const result = await api<{ explorations: Exploration[] }>(
        "/api/explore",
        {
          brief: state.brief,
          perspectives: drawn,
          avoidMechanisms:
            append || rerollId
              ? state.explorations.flatMap((e) =>
                  e.ingredients
                    .filter((i) => i.kind === "mechanic")
                    .map((i) => i.text),
                )
              : [],
          demo,
        },
      );
      const next = result.explorations.map((e) => ({
        ...e,
        source: demo ? ("demo" as const) : ("live" as const),
      }));
      update((current) => {
        const old = current.explorations.find(
          (e) => e.perspective.id === rerollId,
        );
        return {
          ...current,
          explorations: rerollId
            ? current.explorations.map((e) =>
                e.perspective.id === rerollId ? next[0] : e,
              )
            : append
              ? [...current.explorations, ...next]
              : next,
          selectedIds: rerollId
            ? current.selectedIds.filter(
                (id) => !old?.ingredients.some((i) => i.id === id),
              )
            : append
              ? current.selectedIds
              : [],
          startedAt: current.startedAt ?? Date.now(),
          stage: 1,
        };
      });
      if (!rerollId)
        setVisibleCount(
          append ? state.explorations.length + next.length : next.length,
        );
      setSearch("");
      setFilter("All perspectives");
      setStarOnly(false);
      notify(
        rerollId
          ? "A new way to approach the problem."
          : `${next.length} perspectives ready. Start with two or three useful ingredients.`,
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
      setRolling(false);
    }
  }
  async function combineIdeas(source: string, target: string) {
    if (busy) return;
    const pair = [source, target].map((id) =>
      state.concepts.find((c) => c.id === id),
    );
    if (!pair[0] || !pair[1] || source === target) return;
    setBusy("combine");
    try {
      const result = await api<{ concepts: Concept[] }>("/api/combine", {
        brief: state.brief,
        concepts: pair,
        demo,
      });
      const child = {
        ...result.concepts[0],
        source: demo ? ("demo" as const) : ("live" as const),
        parentId: source,
        mutation: "combined",
        x: ((pair[0].x ?? 0) + (pair[1].x ?? 0)) / 2,
        y: Math.max(...state.concepts.map((c) => c.y ?? 0)) + 540,
      };
      update((current) => ({
        ...current,
        concepts: [...current.concepts, child],
        connections: [
          ...(current.connections ?? []),
          { id: crypto.randomUUID(), source: target, target: child.id },
        ],
      }));
      setSelectedNode(child.id);
      notify(
        "Combined into a new concept. Open its details to see what each source contributed.",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function plant() {
    if (selected.length < 2 || busy) return;
    setBusy("plant");
    try {
      const result = await api<{ concepts: Concept[] }>("/api/synthesize", {
        brief: state.brief,
        ingredients: selected,
        demo,
      });
      update((current) => {
        const baseY = current.concepts.length
          ? Math.max(...current.concepts.map((c) => c.y ?? 0)) + 540
          : 50;
        const concepts = result.concepts.map((c, i) => ({
          ...c,
          source: demo ? ("demo" as const) : ("live" as const),
          x: i * 385,
          y: baseY,
        }));
        return {
          ...current,
          concepts: [...current.concepts, ...concepts],
          stage: 2,
        };
      });
      setSelectedNode(result.concepts[0].id);
      notify("Three starting points. Now follow your curiosity.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function mutate(type: Mutation, ingredient?: Ingredient) {
    if (!activeConcept || busy) return;
    setModal(null);
    setBusy(type);
    try {
      const perspective =
        type === "wildcard"
          ? drawPerspectives(
              1,
              state.explorations.map((e) => e.perspective.id),
            )[0]
          : undefined;
      const result = await api<{ concepts: Concept[] }>("/api/mutate", {
        brief: state.brief,
        parent: activeConcept,
        type,
        ingredient,
        perspective,
        demo,
      });
      update((current) => {
        const parent = current.concepts.find((c) => c.id === activeConcept.id);
        if (!parent) return current;
        const children = current.concepts.filter(
          (c) => c.parentId === parent.id,
        ).length;
        const concepts = result.concepts.map((c, i) => ({
          ...c,
          source: demo ? ("demo" as const) : ("live" as const),
          parentId: parent.id,
          mutation: type,
          x: (parent.x ?? 0) + (children + i) * 385,
          y: (parent.y ?? 0) + 540,
        }));
        return { ...current, concepts: [...current.concepts, ...concepts] };
      });
      setSelectedNode(result.concepts[0].id);
      notify("A new branch. A new possibility.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function assessIdea(id: string) {
    const concept = state.concepts.find((c) => c.id === id);
    if (!concept || busy) return;
    setBusy("assess");
    try {
      const result = await api<{ concept: Concept }>("/api/assess", {
        brief: state.brief,
        concept,
        demo,
      });
      update((current) => ({
        ...current,
        concepts: current.concepts.map((c) =>
          c.id === id
            ? {
                ...c,
                mechanism: result.concept.mechanism,
                assessment: result.concept.assessment,
                assumptions: result.concept.assumptions,
              }
            : c,
        ),
      }));
      notify(
        demo
          ? "Illustrative assessment added. Test these assumptions with a real user."
          : "Assessment added. Treat the reasoning as a hypothesis to test.",
      );
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  async function runCrucible(id?: string) {
    const concept = id
      ? state.concepts.find((c) => c.id === id)
      : activeConcept;
    if (!concept || busy) return;
    setBusy("crucible");
    try {
      const r = await api<{ crucible: Crucible }>("/api/crucible", {
        brief: state.brief,
        concept,
        demo,
      });
      update({
        plan: {
          conceptId: concept.id,
          crucible: { ...r.crucible, source: demo ? "demo" : "live" },
        },
      });
      setDrawer(true);
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function pruneBranch() {
    if (!activeConcept) return;
    const ids = new Set([activeConcept.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of state.concepts) {
        if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
          ids.add(c.id);
          grew = true;
        }
      }
    }
    update({
      concepts: state.concepts.map((c) =>
        ids.has(c.id) ? { ...c, dimmed: !activeConcept.dimmed } : c,
      ),
    });
  }
  async function castVote(id: string, value: "fire" | "pass") {
    try {
      if (w.credentials) await w.vote(id, value);
      else setLocalVotes((v) => ({ ...v, [id]: value }));
    } catch (e) {
      notify((e as Error).message);
    }
  }
  async function copyLink() {
    try {
      const link =
        invite ||
        (w.credentials
          ? `${location.origin}/#room=${w.credentials.id}&token=${w.credentials.token}`
          : "");
      await navigator.clipboard.writeText(link);
      notify("Invite link copied. Anyone with it can join this workshop.");
    } catch {
      notify("Copy the invite link from the field below.");
    }
  }
  function exportBlueprint() {
    if (!crucible || !crucibleConcept) return;
    const c = crucible;
    const planning = `${c.experiment ? `\n\n## Five-minute experiment\nHypothesis: ${c.experiment.hypothesis}\n${c.experiment.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}\nSuccess signal: ${c.experiment.successSignal}` : ""}${c.scope ? `\n\n## Smallest prototype\n${c.scope.mustBuild.map((item) => "- " + item).join("\n")}\n\n## Leave out\n${c.scope.cut.map((item) => "- " + item).join("\n")}` : ""}`;
    const text = `# ${crucibleConcept.title}\n\n${crucibleConcept.pitch}\n\n${c.source !== "live" ? "Demo / illustrative evaluation" : "AI-generated evaluation"}\n\n## Assessment\n${c.verdict}\n\n${c.judgeReaction}\n\n${c.benchmark}\n\n## Strengths\n${c.pros.map((p) => "- " + p).join("\n")}\n\n## Risks\n${c.cons.map((p) => "- " + p).join("\n")}\n\n## Weakest assumption\n${c.weakestAssumption.assumption}\nFix: ${c.weakestAssumption.fix}\n5-minute test: ${c.weakestAssumption.test}\n\n## Signals\n${c.blueprint.signals.join("\n")}\n\n## Architecture\n${c.blueprint.architecture.join("\n")}\n\n## Build plan\n${c.blueprint.timeline.map((x) => x.hours + ": " + x.task).join("\n")}\n\n## Demo script\n${c.blueprint.demo.map((x) => x.seconds + ": " + x.action).join("\n")}${planning}`;
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "offscript-prototype-blueprint.md";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <MotionConfig
      reducedMotion="user"
      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
    >
      <div className="studio">
        {mobileMenu && (
          <button
            className="nav-scrim"
            aria-label="Close navigation"
            onClick={() => setMobileMenu(false)}
          />
        )}
        <aside
          id="workshop-navigation"
          className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}
          inert={compactNav && !mobileMenu}
        >
          <button
            className="nav-close icon-button"
            aria-label="Close navigation"
            onClick={() => setMobileMenu(false)}
          >
            <X size={18} />
          </button>
          <a
            href="#"
            className="brand"
            onClick={(e) => {
              e.preventDefault();
              update({ stage: 1 });
            }}
          >
            <span className="brand-mark">
              <ArrowUpRight />
              <ArrowUpRight />
            </span>
            offscript<span className="brand-period">.</span>
          </a>
          <button
            className="workspace-switch"
            disabled={!!busy}
            onClick={() => setModal("invite")}
          >
            <span className="workspace-icon">H</span>
            <span>
              Hacktoberfest lab<small>Your creative workspace</small>
            </span>
            <ChevronDown size={13} />
          </button>
          <div className="sidebar-label">Workshop</div>
          <nav>
            {[{ ...researchStage, id: 4 }, ...stages.map((s, id) => ({ ...s, id }))].map((s) => {
              const i = s.id;
              const Icon = s.icon;
              return (
                <button
                  key={s.name}
                  className={`stage-link ${state.stage === i ? "active" : ""}`}
                  aria-current={state.stage === i ? "step" : undefined}
                  onClick={() => {
                    update({ stage: i });
                    setMobileMenu(false);
                  }}
                >
                  <Icon size={17} />
                  <span>{s.name}</span>
                  {i === 1 && <span className="nav-count">100</span>}
                </button>
              );
            })}
          </nav>
          <div className="sidebar-bottom">
            <button onClick={() => setModal("help")}>
              <BookOpen size={16} />
              How Offscript works
              <ArrowUpRight size={13} />
            </button>
            <button onClick={() => setModal("settings")}>
              <Settings2 size={16} />
              Workshop settings
            </button>
            <div className="profile">
              <span className="avatar">
                {memberName ? memberName[0].toUpperCase() : "Y"}
              </span>
              <span>
                {memberName || "Your workshop"}
                <small>
                  {w.room ? "Connected to team" : "Personal workspace"}
                </small>
              </span>
              <span className="online-dot" />
            </div>
          </div>
        </aside>
        <div className="studio-shell">
          <header className="topbar">
            <div className="breadcrumbs">
              <button
                className="menu-button icon-button"
                onClick={() => setMobileMenu(!mobileMenu)}
                aria-label="Toggle navigation"
                aria-expanded={mobileMenu}
                aria-controls="workshop-navigation"
              >
                <PanelLeftClose size={18} />
              </button>
              <span>Hacktoberfest lab</span>
              <ChevronRight size={13} />
              <strong>{state.stage === 4 ? "Research" : stages[state.stage]?.short || "Briefing"}</strong>
            </div>
            <div className="top-actions">
              <span className="save-status">
                <span className="online-dot" />
                {w.syncing
                  ? "Syncing…"
                  : w.room
                    ? "Team connected"
                    : "Saved on this device"}
              </span>
              <div className="avatar-stack">
                {w.room ? (
                  w.room.participants.slice(0, 4).map((p, i) => (
                    <span
                      title={p.name}
                      className={`avatar avatar-${i}`}
                      key={p.id}
                    >
                      {p.name[0].toUpperCase()}
                    </span>
                  ))
                ) : (
                  <span className="avatar">Y</span>
                )}
              </div>
              <button
                className="button button-small"
                disabled={!!busy}
                onClick={() => setModal("invite")}
              >
                <Users size={14} />
                Invite team
                <Plus size={13} />
              </button>
            </div>
          </header>
          <div className={`main-row ${state.stage === 1 ? "has-tray" : ""}`}>
            <main className={`main-content stage-${state.stage}`}>
              {state.stage === 4 && (
                <ResearchWorkbench
                  research={state.research}
                  configured={configured}
                  onUpdate={(change) => update((current) => {
                    const research = change(current.research ?? { runs: [], saved: [] });
                    return { ...current, research, brief: { ...current.brief, research: research.saved } };
                  })}
                  onStartBrief={(finding) => update((current) => ({
                    ...current, stage: 0,
                    brief: { ...current.brief, challenge: finding.kind === "idea" ? `Explore this idea: ${finding.title}. ${finding.feature}` : finding.problem, research: current.research?.saved ?? [] },
                  }))}
                  onContinue={() => update({ stage: 0 })}
                />
              )}
              {state.stage === 1 && (
                <>
                  <section className="explore-hero">
                    <div className="hero-row">
                      <div>
                        <h1>A different way to think.</h1>
                        <p>
                          Start with six different approaches. Collect two or
                          three ingredients worth combining.
                        </p>
                      </div>
                    </div>
                    <div className="brief-strip">
                      <span className="brief-icon">
                        <Zap size={17} />
                      </span>
                      <div>
                        <span>The challenge</span>
                        <p>{state.brief.challenge}</p>
                      </div>
                      <button onClick={() => update({ stage: 0 })}>
                        Edit brief
                        <ArrowUpRight size={13} />
                      </button>
                    </div>
                  </section>
                  <section className="exploration-controls">
                    <div className="explore-toolbar">
                      <div className="section-title">
                        <h2>
                          Perspectives <span>{state.explorations.length}</span>
                        </h2>
                        <span className="generation-mode">
                          <span className={demo ? "demo-dot" : "online-dot"} />
                          {explorationLabel}
                        </span>
                      </div>
                      <div className="search-row">
                        <label className="search-box">
                          <Search size={15} />
                          <input
                            aria-label="Search perspectives"
                            placeholder="Search perspectives"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </label>
                        <button
                          className={`icon-button star-filter ${starOnly ? "selected" : ""}`}
                          aria-label="Filter starred ingredients"
                          aria-pressed={starOnly}
                          title="Show starred perspectives"
                          onClick={() => setStarOnly(!starOnly)}
                        >
                          <Star size={16} />
                        </button>
                      </div>
                      <button
                        className="button"
                        disabled={!!busy}
                        onClick={() => explore()}
                      >
                        {rolling ? (
                          <Loader2 size={16} className="spin" />
                        ) : (
                          <Shuffle size={16} />
                        )}
                        {rolling ? "Exploring…" : "Shuffle perspectives"}
                      </button>
                    </div>
                    <div className="exploration-guidance">
                      <span>
                        100 lenses in the library. Each applies a different
                        thinking operation.
                      </span>
                      <label>
                        Starting set
                        <select
                          aria-label="Starting perspective set"
                          value={batchSize}
                          onChange={(e) =>
                            setBatchSize(Number(e.target.value) as 6 | 15)
                          }
                        >
                          <option value={6}>6 perspectives</option>
                          <option value={15}>15 perspectives</option>
                        </select>
                      </label>
                    </div>
                    <div className="filter-row">
                      <div
                        className="category-tabs"
                        aria-label="Perspective categories"
                      >
                        <button
                          className={
                            filter === "All perspectives" ? "active" : ""
                          }
                          aria-pressed={filter === "All perspectives"}
                          onClick={() => setFilter("All perspectives")}
                        >
                          All
                        </button>
                        {CATEGORIES.map((c) => {
                          const meta = categoryMeta[c];
                          return (
                            <button
                              className={filter === c ? "active" : ""}
                              key={c}
                              title={c}
                              aria-pressed={filter === c}
                              onClick={() => setFilter(c)}
                            >
                              <span className={`category-dot ${meta.color}`} />
                              {meta.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                  <div
                    className={`perspective-grid ${rolling ? "is-rolling" : ""}`}
                  >
                    {filtered.slice(0, visibleCount).map((e) => (
                      <PerspectiveCard
                        key={e.perspective.id}
                        exploration={e}
                        selectedIds={state.selectedIds}
                        starredIds={state.starredIds}
                        onSelect={toggleIngredient}
                        onStar={star}
                        onReroll={() => explore(e.perspective.id)}
                        busy={!!busy}
                        rerolling={busy === e.perspective.id}
                      />
                    ))}
                    {filtered.length === 0 && (
                      <div className="empty-state">
                        <Search />
                        <h3>No minds found here.</h3>
                        <p>Try another search or a different category.</p>
                        <button
                          className="button"
                          onClick={() => {
                            setSearch("");
                            setFilter("All perspectives");
                            setStarOnly(false);
                          }}
                        >
                          Reset filters
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="explore-more">
                    {filtered.length > visibleCount ? (
                      <button
                        className="button"
                        onClick={() => setVisibleCount((n) => n + 6)}
                      >
                        <Plus size={15} />
                        Show {Math.min(6, filtered.length - visibleCount)} more
                        perspectives
                      </button>
                    ) : (
                      state.explorations.length < 60 && (
                        <button
                          className="button"
                          disabled={!!busy}
                          onClick={() => explore(undefined, true)}
                        >
                          {busy === "explore" ? (
                            <Loader2 className="spin" size={15} />
                          ) : (
                            <Plus size={15} />
                          )}
                          Explore six more
                        </button>
                      )
                    )}
                    <p>Keep exploring only if you need another direction.</p>
                  </div>
                  <div className="board-footer">
                    <span>
                      <Orbit size={14} /> Independently explored. Unexpectedly
                      connected.
                    </span>
                    <span>
                      {ingredients.length} ingredients · 6 cognitive families
                    </span>
                  </div>
                </>
              )}
              {state.stage === 0 && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>What’s getting in the way?</h1>
                      <p>
                        Start with a real frustration. Then find a distinctive
                        idea your team can test and build.
                      </p>
                    </div>
                    <button
                      className="button"
                      onClick={() => {
                        update({ brief: { ...structuredClone(DEMO_BRIEF), research: state.research?.saved ?? [] } });
                        notify(
                          "Hacktoberfest preset loaded. Make it your own.",
                        );
                      }}
                    >
                      <Zap size={15} />
                      Load demo preset
                    </button>
                  </div>
                  {!!state.brief.research?.length && (
                    <details className="brief-research-context">
                      <summary>{state.brief.research.length} research {state.brief.research.length === 1 ? "finding" : "findings"} attached to this brief</summary>
                      <p>These are source-based leads and possible adaptations. Keep your own observations distinct from claims that still need checking.</p>
                      <ul>{state.brief.research.map((finding) => <li key={finding.id}>
                        <strong>{finding.title}</strong>: {finding.feature}
                      </li>)}</ul>
                      <button className="button button-small" onClick={() => update({ stage: 4 })}>Review sources and collection <ArrowUpRight size={14} /></button>
                    </details>
                  )}
                  <ProblemBrief
                    brief={state.brief}
                    onChange={(brief) =>
                      update({
                        brief,
                        startedAt: state.startedAt ?? Date.now(),
                      })
                    }
                  />
                  <div className="brief-bottom">
                    <span>
                      <CheckCheck size={15} />{" "}
                      {briefReady
                        ? "Your context is ready. Your own thoughts are optional."
                        : "Add a problem, who it affects, when it happens, and today’s workaround."}
                    </span>
                    <button
                      className="button button-lime"
                      disabled={!!busy || !briefReady}
                      onClick={() => explore()}
                    >
                      {busy ? (
                        <Loader2 className="spin" size={16} />
                      ) : (
                        <Shuffle size={16} />
                      )}
                      Explore {batchSize} perspectives
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </>
              )}
              {state.stage === 2 && (
                <>
                  <div className="tree-heading">
                    <div>
                      <h1>Room for the idea to grow.</h1>
                      <p>
                        Select a concept. Twist it, splice it, see where it
                        goes.
                      </p>
                    </div>
                    <button
                      className="button"
                      onClick={() => update({ stage: 1 })}
                    >
                      <Plus size={15} />
                      More ingredients
                    </button>
                  </div>
                  <div className="tree-toolbar">
                    <span>
                      <span className="online-dot" />
                      {state.concepts.length} concepts growing
                    </span>
                    <div>
                      <button
                        className={`button button-small ${state.blind ? "toggled" : ""}`}
                        onClick={() =>
                          update({ blind: !state.blind, revealed: false })
                        }
                      >
                        {state.blind ? <EyeOff size={14} /> : <Eye size={14} />}
                        Blind team vote
                        <span className={`switch ${state.blind ? "on" : ""}`} />
                      </button>
                      {state.blind && (
                        <button
                          className="button button-small"
                          onClick={() =>
                            w.reveal().catch((e) => notify(e.message))
                          }
                          disabled={state.revealed}
                        >
                          <Flame size={14} />
                          {state.revealed
                            ? "Heatmap revealed"
                            : "Reveal heatmap"}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="tree-canvas">
                    {state.concepts.length > 0 ? (
                      <IdeaTree
                        concepts={state.concepts}
                        connections={state.connections}
                        onCombine={combineIdeas}
                        busy={!!busy}
                        onConnect={(source, target) =>
                          update((current) => {
                            const connections = current.connections ?? [];
                            if (
                              source === target ||
                              connections.length >= 300 ||
                              !current.concepts.some((c) => c.id === source) ||
                              !current.concepts.some((c) => c.id === target) ||
                              current.concepts.some(
                                (c) => c.id === target && c.parentId === source,
                              ) ||
                              connections.some(
                                (c) =>
                                  c.source === source && c.target === target,
                              )
                            )
                              return current;
                            return {
                              ...current,
                              connections: [
                                ...connections,
                                { id: crypto.randomUUID(), source, target },
                              ],
                            };
                          })
                        }
                        onRemoveConnections={(ids) =>
                          update((current) => ({
                            ...current,
                            connections: (current.connections ?? []).filter(
                              (c) => !ids.includes(c.id),
                            ),
                          }))
                        }
                        selectedId={activeConcept?.id || null}
                        onSelect={setSelectedNode}
                        onMove={(id, x, y) =>
                          update((current) => ({
                            ...current,
                            concepts: current.concepts.map((c) =>
                              c.id === id ? { ...c, x, y } : c,
                            ),
                          }))
                        }
                        votes={votes}
                        myVotes={myVotes}
                        masked={state.blind && !state.revealed}
                        revealed={state.revealed}
                        onVote={castVote}
                      />
                    ) : (
                      <div className="empty-state">
                        <div className="empty-symbol">
                          <Sprout size={40} />
                        </div>
                        <h2>Every idea needs a seed.</h2>
                        <p>
                          Choose 2–6 ingredients from different perspectives,
                          <br />
                          then plant your first idea tree.
                        </p>
                        <button
                          className="button button-lime"
                          onClick={() => update({ stage: 1 })}
                        >
                          Find your ingredients
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                  {activeConcept && (
                    <div className="mutation-bar">
                      <div className="mutation-label">
                        <GitBranch size={14} />
                        <span>EVOLVE THIS IDEA</span>
                      </div>
                      <div className="mutation-actions">
                        <button
                          disabled={!!busy}
                          onClick={() => setModal("splice")}
                        >
                          <Workflow size={16} />
                          Splice
                        </button>
                        <button
                          disabled={!!busy}
                          onClick={() => mutate("autonomous")}
                        >
                          <Ghost size={16} />
                          Zero-UI
                        </button>
                        <button
                          disabled={!!busy}
                          onClick={() => mutate("widget")}
                        >
                          <MousePointer2 size={16} />
                          1-button
                        </button>
                        <button
                          disabled={!!busy}
                          onClick={() => mutate("invert")}
                        >
                          <Shuffle size={16} />
                          Invert
                        </button>
                        <button
                          disabled={!!busy}
                          onClick={() => mutate("wildcard")}
                        >
                          <Dices size={16} />
                          Wildcard
                        </button>
                        <button onClick={pruneBranch}>
                          <Scissors size={16} />
                          {activeConcept.dimmed ? "Restore" : "Prune"}
                        </button>
                        <button
                          className="crucible-button"
                          disabled={!!busy}
                          onClick={() => runCrucible()}
                        >
                          {busy ? (
                            <Loader2 size={16} className="spin" />
                          ) : (
                            <Scale size={16} />
                          )}
                          Test & plan
                          <ArrowUpRight size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                  {state.concepts.length > 0 && (
                    <div className="tree-next-step">
                      <p>
                        Ready to choose? Compare the value, mechanism, scope,
                        and demo.
                      </p>
                      <button
                        className="button button-lime"
                        onClick={() => update({ stage: 3 })}
                      >
                        Compare & choose
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  )}
                  <div className="board-footer">
                    <span>
                      {state.blind && !state.revealed
                        ? "Votes are hidden until your team reveals the heatmap."
                        : "Drag cards to arrange · Connect their dots to link ideas"}
                    </span>
                    <span>
                      {activeConcept?.source !== "live"
                        ? "Illustrative demo concept"
                        : "AI-generated concept"}
                    </span>
                  </div>
                </>
              )}
              {state.stage === 3 && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>Decide what to build.</h1>
                      <p>
                        Compare the options, confirm the problem and solution,
                        and prepare a detailed prompt for your coding agent.
                      </p>
                    </div>
                  </div>
                  <DecisionWorkbench
                    concepts={state.concepts}
                    selectedId={activeConcept?.id ?? null}
                    onSelect={setSelectedNode}
                    commitment={state.commitment}
                    busy={!!busy}
                    onCommit={(id) => {
                      update({ commitment: { conceptId: id, at: Date.now() }, finalDecision: undefined, handoff: undefined });
                      setSelectedNode(id);
                      notify(
                        "Concept chosen. Confirm the final problem and solution below.",
                      );
                    }}
                    onEvaluate={(id) => runCrucible(id)}
                    onAssess={assessIdea}
                  />
                  <DecisionHandoff
                    brief={state.brief}
                    concept={state.concepts.find((concept) => concept.id === state.commitment?.conceptId && !concept.dimmed) ?? null}
                    plan={state.plan?.conceptId === state.commitment?.conceptId ? state.plan : undefined}
                    decision={state.finalDecision}
                    handoff={state.handoff}
                    demo={demo}
                    onSaveDecision={(finalDecision) => update({ finalDecision, handoff: undefined })}
                    onSaveHandoff={(handoff) => update({ handoff })}
                    notify={notify}
                  />
                  {crucible && (
                    <button
                      className="button reopen-plan"
                      onClick={() => setDrawer(true)}
                    >
                      Open saved plan: {crucibleConcept?.title}
                      <ArrowUpRight size={15} />
                    </button>
                  )}
                  <EvaluationLab defaultDataSource={demo ? "demo" : "live"} />
                </>
              )}
            </main>
            {state.stage === 1 && (
              <aside className="synthesis-tray">
                <div className="tray-heading">
                  <span className="tray-symbol">
                    <Layers size={19} />
                  </span>
                  <div>
                    <h2>Your ingredients</h2>
                    <p>The beginnings of a good idea.</p>
                  </div>
                  <span className="tray-counter">
                    {selected.length}
                    <small>/ 6</small>
                  </span>
                </div>
                <div className="tray-body">
                  <div className="tray-instruction">
                    <Layers size={17} />
                    <p>
                      Start with <strong>2–3 ingredients</strong> from different
                      perspectives. You can collect up to six.
                    </p>
                  </div>
                  <div className="tray-slots">
                    <AnimatePresence initial={false}>
                      {selected.map((i) => {
                        const Icon = kinds[i.kind].icon;
                        return (
                          <motion.div
                            key={i.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="tray-ingredient"
                          >
                            <div>
                              <span>
                                <Icon size={12} />
                                {kinds[i.kind].label}
                              </span>
                              <button
                                aria-label={`Remove ${i.text}`}
                                onClick={() => toggleIngredient(i)}
                              >
                                <X size={13} />
                              </button>
                            </div>
                            <p>{i.text}</p>
                            <small>{i.perspectiveName}</small>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                    {Array.from({
                      length: Math.max(0, 2 - selected.length),
                    }).map((_, i) => (
                      <div className="empty-slot" key={i}>
                        <Plus size={18} />
                        <span>
                          {selected.length + i === 0
                            ? "Your first spark goes here"
                            : "Add a different point of view"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {selected.length > 0 && (
                    <button
                      className="clear-tray"
                      onClick={() => update({ selectedIds: [] })}
                    >
                      Clear tray
                    </button>
                  )}
                  {selected.length === 0 && (
                    <p className="tray-tip">
                      Start with a provocation that surprises you. Add a
                      mechanic that makes it possible.
                    </p>
                  )}
                </div>
                <div className="tray-bottom">
                  <div className="tray-progress">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <i
                        className={i < selected.length ? "filled" : ""}
                        key={i}
                      />
                    ))}
                  </div>
                  <p>
                    {selected.length < 2
                      ? `${2 - selected.length} more ingredient${2 - selected.length === 1 ? "" : "s"} to start growing`
                      : `${selected.length} ingredients. Plenty of possibility.`}
                  </p>
                  <button
                    className="button button-lime plant-button"
                    onClick={plant}
                    disabled={selected.length < 2 || !!busy}
                  >
                    {busy === "plant" ? (
                      <Loader2 size={17} className="spin" />
                    ) : (
                      <Sprout size={18} />
                    )}
                    Plant idea tree
                    <ArrowRight size={16} />
                  </button>
                  <span>Combines your selection into 3 concepts</span>
                </div>
              </aside>
            )}
          </div>
        </div>
        {state.stage === 1 && (
          <button
            className="mobile-tray-shortcut button button-lime"
            disabled={!!busy}
            onClick={() =>
              selected.length >= 2
                ? void plant()
                : document
                    .querySelector(".synthesis-tray")
                    ?.scrollIntoView({ behavior: "smooth" })
            }
          >
            <Layers size={16} />
            {selected.length} / 6 ingredients
            <span>
              {selected.length >= 2 ? "Plant idea tree" : "Open tray"}
            </span>
            <ArrowRight size={16} />
          </button>
        )}
        <AnimatePresence>
          {toast && (
            <motion.div
              className="toast"
              role="status"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
            >
              <span className="toast-dot" />
              {toast}
              <button aria-label="Dismiss message" onClick={() => setToast("")}>
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {modal && (
            <motion.div
              className="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModal(null)}
            >
              <motion.section
                className={`modal ${modal === "splice" ? "wide-modal" : ""}`}
                role="dialog"
                aria-modal="true"
                aria-label={
                  modal === "invite"
                    ? "Invite your team"
                    : modal === "settings"
                      ? "Workshop settings"
                      : modal === "splice"
                        ? "Splice an ingredient"
                        : "How Offscript works"
                }
                initial={{ y: 15, scale: 0.98 }}
                animate={{ y: 0, scale: 1 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="modal-close icon-button"
                  aria-label="Close dialog"
                  onClick={() => setModal(null)}
                >
                  <X size={20} />
                </button>
                {modal === "invite" && (
                  <>
                    <div className="modal-icon">
                      <Users size={26} />
                    </div>
                    <h2>
                      {join
                        ? "Your team is going off script."
                        : "Better ideas are a team sport."}
                    </h2>
                    <p>
                      {join
                        ? "Join the shared workshop. Your perspective belongs here."
                        : "Create a shared room, invite your teammates, and watch your ideas evolve together."}
                    </p>
                    {!w.credentials || join ? (
                      <>
                        <label className="field-label">
                          Your name
                          <input
                            autoFocus
                            maxLength={40}
                            placeholder="e.g. Nino"
                            value={memberName}
                            onChange={(e) => setMemberName(e.target.value)}
                          />
                        </label>
                        <button
                          className="button button-lime full-width"
                          disabled={!memberName.trim() || !!busy}
                          onClick={async () => {
                            setBusy("room");
                            try {
                              if (join) {
                                await w.joinRoom(
                                  join.id,
                                  join.token,
                                  memberName.trim(),
                                );
                                setJoin(null);
                                setModal(null);
                                notify("You’re in. Make something unexpected.");
                              } else {
                                setInvite(
                                  await w.createRoom(memberName.trim()),
                                );
                                notify(
                                  "Shared room created. Copy the link to invite your team.",
                                );
                              }
                            } catch (e) {
                              notify((e as Error).message);
                            } finally {
                              setBusy("");
                            }
                          }}
                        >
                          {busy ? (
                            <Loader2 size={16} className="spin" />
                          ) : (
                            <Users size={16} />
                          )}{" "}
                          {join ? "Join workshop" : "Create shared workshop"}
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="invite-link">
                          <input
                            readOnly
                            aria-label="Workshop invitation link"
                            value={
                              invite ||
                              `${typeof location === "undefined" ? "" : location.origin}/#room=${w.credentials.id}&token=${w.credentials.token}`
                            }
                          />
                          <button
                            aria-label="Copy invite link"
                            onClick={copyLink}
                          >
                            <Copy size={16} />
                          </button>
                        </div>
                        <p className="small-note">
                          Anyone with this link can edit this room after passing
                          the site’s access controls.
                        </p>
                        <div className="room-members">
                          {w.room?.participants.map((p) => (
                            <div key={p.id}>
                              <span className="avatar">
                                {p.name[0].toUpperCase()}
                              </span>
                              {p.name}
                              <span className="online-dot" />
                            </div>
                          ))}
                        </div>
                        <button
                          className="text-button"
                          onClick={() => {
                            w.leaveRoom();
                            setInvite("");
                          }}
                        >
                          <LogOut size={14} />
                          Leave shared room
                        </button>
                      </>
                    )}
                  </>
                )}
                {modal === "settings" && (
                  <>
                    <div className="modal-icon">
                      <Settings2 size={26} />
                    </div>
                    <h2>Your workshop, your way.</h2>
                    <p>
                      Choose how Offscript explores and evaluates future ideas.
                    </p>
                    <button
                      className={`mode-option ${demo ? "active" : ""}`}
                      onClick={() => chooseMode(true)}
                    >
                      <FlaskConical size={22} />
                      <span>
                        <strong>Demo workshop</strong>
                        <small>
                          Curated examples. Every interaction works. No API key
                          needed.
                        </small>
                      </span>
                      {demo && <Check size={17} />}
                    </button>
                    <button
                      className={`mode-option ${!demo ? "active" : ""}`}
                      disabled={!configured}
                      onClick={() => chooseMode(false)}
                    >
                      <Sparkles size={22} />
                      <span>
                        <strong>Live AI</strong>
                        <small>
                          {configured
                            ? "Independent live generations, tailored to your brief."
                            : "Set LLM_ENDPOINT_URL on the server to connect live AI."}
                        </small>
                      </span>
                      {!demo && <Check size={17} />}
                    </button>
                    <p className="small-note">
                      Demo results are illustrative. Live assessments are AI
                      suggestions; user value and originality still need
                      evidence.
                    </p>
                  </>
                )}
                {modal === "help" && (
                  <>
                    <div className="modal-icon">
                      <Sparkles size={26} />
                    </div>
                    <h2>Get a little off script.</h2>
                    <p>
                      Research a direction, shape your own idea, and give your
                      coding agent a clear plan.
                    </p>
                    <div className="help-steps">
                      <div><span>01</span><Search size={20}/><div><strong>Research</strong><p>Explore websites and past hackathon projects. Save useful features with their sources and bring them into your brief.</p></div></div>
                      {stages.map((s, i) => {
                        const Icon = s.icon;
                        return (
                          <div key={s.name}>
                            <span>0{i + 2}</span>
                            <Icon size={20} />
                            <div>
                              <strong>{s.name}</strong>
                              <p>
                                {
                                  [
                                    "Describe who has the problem, when it happens, and today’s workaround. Capture your team’s own thoughts first.",
                                    "Start with six independent perspectives from 100. Explore more only when you need another direction.",
                                    "Create distinct mechanisms. Connect two ideas, then choose Combine to create a child with both sources. Vote independently.",
                                    "Compare reasons and unknowns. Confirm your problem and solution, plan a test, and export a detailed prompt for Codex or Claude Code.",
                                  ][i]
                                }
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button
                      className="button button-lime full-width"
                      onClick={() => setModal(null)}
                    >
                      Let’s make something unexpected
                      <ArrowRight size={16} />
                    </button>
                  </>
                )}
                {modal === "splice" && (
                  <>
                    <div className="modal-icon">
                      <Workflow size={26} />
                    </div>
                    <h2>A new ingredient. A new direction.</h2>
                    <p>
                      Splice “{activeConcept?.title}” with an ingredient outside
                      your tray.
                    </p>
                    <div className="splice-list">
                      {ingredients
                        .filter((i) => !state.selectedIds.includes(i.id))
                        .map((i) => (
                          <button
                            key={i.id}
                            onClick={() => mutate("splice", i)}
                          >
                            <span>
                              {i.perspectiveName} · {kinds[i.kind].label}
                            </span>
                            <p>{i.text}</p>
                            <Plus size={15} />
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {drawer && crucible && (
            <motion.div
              className="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawer(false)}
            >
              <motion.aside
                className="crucible-drawer"
                role="dialog"
                aria-modal="true"
                aria-label="Validation and build plan"
                initial={{ x: "100%" }}
                animate={{ x: 0 }}
                exit={{ x: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="drawer-header">
                  <span>
                    <Scale size={17} />
                    VALIDATE & BUILD
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Close build plan"
                    onClick={() => setDrawer(false)}
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="drawer-content">
                  <p className="assessment-source">
                    {crucible.source !== "live"
                      ? "Illustrative demo plan"
                      : "AI-generated plan · assumptions need testing"}
                  </p>
                  <h1>{crucibleConcept?.title}</h1>
                  <p className="drawer-pitch">{crucibleConcept?.pitch}</p>
                  <div className="verdict-box reasoned-verdict">
                    <p>{crucible.verdict}</p>
                  </div>
                  {crucible.experiment && (
                    <section className="validation-experiment">
                      <h2>
                        <FlaskConical size={19} />
                        Your five-minute experiment
                      </h2>
                      <p>
                        <strong>Hypothesis</strong>{" "}
                        {crucible.experiment.hypothesis}
                      </p>
                      <ol>
                        {crucible.experiment.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                      <p>
                        <strong>Success signal</strong>{" "}
                        {crucible.experiment.successSignal}
                      </p>
                    </section>
                  )}
                  {crucible.scope && (
                    <section className="build-scope">
                      <h2>
                        <Target size={19} />
                        The smallest convincing prototype
                      </h2>
                      <h3>Build only this</h3>
                      <ul>
                        {crucible.scope.mustBuild.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                      <h3>Leave out for now</h3>
                      <ul>
                        {crucible.scope.cut.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                  <section>
                    <h2>
                      <Brain size={19} />
                      Fit with your judging context
                    </h2>
                    <p>{crucible.judgeReaction}</p>
                    <blockquote>{crucible.benchmark}</blockquote>
                  </section>
                  <div className="pros-cons">
                    <section>
                      <h2>
                        <Plus size={16} />
                        Technical strengths
                      </h2>
                      {crucible.pros.map((p, i) => (
                        <p key={i}>
                          <Check size={13} />
                          {p}
                        </p>
                      ))}
                    </section>
                    <section>
                      <h2>
                        <Target size={16} />
                        Hackathon traps
                      </h2>
                      {crucible.cons.map((p, i) => (
                        <p key={i}>
                          <span>−</span>
                          {p}
                        </p>
                      ))}
                    </section>
                  </div>
                  {!crucible.experiment && (
                    <section className="sniper">
                      <div className="eyebrow">
                        <Target size={15} /> WEAKEST ASSUMPTION SNIPER
                      </div>
                      <h3>{crucible.weakestAssumption.assumption}</h3>
                      <p>
                        <strong>The fix</strong>
                        {crucible.weakestAssumption.fix}
                      </p>
                      <p>
                        <strong>The 5-minute test</strong>
                        {crucible.weakestAssumption.test}
                      </p>
                    </section>
                  )}
                  <section>
                    <h2>
                      <Workflow size={19} />
                      Your build sequence
                    </h2>
                    <h4>CONTEXT SIGNALS</h4>
                    <div className="signal-pills">
                      {crucible.blueprint.signals.map((s, i) => (
                        <span key={i}>
                          <Radio size={12} />
                          {s}
                        </span>
                      ))}
                    </div>
                    <h4>ARCHITECTURE & APIS</h4>
                    {crucible.blueprint.architecture.map((a, i) => (
                      <p className="architecture-line" key={i}>
                        <span>0{i + 1}</span>
                        {a}
                      </p>
                    ))}
                    <div className="timeline">
                      {crucible.blueprint.timeline.map((t, i) => (
                        <div key={i}>
                          <span>{t.hours}</span>
                          <p>{t.task}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                  <section>
                    <h2>
                      <Clock size={19} />
                      Your 60-second demo
                    </h2>
                    <div className="demo-script">
                      {crucible.blueprint.demo.map((d, i) => (
                        <div key={i}>
                          <span>{d.seconds}</span>
                          <p>{d.action}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
                <div className="drawer-footer">
                  <button
                    className="button button-lime full-width"
                    onClick={exportBlueprint}
                  >
                    <Download size={16} />
                    Export prototype blueprint
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
function PerspectiveCard({
  exploration: e,
  selectedIds,
  starredIds,
  onSelect,
  onStar,
  onReroll,
  busy,
  rerolling,
}: {
  exploration: Exploration;
  selectedIds: string[];
  starredIds: string[];
  onSelect: (i: Ingredient) => void;
  onStar: (i: Ingredient) => void;
  onReroll: () => void;
  busy: boolean;
  rerolling: boolean;
}) {
  const m = categoryMeta[e.perspective.category];
  const Icon = m.icon;
  const selected = e.ingredients.some((i) => selectedIds.includes(i.id));
  return (
    <motion.article
      initial={false}
      animate={{ opacity: rerolling ? 0.5 : 1 }}
      transition={{ duration: 0.18 }}
      className={`perspective-card ${selected ? "has-selected" : ""} ${rerolling ? "rerolling" : ""}`}
    >
      <div className="perspective-header">
        <span className={`perspective-icon ${m.color}`}>
          <Icon size={21} />
        </span>
        <div>
          <span className={`perspective-category text-${m.color}`}>
            {m.short} lens
          </span>
          <h3>{e.perspective.name}</h3>
        </div>
        <button
          className="reroll-button"
          aria-label={`Re-roll ${e.perspective.name}`}
          title="Draw a new perspective"
          onClick={onReroll}
          disabled={busy}
        >
          <RotateCw size={16} className={rerolling ? "spin" : ""} />
        </button>
      </div>
      <p className="axiom">{e.perspective.operator}</p>
      <div className="ingredient-stack">
        {e.ingredients.map((i) => {
          const KindIcon = kinds[i.kind].icon;
          const picked = selectedIds.includes(i.id);
          return (
            <div key={i.id} className={`ingredient ${picked ? "picked" : ""}`}>
              <button
                className="ingredient-main"
                aria-pressed={picked}
                onClick={() => onSelect(i)}
              >
                <span className="ingredient-label">
                  <KindIcon size={13} />
                  {kinds[i.kind].label}
                </span>
                <span className="ingredient-text">{i.text}</span>
                <span className="ingredient-add">
                  {picked ? <Check size={13} /> : <Plus size={13} />}
                </span>
              </button>
              <button
                className={`ingredient-star ${starredIds.includes(i.id) ? "starred" : ""}`}
                aria-label={`${starredIds.includes(i.id) ? "Unstar" : "Star"} ${i.text}`}
                title="Save ingredient"
                onClick={() => onStar(i)}
              >
                <Star size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </motion.article>
  );
}
