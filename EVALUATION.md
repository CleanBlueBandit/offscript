# Evaluating Offscript with real teams

This is a prospective protocol, not a report of results. Offscript has not yet demonstrated improved creativity, faster decisions, or higher prototype completion. The 100 perspectives are a curated library; neither 100 nor the six-perspective default is an established optimum.

## Questions and outcomes

Test two questions separately:

1. **Does the whole workflow help teams?** Compare Offscript with ordinary ChatGPT brainstorming and unaided brainstorming under a matched brief, team composition, and time limit.
2. **Does a larger perspective set help?** Compare six versus 15 Offscript perspectives while holding the model, generation budget, other features, and time limit constant.

Choose the primary outcome and decision rule before collecting results. A practical primary outcome is the proportion of teams that commit to an idea within the ideation deadline and complete a working prototype within the build deadline. Report both components separately as well. A fast decision that leads to an unusable idea is not success.

Record these secondary outcomes separately; do not compress them into a generated percentage:

| Outcome              | Operational definition                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time to commitment   | Minutes from the agreed brainstorming start to the team's explicit choice. Mark no commitment if the deadline passes.                                       |
| Originality          | Independent rating of how unusual the underlying mechanism is relative to the brief's current workaround and reasonable alternatives.                       |
| Usefulness           | Independent rating of value for the specific user in the stated moment of friction.                                                                         |
| Feasibility          | Independent rating of whether the chosen scope is achievable with the stated skills, tools, and build deadline.                                             |
| Distinct mechanisms  | Number of materially different input/transformation/interaction/outcome combinations among the team's candidate ideas. Different titles alone do not count. |
| Prototype completion | An observer can run one end-to-end path demonstrating the core mechanism by the same deadline. Record which inputs or integrations are mocked.              |
| Resource use         | Exact model/version, calls, retries, tokens or cost where available, ideation time, and any assistance outside the assigned method.                         |

The team is the unit of comparison. Multiple ideas or reviewer ratings from one team are not independent teams.

## Prepare comparable sessions

Use a brief that specifies the target user, the situation, the current workaround, observations available to every team, constraints, and the expected deliverable. Prefer a problem participants do not already have a finished solution for. Give every condition the same evidence and build constraints; Offscript must not receive richer user research than its baselines.

Choose an ideation deadline and a build deadline in advance, such as 20 minutes and a fixed hackathon build window. These are study settings, not product performance claims. Define whether brief-reading and orientation count toward the ideation clock, and apply the same rule to everyone.

Record team size, relevant experience, familiarity with AI tools, stack, and prior exposure to the brief using codes. Match or stratify assignment by these factors where practical. Give everyone comparable orientation to their assigned tool without showing sample ideas that could anchor them.

Randomly assign comparable teams to methods. If each team must try multiple methods, use different but comparable briefs and counterbalance both method order and brief assignment. Reusing the same brief lets teams carry ideas forward and undermines attribution. Keep an external assignment sheet; the current app does not randomize trials.

Freeze the app revision, perspective library, prompt revision, demo/live setting, model version, and allowed external tools for the study. Do not change prompts partway through a comparison without treating the change as a new study version.

## Study A: the whole workflow

Use three conditions: Offscript with six perspectives, plain ChatGPT, and unaided brainstorming. Give teams the same brief, time, final deliverable, and access to non-AI resources. Let each condition use its assigned process naturally, but record rerolls, expansions, combinations, and other deviations.

The plain-ChatGPT baseline should receive the same task information and final-output requirements. Decide beforehand whether its prompt is standardized or team-written. Neither condition should receive unrecorded coaching. Unaided teams can use paper or the same basic shared document; record “No AI” as their model budget.

Match the allowed AI usage budget as closely as the available products permit and record actual use. Offscript currently uses Gemini while plain ChatGPT may use a different model. Such a comparison tests practical product alternatives; any observed difference cannot be attributed solely to the interface or perspectives. If isolating the workflow is necessary, add a separate same-model plain-chat baseline outside the current four-condition logger and retain its results in an external study sheet. Do not label a Gemini baseline as ChatGPT.

Keep demo sessions out of live-creativity effectiveness estimates. Demo sessions can test comprehension, navigation, and whether the procedure is usable, but use authored illustrative content.

## Study B: six versus 15 perspectives

Randomly assign fresh teams or counterbalanced sessions to six or 15 starting perspectives. Keep the brief, live model/version, generation settings, time allowance, synthesis options, and final deliverable fixed. Disable or disallow additional perspective expansion during this comparison; record any exceptions.

Predefine an equal **total generation budget per team**, including exploration, rerolls, duplicate-repair attempts, synthesis, combination, and planning calls. Count input and output tokens or cost consistently; call count alone is misleading when calls differ in size. A larger set must operate within the same total budget. If the provider cannot enforce that cap, audit actual usage and report the imbalance rather than describing the comparison as controlled.

The current UI records a budget description but does not enforce a global token/cost cap. A strictly controlled study therefore needs external request instrumentation and budget enforcement. The default six- and 15-perspective settings make different numbers of generation calls and produce different quantities of text. Running them unchanged tests those bundled experiences, not the isolated causal effect of perspective count.

Record the specific lenses selected for each trial. Repeated trials help distinguish perspective-count effects from a particularly useful or unhelpful draw. Keep the library and selection algorithm fixed. The selection algorithm balances families and mixes keyword relevance with random discovery; it does not prove that the chosen perspectives are maximally different.

## Independent review

Create a standardized summary for each chosen idea: user, moment, mechanism, expected outcome, and minimum build scope. Use a fixed length range and remove tool names, perspective count, team identity, and decorative branding. Preserve substantive differences; do not rewrite weak ideas into stronger ones. Give reviewers the corresponding brief and build constraints separately.

Have reviewers work independently before seeing others' judgments. Randomize the review order. Use at least two independent reviewers when feasible; keep their ratings separate and inspect disagreements. The app stores one blind review per trial, so collect additional reviews in an external sheet keyed by trial ID. Do not duplicate trial rows to represent additional reviewers.

Use the same 1–5 rubric for all ideas:

| Dimension   | 1: low                                                 | 3: moderate                                              | 5: high                                                                               |
| ----------- | ------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Originality | Familiar workaround with renamed presentation          | A meaningful variation or combination                    | A clearly unusual mechanism with a coherent causal explanation                        |
| Usefulness  | Weak connection to the stated friction                 | Plausible benefit with meaningful unresolved assumptions | Direct, substantial benefit for the stated situation, with a credible reason to adopt |
| Feasibility | Essential dependencies or scope exceed the constraints | Core path appears possible after cuts or mocks           | A clear minimum path fits the skills and time, with explicit fallbacks                |

These are human judgments, not verified market novelty, adoption, or technical proof. Collect a short reason and key uncertainty for each rating. Reviewers should disclose if wording reveals the method. The app's condition-hidden view and blindness confirmation support this process but cannot establish independence or prevent someone from returning to the full log.

Count distinct candidate mechanisms separately from final-idea quality. Use a simple coding sheet with input, transformation, interaction, and outcome columns. Have a second person review ambiguous duplicates. Offscript's lexical similarity guard can catch repeated wording; it can miss paraphrased duplicates and flag different ideas with shared vocabulary. Do not use that heuristic as the study's creativity score.

## Record trials in the app

Open **Compare & choose → Does this process help your team? → Record a trial** after an observed session. Enter:

- Method and data source; keep illustrative demo, live generation, and human/manual entries distinct.
- Brief and team codes, time allowance, exact model and usage cap, and a neutral idea summary.
- Observed minutes to commitment, leaving the field blank when no commitment occurred.
- Prototype outcome as pending until checked, then completed or not completed.
- Notes for the build deadline, team experience, selected lenses, distinct-mechanism count, actual resource use, deviations, and an external study-record reference if needed.

Use **Open blind review** only with a reviewer who has not seen the methods. Export CSV after entering the outcomes and review. The log is local browser storage, separate from shared rooms, limited to 100 trials, and does not automatically collect model telemetry or recruit participants. Keep an external archive and assignment sheet. Use codes rather than personal names; explain the study and data use to participants.

## Analyze and decide

Include all assigned teams, including teams that never commit or fail to finish a prototype. Report missing and excluded data with reasons. Do not calculate decision speed only among successful teams without also showing the non-commitment rate. Treat the deadline as a censoring boundary for teams that have not chosen by then.

Report per-condition team counts, completion proportions, time distributions, and each rating dimension. Show uncertainty and the practical size of any difference, not only whether a test crosses a significance threshold. Account for repeated teams/briefs and reviewer differences in a formal analysis. A small pilot is suitable for finding usability problems and checking the protocol; it is not conclusive evidence of a creativity effect. Choose a larger confirmatory sample using the pilot's variance and a prespecified effect worth detecting.

Keep product and perspective-count conclusions separate. Greater idea diversity can coexist with slower decisions or lower feasibility. Prefer a change only when it improves the chosen outcome without an unacceptable tradeoff, and verify that result with a fresh sample before making public effectiveness claims.
