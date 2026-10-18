# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Hackathon teams developing and evaluating ideas, together or in a personal workshop.

## Product Purpose

Offscript helps a team turn an observed frustration into distinct candidate concepts, a saved team decision, and a testable build plan. The workflow moves through a concrete problem brief, independent perspectives, a branching idea canvas, reasoned comparison, and a small validation experiment before building.

The intended outcome is a distinctive idea the team can test and build within its actual constraints. Faster decisions, greater creativity, and better prototype completion are hypotheses to evaluate, not established product results.

## Positioning

Start with six cognitive perspectives from a curated library of 100. Selection spreads the batch across six families and mixes simple keyword relevance with random discovery; users can explore six more or choose a 15-perspective batch. Each lens supplies an explicit thinking operator and small ingredients to combine. The number 100 describes library breadth; it is not a validated threshold for creativity.

Live explorations begin independently so one perspective does not see another's first response. Conservative lexical checks request replacements for obvious repeated mechanics and reject overly similar generated concepts. These checks do not measure semantic originality or guarantee distinct ideas.

## Operating Context

The React and TypeScript application follows Next.js App Router conventions. It supports native Next.js and a Sites-compatible Vinext/Cloudflare runtime. React Flow provides the draggable idea canvas.

New workshops start on Research, with Briefing immediately available; existing saved workshops retain their current page and ideas. Research explores the web, past hackathons, or up to five public URLs using Gemini Search and URL Context. Findings separate source-reported features from proposed adaptations. Teams can save up to twelve findings with their source links and use a reported problem to start a brief. Research is inspiration, not validated user evidence. Research always requests real public sources, independently of the workshop generation mode. If Gemini is unavailable, a public search fallback returns linked idea leads and original search snippets, clearly distinguished from extracted features. Older demo findings remain labeled and have no verified sources.

In Briefing, users describe who experiences the problem, the moment of friction, the current workaround, observations, and constraints. Optional own thoughts and a two-minute timer encourage an independent first pass before AI suggestions. An editable Hacktoberfest preset supports trying the product.

Users filter and search perspectives, collect 2–6 ingredients, synthesize three concepts, grow or prune branches, connect ideas, and vote. Selecting a manual connection exposes an explicit combination action; its child records what each source contributes. Drawing a line alone is an association and does not generate a concept. Manual connections remain separate from mutation ancestry.

New concepts explain their unusual mechanism, assumptions, and reasons for user value, originality, build feasibility, and demo clarity. The comparison stage saves a team choice. A generated plan provides a five-minute hypothesis/steps/success signal, minimum prototype scope, features to cut, a build sequence, and a demo script. The selected plan is persisted with the workshop and exportable as Markdown. Older concepts without assessment fields remain readable and are marked as needing assessment.

Shared workshop rooms support invitations, saved choices/plans, and blind Fire/Pass ballots with an explicit reveal step. Personal state is retained in browser storage. The optional trial log is local to the browser, separate from room state, and exports observed outcomes and independent ratings as CSV.

After choosing a concept, the team confirms the final problem, target user, solution, rationale, and success criteria. A detailed prompt for Codex, Claude Code, or another coding agent preserves that wording and includes scope, user journeys, architecture, data/API contracts, milestones, tests, source provenance, and explicit mock boundaries. Copy and Markdown export require a current prompt; changing the brief, sources, choice, plan, decision, mode, or target agent requires regeneration. Research and handoff state persist locally and in shared rooms.

## Capabilities and Constraints

- An editable Hacktoberfest preset and illustrative demo generation work without an API key.
- Live generation requires a server-side Gemini API key. Provider errors are explicit; live errors do not silently become demo results.
- Research can only inspect public pages available to the provider. Login-only, blocked, or unsupported pages return explicit limitations. Search result evidence is distinguished from retrieved page content.
- Assessments explain reasons and uncertainty. Generated percentage scores are not displayed as evidence or used to claim creative effectiveness.
- Judge reactions are hypothetical. A generated test plan is not evidence that a user need has been validated, and a build plan does not mean its integrations have been implemented.
- The 100 perspectives, six-perspective default, and lexical duplication guard are design choices whose effects still need testing.
- The optional evaluation log contains user-entered trials, never fabricated results. Its condition-hidden review view does not independently verify that a reviewer was blind. Random assignment, usage caps, multiple independent reviewers, and formal analysis require an external study process; EVALUATION.md describes one.
- Shared rooms use whole-workshop revision-based synchronization rather than character-level collaborative editing. The prototype has no owner roles, expiring invitations, or participant-removal interface.
- Personal-service concepts do not mean Offscript connects to calendars, location, weather, or other personal services.
- Hosting access policy and workshop invitation access are separate. A room invitation cannot bypass a private site's access policy.

## Brand Commitments

Keep the Offscript name. The user explicitly selected: “Light Apple-style workspace — warm white, generous spacing, restrained color.” The implemented visual system is recorded in DESIGN.md. Operate as a calm workspace: make the next useful action, the idea's mechanism, and the limits of its evidence easy to understand.

## Evidence on Hand

README.md documents the workflow, runtime, storage, and limitations. EVALUATION.md provides a prospective trial protocol. `lib/perspectives.ts` contains the 100 operators; `lib/preset.ts` supplies the optional preset. Product behavior lives in the workshop, idea tree, problem brief, decision workbench, and evaluation lab components.

Demo content is illustrative. No customer results, testimonials, measured creativity gains, or competition-outcome claims have been established. Browser, domain, and build verification assess implementation behavior; they do not validate product effectiveness.

## Workshop Goal

Aim to help a team choose a distinctive, testable idea in about 20 minutes. This is a product target to evaluate, not an established performance claim. EVALUATION.md defines the study protocol; the optional trial log records actual outcomes.
