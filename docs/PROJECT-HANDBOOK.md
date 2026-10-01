# MSM-1 T&E Console — project handbook

Original baseline: `f9645ca`. Updated for the hardening pass; see [implementation and checks](HARDENING.md). This is a source-based
handoff for maintainers and future assistants. It describes this repository, not
the contents or modifications of the sensitive user's independent installation.

## 1. Purpose and boundaries

This is a browser-based Test & Evaluation management console. It connects the
question “what must the program demonstrate?” to test procedures, execution
results, defects, risks, resources, schedules, and decision evidence.

The bundled example is the **MSM-1 Virtual Proving Ground**, a simulation and
hardware-in-the-loop test program for a mobile sentry vehicle. The console
manages that program's T&E information; it does not implement the simulation,
control the truck, collect live telemetry, or execute automated hardware tests.
Its entities and blank-program action also support other T&E programs.

Primary users are test engineers, test leads, V&V staff, resource owners, and
program decision makers. These are usage roles, not implemented access roles.
There are no accounts, authentication, shared server, or multiuser synchronization.

The existing [DT&E alignment note](DTE-ALIGNMENT.md) explains the domain rationale.
Its policy references are background documentation, not independently verified
compliance claims made by this handbook.

## 2. Run and operate

Open `index.html` in a browser. There is no package installation, build pipeline,
framework runtime, or application server. The HTML loads local scripts in order.
A release is the whole folder (including `js/pages/`); copy it complete rather than
replacing individual files.
The app retains one active program in browser localStorage. A hash URL identifies
a view and sometimes an entity; it does not transfer the underlying database.

Browser profiles and origins have separate storage. Do not assume a new folder,
browser, profile, or hosting location will find the old database. Preserve an
export before moving to a new release. Browser storage is working storage, not
an independent backup.

All runtime assets are local. Explicit external links can leave the environment; the Content Security Policy blocks background connections. Editing requires Web Locks, IndexedDB, Web Crypto and localStorage. Chrome file launch is tested.

### Typical work cycle

1. Create systems and their components.
2. Define requirements, measures, thresholds, objectives, and component links.
3. Create procedures and entry/exit criteria; create cases linked to procedures,
   components, requirements, and test resources.
4. Group cases into dated test plans; link plans and requirements to decisions.
5. Register events, risks, mitigations, and resource VV&A information.
6. Record a run directly, or open Execute to check procedure steps and capture a
   result, operator, measurements, evidence references, and notes.
7. Investigate failures with linked defects, then record retest results.
8. Review trace coverage, component health, readiness, schedules, and reports.
9. Export the complete JSON database regularly and before changing releases.

`/` focuses search; Ctrl/Cmd+K opens navigation and creation commands. The cases
list supports bulk status/plan actions and a removal review queue. Procedure steps
support drag reordering. Filters live in hash query parameters. Most entity codes
are clickable. Saving or changing status on the current page re-renders in place:
the URL (with its filters) and scroll position are kept, and a result recorded from
a test run brings its row back into view. Navigating to a new page starts at the top.

## 3. Source map and runtime

| File | Responsibilities |
|---|---|
| `index.html` | Sidebar, navigation, view/modal/toast roots, import input, ordered script loading |
| `styles.css` | Dark console appearance, tables, badges, charts, Gantt, responsive and print styles |
| `js/seed.js` | `SEED_DB`: illustrative program used when no saved database is loaded or on reset |
| `js/guard.js` | Candidate normalization and validation, preserving unknown fields |
| `js/fence.js` | Shared IndexedDB fingerprint journal for stale-writer rejection |
| `js/commands.js` | UI command boundary, previews, deferred effects and error handling |
| `js/store.js` | `Store`: persistence, migrations, IDs, CRUD, relationships, derived status, search, audit, undo, snapshots |
| `js/io.js` | `IO`: CSV parser/writer, Jira and Zephyr conversions, browser file downloads |
| `js/ui.js` | Escaping, links, badges, page fragments, schema-driven forms, confirmations, toasts, command palette |
| `js/views.js` | Views core: shared vocabularies, rendering helpers (badges, run dots, pace strip, charts, external-links panel), the `Views` and `Actions` objects, shared actions, owner fields |
| `js/pages/*.js` | One file per page area — `dashboard`, `systems`, `requirements`, `cases`, `procedures`, `plans`, `risks`, `documents`, `defects`, `decisions`, `schedule`, `resources`, `interchange`, `releases` — each holding that area's page renderers, its actions (added with `Object.assign(Actions, …)`) and its form field definitions |
| `js/regression.js` | Test run sessions page, full-system regression, plan Auto-Fill / Start Run, review-for-removal dispositions |
| `js/scope.js` | Scope banner, ownership page (assign program-level records to systems, reviewed suggestions) |
| `js/app.js` | `App`: startup, hash routing, HTML replacement, scroll/anchor preservation, delegated events, file reads, bulk-selection state |

Scripts are classic scripts sharing global bindings, not ES modules. Load order:
seed → guard → fence → store → IO → UI → views → pages/* → regression → scope → commands → app.
Page files only define functions and register them, so their order among themselves
does not matter at load; `index.html` is the single source of the order and the core
test harness reads it from there. A page whose script is missing renders an
"incomplete install" message naming `js/pages/` instead of failing silently.
`regression.js` and `scope.js` add to `Views` and `Actions` before `commands.js`
wraps every action in the command boundary; they do not override or patch
existing functions. The `Scope` object itself lives in `ui.js`. `App.boot()` loads/migrates data, attempts a
daily snapshot, binds events, and renders. `App.render()` routes to a `Views`
function, assigns its HTML to `#view`, and refreshes navigation counts. Clicks
with `data-act` dispatch to `Actions`; forms call Store or mutate records directly.
Most operations save the entire database and then rerender the page.

Commands now surround UI mutations, including direct record edits. The boundary validates and audits the complete difference, saves under the write fence, then releases queued success messages and rendering. Views still contain both display and action logic.

## 4. Data dictionary

Data is one JSON object. Entity IDs are relationship keys; display codes are
human-readable labels. Do not substitute codes for IDs during migration.
Most dates are strings; many descriptive and measurement fields are free text.
The tables below describe the application's known fields, not a strict schema.

| Collection | Important fields and relationships |
|---|---|
| `meta` | `program`, `version` (seed/blank use 2), `seq` counters (plus per-class requirement series `requirements.REQ` / `requirements.PSPEC` / `requirements.SWR`), `jiraBaseUrl` |
| `systems` | `id`, `code`, `name`, `description`, `team`, `lead` |
| *(ownership)* | Optional `systemId` on `requirements`, `procedures`, `plans`, `testRuns`, `risks`, `defects`, `decisions`, `events`, `documents`, `resources`, `releases`, `builds` = owning system; blank or absent = program-level / shared |
| `components` | `id`, `code`, `systemId`, optional `parentComponentId` (subcomponent link, any depth, same system), `name`, `description` |
| `requirements` | `id`, `code`, `title`, `text`, `type`, `priority`, `method`, `measure`, `threshold`, `objective`, `componentIds[]`, `extKey`, optional `reqClass` (`System` / `PSPEC` / `SW`; absent = System), optional `derivedFromIds[]` (parent requirements it flows down from) |
| `procedures` | `id`, `code`, `title`, `description`, `steps[]` of strings |
| `criteria` | `id`, `code`, `parentType` (`procedure`/`plan`), `parentId`, `kind` (`entry`/`exit`), `text`, `status`; old records may have `procedureId` |
| `cases` | `id`, `code`, `componentId` and/or `systemId` (blank component = system-level case), `title`, `objective`, `requirementIds[]`, `procedureId`, `resourceIds[]`, `priority`, `status` (adds `Retired`), `venue`, `testType`, `extKey`, `extLinks[]`, `removalNominated`, `reviewDisposition`, `preconditions`, `testData`, `expectedResults`, `passFailCriteria` |
| `plans` | `id`, `code`, `name`, `description`, `phase`, `status`, `start`, `end`, `caseIds[]`, `decisionId`, `extKey`, `extLinks[]`, optional `regressionSystemId`; old `decision` free text migrates |
| `runs` | `id`, `code`, `caseId`, optional `planId`, optional `testRunId`, optional `buildId` (the build the result was measured on), `date`, `operator`, `result` (adds `Waived`, `Review for Removal`), `measured`, `evidence`, `notes`, `extKey` |
| `testRuns` | `id`, `code`, `name`, `operator`, `status` (free text; app uses Active/Complete/Aborted), `planId`, `systemId`, `componentId` (optional scope root), `caseIds[]` (scope frozen at start), optional `buildId` (build under test), `notes`, `createdAt`, `startedAt`, `completedAt` (date-time text) |
| `releases` | `id`, `code` (REL-##), `systemId` (each system has its own releases), `name`, `status` (Planning / In Test / Release Candidate / Released / Cancelled), `targetDate`, `releasedDate`, optional `decisionId`, optional `fixVersion` (Jira Fix Version), `description` |
| `builds` | `id`, `code` (BLD-###), `systemId` (each system has its own build stream), optional `releaseId` (a release of the same system), `label` (version string), `status` (Received / Smoke Passed / Under Test / Accepted / Rejected / Shipped), `received` date, optional `url` (artifact or CI link), optional `cycle` (Zephyr test cycle), `description` (change notes) |
| `defects` | `id`, `code`, `title`, `description`, `severity`, `status`, `componentId`, `caseIds[]`, `runId`, `owner`, `opened`, `closed`, optional `extLinks[]` |
| `risks` | `id`, `code`, `title`, `description`, `category`, `status`, `owner`, likelihood/impact, initial and residual likelihood/impact, `relatedRequirementIds[]`, `relatedCaseIds[]`, nested `mitigations[]` |
| `resources` | `id`, `code`, `name`, `type`, `description`, `vvaRequired`, `intendedUse`, `owner`, `authority`, `verification`, `validation`, `accreditation`, `accDate`, `accScope`, `artifacts` booleans |
| `decisions` | `id`, `code`, `title`, `description`, `status`, `date`, `authority`, `requirementIds[]` |
| `events` | `id`, `code`, `title`, `description`, `type`, `status`, `start`, `end`, `location`, `planId`, `decisionId`, nested `notes[]` |
| `documents` | `id`, `code`, `title`, `docType`, `description`, `url`, `fileName`, `fileSize`, `fileType`, `dataUrl`, `relatedCodes`, `added` |
| `snapshots` | Daily `date`, `pass`, `fail`, `other`, `verified`, `reqTotal`, `defOpen`; no automatic pruning |
| `audit` | `ts`, `coll`, `entityId`, `code`, `action`, `summary`; no automatic pruning |

Mitigations are embedded in risks (`id`, `text`, `status`, `owner`, `due`). Notes
are embedded in events (`id`, `date`, `text`). External links are embedded objects
with `url` and `label`. Resources' artifact flags are `accPlan`, `vvPlan`,
`vvReport`, `accReport`; these are checkboxes, not verified attached artifacts.

Generated IDs combine a three-letter collection prefix, current timestamp in
base 36, and a sequence number. `nextCode()` peeks at the next counter value and
`nextId()` increments it. Requirement codes instead come from `nextReqCode(class)`:
each class (REQ / PSPEC / SWR) has its own `meta.seq["requirements.<PREFIX>"]`
counter, so adding a PSPEC never skips a System number and a deleted code is not
reissued. The System series starts from the legacy shared counter the first time.
Existing seed IDs use shorter forms such as `tc-1`.
Compatibility must retain both forms and validate counters against actual records.

## 5. Pages and behavior

| Area / hash | What it provides |
|---|---|
| `#/dashboard` | Coverage, verification, results, risks, defects, plan progress, snapshot trends, links to work |
| `#/systems`, `#/components/:id` | System/component/subcomponent tree, derived component health, regression scope panel and ▶ Full Regression; component pages add a component test scope panel, its test history, and ▶ Component Test |
| `#/requirements?class=&q=` | Register in one section per class (System Requirements, PSPECs, SW Requirements) with class tabs and counts, a per-class status bar and add button, rows grouped by owning system, ↑ parent / ↓ derived flow-down chips, text filter. Detail adds a Requirement Flow-Down panel and **+ Derived PSPEC / + Derived SW Req** buttons |
| `#/cases` | Cases as component cards per system in tree order (subcomponent cards indented with a dashed purple rail and level badge; a system-level card per system), filters, bulk changes, review queue; `?view=table` gives the flat table |
| `#/trace?class=` | One requirement-by-case grid per class, each limited to the cases that verify its rows and grouped by system; class, system and gaps filters |
| `#/procedures` | Procedure steps and entry/exit criteria, readiness strip, related cases |
| `#/plans` | Case campaigns, dates, phase criteria, result rollup and pace estimate |
| `#/runs` | Test run sessions, then the execution log with result, operator, measurement, evidence, issue key, session |
| `#/testruns/:id?comp=` | One test run session: completion, per-component groups in tree order, top-level/subcomponent filter pills, vs-previous-run regressions, record/execute per case, complete/reopen/rerun |
| `#/execute/:id?tr=` | Procedure checklist and run capture; with `tr` it records into that test run and returns to it. Fail offers a defect form |
| `#/defects` | Severity, ownership, age, status workflow, component/case/run links; detail page has the same External Links — Jira / Zephyr / Share panel as cases and plans |
| `#/risks` | 5×5 matrix, current/initial/residual risk information and mitigation workflow |
| `#/resources` | Model/simulation/rig/referent register and VV&A tracks, intended use and caveats |
| `#/idsk`, `#/decisions/:id` | Decisions, informing requirements and plans, evidence readiness |
| `#/schedule?zoom=`, `#/events/:id` | Campaign Overview: one row per plan (name and status at left, labeled bar for its window) plus a Program row for events not tied to a plan. Shape encodes event type (● event, ▲ milestone, ◆ decision point), a thin bar marks a multi-day event, green fill = complete, faded = cancelled; milestones and decision points carry visible labels. Zoom: whole program (default), ±90 days around today, or this calendar quarter; bars cut by the window get a dashed edge and items outside are counted. All positions come from one UTC-day scale (`ganttScale`). Below: event timeline with dates/status/location and dated notes |
| `#/documents` | External references and embedded files, related-code links |
| `#/interchange` | CSV conversions, full JSON transfer, Jira URL setting, blank program (always whole-program, regardless of scope) |
| `#/ownership` | Ownership overview per system; program-level records with reviewed owner suggestions; assign selected or accept suggestions |
| `#/releases`, `#/releases/:id`, `#/builds/:id` | Per system: current build, releases (status, target, latest build, decision, Jira Fix Version) and the build stream with how many active cases have a result on each build. A build page shows results on that build, what has not been run on it yet, its change notes, sessions run against it, and links to the newer and older builds. System pages carry a Releases & Builds panel; system cards show the current build |
| `#/sitrep`, `#/decisions/:id/report` | Print-oriented weekly program and decision package reports |
| `#/search?q=...` | Case-insensitive substring search across configured fields, capped at 40 hits |

### Exact rules that affect interpretation

- Latest run is selected by descending lexical `date`, across all plans. Same-day
  runs use descending recordedAt and then numeric-aware ID as a deterministic tie-breaker. New runs capture recordedAt; historical timestamps are not invented. Plan counts therefore can use a
  case result recorded under a different plan.
- Requirement: Retired cases are ignored. No linked cases → uncovered; any latest
  Fail → failing; all latest Pass → verified; otherwise covered. **Waived is not a
  verified pass**: a waived case keeps its requirement at covered. Measurements,
  open defects, accreditation, and freshness do not independently veto this rollup.
- Component: Retired cases are ignored. A latest Fail or an open Critical/Major
  defect → Failing; every case's latest result is Pass, Waived or Review for
  Removal → Passing (health, not verification); any run → In Test; otherwise
  Untested. Subcomponents are separate components; a parent's status covers only
  its own cases. `Store.componentStatusDetail` returns the status with the records
  that decided it (failed cases, blocking defects, unrun or unsettled cases); case
  cards and component pages print that reason line and system-card pills show it
  as a tooltip, so the label and its explanation come from one rule. System health propagates failures and only reads Passing when
  every component passes.
- Regression scope for a system: every non-Retired case owned by any of its
  components (all subcomponent depths) plus its system-level cases. Full
  Regression reuses the plan whose `regressionSystemId` is that system (else a
  phase-`Regression` plan whose name contains the system name), creates one
  otherwise, adds missing scope cases without removing others, and starts a test
  run with the scope frozen into `caseIds`.
- Test run results: a case's result in a session is its latest run carrying that
  `testRunId`. Completion counts Pass, Fail, Waived and Review for Removal as final;
  Blocked and In Progress are not. "vs Previous" compares with the latest earlier
  session of the same plan, else of the same component scope, else of the same
  system (by `startedAt`/`createdAt`).
- Component test: a session with `componentId` set to the component, scoped to every
  non-Retired case on that component and all of its subcomponents. The component
  filter on the cases page also includes subcomponent cases.
- Review for Removal sets `removalNominated` and a `reviewDisposition` only when a
  run *newly* takes that result, so editing other run fields never re-raises a
  nomination the user already resolved. Keep clears it (case → Ready); Retire sets
  `Retired` and can remove the case from plans. Run changes never alter a Retired
  case's status. Status cycling skips Retired.
- System scope (sidebar switcher): a per-browser view preference stored under
  `msm1-te-scope`, never in the program database or exports. In a system, lists,
  matrices, IDSK, schedule, dashboard, SITREP and sidebar counts show records owned
  by that system, plus program-level records when "include program-level items" is
  on. **Scope filters what is listed, never what is computed**: requirement
  verification, component health, decision readiness and test-run results always
  use all evidence regardless of system. Snapshot trends stay program-wide (labeled
  so). Detail pages, search and form option lists are unscoped so cross-system
  links remain possible; chips owned by another system show a ↗ marker.
- Ownership: components, cases, runs and criteria derive their system from their
  parent; plans fall back to `regressionSystemId`; defects follow their component.
  Others use explicit `systemId`. Records created while scoped default to that
  system. Deleting a system makes the records it owned program-level instead of
  deleting them. Ownership suggestions appear only when every link of a record
  points to exactly one system and are applied only on confirmation.
- Component hierarchy: a parent must exist and cycles are rejected at validation.
  A parent in another system is displayed as a root rather than rejected. Deleting
  a component moves its children up to its parent; moving a component to another
  system moves its whole subtree.
- Requirement classes: a class only groups and numbers requirements; every class
  uses the same verification rollup and trace rules. Reclassifying keeps the code.
  Flow-down (`derivedFromIds`) is informational: a parent's status is never derived
  from its children. Self-derivation is rejected; deleting a parent removes the
  link from its children without deleting them.
- Builds: each system has its own build stream and its own releases; a build's
  release must belong to the same system. A system's **current build** is its newest
  build with status Under Test, else its newest build that was not Rejected — derived
  from the build records, not a per-browser setting. New runs, Execute and new test
  run sessions default to it (a run recorded inside a session defaults to the
  session's build); the field can be changed or cleared. **An older-build result
  still counts**: requirement and component rollups ignore builds entirely. Each
  result is labeled with how many non-rejected builds of its system arrived after the
  build it was measured on ("2 builds old"). Results with no build show "build not
  recorded" once the system has builds; nothing is shown for systems without builds,
  and old results are never assigned a build automatically. Deleting a build keeps its
  results (they lose only the build link); deleting a release keeps its builds.
- Closed and Deferred defects are excluded from the “open” calculation.
- Decision readiness is the percentage of linked requirements currently verified;
  no linked requirements returns no readiness value. It is not an approval gate.
- A case's VV&A caveat lists required resources whose accreditation is neither
  Accredited nor Conditionally Accredited. Scope suitability is not evaluated.
- Risk score is likelihood × impact: 1–4 low, 5–9 moderate, 10–16 high, 17–25
  critical. Residual values are targets; mitigation completion does not calculate
  a new likelihood or impact automatically.
- New runs map Pass and Waived → case Complete; Fail/In Progress → case In
  Progress; Blocked → case Blocked; Review for Removal → case Draft. Run creation, editing, reassignment and deletion recompute affected case lifecycle states. Deleting the final run sets Draft. Imports retain historical lifecycle fields.
- GO/HOLD is an indicator. Execution can still save with open criteria or
  unchecked steps. Unchecked step numbers are appended to notes. Checklist state
  is not a durable, resumable execution record.
- Numeric charts parse the first number from free text. Multiple measurements,
  units, ranges, and statistics are not represented as structured measurement data.
- Pace estimates extrapolate passing cases over elapsed time since plan start;
  they are not dependency/resource-aware scheduling forecasts.
- Snapshots capture the first startup snapshot for a UTC date, not end-of-day
  totals. New audit timestamps have full precision with structured changes; old entries are retained.

## 6. Persistence, interchange, and recovery

The active key remains msm1-te-db-v1 and the recognized legacy key msm4-te-db-v1
is retained. Startup normalizes a copy and never substitutes seed data for an
unreadable saved database. DataGuard adds absent defaults, retains legacy text,
checks references/counters, and rejects unsupported input.

JSON import previews a validated replacement. CSV imports are staged before
confirmation. Commands use Web Locks and an IndexedDB fingerprint journal,
preserve a recovery copy, write once and verify persistence. Success UI runs after
commit. Failed forms remain open and the candidate can be exported. See
[Hardening](HARDENING.md) for cross-storage crash-recovery limits.

Full JSON contains records, unknown fields, audit, snapshots and embedded files.
External references are not copied files. CSV covers selected fields: Jira matches
key, code then title; a new Jira row whose summary starts with a `PSPEC-` or
`SWR-` code joins that class and keeps the code. RTM export adds the class as a
label; the traceability CSV appends `Requirement Class` and `Derived From` columns
after the existing ones. Zephyr matches key then TC label. Ambiguous matches stop and
absent columns preserve existing fields. CSV does not reconstruct every trace
label or replace existing procedure steps.

Embedded documents retain the 2 MiB upload cap, but total available quota depends
on the browser, whole database and recovery copy. The storage estimate is
serialized character length, not exact disk bytes. Audit and snapshots no longer
prune automatically. Keep independent JSON backups.

Deletion, blank creation, reset and import checkpoint in-memory state. Supported
Undo actions last ten seconds; at most five checkpoints remain, and they do not
survive reload. Cascades clean references from defects to removed runs. Undo
maintains audit history. The recovery key rotates on subsequent saves.

## 7. Remaining engineering limits

- Browser storage is finite and can be cleared. Recovery copies consume quota;
  full-database serialization is still used.
- Old releases/private writers do not honor the write journal. Close them while
  editing. Interrupted cross-storage writes fail closed and may require an
  isolated-profile restore.
- Unknown private schema changes are not certified. Incompatible input is retained
  and rejected for explicit local investigation.
- Local audit is not authenticated or tamper-proof; data/exports are not encrypted.
- Free-text measurements, advisory GO/HOLD, current-state readiness and broad
  cross-plan rollups retain the limits described above.
- Automated checks cover synthetic inputs and Chrome, not a private installation
  or actual power failure.

## 8. How to make future changes

Read [Data compatibility](DATA-COMPATIBILITY.md) first. Add fields without erasing
old values, keep identities stable, migrate copies before activation, and use
synthetic old-format fixtures. Keep renderers separate from migration logic.
For new entities, consider codes, counters, defaults, forms, routes, search,
navigation, reference validation/deletion, exports, and reports together.

The [architecture document](ARCHITECTURE.md) draws current and proposed flows.
The [upgrade roadmap](UPGRADE-ROADMAP.md) prioritizes ten self-contained upgrades.
Neither document means the proposed functionality has already been implemented.

## 9. Verification

Run npm test for synthetic compatibility, validation, persistence-failure,
reference cleanup, status, CSV, safe-link and rendering checks. Run
npm run test:browser with developer Playwright available for actual offline
Chrome file launch and UI workflows. npm run test:release requires both.
[Hardening](HARDENING.md) describes setup, coverage and limitations. No private
user data is included in fixtures or required for these checks.
