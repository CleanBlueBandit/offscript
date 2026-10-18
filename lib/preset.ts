import { PERSPECTIVES } from "./perspectives";
import type { Brief, Exploration, IngredientKind } from "./types";

export const TRACKS = [
  { id: "make-it-better", label: "make-it-better", emoji: "🔁" },
  { id: "multiplayer-agents", label: "multiplayer-agents", emoji: "👥" },
  { id: "mobile-native", label: "mobile-native", emoji: "📱" },
  { id: "desktop-native", label: "desktop-native", emoji: "💻" },
  { id: "solana-ideathon", label: "solana-ideathon", emoji: "🪙" },
];

export const DEMO_BRIEF: Brief = {
  challenge: "Make everyday life feel a little less like admin.",
  targetUser: "Commuters juggling meetings in different places.",
  moment:
    "Ten minutes before leaving, when weather or a meeting location changes.",
  workaround:
    "Check calendar, weather, and maps separately; set a departure alarm by hand.",
  ownIdeas:
    "Show a departure window on the lock screen; move an errand into a canceled meeting slot.",
  observations:
    "People check their calendar, the weather, and their commute in three different places just to decide when to leave. A moved meeting or a rainy morning creates a cascade of tiny decisions. The context already exists; connecting it is still our job.",
  constraints:
    "A team of 3 with React, Python, and mobile experience. Build a convincing working prototype in 24 hours. Prefer existing device signals, reversible actions, and a 60-second demo with no typing.",
  tracks: ["make-it-better", "multiplayer-agents", "mobile-native"],
  judge: {
    who: "Tech Nerd judges: engineers, technical builders, and curious tinkerers.",
    avoid:
      "Business models, revenue streams, monetization, and generic LLM chat wrappers. Avoid setup-heavy experiences, vague AI promises, and pitch-deck-only ideas.",
    love: "Creativity, a real relatable problem, and a seamless autonomous UX that synthesizes multiple context signals without manual user input. Reward a surprising, technically credible live demo.",
    winners:
      "1st Place: Flip My Room — an embeddable 1-button room visualizer widget for e-commerce. 2nd Place: Autonomous AI Alarm Clock — a zero-config alarm that calculates wake time automatically from personal context signals.",
  },
};

const examples: [string, string, string, string][] = [
  [
    "choreographer",
    "What if getting out the door felt like one continuous movement?",
    "Sequence keys, coat, and departure cues around the next journey’s live travel time.",
    "Start the sequence when the phone leaves its charger; no morning checklist.",
  ],
  [
    "mycelium-network",
    "Your apps already know enough. Why must you introduce them?",
    "Let meeting location, rain forecast, and transit delay negotiate one shared departure moment.",
    "Connect existing signals once; show only the useful change they agree on.",
  ],
  [
    "triage-nurse",
    "What if only one thing deserved your attention right now?",
    "Rank today’s loose ends by consequence and time remaining, then surface the single urgent move.",
    "Let low-impact tasks expire quietly instead of becoming another list to manage.",
  ],
  [
    "six-year-old-child",
    "Why can’t the front door tell me what I forgot?",
    "Turn the lock-screen into a pocket check: umbrella, keys, ticket, depending on today’s adventure.",
    "The next destination decides what to bring; nobody writes a packing list.",
  ],
  [
    "air-traffic-controller",
    "Your day needs clearance to land, not another overlapping plan.",
    "Reserve small travel buffers between commitments using live journey conditions.",
    "When a meeting moves, recalculate the departure window and protect the next connection automatically.",
  ],
  [
    "sleight-of-hand-magician",
    "Make one tap feel like you already handled tomorrow.",
    "Reveal a prepared departure card with route, weather, and the right ticket together.",
    "Prepare everything in the background; the only visible interaction is the reveal.",
  ],
  [
    "economist",
    "What if every unnecessary decision had a visible attention cost?",
    "Show the minutes of mental effort saved by bundling three morning checks into one answer.",
    "Spend attention only when the new situation genuinely changes the best next move.",
  ],
  [
    "circadian-clock",
    "A useful suggestion at the wrong moment is still another interruption.",
    "Learn the gap between waking and leaving, then place a departure cue inside that rhythm.",
    "Use movement and charging patterns to choose the moment; skip a timing questionnaire.",
  ],
  [
    "black-box-recorder",
    "Could an interrupted plan wait exactly where your intention stopped?",
    "Keep a private breadcrumb of the route, booking, or errand interrupted by another commitment.",
    "Resurface the unfinished intention when the person returns to its original context.",
  ],
  [
    "beaver",
    "Don’t make people better at coping with a badly arranged morning.",
    "Create a departure zone that gathers tomorrow’s ticket, destination, and weather gear in one place.",
    "Build the zone from tomorrow’s first commitment while the phone charges overnight.",
  ],
  [
    "sleepy-commuter",
    "Can the whole product work before the first sip of coffee?",
    "Use a single large lock-screen departure ring: time left, one destination, one necessary action.",
    "Choose the next real journey from existing commitments; require no destination entry.",
  ],
  [
    "postal-sorter",
    "The useful fact should travel; the entire private message should not.",
    "Extract only time and destination locally, then send those fields to a journey calculator.",
    "Keep raw personal material on-device and discard extracted fields after the journey.",
  ],
  [
    "tightrope-walker",
    "Why wait for a late-arrival crisis before making a tiny correction?",
    "Let the departure ring slowly tighten as transit delays consume the available buffer.",
    "Adjust the cue continuously; ask for a decision only when the route truly changes.",
  ],
  [
    "improv-partner",
    "A changed plan is an offer. What becomes possible now?",
    "Turn a canceled meeting into one nearby unfinished errand that fits the newly open time.",
    "Use the place, available gap, and existing intention to offer a ready-made next move.",
  ],
  [
    "lighthouse-keeper",
    "What if a calm signal replaced the morning ritual of checking?",
    "Give the home-screen widget three quiet states: plenty of time, prepare, and leave.",
    "Let weather, route, and first commitment keep the signal current without opening anything.",
  ],
];

const kinds: IngredientKind[] = ["provocation", "mechanic", "flip"];
export const INITIAL_EXPLORATIONS: Exploration[] = examples.map(
  ([id, ...texts]) => {
    const perspective = PERSPECTIVES.find((item) => item.id === id);
    if (!perspective) throw new Error(`Missing demo perspective: ${id}`);
    return {
      perspective,
      ingredients: texts.map((text, index) => ({
        id: `${id}-${kinds[index]}`,
        perspectiveId: id,
        perspectiveName: perspective.name,
        kind: kinds[index],
        text,
      })),
    };
  },
);
