# Architecture drawings — MSM-1 T&E Console

Original baseline: `f9645ca`, updated for the hardening pass. Diagrams 1–4 show the current system. Diagram 5 shows the implemented staged-import path; richer versioned packages remain proposed. Mermaid source is embedded for maintenance and
renders in supporting Markdown viewers; no hosted diagram service is required.

## 1. System context and sensitive-data boundary

```mermaid
flowchart LR
  Dev[Developer repository] -->|Application files only| Release[Release folder]
  subgraph Local[User-controlled environment]
    Release --> Browser[Browser console]
    User[Test engineer or program lead] --> Browser
    Browser <-->|JSON string| LS[(Browser localStorage)]
    Browser -->|Full JSON export| Backup[User-owned backup file]
    Backup -->|Replace database import| Browser
    CSV[Jira or Zephyr CSV file] <-->|Partial interchange| Browser
    Browser -->|Print| Report[Local report or PDF via print]
    Evidence[Embedded document content] <-->|Data URLs in database| Browser
  end
  Browser -.->|User opens a reference| External[Jira, wiki, or program share]
```

No implemented data synchronization path leads from the user environment to the
repository. Browser storage and exported JSON belong to the user. All runtime assets are local and background connections are blocked by the Content Security Policy.
Linked evidence requires separate access; a reference is not a copied file.

## 2. Runtime modules

```mermaid
flowchart TD
  HTML[index.html: shell and script order] --> Boot[app.js: App.boot]
  CSS[styles.css] --> HTML
  Boot --> Load[store.js: Store.load and migrate]
  Seed[seed.js: SEED_DB] -->|Initial or reset data| Load
  Load --> Guard[guard.js: normalize and validate copy]
  Load --> Storage[(localStorage: active and recovery)]
  Boot --> Router[app.js: hash router and event delegation]
  Router -->|Select view| Views[views.js core + pages/*.js: Views]
  Regression[regression.js: test runs and regression flows] -->|Adds Views and Actions at load| Views
  ScopeMod[scope.js: scope banner and ownership page] -->|Adds Views and Actions at load| Views
  Views -->|Scope.list filters lists by owning system| Store
  ScopePref[(localStorage: msm1-te-scope view preference)] <--> Views
  Views -->|Relations and rollups| Store[store.js: Store]
  Views --> UI[ui.js: HTML fragments and badges]
  Views --> DOM[View HTML in DOM]
  DOM -->|data-act / form events| Router
  Router --> Actions[pages/*.js: Actions and forms]
  Actions --> Modal[ui.js: Modal and Toast]
  Modal -->|Submitted values| Actions
  Actions --> Commands[commands.js: UI boundary]
  Commands -->|Validated and audited command| Store
  Store --> Fence[fence.js: shared fingerprint journal]
  Fence <--> Journal[(IndexedDB fingerprint)]
  Store -->|form saved after another tab saved| Merge[merge.js: three-way merge]
  Storage -->|storage event: another tab saved| Boot
  Actions --> IO[io.js: CSV conversion and downloads]
  IO --> Store
  Store <--> Storage
  Router -->|FileReader import candidate| Commands
```

Several tabs share the one localStorage database. A save in any tab fires a
`storage` event in the others, which catch up in place (`Store.syncFromStorage`) and
redraw. Each save waits inside the Web Lock until the tab sees the last committed
write (`WriteFence.settle`), catches up, then applies its change; a form that opened
before another tab's save is merged three ways (`Merge.db`), and a field both tabs
changed is returned to the form as a conflict to decide.

All scripts share global bindings. This is a conceptual responsibility diagram;
`Load` and `Store` are methods of the same Store object. Actions also use shared UI
helpers and trigger `App.render()`. Full-page HTML regeneration is the main update
mechanism; there is no virtual DOM or backend.

## 3. Logical data relationships

```mermaid
erDiagram
  SYSTEM ||--o{ COMPONENT : contains
  COMPONENT o|--o{ COMPONENT : parent_of
  COMPONENT o|--o{ CASE : owns
  SYSTEM o|--o{ CASE : owns_system_level
  COMPONENT }o--o{ REQUIREMENT : traced_by
  REQUIREMENT }o--o{ REQUIREMENT : derived_from
  PROCEDURE o|--o{ CASE : supplies_steps
  PROCEDURE ||--o{ CRITERION : has
  PLAN ||--o{ CRITERION : has
  CASE }o--o{ REQUIREMENT : verifies
  CASE }o--o{ RESOURCE : uses
  PLAN }o--o{ CASE : includes
  CASE ||--o{ RUN : executed_as
  PLAN o|--o{ RUN : optionally_recorded_under
  PLAN o|--o{ TEST_RUN : run_as
  SYSTEM o|--o{ TEST_RUN : regressed_by
  TEST_RUN }o--o{ CASE : freezes_scope_of
  TEST_RUN o|--o{ RUN : groups_results
  SYSTEM o|--o{ RELEASE : tracks
  SYSTEM o|--o{ BUILD : build_stream
  RELEASE o|--o{ BUILD : contains
  BUILD o|--o{ RUN : measured_on
  BUILD o|--o{ TEST_RUN : under_test
  BUILD o|--o{ DEFECT : found_fixed_verified_in
  RELEASE ||--o{ CRITERION : exit_criteria
  COMPONENT o|--o{ DEFECT : affected_by
  CASE }o--o{ DEFECT : linked_to
  RUN o|--o{ DEFECT : discovery_run
  RISK }o--o{ CASE : concerns
  RISK }o--o{ REQUIREMENT : threatens
  RISK ||--o{ MITIGATION : embeds
  DECISION }o--o{ REQUIREMENT : informed_by
  DECISION o|--o{ PLAN : supported_by
  DECISION o|--o{ EVENT : scheduled_as
  PLAN o|--o{ EVENT : scheduled_by
  EVENT ||--o{ NOTE : embeds
```

This is the intended logical model; the current store does not enforce all
cardinalities. A case belongs to a component (whose system it inherits) or, with
no component, directly to a system. Components nest through `parentComponentId`;
cycles are rejected. Requirements carry an optional class (System, PSPEC, SW) and
may flow down from parents through `derivedFromIds`; the trace matrix draws one grid
per class. Flow-down never feeds the verification rollup. A test run session stores its frozen case list; each case's
result in it is an ordinary run carrying `testRunId`, so per-case history and
every existing rollup keep working unchanged. Each system has its own releases and
build stream; a run optionally records the build it was measured on (`buildId`).
Builds label results with their age but never change a rollup. Requirements, procedures, plans,
test runs, risks, defects, decisions, events, documents and resources may carry an
owning `systemId`; blank means program-level. Ownership drives only which records
the system scope lists, never relationships or computed status. Each criterion belongs to a procedure **or** a plan through
`parentType` + `parentId`, not both. Many-to-many links use ID arrays, not join
tables. Mitigations and event notes are nested records. Documents use free-text
`relatedCodes`, while evidence references on runs are also text; neither is an
enforced foreign-key relationship. Audit and snapshots sit beside the graph.

## 4. Execution and derived evidence

```mermaid
sequenceDiagram
  actor Engineer
  participant App
  participant Views
  participant Store
  participant Fence as IndexedDB write fence
  participant Disk as localStorage
  Engineer->>App: Open execute/case-id
  App->>Views: Render procedure, criteria, checklist
  Views->>Store: Read linked records
  Views-->>Engineer: GO/HOLD indicator and capture form
  Engineer->>App: Check steps and save result
  App->>Store: Command: add run and reconcile case status
  Store->>Store: Validate candidate and audit differences
  Store->>Fence: Check expected database fingerprint
  Store->>Disk: Preserve and verify recovery copy
  Store->>Disk: Write full candidate once and verify
  Store->>Fence: Commit new fingerprint
  Fence-->>Store: Journal transaction completed
  App->>Views: Render case detail
  Views->>Store: Read latest run and relationships
  opt Result is Fail in Execute flow
    App-->>Engineer: Offer prefilled defect form
  end
```

The run and case change share one active-database write, guarded by Web Locks and the fingerprint journal. UI success is released after verification and journal completion. The two storage engines are not one atomic transaction: a crash between them can require fail-closed recovery, as described in [Hardening](HARDENING.md). Checklist progress is transient and HOLD remains advisory.

```mermaid
flowchart LR
  Runs[Latest run per case by date] --> Req[Requirement rollup]
  Runs --> Plan[Plan counts across included cases]
  Runs --> Comp[Component status]
  Def[Open Critical or Major defect] --> Comp
  Comp --> Sys[System status]
  Req --> Dec[Decision verified percentage]
  Res[Resource accreditation state] --> Caveat[Case credibility caveat]
  Req --> Reports[Dashboard and reports]
  Plan --> Reports
  Dec --> Reports
  Caveat --> Reports
```

Caveats do not currently veto requirement verification or decision percentages.
Plan counts are not filtered by the run's plan. These distinctions explain why
stronger evidence qualification is proposed in the roadmap.

## 5. Release and staged-import architecture

The user's data never needs to reach the developer. Current JSON and CSV imports use staged validation and preview. Richer versioned package manifests and a general historical migration registry remain future work.

```mermaid
flowchart TD
  Repo[Repository: code and synthetic fixtures] --> Package[Offline application release]
  Package --> NewApp[New app in isolated user environment]
  OldApp[User's old installation] --> Original[User-retained original export]
  Original --> Detect[Identify format and validate]
  Detect --> Copy[Normalize supported legacy shapes on a copy]
  Copy --> Verify[Validate identities, links, types and embedded content]
  Verify --> Preview[Local migration preview]
  Preview --> Commit[Commit and read-back verification]
  Commit --> NewApp
  Commit --> Receipt[Replacement audit receipt and exportable database]
  Detect -->|Unsupported or malformed| Stop[Stop without changing original]
  Verify -->|Validation failed| Stop
  Commit -->|Persistence failed| Recovery[Keep or restore prior active database]
  Original --> Recovery
```

Current boundaries: Views → UI commands → Store validation/audit → write fence and localStorage. Migration operates on staged data; evidence payloads remain embedded in the JSON database. No server or cloud
component is needed. [Compatibility contract](DATA-COMPATIBILITY.md) defines the
acceptance tests and rollback requirements.
