import type {
  Brief,
  Concept,
  Crucible,
  Exploration,
  Ingredient,
  Mutation,
  Perspective,
} from "./types";
import {
  containsForbidden,
  explorationOutputSchema,
  nearDuplicateText,
} from "./validation";

type Theme = {
  subject: string;
  audience: string;
  task: string;
  outcome: string;
  signals: string[];
  scenario: string;
  names: [string, string, string];
};
const clip = (value: string, max = 100) =>
  value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
const compact = (value: string, words: number) =>
  value.replace(/\s+/g, " ").trim().split(" ").slice(0, words).join(" ");
const fragment = (value: string, max = 100) =>
  clip(
    value
      .trim()
      .replace(/[.!?:;,\u2026]+$/u, "")
      .trimEnd(),
    max,
  );
const sentence = (value: string, max = 100) => {
  const result = fragment(value, max);
  return result.endsWith("…") ? result : `${result}.`;
};

function themeFor(brief: Brief): Theme {
  const source = `${brief.challenge} ${brief.observations}`.toLowerCase();
  if (/learn|student|studying|classroom|education|homework/.test(source))
    return {
      subject: "learning",
      audience: "students",
      task: "starting the next study session",
      outcome: "make the next useful learning step obvious",
      signals: [
        "Time until the next deadline",
        "Recently attempted exercises and their outcomes",
        "Available focus time from an opted-in calendar",
      ],
      scenario:
        "A deadline moves forward and a previously difficult exercise becomes the next tiny practice step.",
      names: ["Next Small Win", "Study Switch", "Forget the Syllabus"],
    };
  if (/food|meal|cook|grocery|fridge|kitchen/.test(source))
    return {
      subject: "meal planning",
      audience: "busy home cooks",
      task: "deciding what to cook tonight",
      outcome: "turn what is already available into one achievable meal",
      signals: [
        "Opted-in grocery receipt items",
        "Days since each ingredient was purchased",
        "Time available before the next calendar event",
      ],
      scenario:
        "A meeting overruns; the same ingredients instantly become a ten-minute meal.",
      names: ["Pantry Current", "Dinner Switch", "Cook Nothing New"],
    };
  if (/climate|carbon|sustainab|recycl|waste|energy/.test(source))
    return {
      subject: "resource use",
      audience: "households",
      task: "reducing waste during an ordinary day",
      outcome: "make the lower-waste option the easiest next action",
      signals: [
        "Time-stamped resource usage samples",
        "Local collection schedule",
        "Items already available for reuse",
      ],
      scenario:
        "A disposal event is replaced by a nearby reuse opportunity, with the saved step made visible.",
      names: ["Second Current", "Reuse Switch", "Waste Less Work"],
    };
  if (
    /wellbeing|wellness|mental health|stress|burnout|sleep|fitness|exercise/.test(
      source,
    )
  )
    return {
      subject: "daily wellbeing",
      audience: "busy people",
      task: "finding room for a restorative pause",
      outcome: "fit a small voluntary break into a real gap",
      signals: [
        "Opted-in calendar gaps",
        "User-set quiet hours",
        "Device activity duration without message contents",
      ],
      scenario:
        "A long meeting ends and a protected five-minute pause appears without a form.",
      names: ["Breathing Room", "Pause Switch", "Do One Less"],
    };
  if (
    /commut|travel|trip|transport|traffic/.test(source) &&
    !/admin|everyday|calendar/.test(source)
  )
    return {
      subject: "daily journeys",
      audience: "commuters",
      task: "leaving at the right moment",
      outcome: "turn a changing journey into one clear next step",
      signals: [
        "Opted-in destination and arrival time",
        "Travel-time estimates",
        "Local weather and service status",
      ],
      scenario:
        "A delayed service changes the departure moment and exposes the reason immediately.",
      names: ["Wayfinder", "Leave Switch", "The Uncommute"],
    };
  if (/brainstorm|creativ|idea|hackathon teams/.test(source))
    return {
      subject: "team ideation",
      audience: "small creative teams",
      task: "finding an unexpected idea worth building",
      outcome: "turn overlooked fragments into a testable direction",
      signals: [
        "Selected idea fragments",
        "Anonymous team preferences",
        "Remaining build time and available skills",
      ],
      scenario:
        "Two incompatible fragments form a concrete prototype while a hidden team vote reveals disagreement.",
      names: ["Sideways Current", "Idea Switch", "Kill the Favorite"],
    };
  if (/money|budget|financ|spend|saving/.test(source))
    return {
      subject: "everyday spending",
      audience: "people managing a household budget",
      task: "understanding a small spending decision",
      outcome: "make the tradeoff clear before someone commits",
      signals: [
        "User-imported transaction categories",
        "Known recurring due dates",
        "A user-set spending boundary",
      ],
      scenario:
        "A new recurring expense moves one visible budget boundary before any money is committed.",
      names: ["Quiet Ledger", "Tradeoff Switch", "Buy One Less"],
    };
  if (
    /admin|everyday|daily|calendar|routine|task|context switch|forgot|productiv/.test(
      source,
    )
  )
    return {
      subject: "daily admin",
      audience: "busy people",
      task: "getting ready for the next part of the day",
      outcome: "turn scattered context into one timely, reversible action",
      signals: [
        "Next calendar event and travel time",
        "Local weather for that event",
        "Permissioned device context and user-set quiet hours",
      ],
      scenario:
        "A rainy 9 AM meeting moves across town; the next action changes from “focus” to “leave with an umbrella.”",
      names: ["Quiet Current", "Ready, Set", "Negative Space"],
    };
  const subject = compact(
    brief.challenge
      .replace(
        /^(help|build|create|make|improve|solve|design|how (can|might) we)\s+/i,
        "",
      )
      .replace(/[.!?].*$/, ""),
    5,
  );
  return {
    subject: subject || "this challenge",
    audience: "people facing this problem",
    task: `taking the next useful step on ${subject}`,
    outcome: `remove one repeated friction point in ${subject}`,
    signals: [
      "Current workflow state from one opted-in source",
      "Time until the next relevant event",
      "Outcome of the last reversible action",
    ],
    scenario: `A real example of “${clip(brief.observations || brief.challenge, 110)}” changes one useful next action.`,
    names: ["Quiet Current", "One Good Move", "The Opposite Route"],
  };
}

function prototypeArchitecture(brief: Brief, theme: Theme): string[] {
  const stack = brief.constraints.toLowerCase();
  const native = /swift|kotlin|flutter|dart/.test(stack);
  const client = native
    ? "the team’s existing native UI"
    : !stack || /react|next/.test(stack)
      ? "React + TypeScript UI"
      : "the team’s existing client";
  const server = /django/.test(stack)
    ? "one endpoint on the existing Django server"
    : /python|fastapi/.test(stack)
      ? "one Python FastAPI endpoint"
      : /swift|kotlin|flutter|dart/.test(stack)
        ? "one typed JSON endpoint behind the native app"
        : "Next.js App Router route handlers";
  const sources: Record<string, string[]> = {
    "daily admin": [
      "Proposed calendar adapter: Google Calendar API events.list with consent, or an uploaded ICS file parsed by ical.js. Start with dated JSON fixtures while account access is being connected.",
      "Proposed context inputs: Open-Meteo forecast plus opt-in browser Geolocation API. Offer a chosen-location fallback; label travel-time fixtures until a real routing source is connected.",
    ],
    learning: [
      "Proposed deadline adapter: a course ICS export parsed by ical.js, or Google Calendar API with consent. Use a local exercise-attempt log; keep course-service fixtures labeled.",
      "Represent each exercise with topic, last attempt, outcome, and estimated minutes. Select a small next step with deterministic prerequisite rules before adding any generated explanation.",
    ],
    "meal planning": [
      "Proposed inventory adapter: a user-selected grocery CSV parsed by Papa Parse, with an optional Open Food Facts barcode lookup. Use a small local inventory fixture until a real import works.",
      "Combine purchase dates, a user-set available cooking window, and a short recipe JSON file. Treat food age as a planning hint, never as a determination that food is safe to eat.",
    ],
    "resource use": [
      "Proposed inputs: a user-selected meter or reuse CSV parsed by Papa Parse and a municipal collection ICS file parsed by ical.js. Label local fixtures when no source is available.",
      "Normalize timestamps and resource units before comparing a baseline with one changed action. Use deterministic totals so the proposed benefit can be inspected.",
    ],
    "daily wellbeing": [
      "Proposed calendar adapter: Google Calendar API or an ICS file parsed by ical.js. Keep quiet hours in local preferences and use permissioned fixture events until a real source works.",
      "Use the Page Visibility API only for this app’s active-tab context; it does not measure whole-device activity. Keep device-wide duration as a labeled fixture and breaks voluntary.",
    ],
    "daily journeys": [
      "Proposed inputs: opt-in browser Geolocation API and Open-Meteo forecast, with chosen-location and JSON fixture fallbacks.",
      "If the chosen transit agency supplies GTFS Realtime, parse it with gtfs-realtime-bindings; otherwise use a clearly labeled delay fixture. Validate one route before adding coverage.",
    ],
    "team ideation": [
      "Use typed ingredient JSON plus an explicit room event stream for ideas and votes. Server-Sent Events can deliver room updates; keep anonymous vote results hidden until reveal.",
      "For a React team, React Flow can show the branching concepts. Prototype with local room fixtures before connecting persistence and multi-device transport.",
    ],
    "everyday spending": [
      "Proposed transaction input: a user-selected CSV parsed by Papa Parse, with a labeled synthetic ledger fallback. Validate dates, currencies, and amounts before using a record.",
      "Calculate recurring totals and user-set budget boundaries deterministically. Preview a spending tradeoff; do not initiate payments or infer financial advice from generated text.",
    ],
  };
  return [
    `${brief.constraints ? `Keep the stated team stack: ${sentence(brief.constraints, 240)} ` : ""}Proposed prototype boundary: ${client} calling ${server}. Build one input-to-action path first.`,
    ...(sources[theme.subject] || [
      "Define one typed adapter for a source the team already has permission to access. Validate its JSON with Zod in TypeScript or Pydantic in Python; use labeled local fixtures until it is connected.",
    ]),
    "Implement a deterministic decide(context) function returning action, reason, confidence, and undo data. Reject stale or missing signals; test the same rule against normal, changed, and failed-input fixtures.",
    "Use Gemini only if bounded interpretation is necessary, with schema-validated JSON. Keep the final action rule deterministic and show which source fields caused the decision.",
    "Persist only opted-in context and an action log; keep provider credentials on the server. Include reset and undo. These are proposed integrations, not services already connected to this demo.",
  ];
}

type Atom = [string, string, string];
function atomsFor(perspective: Perspective, subject: string): Atom {
  const name = perspective.name.toLowerCase();
  if (/choreograph|danc|conductor|orchestra/.test(name))
    return [
      `What if ${subject} followed a rhythm instead of a list?`,
      "Sequence tiny actions around the next event, like cues in a performance.",
      "Let the next cue appear only when the previous action naturally ends.",
    ];
  if (/triage|emergency|nurse|firefight/.test(name))
    return [
      `What if only one part of ${subject} deserved attention right now?`,
      "Rank friction by urgency, consequence, and reversibility; surface only the highest-leverage move.",
      "Defer low-impact decisions automatically until their context becomes useful.",
    ];
  if (/mycel|fung|forest|root|coral/.test(name))
    return [
      `What if small clues solved ${subject} together?`,
      "Connect weak signals from nearby events into one confidence-weighted trigger.",
      "Reuse context already shared by adjacent activities; ask for nothing twice.",
    ];
  if (/child|beginner|toddler/.test(name))
    return [
      `Why does ${subject} need so many steps?`,
      "Replace a complicated decision with a playful before-and-after preview.",
      "Make the obvious choice one tap and explain the rest only on demand.",
    ];
  if (/air traffic|dispatcher|railway|logistic/.test(name))
    return [
      `What if ${subject} had a clear runway?`,
      "Reserve a safe action window using time, location, and competing commitments.",
      "Reroute the next step when conditions change, keeping a visible undo.",
    ];
  if (/econom|auction|market|game|poker|negotiat/.test(name))
    return [
      `What if attention were the scarce currency of ${subject}?`,
      "Give each interruption a fixed budget and price it against the value of waiting.",
      "Let low-value requests expire without asking the user to reject them.",
    ];
  if (/magic|illusion|sleight/.test(name))
    return [
      `What if ${subject} happened before anyone noticed the work?`,
      "Precompute two likely outcomes and reveal the right one at the moment of need.",
      "Hide preparation while making every final action inspectable and reversible.",
    ];
  if (/immune|antibod|vaccine/.test(name))
    return [
      `What if ${subject} remembered yesterday’s friction?`,
      "Recognize recurring failure patterns and prepare a small protective action.",
      "Suppress a repeated annoyance after one correction instead of demanding another preference.",
    ];
  if (/garden|seed|farmer|compost/.test(name))
    return [
      `What if unfinished ${subject} became useful material?`,
      "Let stale tasks decay into reusable context instead of accumulating forever.",
      "Grow a next step from existing materials rather than requesting fresh input.",
    ];
  if (/cartograph|map|navigator|sailor/.test(name))
    return [
      `What if ${subject} showed the next turn, not the whole map?`,
      "Use a single contextual landmark to reveal the next achievable action.",
      "Recalculate after each change; preserve the destination without asking for another plan.",
    ];
  if (/thermo|heat|entropy|physic/.test(name))
    return [
      `Where does ${subject} lose useful energy?`,
      "Detect repeated transitions and recover their wasted effort as a reusable shortcut.",
      "Trigger the shortcut only when the same context returns.",
    ];
  if (/librar|archiv|historian|scribe/.test(name))
    return [
      `What if ${subject} could borrow a proven answer from yesterday?`,
      "Match the current situation to a small indexed memory of successful actions.",
      "Retrieve the relevant precedent automatically and expose its source in one tap.",
    ];
  if (/chef|cook|baker/.test(name))
    return [
      `What if ${subject} used only ingredients already on hand?`,
      "Compose the next action from available time, tools, and context like a tiny recipe.",
      "Substitute the missing piece automatically instead of stopping the whole flow.",
    ];
  if (/sculpt|editor|minimal|monk/.test(name))
    return [
      `What could disappear from ${subject} without losing the outcome?`,
      "Remove one recurring decision and compare the result with the original process.",
      "Default to doing less; require a reason before adding another step.",
    ];
  const categoryAtoms: Record<Perspective["category"], Atom[]> = {
    "Physical & Kinetic": [
      [
        `What if ${subject} worked through momentum?`,
        "Chain one small action to a natural transition already happening.",
        "Let the previous action become the trigger for the next.",
      ],
      [
        `Where is the hidden lever in ${subject}?`,
        "Amplify one tiny input into a reversible sequence of useful steps.",
        "Prepare everything in advance; ask only for the final commitment.",
      ],
      [
        `What if friction itself guided ${subject}?`,
        "Detect a repeated pause and offer the smallest action that removes it.",
        "Adapt the path from observed hesitation instead of another settings screen.",
      ],
    ],
    "Biological & Natural": [
      [
        `What if ${subject} adapted like a living system?`,
        "Combine three weak environmental clues into a context-sensitive trigger.",
        "Learn one stable pattern and let exceptions remain explicitly reversible.",
      ],
      [
        `Could ${subject} grow from what is already here?`,
        "Reuse leftover context from the previous activity to seed the next action.",
        "Ask for missing information only when it would change the outcome.",
      ],
      [
        `What if ${subject} rested when nothing needed doing?`,
        "Wake a tiny mechanism only when two independent signals agree.",
        "Do nothing by default; act only when confidence crosses a clear boundary.",
      ],
    ],
    "Economic & Game Theory": [
      [
        `Who pays the hidden attention tax in ${subject}?`,
        "Trade low-value interruptions for one well-timed decision with visible consequences.",
        "Batch weak requests until one meaningful action can resolve them together.",
      ],
      [
        `What if ${subject} rewarded doing less?`,
        "Track removed decisions instead of completed tasks to expose unnecessary work.",
        "Automatically retire a repeated step when its outcome no longer matters.",
      ],
      [
        `What if disagreement improved ${subject}?`,
        "Compare two competing predictions and act only where they converge.",
        "Let uncertainty delay the action instead of creating extra questions.",
      ],
    ],
    "Systems & Chaos": [
      [
        `What if ${subject} needed a circuit breaker?`,
        "Detect overload and collapse the workflow to one safe next action.",
        "Pause low-confidence steps until real-world conditions settle.",
      ],
      [
        `Which tiny change could transform ${subject}?`,
        "Simulate two nearby outcomes before committing to a reversible action.",
        "Preselect the least-regret path using existing context.",
      ],
      [
        `What if ${subject} repaired itself?`,
        "Keep the desired outcome fixed while swapping failed intermediate steps.",
        "Recover quietly from one missing signal using a transparent fallback.",
      ],
    ],
    "Sensory & Human": [
      [
        `What if ${subject} felt obvious before it was explained?`,
        "Use one subtle color shift to show readiness without demanding attention.",
        "Reveal detail only when someone pauses or deliberately inspects the cue.",
      ],
      [
        `How could ${subject} feel lighter in one second?`,
        "Replace a form with a tangible before-and-after preview of one useful change.",
        "Carry forward the last relevant choice until the situation materially changes.",
      ],
      [
        `What if ${subject} respected a person’s attention span?`,
        "Fit the next step inside the available moment, using time and activity signals.",
        "Move unfinished work to the next natural pause without asking again.",
      ],
    ],
    "Historical & Analog": [
      [
        `What if ${subject} borrowed an old physical ritual?`,
        "Turn a familiar handoff into a small digital mechanism with one visible state.",
        "Let the ritual carry the instructions instead of requiring setup.",
      ],
      [
        `Could ${subject} work like a well-run workshop?`,
        "Prepare tools and context before the person reaches the next workstation.",
        "Reuse the previous successful arrangement when a familiar situation returns.",
      ],
      [
        `What did people understand about ${subject} before software?`,
        "Translate a physical cue into a single timely action inside the existing workflow.",
        "Use the environment as the input instead of asking for another form.",
      ],
    ],
  };
  const choices = categoryAtoms[perspective.category];
  const hash = [...perspective.name].reduce(
    (value, char) => value + char.charCodeAt(0),
    0,
  );
  return choices[hash % choices.length];
}

function enforceAtom(
  value: string,
  forbidden: string[],
  limit: number,
): string {
  let result = value;
  for (const phrase of [...forbidden].sort((a, b) => b.length - a.length)) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(
      new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "giu"),
      "$1",
    );
  }
  result = compact(result.replace(/\s+([,.?!])/g, "$1"), limit);
  if (!result || containsForbidden(result, forbidden)) {
    result = compact(
      "Try a small reversible step using signals already present."
        .split(" ")
        .filter((word) => !containsForbidden(word, forbidden))
        .join(" "),
      limit,
    );
  }
  return result;
}

export function exploreDemo(
  brief: Brief,
  perspectives: Perspective[],
  avoidMechanisms: string[] = [],
): Exploration[] {
  const theme = themeFor(brief);
  const seen: string[] = [...avoidMechanisms];
  return perspectives.map((perspective) => {
    const atoms = atomsFor(perspective, compact(theme.subject, 3));
    const values = {
      provocation: enforceAtom(atoms[0], perspective.forbiddenWords, 15),
      mechanic: enforceAtom(atoms[1], perspective.forbiddenWords, 20),
      flip: enforceAtom(atoms[2], perspective.forbiddenWords, 20),
    };
    if (seen.some((text) => nearDuplicateText(text, values.mechanic))) {
      values.mechanic = enforceAtom(
        `Prototype this operator: ${perspective.operator}`,
        perspective.forbiddenWords,
        20,
      );
    }
    seen.push(values.mechanic);
    const output = explorationOutputSchema(perspective).parse(values);
    return {
      perspective,
      ingredients: (["provocation", "mechanic", "flip"] as const).map(
        (kind) => ({
          id: crypto.randomUUID(),
          perspectiveId: perspective.id,
          perspectiveName: perspective.name,
          kind,
          text: output[kind],
        }),
      ),
    };
  });
}

function mechanism(ingredient: Ingredient): string {
  const source = ingredient.text.toLowerCase();
  if (/rhythm|cue|sequence|chain|momentum/.test(source))
    return "a sequence of tiny cues attached to natural transitions";
  if (/urgency|triage|highest|overload|circuit/.test(source))
    return "one urgency-ranked, reversible next move";
  if (/weak signal|confidence|agree|converg|clues/.test(source))
    return "a trigger that waits for two independent context signals";
  if (/preview|simulat|outcome|before-and-after/.test(source))
    return "a before-and-after preview of the next useful action";
  if (/attention|interrupt|budget|low-value/.test(source))
    return "a strict attention budget that batches low-value decisions";
  if (/remove|disappear|less|retire|decay/.test(source))
    return "a reversible rule that removes an unnecessary decision";
  if (/reuse|previous|precedent|memory|familiar/.test(source))
    return "a reusable pattern drawn from the last successful situation";
  if (/color|subtle|tangible|ritual|physical/.test(source))
    return "a subtle visual cue embedded in the existing environment";
  return `the principle “${clip(ingredient.text.replace(/[.!?]$/, ""), 92)}”`;
}
function judgeScore(brief: Brief, base: number) {
  const technical =
    /creativ|engineer|autonom|seamless|real|build|technical/.test(
      `${brief.judge.who} ${brief.judge.love}`.toLowerCase(),
    )
      ? 3
      : 0;
  return Math.min(96, base + technical);
}

function demoDirections(brief: Brief, theme: Theme) {
  const audience = fragment(brief.targetUser?.trim() || theme.audience, 200);
  if (theme.subject === "daily admin" || theme.subject === "daily journeys")
    return [
      {
        title: "Departure Window",
        mechanism:
          "Subtract live journey duration and a weather buffer from the next meeting's arrival time; update a lock-screen departure window.",
        pitch: `For ${audience}, a departure window recomputes when to leave after a meeting moves, combining calendar location, journey duration and rain into one visible countdown.`,
        risk: "The proposed leave time matches what commuters actually need, including their preparation time.",
      },
      {
        title: "Where I Left Off",
        mechanism:
          "Save an explicit breadcrumb of an interrupted route or errand; match a later calendar gap and location to resume the unfinished action.",
        pitch: `For ${audience}, an interrupted errand leaves a one-tap breadcrumb that resurfaces when a later gap near the destination makes it possible to finish.`,
        risk: "People will deliberately save an interrupted intention, and a later gap is a useful time to resume it.",
      },
      {
        title: "One Less Check",
        mechanism:
          "Compare the last confirmed plan with changed inputs; suppress repeat checks when the resulting decision is unchanged, and reveal only a meaningful difference.",
        pitch: `For ${audience}, a change-only receipt shows whether the morning plan still holds, so repeated weather and calendar checks disappear until an actual decision changes.`,
        risk: "A trustworthy unchanged-plan signal removes checking without hiding an important exception.",
      },
    ];
  if (theme.subject === "meal planning")
    return [
      {
        title: "Use It First",
        mechanism:
          "Sort an imported pantry by purchase date; match the first ingredient to recipes that fit tonight's available cooking window.",
        pitch: `For ${audience}, the oldest pantry item becomes the starting constraint for a meal that fits tonight's calendar gap, with a visible substitution when time shrinks.`,
        risk: "Purchase date and the imported inventory are accurate enough to prioritize a useful meal; age is not a food-safety judgment.",
      },
      {
        title: "Pantry Swap",
        mechanism:
          "Match explicit surplus and missing-ingredient offers between nearby opt-in households; suggest one reciprocal exchange without storing private addresses.",
        pitch: `For ${audience}, two households with complementary pantry leftovers receive a single opt-in swap proposal that unlocks a meal for each.`,
        risk: "Enough nearby households have complementary ingredients and are willing to arrange a safe exchange.",
      },
      {
        title: "Skip The Shop",
        mechanism:
          "Compare a proposed shopping list against already-owned recipe substitutions; preview which purchases can be removed while preserving the intended meal.",
        pitch: `For ${audience}, an editable shopping-list preview crosses out purchases that existing pantry substitutions can cover and shows the recipe change before approval.`,
        risk: "Suggested substitutions preserve the meal people want, including their explicit dietary constraints.",
      },
    ];
  return [
    {
      title: theme.names[0],
      mechanism: `Use ${theme.signals[0].toLowerCase()} to predict a narrow opportunity window for ${theme.task}; show one timely next action with its triggering evidence.`,
      pitch: `For ${audience}, ${theme.names[0]} turns ${theme.signals[0].toLowerCase()} into an inspectable opportunity window for ${theme.task}.`,
      risk: "The chosen input predicts a moment when the proposed action is actually useful.",
    },
    {
      title: theme.names[1],
      mechanism: `Capture the exact point where ${theme.task} gets interrupted; restore only the unfinished state when a matching situation returns.`,
      pitch: `For ${audience}, ${theme.names[1]} saves an interrupted step in ${theme.subject} and restores it at the next relevant moment, avoiding a complete restart.`,
      risk: "Interruptions recur often enough that saving and restoring state is worth the capture effort.",
    },
    {
      title: theme.names[2],
      mechanism: `Run a reversible subtraction experiment on ${theme.subject}: remove one repeated step, compare the resulting outcome with the original, and restore it if the outcome worsens.`,
      pitch: `For ${audience}, ${theme.names[2]} lets someone remove one recurring step from ${theme.task} and inspect whether the intended outcome still holds.`,
      risk: "The repeated step is unnecessary rather than an obligation or hidden dependency.",
    },
  ];
}

export function synthesizeDemo(
  brief: Brief,
  ingredients: Ingredient[],
): Concept[] {
  const theme = themeFor(brief);
  const selected = (index: number) => [
    ingredients[(index * 2) % ingredients.length],
    ingredients[(index * 2 + 1) % ingredients.length],
  ];
  return demoDirections(brief, theme).map((direction, index) => {
    const sources = selected(index);
    return {
      id: crypto.randomUUID(),
      title: direction.title,
      pitch: direction.pitch,
      mechanism: direction.mechanism,
      assessment: {
        userValue: `Addresses ${fragment(brief.moment || theme.task, 250)}. Confirm that this is frequent enough to matter to ${fragment(brief.targetUser || theme.audience, 200)}.`,
        originality: [
          "The time window is recalculated from changing context; compare this with an ordinary manually set reminder.",
          "Restoring an interrupted state is a different interaction from predicting or recommending the next action.",
          "The concept removes a repeated step and checks the outcome; its distinction depends on a meaningful step actually disappearing.",
        ][index],
        feasibility: `${brief.constraints ? `Given ${fragment(brief.constraints, 240)}, start` : "Start"} with one source and two labeled scenarios. ${index === 1 ? "Persist one breadcrumb before adding any automatic matching." : index === 2 ? "A before/after comparison needs no autonomous action." : "Use a deterministic rule before connecting live inputs."}`,
        demoClarity: [
          "Move one input and show the window change, then inspect the calculation.",
          "Interrupt one action, change the context, and restore exactly where it stopped.",
          "Remove one step, show the preserved outcome, and undo the change.",
        ][index],
      },
      assumptions: [
        direction.risk,
        `The current workaround${brief.workaround ? ` (${fragment(brief.workaround, 220)})` : ""} is painful enough to justify changing behavior.`,
      ],
      perspectives: [...new Set(sources.map((item) => item.perspectiveName))],
      score: judgeScore(brief, [85, 89, 79][index]),
      pros: [
        [
          "A context change produces an immediate, visible before/after.",
          "One embedded action gives the demo a clear, memorable payoff.",
          "The inversion makes the idea easy to distinguish from familiar task tools.",
        ][index],
        `${sources[1].perspectiveName} adds a concrete constraint: “${clip(sources[1].text, 120)}”`,
        brief.constraints
          ? `Start with one vertical slice inside the supplied stack: ${clip(brief.constraints, 110)}`
          : "One input adapter, one decision rule, and one visible action fit a focused prototype.",
      ],
      cons: [
        [
          "Incorrect context could trigger an unwanted action; keep it reversible.",
          "An embedded host needs a clear integration surface and explicit permissions.",
          "Removing a step is only valuable if its original purpose remains covered.",
        ][index],
        "Fixture-driven demonstration must be clearly distinguished from a connected real-world integration.",
      ],
    };
  });
}

export function mutateDemo(
  brief: Brief,
  parent: Concept,
  type: Mutation,
  ingredient?: Ingredient,
  perspective?: Perspective,
): Concept[] {
  const theme = themeFor(brief);
  const sources = [
    ...new Set([
      ...parent.perspectives,
      ...(ingredient ? [ingredient.perspectiveName] : []),
      ...(perspective ? [perspective.name] : []),
    ]),
  ].slice(0, 10);
  const variation: Record<
    Mutation,
    { title: string; pitch: string; pro: string; con: string; delta: number }
  > = {
    autonomous: {
      title: `${parent.title} · Autopilot`,
      pitch: `${parent.title} watches ${theme.signals[0].toLowerCase()} and ${theme.signals[1].toLowerCase()}, then prepares its next action automatically with a visible undo and a safe pause when signals disagree.`,
      pro: "Replaces the parent’s manual trigger with a precise, testable two-signal rule.",
      con: "Requires consent, stale-signal detection, and a conservative confidence threshold.",
      delta: 3,
    },
    widget: {
      title: `${parent.title} · One Press`,
      pitch: `A compact “Make this easier” button embeds ${parent.title} in the ${brief.tracks.includes("mobile-native") ? "mobile share sheet" : "browser toolbar"}, previews one change to ${theme.subject}, and applies it with a single reversible press.`,
      pro: "A narrow host surface and one before/after make the interaction instantly legible.",
      con: "The host must expose enough context; prototype one explicit supported page or screen.",
      delta: 4,
    },
    invert: {
      title: `${parent.title} · Subtract`,
      pitch: `Instead of helping people do more, ${parent.title} identifies one unnecessary step in ${theme.subject}, proposes removing it, and proves the desired outcome still holds before the team commits.`,
      pro: "Reverses the core assumption from completing work to proving which work can vanish.",
      con: "A removed step may carry a hidden obligation; show the dependency and keep undo.",
      delta: -2,
    },
    wildcard: {
      title: `${parent.title} · ${perspective?.name || "Sideways"}`,
      pitch: `${parent.title} borrows ${perspective?.name || "a new lens"}’s mechanism: ${perspective ? atomsFor(perspective, compact(theme.subject, 3))[1] : "Reverse the familiar interaction."} This changes the next useful action in ${theme.subject}.`,
      pro: `Uses the lens’s axiom as a design rule: ${clip(perspective?.axiom || "Explore an unfamiliar mechanism.", 170)}`,
      con: "The metaphor needs one concrete interaction; resist expanding it into a full platform.",
      delta: 1,
    },
    splice: {
      title: `${parent.title} · Crossfade`,
      pitch: `${parent.title} gains ${ingredient ? mechanism(ingredient) : "a second context trigger"}, changing how it helps ${theme.audience} with ${theme.task} while retaining the parent’s original payoff.`,
      pro: `The added ingredient changes behavior: “${clip(ingredient?.text || "", 170)}”`,
      con: "Two mechanisms can compete; give the new one a single clear trigger and fallback.",
      delta: 2,
    },
  };
  const child = variation[type];
  return [
    {
      id: crypto.randomUUID(),
      title: clip(child.title, 115),
      pitch: child.pitch,
      mechanism: child.pro,
      assessment: {
        userValue: `Preserves the problem addressed by ${parent.title}; test whether the changed interaction improves the user's actual moment of friction.`,
        originality: child.pro,
        feasibility: `${child.con} Keep the prototype inside ${fragment(brief.constraints || "one focused end-to-end interaction", 220)}.`,
        demoClarity: `Show ${parent.title}'s original behavior, then the ${type} variation with the same input and a visible outcome.`,
      },
      assumptions: [
        child.con,
        "The changed interaction is preferable to the parent's behavior for the intended user.",
      ],
      inheritedFrom: [
        {
          conceptId: parent.id,
          contribution: clip(parent.mechanism || parent.pitch, 500),
        },
      ],
      parentId: parent.id,
      mutation: type,
      perspectives: sources,
      score: Math.max(0, Math.min(98, parent.score + child.delta)),
      pros: [
        child.pro,
        `Preserves the parent payoff: ${clip(parent.pitch, 230)}`,
      ],
      cons: [
        child.con,
        "Validate the changed interaction separately; the parent’s assumptions do not automatically transfer.",
      ],
    },
  ];
}

export function combineDemo(
  brief: Brief,
  concepts: [Concept, Concept],
): Concept[] {
  const [first, second] = concepts;
  const contribution = (concept: Concept) =>
    fragment(concept.mechanism || concept.pitch, 220);
  const joinedMechanism = `Use the result of ${first.title} as the trigger for ${second.title}: ${contribution(first)}; then ${contribution(second)}. Run the second step only when the first produces a useful change.`;
  return [
    {
      id: crypto.randomUUID(),
      title: clip(`${first.title} × ${second.title}`, 115),
      pitch: clip(
        `For ${fragment(brief.targetUser || themeFor(brief).audience, 200)}, combine ${first.title}'s result with ${second.title}'s next action so one explicit change carries the user through both steps with a single preview and undo.`,
        780,
      ),
      mechanism: clip(joinedMechanism, 590),
      perspectives: [
        ...new Set(concepts.flatMap((concept) => concept.perspectives)),
      ].slice(0, 10),
      score: 0,
      parentId: first.id,
      mutation: "combine",
      inheritedFrom: concepts.map((concept) => ({
        conceptId: concept.id,
        contribution: contribution(concept),
      })),
      assessment: {
        userValue: `Removes a handoff between two actions for ${fragment(brief.targetUser || themeFor(brief).audience, 200)}; verify that the same person needs both in the same situation.`,
        originality:
          "The first mechanism's result becomes the second mechanism's trigger. The connection is only useful if this changes behavior, rather than bundling features.",
        feasibility: `Implement a typed handoff between two small functions with a shared preview. Keep to ${fragment(brief.constraints || "one input source and one complete path", 250)}.`,
        demoClarity:
          "Show the first result, inspect exactly what it passes to the second action, then undo the combined outcome.",
      },
      assumptions: [
        "Both parent mechanisms address the same user's situation.",
        "The output of the first mechanism contains enough information to trigger the second without more setup.",
      ],
      pros: [
        "A single explicit handoff explains why these ideas belong together.",
        "Each parent's contribution remains inspectable and independently testable.",
      ],
      cons: [
        "The connection may create extra complexity if people do not need both steps together.",
        "The second action must pause when the first result is missing or uncertain.",
      ],
    },
  ];
}

export function assessDemo(brief: Brief, concept: Concept): Concept {
  return {
    ...concept,
    mechanism:
      concept.mechanism ||
      `Described behavior: ${fragment(concept.pitch, 420)}. Specify its input and decision rule before claiming a distinct mechanism.`,
    assessment: concept.assessment || {
      userValue: `Check whether ${fragment(brief.targetUser || themeFor(brief).audience, 160)} experiences this often: ${fragment(brief.moment || brief.observations || brief.challenge, 250)}. The existing pitch alone is not evidence of demand.`,
      originality: `The proposed difference is ${fragment(concept.pros[0] || concept.pitch, 300)}. Compare that behavior with ${fragment(brief.workaround || "the current workaround", 180)}; a new name is not evidence of novelty.`,
      feasibility: `Start with one concrete input-to-outcome path within ${fragment(brief.constraints || "the team's available time and skills", 250)}. Resolve this risk first: ${fragment(concept.cons[0] || "the pitch has not specified its implementation", 200)}.`,
      demoClarity: `Show one realistic before/after for ${fragment(concept.title, 110)} with the same input, then show a failure case. The pitch still needs a concrete observable success signal.`,
    },
    assumptions: concept.assumptions || [
      `The intended user encounters the problem often enough to change their current behavior.`,
      fragment(
        concept.cons[0] ||
          "The required input is available within the team's build time",
        500,
      ),
    ],
  };
}

export function crucibleDemo(brief: Brief, concept: Concept): Crucible {
  const theme = themeFor(brief);
  const budgetMatch = brief.constraints.match(
    /(\d+(?:\.\d+)?)\s*[-–]?\s*(hours?|hrs?|h|days?|d|minutes?|mins?)\b/i,
  );
  const budgetHours = budgetMatch
    ? Math.max(
        0.1,
        Math.min(
          168,
          Number(budgetMatch[1]) *
            (/^d/i.test(budgetMatch[2])
              ? 24
              : /^m/i.test(budgetMatch[2])
                ? 1 / 60
                : 1),
        ),
      )
    : 24;
  const slot = (from: number, to: number) =>
    budgetHours < 2
      ? `${Math.round(from * budgetHours * 60)}–${Math.round(to * budgetHours * 60)} minutes`
      : `${Number((from * budgetHours).toFixed(1))}–${Number((to * budgetHours).toFixed(1))} hours`;
  const widget =
    concept.mutation === "widget" ||
    /one press|one inspectable|button/i.test(concept.pitch);
  const invert =
    concept.mutation === "invert" ||
    /removing work|subtract/i.test(concept.pitch);
  const mechanismRisk = widget
    ? "The host surface provides enough context for one button to produce a useful result."
    : invert
      ? "The step being removed is genuinely unnecessary, rather than a hidden dependency."
      : "The available context predicts the useful next action reliably enough to earn trust.";
  const hypothesis = concept.assumptions?.[0] || mechanismRisk;
  const resultAction = widget
    ? "Press the embedded button once and show its preview and undo."
    : invert
      ? "Remove one proposed step and show that the intended outcome still holds."
      : "Change the fixture’s context and show the next action update without typing.";
  return {
    verdict: `${concept.title} is a strong prototype candidate if the team proves one useful behavior end to end. Cut the scope to ${theme.task}; earn the judge’s trust with an obvious trigger and undo.`,
    score: Math.max(0, Math.min(96, concept.score - 2)),
    judgeReaction: `Simulated panel reaction for ${fragment(brief.judge.who || "technical builders", 220)}: “I can see why ${theme.audience} would use this. Show me what actually changed the decision and what happens when a signal is wrong.” The strongest moment is ${concept.title} making its mechanism visible. Emphasize ${sentence(brief.judge.love || "a useful, surprising interaction", 220)}`,
    benchmark: brief.judge.winners
      ? `${concept.title} should match the immediate before/after and low setup cost of the supplied benchmark: ${sentence(brief.judge.winners, 330)} Its distinction is applying ${concept.perspectives.slice(0, 2).join(" + ")} to ${theme.subject}; demonstrate that mechanism rather than claiming novelty.`
      : `${concept.title} needs a benchmark the team can verify: compare the existing multi-step workflow with the proposed single useful action, using the same starting context.`,
    pros: [
      `The core promise is concrete enough to demonstrate: ${clip(concept.pitch, 260)}`,
      `The ${concept.perspectives.slice(0, 2).join(" and ")} ingredients create a recognizable design choice, not just another text response.`,
      `The ${brief.tracks.slice(0, 2).join(" / ") || "selected"} track can be demonstrated through one focused vertical slice.`,
    ],
    cons: [
      "Live integrations and permission screens can consume the hackathon; support one source first and label fixture inputs.",
      `${concept.title} may look magical until it is wrong. Expose the contributing signals, uncertainty, and an undo.`,
      brief.judge.avoid
        ? `Judge guardrail: avoid spending the demo on ${sentence(brief.judge.avoid, 220)}`
        : "Do not let an attractive interface substitute for a real before/after outcome.",
    ],
    weakestAssumption: {
      assumption: hypothesis,
      fix: `For ${concept.title}, restrict the first version to one known situation and the stated mechanism. Use the five-minute experiment to observe the user's action and current workaround before expanding the scope.`,
      test: "Five-minute falsification test: ask one prospective user about their last relevant situation, show a two-state prototype with a normal and missing-input case, and observe them completing the action without coaching. Continue only if they complete it and name a specific recent situation where it would help. Revise if either is missing. A teammate can serve only as a limited usability proxy; one conversation does not validate demand.",
    },
    experiment: {
      hypothesis,
      steps: [
        `Minute 1: ask a person from the target group (${fragment(brief.targetUser || theme.audience, 200)}) to recount the last time they faced ${fragment(brief.moment || theme.task, 220)}. Record their actual workaround without pitching the idea.`,
        `Minutes 2–3: show two paper or clickable states of ${concept.title}, using one realistic example and one missing-input case. Ask the person to predict what happens next.`,
        "Minute 4: ask them to complete the action without coaching and explain whether it improves their current workaround.",
        "Minute 5: record the behavior and the strongest objection. If only a teammate is available, label this a usability rehearsal and arrange a prospective-user check before claiming demand.",
      ],
      successSignal:
        "Continue to a small prototype if the prospective user completes the action without help and names a specific recent situation where it would help. If either is missing, revise the problem or interaction. One conversation is a directional signal, not validated demand.",
    },
    scope: {
      mustBuild: [
        `One end-to-end mechanism: ${clip(concept.mechanism || concept.pitch, 500)}`,
        "One typed input adapter with normal, changed, and missing-input fixtures clearly labeled.",
        "One visible result with an explanation and a reversible reset.",
      ],
      cut: [
        "Additional user groups and unrelated workflows.",
        "Multiple live integrations before one complete path works.",
        "Background autonomy, account setup, and personalization unless essential to the chosen mechanism.",
        "A polished dashboard or pitch-only features that do not demonstrate the core behavior.",
      ],
    },
    blueprint: {
      signals: [
        ...theme.signals,
        "Freshness timestamp, explicit user consent, and the most recent undo",
      ],
      architecture: prototypeArchitecture(brief, theme),
      timeline: [
        {
          hours: slot(0, 1 / 12),
          task: `Run the five-minute experiment with a prospective user and use the observed action and objection to scope one ${concept.title} behavior. Revise the interaction if the success signal is missing.`,
        },
        {
          hours: slot(1 / 12, 1 / 4),
          task: "Build typed context fixtures, one source adapter, and the decision rule with explicit fallback cases.",
        },
        {
          hours: slot(1 / 4, 1 / 2),
          task: `Implement the visible interaction: ${resultAction}`,
        },
        {
          hours: slot(1 / 2, 3 / 4),
          task: "Connect one real source if time permits; add consent, stale-data handling, and a reversible action log.",
        },
        {
          hours: slot(3 / 4, 1),
          task: "Exercise missing/wrong signals, polish the before/after, and rehearse the exact 60-second demo.",
        },
      ],
      demo: [
        {
          seconds: "0–10s",
          action: `State the pain in one sentence: ${theme.task} currently takes too many disconnected decisions.`,
        },
        {
          seconds: "10–20s",
          action: `Show the starting situation. ${theme.scenario} Clearly label any simulated input.`,
        },
        {
          seconds: "20–35s",
          action: `${resultAction} Keep every prompt and configuration form off the critical path.`,
        },
        {
          seconds: "35–45s",
          action: `Inspect the two signals that drove ${concept.title} and explain why the action is useful.`,
        },
        {
          seconds: "45–60s",
          action:
            "Introduce one wrong or missing signal, show the safe fallback and undo, then end on the visible before/after.",
        },
      ],
    },
  };
}
