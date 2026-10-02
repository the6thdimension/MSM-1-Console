# MSM-1 T&E Console — Handoff

> Last updated: 2026-10-01. Pushed through `b904192`; multi-tab work, folder backups and
> the evidence folder are in the working tree, not yet committed.
> The one document to read when picking this project back up, for a person or an
> AI session. Plain language first, detail after, glossary at the bottom.
> This file records state and lessons. How the app works is in
> [docs/PROJECT-HANDBOOK.md](docs/PROJECT-HANDBOOK.md); proposals are in
> [docs/UPGRADE-ROADMAP.md](docs/UPGRADE-ROADMAP.md).

---

## 1. What this project is

A test and evaluation (T&E) console for a simulation program. You keep systems,
components, requirements, test cases, procedures, plans, runs, defects, risks,
decisions, schedule and documents in one place. It shows what is verified, what is
failing, and what a release still needs.

- **It runs by double-clicking `index.html`.** Plain JavaScript and CSS, no build
  step, no server, no network. Data lives in the browser (localStorage).
- **Someone else runs an independent copy with sensitive data.** That copy can
  never sync with this repository. Every release has to import their JSON backup
  on their machine, offline, without losing or renumbering anything. This is the
  rule that shapes every storage decision; read [AGENTS.md](AGENTS.md).
- **The demo program** in `js/seed.js` is "VANGUARD RIDGE", a made-up MILSIM
  training suite with three systems: a Desktop Tactical Trainer, Shared Simulation
  Services, and an Immersive Virtual Trainer. It is for hand testing only;
  [docs/DEMO-GUIDE.md](docs/DEMO-GUIDE.md) maps the scenarios in it.

## 2. Hard-won findings (do not re-learn these)

1. **Old exports from the independent copy import cleanly.** Checked 2026-10-01 with
   synthetic data built from that copy's schema screenshots (same 18 top-level keys,
   same field names and types, invented values). Nothing was lost on import or
   when the new app opened the old browser storage directly. Details and limits are
   in §3.
2. **Optional fields are never filled in on import.** `buildId`, `reqClass`, an
   owning `systemId` and defect links stay absent until a person sets them. "Build
   not recorded" is an honest state, not a gap to auto-fill. The only additions on
   import are empty lists for new collections, counters raised to the highest
   existing code, and one audit receipt.
3. **The import is all-or-nothing.** A file with a value the app does not know (a
   new status, a broken reference, an embedded file whose size does not match its
   bytes) is refused with the record path, and the current data stays as it was. It
   is never "repaired" silently.
4. **The core test fixture is not the demo.** `tests/fixtures/current.json` is the
   original truck-program seed and stays fixed. Changing `js/seed.js` does not move
   the tests.
5. **The trace matrix's rollup column is pinned to the right**, not next to the
   requirement column. Calling `scrollIntoView` on a full-width table row resets
   the grid's horizontal scroll, so the jump scrolls the page vertically by hand.
6. **The browser pane is often hidden** (`document.hidden` is true) and then never
   animates smooth scrolls. A check that relies on smooth scrolling reads 0 there.
   Make the scroll instant for the check, or use the Playwright suite.
7. **The browser pane caches scripts.** After editing, open a raw file URL such as
   `/js/app.js` and fetch each changed file with `{cache:'reload'}`, then reload
   the app.
8. **Route changes render on `hashchange`, after `App.go` returns.** Browser tests
   use the `go()` helper, which waits for `App._lastHash`; without it they flake.
9. **Chrome hands one tab's localStorage write to other tabs a moment later.** Inside
   the shared Web Lock a tab can still read the old value. Saves therefore wait
   (`WriteFence.settle`, up to 3 s) until the IndexedDB fingerprint matches what the tab
   sees, then catch up, then apply. Tests that read another tab's save must wait for it.
10. **A page opened from `file://` cannot use the browser's private file system**
    (`navigator.storage.getDirectory()` throws SecurityError). The folder picker does
    open from `file://` in visible Chrome. Headless Chrome cancels every picker. So the
    folder tests run on a 127.0.0.1 server in a separate browser session.
11. **Windows shell traps.**
   - PowerShell cannot pipe binary data: `git archive | tar` breaks, so use bash.
   - A here-string passed to `git commit -F -` is read as a path, so write the
     message to a file.
   - The working tree uses CRLF line endings (autocrlf).

## 3. Verdict ledger

| Thing | Status | Where |
|---|---|---|
| Hardening (staged import, validation, write fence, command boundary) | SHIPPED, verified (tests) | `docs/HARDENING.md` |
| Independent-copy schema (testRuns, subcomponents, system-level cases, Waived / Review for Removal, private fields) | SHIPPED, verified on synthetic data | `docs/HARDENING.md` §Compatibility |
| Old-schema import check, exact skeleton shape (2026-10-01) | VERIFIED on synthetic data; not yet a checked-in test | §2.1, §6 |
| Requirement classes (System / PSPEC / SW), flow-down, a trace grid per class | SHIPPED | handbook |
| Releases and builds, phases 1 and 2 (per-system streams, readiness, build comparison, retest prompts) | SHIPPED | handbook, `js/pages/releases.js` |
| Builds phase 3 (changed components flag re-runs; accreditation tied to a model build) | NOT BUILT | §6 |
| Test-rig hardware configuration tracking | SHELVED 2026-10-01: "the rig HW wont change much if at all". Revisit if rig hardware starts changing. | memory |
| Council deep-tune picks: test cases, runs, narrow screens | SHIPPED, verified (tests and browser) | `1987fbf`, `5478694`, `1f28199` |
| Schedule: Program row first, Upcoming / Past sections | SHIPPED; the pinned overview was a misread and was reverted | `f2369ab` |
| Systems pills, requirement system colors, By-component toggle, trace rollup jump | SHIPPED, verified | `b904192` |
| Several tabs at once: live refresh, saves applied on top of the latest data, three-way form merge with Keep mine / Use theirs, undo of only this tab's own change | BUILT, verified (core tests and real two-tab browser test); uncommitted | `js/merge.js`, handbook §6 |
| Automatic folder backups (latest + 30 daily copies, read back) | BUILT, verified against the browser's private file system; picker-chosen folder on `file://` unverified end to end | `js/backup.js`, `#/storage` |
| Evidence folder (files of any size copied to disk by document code, SHA-256 checks, move embedded files out) | BUILT, verified the same way; uncommitted | `js/evidence.js`, documents page |
| Protected browser storage, backup status in the sidebar, in-browser version history | DECLINED 2026-10-01 (not picked) | — |
| Moving records out of localStorage into IndexedDB | DECLINED for now; revisit if storage passes ~60% | Backups & Files meter |
| Ten upgrades in the roadmap | PROPOSED, nothing built | `docs/UPGRADE-ROADMAP.md` |

**Limits of the old-schema check.** The screenshots showed field names and types,
never values, so these are still unconfirmed against the real copy:

- **`meta.version`** must be 1, 2 or absent. All three pass; 3 or higher is refused.
- **Run results** must be one of `Pass`, `Fail`, `Blocked`, `In Progress`, `Waived`
  or `Review for Removal`.
- **Case statuses** must be one of `Draft`, `Ready`, `In Progress`, `Complete`,
  `Blocked` or `Retired`.
- **Plan statuses** must be one of `Planning`, `Active`, `Complete`, `On Hold` or
  `Closed`.
- **Embedded documents** must carry a `fileSize` that matches their bytes.
- **References** must all resolve.

A real file that breaks one of these is refused safely, as finding 3 describes;
it is not damaged. The screenshots showed `risks`, `resources`, `decisions` and
`defects` with no records. If that copy now has records in them, they use the
original shape, which the existing fork test covers.

## 4. What is running

- **Nothing is scheduled.** No routines, loops or cloud jobs.
- **Preview server:** `te-console` in `.claude/launch.json` (python `http.server`
  on port 8123). Start it with `preview_start`. localhost and `file://` keep
  separate localStorage.
- **Tests:** core 56/56 and browser 22/22 on the working tree (2026-10-01).

## 5. Command crib sheet

| Task | Command |
|---|---|
| Core tests (Node 22, no dependencies) | `npm test` |
| Browser suite (Playwright and Chrome) | `$env:NODE_PATH = "C:\Users\SIX\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"; node tests/browser.cjs` |
| Full release gate | `npm run test:release` |
| Syntax-check one file | `node --check js/pages/<file>.js` |
| Extract an old version | bash: `git archive --format=tar <sha> \| tar -x -C <dir>` |

Adding a page: put its code in `js/pages/<area>.js` (it extends `Views` and
`Actions` through `Object.assign`). Add a `<script>` tag to `index.html` after
`views.js` and before `commands.js`, and the core harness reads that order. Table
columns that can drop on narrow screens get `col-lo` (hidden under 1250 px) or
`col-mid` (hidden under 1000 px) on their `<th>`.

## 6. Next steps, in priority order

1. **Hand-check one folder on your machine.** Open `index.html` by double-click, choose
   a backup folder and an evidence folder on the Backups & Files page, change something,
   add a file, then confirm both files appear on disk. This is the one path tests
   cannot drive.
2. **Check-in the old-schema import check as a test.** The script is ready
   (§2.1); as a test it guards every future release against that exact shape.
3. **A local verifier for the sensitive user.** The data-compatibility doc asks
   for a small offline check they can run on their own export and keep private.
   It closes the §3 limits without anyone seeing their data. This is roadmap
   upgrade 1 territory.
4. **Ask the other copy's owner for value lists only**: `meta.version`, the run
   results and case/plan statuses in use. Open since 2026-10-01.
5. **Builds phase 3**: flag re-runs when components change, and tie accreditation
   to a model build.
6. Roadmap wave 1 (migration-safe package, then the evidence vault), in small slices.

## 7. The user's standing preferences

- Ask with multiple-choice questions before building; plan first.
- Commit and push only when asked. Commits go on `main`, prose subjects, with
  measured counts in the body.
- Hopper Council skills (`council-review`, `consult-*`) drive deep-tunes.
- System cards use a small status lamp, not a text pill saying "Failing".
- The Program (no plan) row stays at the top of the schedule. Do not pin the
  overview.
- Each system has its own build stream and its own releases. An older-build Pass
  still counts, labeled "N builds old".
- Jira / Zephyr mapping stays optional. External links belong on everything the
  teams track.

## Glossary

- **T&E:** test and evaluation. **DT&E:** developmental T&E.
- **PSPEC:** process specification, a requirement derived from a system requirement.
- **Trace matrix:** a grid of requirements by the test cases that verify them.
- **Rollup column:** the right-hand column of the trace grid, holding one
  requirement's overall status.
- **Test run session (`testRuns`):** a group of case results recorded together,
  such as a regression pass.
- **Build:** one software delivery of a system. **Release:** the target a set of
  builds is working toward.
- **Independent copy / fork:** the other user's separate installation with
  sensitive data.
- **Schema skeleton:** a dump of that copy's field names and types with no values.
- **Write fence:** an IndexedDB journal that stops an old browser tab from
  overwriting newer data.
- **Three-way merge:** comparing what a form started from, what is saved now, and
  what the form wants, so only real disagreements need a decision.
- **Evidence folder:** a folder on disk holding attachments; the program keeps only
  each file's path and SHA-256 fingerprint.
- **VV&A:** verification, validation and accreditation of models and simulations.
