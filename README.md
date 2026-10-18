# Offscript

An interactive workshop that helps hackathon teams move from a real frustration to distinct concepts, a team decision, and a testable build plan. Begin with six perspectives from a curated library of 100, collect ingredients, connect and combine ideas, and compare the reasons to build each one.

A new workshop opens on Research, with Briefing one click away. Existing saved workshops are preserved. **Load demo preset** supplies an editable Hacktoberfest example; illustrative demo generation needs no API key. Live generation uses the official Google Gen AI SDK and the exact model `gemini-3.8-flash`.

The product aims to help teams choose a distinctive, testable idea in a short workshop. No measured improvement in creativity, decision speed, or prototype completion is claimed. See [EVALUATION.md](EVALUATION.md) for the trial protocol.

## Run locally with Next.js

Requires Node.js 22.13 or newer and npm or pnpm. From this directory:

```sh
npm install
npm run dev:next
```

Open the URL printed by Next.js, normally `http://localhost:3000`. The same commands work with pnpm:

```sh
pnpm install
pnpm run dev:next
```

For a native Next.js production build:

```sh
npm run build:next
npm run start:next
```

Use **Workshop settings → Demo workshop** to try the complete interaction without external generation. To enable live generation, copy `.env.example` to `.env.local`, replace the placeholder with a Gemini API key, and restart the server:

```dotenv
GEMINI_API_KEY=your_server_side_gemini_api_key
```

Choose **Live Gemini 3.8 Flash** in Workshop settings after restarting. The key stays on the server; never give it a `NEXT_PUBLIC_` prefix. The account must have access to `gemini-3.8-flash`. Provider errors are displayed explicitly; live failures do not silently substitute demo output. No live-provider verification is claimed by this README.

## Sites hosting runtime

The source uses Next.js App Router conventions. The default `dev`, `build`, and `start` scripts serve the Sites-compatible **Vinext / Cloudflare Worker** runtime. The explicit `:next` scripts use native Next.js.

| Command               | Runtime and purpose                                               |
| --------------------- | ----------------------------------------------------------------- |
| `npm run dev:next`    | Native Next.js development                                        |
| `npm run build:next`  | Native Next.js production build                                   |
| `npm run start:next`  | Run that Next.js production build                                 |
| `npm run dev`         | Vinext development; portable preview normally starts on port 5173 |
| `npm run build`       | Build the Sites Worker artifact into `dist/`                      |
| `npm run start`       | Preview the built Worker locally through Wrangler                 |
| `npm run typecheck`   | Check TypeScript                                                  |
| `npm run db:generate` | Generate SQL after a Drizzle schema change                        |

Replace `npm run` with `pnpm run` for pnpm. `npm start` previews a built Worker; it does not publish a site. Managed Sites environments use the included execution-profile scripts and preview supervisor. A local native Next.js server does not require the Sites runtime.

The hosted runtime expects the `DB` D1 binding declared in `.openai/hosting.json` and the included migration in `drizzle/`. Sites publishing applies production database migrations. For a standalone local Worker preview, build first and apply the pending migration once:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_ambiguous_mandarin.sql
npm run start
```

Configure `GEMINI_API_KEY` as a server-side secret in the hosting environment for live hosted generation. A local `.env.local` file does not configure the published site's secrets.

A workshop invitation grants access to a room only after the visitor passes the site's access policy. An owner-private Sites deployment remains owner-private: forwarding the room link cannot let a teammate bypass that restriction. Use a site access policy appropriate for the intended team before testing invitations across accounts.

## Research and coding-agent handoff

**Research** sits above Briefing. Explore the web, past hackathons, or up to five public website URLs. Live research uses Gemini Google Search and URL Context, then extracts source-linked features, the problems they address, and possible adaptations. Search-only sources are labeled separately from retrieved pages. Save up to twelve findings; their sources travel with the brief, concept generation, and build prompt. Public access restrictions and provider limits may prevent retrieval. Research always searches real sources, independently of the workshop generation mode. If Gemini is unavailable, DuckDuckGo public search returns clearly labeled idea leads with source titles, snippets, and URLs. These leads do not claim to have extracted the full page or its mechanism. Older demo results remain labeled as illustrative.

In **Decide & build**, save a team choice, then explicitly confirm the final problem, target user, solution, rationale, and success criteria. Create a detailed prompt for Codex, Claude Code, or any coding agent. It includes MVP scope, non-goals, user flows, screens, architecture, data models, API contracts, integration/mock boundaries, implementation milestones, acceptance criteria, tests, edge cases, accessibility, security, and source references. Copy it or download Markdown. Input changes mark previous prompts as outdated and disable export until regeneration.

Research, final decisions, and prompts persist locally and in shared rooms. Existing workshop stages retain their original indices so older saved workshops remain usable.

## The workshop

1. **Start with the problem.** Enter the challenge, who experiences it, the moment of friction, and today's workaround. Add observations, team skills/time constraints, tracks, and judge context. Capture your own thoughts before AI suggestions if useful; an optional two-minute timer supports an independent first pass. These thoughts are optional and do not gate exploration.
2. **Explore a small set.** The default batch has six perspectives, spread across cognitive families with a mix of simple brief relevance and random discovery. Each lens has an explicit thinking operator and supplies a short provocation, mechanic, and constraint flip. Search, filter, star, and collect 2–6 ingredients. **Explore six more** expands the set when needed; the batch selector also offers 15 perspectives. The underlying 100 is a library, not a scientifically established optimum.
3. **Grow and combine ideas.** Synthesis returns three concepts with explicit mechanisms, reasoned assessments, assumptions, strengths, and risks. Drag cards to arrange them. Draw a line from a bottom dot to another top dot, or click the two dots. Select a manual line and choose **Combine these ideas** to create a child with a contribution attributed to each source. Drawing a line alone does not generate anything. Existing mutation actions, pruning, blind ballots, and reveal remain available.
4. **Compare and choose.** Compare user value, originality, build feasibility, demo clarity, and key uncertainty. Save a team choice, and change it as evidence changes. Assessments explain reasoning; the interface does not present generated percentages as evidence. Older concepts without the new fields show that assessment is still needed.
5. **Test, scope, and build.** Generate a plan for the chosen idea: a five-minute experiment with a hypothesis, concrete steps and an observable success signal; the smallest end-to-end prototype; features to leave out; a build sequence; and a short demo script. The selected plan is saved with the workshop and can be exported as Markdown. It also includes a hypothetical judge reaction and an explicit weakest assumption.

Manual connections are saved locally and shared with the room. Select a manual line and use **Remove connection** or Delete/Backspace to remove it. The connection dots support Enter/Space for keyboard linking. Mutation ancestry remains separate from manually drawn associations, so deleting an association does not remove its ideas or their branch history.

Live perspective calls are initially independent. A conservative lexical similarity check identifies repeated mechanic wording and requests bounded replacements; concept generation also checks for repeated mechanisms and pitches. This is a useful guard against obvious duplication, not a semantic originality detector: paraphrases can evade it, and shared vocabulary can trigger it. Review whether the underlying input, transformation, interaction, and outcome actually differ.

Demo results are illustrative. AI assessments, validation plans, and judge reactions are proposals, not observed user evidence or predictions of competition results. Ideas about calendars, location, weather, and other context signals are proposed prototypes; Offscript itself does not connect to those personal services.

### Optional team trials

The comparison stage includes **Does this process help your team?**, a local trial log. Record real observations for Offscript with six or 15 perspectives, plain ChatGPT, or unaided brainstorming. Enter the brief/team codes, time limit, model and usage budget, anonymized idea summary, observed time to commitment, and prototype outcome. Independent reviewers can use the condition-hidden view to record originality, usefulness, and feasibility ratings; the reviewer must confirm they did not know the method.

The log generates no research results or quality claims. It stores up to 100 user-entered trials in this browser, separately from shared rooms, and exports CSV. The app does not enforce random assignment, model budgets, or reviewer independence. Use [EVALUATION.md](EVALUATION.md) to run a fair comparison and understand the limits of the current logging interface.

## Stack and source map

- Next.js App Router, React, TypeScript, Tailwind CSS, Lucide, and Framer Motion.
- React Flow (`@xyflow/react`) for the interactive concept tree.
- Official `@google/genai` SDK; structured generation uses JSON schemas and server-side validation. Research first retrieves provider-grounded text and citation metadata, then performs schema-validated extraction.
- Drizzle/SQLite schema for hosted Cloudflare D1 room persistence.

| Location                                                         | Responsibility                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `components/workshop.tsx`                                        | Workshop stages, synthesis, combination, saved choice, and build plan |
| `components/idea-tree.tsx`                                       | Concept mechanisms, canvas connections, explicit combination, ballots |
| `components/problem-brief.tsx`                                   | Concrete problem context, independent thoughts, optional timer        |
| `components/research-workbench.tsx`, `lib/research.ts`          | Public-source research, saved findings, citation provenance             |
| `components/decision-handoff.tsx`, `lib/handoff.ts`              | Confirmed final decision and detailed coding-agent prompts               |
| `components/decision-workbench.tsx`                              | Reasoned concept comparison and saved team choice                     |
| `components/evaluation-lab.tsx`, `lib/evaluation.ts`             | Local observed trials, condition-hidden review, and CSV export        |
| `lib/perspectives.ts`                                            | 100 operators, family-balanced brief-aware selection, random draws    |
| `lib/preset.ts`                                                  | Hacktoberfest brief and initial curated ingredients                   |
| `lib/ai.ts`                                                      | Live structured generation and independent explorations               |
| `lib/use-workshop.ts`                                            | Browser persistence, serialized room synchronization, voting          |
| `lib/rooms.ts`                                                   | Room authorization, revisions, private ballots, persistence           |
| `app/api/explore`, `synthesize`, `mutate`, `combine`, `crucible` | Generation Route Handlers                                             |
| `app/api/rooms`                                                  | Shared workshop Route Handlers                                        |
| `db/schema.ts`, `drizzle/`                                       | Hosted room table and migration                                       |

## Storage and collaboration

Personal workshop state is saved in browser `localStorage`. Shared-room membership credentials are stored in tab `sessionStorage`; the invite contains a room capability in the URL fragment. Room invitations allow editing, so share them only with the intended collaborators.

- **Native Next.js:** rooms persist as private JSON files under ignored `.offscript-data/`, with atomic writes and file locks. This is a single-server setup with persistent local disk; separate instances do not share those files.
- **Hosted Sites:** rooms persist in the `DB` D1 database using atomic compare-and-swap updates. Missing hosted storage fails explicitly instead of falling back to ephemeral memory.
- **Local Worker preview:** D1 data lives under ignored `.wrangler/state/`.

Clients poll approximately every 1.5 seconds. Each member has one replaceable Fire/Pass ballot per concept. Blind totals are withheld by the server, not merely hidden with CSS. Member credentials are not exposed to other participants. A room allows up to 32 participants and 150 concepts, within the request-size limit.

Room editing uses a whole-workshop revision. Conflicting simultaneous edits load the server's newer version and show an explicit message; this is not character-level collaborative text editing. Requests are serialized in each tab, and pending local edits are saved before voting or revealing. Leaving a shared room keeps its current content as a local workshop.

The prototype has no room-owner roles, expiring invitations, participant-removal UI, or automatic room deletion. Room membership is separate from the hosting site's authentication and access policy. The workshop stores its brief, ingredients, concepts, manual connections, saved commitment, and selected validation/build plan. Shared rooms synchronize these workshop fields. The optional evaluation trial log is separate browser-local storage; it is never included in a room invitation or room state. Export CSV to keep a copy before clearing browser data. A new generated plan replaces the workshop’s selected plan, so export earlier plans if you need an archive.

## Interface design

The workspace uses warm white surfaces, system typography, blue actions and selection, and a two-column perspective grid at desktop sizes. Phone layouts use a single column and a persistent collection shortcut. The briefing, canvas, evaluation drawer, and dialogs share the same visual system. See `DESIGN.md` for tokens and component guidance and `PRODUCT.md` for product constraints.

## Verification

```sh
npm run typecheck
npm test
# With a local dev server running:
node scripts/smoke-workshop.mjs http://127.0.0.1:5173
node scripts/smoke-rooms.mjs http://127.0.0.1:5173
```

Earlier baseline deliveries recorded successful native Next.js and Sites Worker builds, AI/domain and room privacy/concurrency tests, local generation/room HTTP checks, and desktop/mobile browser checks. Those historical checks predate the current workflow expansion; they are not a claim that the current changes have passed every check. Run the commands above and verify the complete workflow before release.

No live Gemini verification is claimed: no server API key was supplied during the baseline delivery. Demo checks and structured-output tests cannot establish live model quality or creative effectiveness.

Current workflow update verification: native Next.js production build and TypeScript pass; 14 AI/domain tests, file/D1 room persistence tests, trial validation and CSV safety tests pass. Local HTTP checks cover six/15-perspective batches, combination provenance, legacy assessment enrichment, and experiment/scope output. Browser checks cover the grounded brief, optional timer, six-perspective generation, ingredient selection, linking and combining, commitment/plan reload, trial entry and method-hidden review, and responsive layouts at 1440, 664, and 390 pixels. The independent finish review marked the compact comparison correction resolved. Live Gemini network requests remain untested without a server key.
