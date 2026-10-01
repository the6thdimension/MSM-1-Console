# MSM-1 T&E Console

Self-contained Test & Evaluation management tool. Plain HTML/CSS/JS — no build step, no dependencies, no server required.

## Hardening and verification

See [the hardening report](docs/HARDENING.md) for recovery, compatibility and browser requirements. Run `npm test` for core checks, or `npm run test:release` with developer Playwright and Chrome available for the full release gate. Runtime use still requires no installation or server.

## Maintainer documentation

- [Project handbook](docs/PROJECT-HANDBOOK.md) — purpose, source map, data model, workflows, exact status rules, and limitations.
- [Architecture drawings](docs/ARCHITECTURE.md) — runtime, relationships, execution, and offline migration diagrams.
- [Data compatibility contract](docs/DATA-COMPATIBILITY.md) — independent sensitive-data installations, safe upgrades, preservation rules, and release gates.
- [Ten proposed upgrades](docs/UPGRADE-ROADMAP.md) — powerful local-only capabilities and their migration requirements.

Future contributors should also read [AGENTS.md](AGENTS.md). The hardening report identifies implemented compatibility protections; the feature roadmap remains proposed work.

## Launch

**Double-click `index.html`.** That's it. Data persists in your browser's localStorage.

## What's inside

| Area | Model |
|---|---|
| Systems → Components → Subcomponents | Components nest under systems and under each other to any depth; system cards show a status lamp and each component as a status pill (Passing / In Test / Failing / Untested). Cases can also attach to a system directly (system-level cases) |
| Regression | **▶ Full Regression** on a system gathers every active case across its components, subcomponents and system level into its regression plan and opens a test run session. Plans add **Auto-Fill Regression** and **▶ Start Run** |
| Test Run Sessions | Frozen case scope grouped by component in true tree order, completion % and pass/fail/not-run per group, top-level and subcomponent filter pills colored by in-run status, record or execute per case without losing filter or scroll, **▼ Regressed / ▲ Fixed vs the previous run**, complete/reopen, and one-click rerun of failed and open cases |
| Removal Review | **Review for Removal** results nominate a case; its page shows the recommendation with **Keep** or **Retire** dispositions. Retired cases leave regression scope and coverage; the cases list has a review queue |
| Procedures → Test Cases → Test Plans | Procedures own steps + entry/exit criteria and parent their test cases; cases trace to components and requirements and roll into plans; runs record each execution of a case (with measured values and evidence refs) |
| Defects | Bugs against components with severity, a status workflow (Open → In Analysis → Fix In Work → Ready for Retest → Closed), links to the run that found them; open Critical/Major defects mark their component Failing |
| Procedures | Step-by-step execution docs with **entry & exit criteria** (Open → Met → Waived) gating a GO/HOLD readiness indicator |
| Test Plans | Bundle test cases into campaigns with progress rollup from latest run results |
| Test Runs | Execution log (Pass / Fail / Blocked / In Progress / Waived / Review for Removal); recording a run auto-updates case status |
| Requirements | Traced to components, verified by test cases; rollup: Verified / Failing / Covered / No Coverage |
| Trace Matrix | Requirements × test cases grid, columns grouped by system (with per-system coverage %); cells colored by latest run result, uncovered requirements flagged; filter by system or gaps-only |
| Documents | Program document library: link out to files/wikis on your share, or embed small files (≤ 2 MB) directly in the local database; related codes auto-link to any entity |
| Risks | 5×5 likelihood × impact matrix (click a cell to filter) with a mitigation workflow: Proposed → Approved → In Progress → Complete → Verified |
| M&S / VV&A | Register of models, sims, HWIL rigs, referent datasets, and instrumentation. M&S assets track Verification, Validation, and Accreditation (DoDI 5000.61 / MIL-STD-3022) with an artifact checklist; cases using unaccredited assets get a data-credibility caveat |
| Interchange | CSV import/export for **Jira RTM** (requirements + traceability) and **Zephyr** (test cases), plus full-database JSON backup |
| IDSK | Integrated Decision Support Key: program decisions × the measures and test plans that inform them, with per-decision evidence readiness |
| Schedule | Program timeline of test events, reviews, range windows, and decision points — each event tracked by status with a dated notes log |

The DT&E framing (measures, phase criteria, VV&A, venues) follows the DoD T&E Enterprise Guidebook — see [docs/DTE-ALIGNMENT.md](docs/DTE-ALIGNMENT.md).

Everything is deep-linked — every code (SYS-01, TC-003, RSK-001…) is clickable, and URLs are shareable hashes like `#/cases/tc-1`.

## Toolbar (bottom of sidebar)

- **Export** — download the whole database as JSON
- **Import** — restore from an exported JSON file
- **Reset** — restore the demo dataset (truck-in-the-loop sim example)
- **Start Blank Program** (Interchange → Full Database) — wipe everything and name a fresh program for real use (undo-able for 10 s; export first if in doubt)

Press <kbd>/</kbd> to jump to global search, <kbd>Ctrl</kbd>+<kbd>K</kbd> for the command palette (jump to anything or quick-create). Deletes can be undone from the toast for 10 seconds. Each decision has a print-clean **Decision Package** report (⎙ on the decision page). A daily snapshot powers the dashboard progress trend (passing, verified, open defects).

**Jira/Zephyr sync**: requirements, test cases, test plans, and runs carry an editable **Issue Key** (shown as a subtitle on case/plan pages and under run codes in tables); case and plan pages end with an **External Links** panel where you paste full Jira/Zephyr/share URLs for one-click jump-out; set your Jira base URL under Interchange → Sync Settings and every key becomes a link into Jira. Imports match by key first, so CSV round-trips update rather than duplicate. The dashboard's **⎙ Weekly SITREP** prints a program-wide status report; procedures have an inline step editor (add/edit/delete/drag-reorder).

Working the tool day to day: **▶ Execute** on a case runs its procedure step-by-step and captures the run (a Fail offers a pre-filled defect); status badges in the case/defect tables are **click-to-cycle**; the cases list supports **bulk select** (assign to plan / set status); the Schedule page opens with a **campaign Gantt** (plan bars, event diamonds, today line); plan pages show an honest **pace projection**; requirement pages chart **measured-value history** against threshold/objective; and every major entity keeps an automatic **change log**.

## Files

- `index.html` — shell
- `styles.css` — all styling
- `js/seed.js` — demo dataset (MSM-1 Mobile Sentry Module)
- `js/store.js` — localStorage database + relations + rollups
- `js/ui.js` — modal forms, toasts, shared fragments
- `js/views.js` — page renderers + CRUD actions
- `js/regression.js` — test run sessions, full regression, removal review
- `js/guard.js`, `js/fence.js`, `js/commands.js` — validation, write fence, command boundary
- `js/app.js` — hash router + event wiring
