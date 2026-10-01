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
list supports bulk status/plan actions. Procedure steps support drag reordering.
Filters live in hash query parameters. Most entity codes are clickable.

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
| `js/views.js` | `Views`, `Actions`, field definitions, execution flow, reports, charts, document management |
| `js/app.js` | `App`: startup, hash routing, HTML replacement, delegated events, file reads, bulk-selection state |

Scripts are classic scripts sharing global bindings, not ES modules. Load order:
seed → guard → fence → store → IO → UI → views → commands → app. `App.boot()` loads/migrates data, attempts a
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
| `meta` | `program`, `version` (seed/blank use 2), `seq` counters, `jiraBaseUrl` |
| `systems` | `id`, `code`, `name`, `description` |
| `components` | `id`, `code`, `systemId`, `name`, `description` |
| `requirements` | `id`, `code`, `title`, `text`, `type`, `priority`, `method`, `measure`, `threshold`, `objective`, `componentIds[]`, `extKey` |
| `procedures` | `id`, `code`, `title`, `description`, `steps[]` of strings |
| `criteria` | `id`, `code`, `parentType` (`procedure`/`plan`), `parentId`, `kind` (`entry`/`exit`), `text`, `status`; old records may have `procedureId` |
| `cases` | `id`, `code`, `componentId`, `title`, `objective`, `requirementIds[]`, `procedureId`, `resourceIds[]`, `priority`, `status`, `venue`, `testType`, `extKey`, `extLinks[]` |
| `plans` | `id`, `code`, `name`, `description`, `phase`, `status`, `start`, `end`, `caseIds[]`, `decisionId`, `extKey`, `extLinks[]`; old `decision` free text migrates |
| `runs` | `id`, `code`, `caseId`, optional `planId`, `date`, `operator`, `result`, `measured`, `evidence`, `notes`, `extKey` |
| `defects` | `id`, `code`, `title`, `description`, `severity`, `status`, `componentId`, `caseIds[]`, `runId`, `owner`, `opened`, `closed` |
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
`nextId()` increments it. Existing seed IDs use shorter forms such as `tc-1`.
Compatibility must retain both forms and validate counters against actual records.

## 5. Pages and behavior

| Area / hash | What it provides |
|---|---|
| `#/dashboard` | Coverage, verification, results, risks, defects, plan progress, snapshot trends, links to work |
| `#/systems`, `#/components/:id` | System/component hierarchy and derived component test health |
| `#/requirements` | Requirement register, component trace, verification rollup, measured-value history |
| `#/cases` | Filterable cases, bulk changes, linked procedure/requirements/resources, runs and defects |
| `#/trace` | Requirement-by-case matrix grouped by system, coverage and gaps filters |
| `#/procedures` | Procedure steps and entry/exit criteria, readiness strip, related cases |
| `#/plans` | Case campaigns, dates, phase criteria, result rollup and pace estimate |
| `#/runs` | Execution log with result, operator, measurement, evidence, issue key |
| `#/execute/:id` | Procedure checklist and run capture; Fail offers a defect form |
| `#/defects` | Severity, ownership, age, status workflow, component/case/run links |
| `#/risks` | 5×5 matrix, current/initial/residual risk information and mitigation workflow |
| `#/resources` | Model/simulation/rig/referent register and VV&A tracks, intended use and caveats |
| `#/idsk`, `#/decisions/:id` | Decisions, informing requirements and plans, evidence readiness |
| `#/schedule`, `#/events/:id` | Campaign Gantt, event dates/status/location and dated notes |
| `#/documents` | External references and embedded files, related-code links |
| `#/interchange` | CSV conversions, full JSON transfer, Jira URL setting, blank program |
| `#/sitrep`, `#/decisions/:id/report` | Print-oriented weekly program and decision package reports |
| `#/search?q=...` | Case-insensitive substring search across configured fields, capped at 40 hits |

### Exact rules that affect interpretation

- Latest run is selected by descending lexical `date`, across all plans. Same-day
  runs use descending recordedAt and then numeric-aware ID as a deterministic tie-breaker. New runs capture recordedAt; historical timestamps are not invented. Plan counts therefore can use a
  case result recorded under a different plan.
- Requirement: no linked cases → uncovered; any latest Fail → failing; all latest
  Pass → verified; otherwise covered. Measurements, open defects, accreditation,
  and freshness do not independently veto this rollup.
- Component: a latest Fail or an open Critical/Major defect → Failing; all cases
  have latest Pass → Passing; any run → In Test; otherwise Untested. System health
  propagates failures and only reads Passing when every component passes.
- Closed and Deferred defects are excluded from the “open” calculation.
- Decision readiness is the percentage of linked requirements currently verified;
  no linked requirements returns no readiness value. It is not an approval gate.
- A case's VV&A caveat lists required resources whose accreditation is neither
  Accredited nor Conditionally Accredited. Scope suitability is not evaluated.
- Risk score is likelihood × impact: 1–4 low, 5–9 moderate, 10–16 high, 17–25
  critical. Residual values are targets; mitigation completion does not calculate
  a new likelihood or impact automatically.
- New runs map Pass → case Complete; Fail/In Progress → case In Progress;
  Blocked → case Blocked. Run creation, editing, reassignment and deletion recompute affected case lifecycle states. Deleting the final run sets Draft. Imports retain historical lifecycle fields.
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
key, code then title; Zephyr matches key then TC label. Ambiguous matches stop and
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
