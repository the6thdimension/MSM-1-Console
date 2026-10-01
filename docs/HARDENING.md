# Hardening pass — implementation and release checks

This pass strengthens the existing console. It does not implement the feature
roadmap. Application updates and user-owned data remain separate; all runtime
processing is local. No private user database was used for development or tests.

## What changed

| Area | Implemented protection |
|---|---|
| Startup | Read and normalize a copy; malformed, unsupported, or unavailable storage opens a recovery screen instead of demo initialization. The original keys are never removed. |
| Saving | Commands group all their changes into one active-database write. Validate, save a recovery copy, verify it, write the candidate, verify it, and only then show success/navigation. Failures restore memory and retain an exportable draft. |
| Imports | JSON and CSV operate on candidates. Preview replacement counts/normalization or CSV added/updated counts before activation. Failed validation or persistence cannot partially apply the import. |
| Integrity | Validate identities, reference targets, core types/workflow states, dates and embedded content. Reconcile counters without renumbering records. Preview cascade impact; clean references to cascaded run deletions. |
| Competing tabs | Web Locks serialize commands. An IndexedDB fingerprint journal rejects stale writers even when localStorage caches have not yet propagated updates. A localStorage comparison provides an additional check. |
| Status | Run creation, editing, reassignment and deletion recompute affected case lifecycle state from its latest run. Date, recorded timestamp and numeric-aware ID establish deterministic ordering. |
| Content | Safe external-link rendering, HTTP(S) validation for new issue links, HTML escaping, inert binary downloads, structural attachment checks, and spreadsheet formula protection on CSV export. |
| Offline | Removed remote fonts. A Content Security Policy disallows background network connections, remote scripts, embedded objects and form submission. Explicit external links still work when the user opens them. |
| Audit | Commit-time differences cover regular CRUD, nested notes/mitigations, assignment changes, artifact flags, cascades and settings. Retain history without the former audit/snapshot pruning. Replacement imports receive a receipt without accumulating receipts on identical repeated imports. |
| Release checks | Built-in Node tests plus an offline Chrome browser suite cover existing workflows, failure handling and real competing tabs. Synthetic fixtures are checked in. |

## Storage and rollback behavior

The data format remains the raw JSON database with the existing IDs and
`meta.version: 2` convention. No opaque application package is required.

- Active key: `msm1-te-db-v1`.
- Previous successful state: `msm1-te-db-v1-recovery` (rotates on subsequent saves).
- Legacy key retained when encountered: `msm4-te-db-v1`.
- Write journal: IndexedDB database `msm-te-write-fence`, store `heads`, containing
  a SHA-256 fingerprint of the active serialized database. It contains no program
  text or attachments, and is recreated independently in a fresh browser profile.
- Failed candidate: held in memory and downloadable through the error toast or
  Interchange → Export unsaved draft. Forms retain values for retry.
- Interchange → Export recovery copy downloads the previous active state.
  Corrupt-startup recovery exposes the available raw storage copies for download.

The recovery key is **not** a permanent independent backup. It consumes browser
quota and can be lost along with all other browser site data. Keep full JSON
exports and the original application in the user's controlled storage before
upgrading. Linked evidence files still need their own preservation.

A write-journal failure after a local write attempts to restore the previous
active bytes. An abrupt process/power failure between the two storage systems may
leave a journal mismatch: writes then stop rather than guessing which state won.
Export the active/recovery copies and restore the selected valid export in an
isolated profile. This is fail-closed recovery, not a claim of an atomic transaction
across two different browser storage engines.

Web Locks, IndexedDB, Web Crypto and working localStorage are required for editing.
The tested launch is Chrome opening `index.html` directly using `file://`.
Unsupported/disabled capabilities prevent saving; they do not justify resetting
data. Read/export remains available when the existing database can be loaded.

Close old releases while editing. Earlier versions do not honor the write fence.
A private fork that writes independently cannot be made concurrency-safe by this
release alone. Do not bypass a journal mismatch by deleting storage indiscriminately.

## Compatibility range and deliberate behavior changes

Tested inputs: the checked-in baseline seed shape, a normalized current database,
blank programs, and synthetic legacy criteria/decision/key variants understood by
the original migration code. Unknown fields are retained recursively. Unsupported
versions, unsafe identity shapes, malformed types or dangling references are
reported without changing the source. This does not certify arbitrary private
schema modifications or undocumented historical releases.

Migration retains legacy `procedureId` and free-text `decision` fields. Defaults
are added only when absent. Existing statuses and measurements are not rewritten
during import. New runs add `recordedAt`; same-day historical runs without that
field use an ID tie-breaker, so previously ambiguous same-day rollups may change.
Deleting the final run resets the affected case to Draft. Manually changing a case
status remains possible; a subsequent run mutation reapplies the result rule.
Plan rollups still use a case's latest run across plans, as before.

Audit entries now include full timestamps, affected fields and before/after
values. Embedded payloads are summarized by encoded length in audit changes to
avoid multiplying attachment storage. Audit remains editable local history,
not authenticated or tamper-proof evidence. Replacement import keeps the incoming
history and appends a replacement receipt; previous active history is in the
recovery copy. Reset/blank intentionally replace the program after user action.

CSV remains partial interchange. Missing CSV columns no longer blank existing
fields. Ambiguous matches, duplicate headers, malformed quoting and irregular
row widths are rejected. Formula-like exported cells receive a leading apostrophe
for spreadsheet safety; that prefix is preserved if reimported. Use JSON whenever
exact full-program round-trip preservation is required.

## Repeatable checks

Run the core suite with Node 22 or a compatible recent Node installation:

```sh
npm test
```

It uses Node's built-in test runner and no third-party dependencies. The fixture
is demonstration data from `js/seed.js`; the tests construct synthetic legacy,
malformed, extension and failure variants. VM storage-failure tests substitute
the write fence; the browser suite exercises the actual journal and Web Locks.

For browser/release checks, make Playwright available in the developer environment
(tested version: 1.62.1) and install Chrome. Run:

```sh
npm run test:browser
npm run test:release
```

Playwright is a developer-only tool, not an application dependency. `NODE_PATH`
can point at an existing bundled installation. `BROWSER_CHANNEL=msedge` selects
an installed Edge instead; other browsers are not claimed tested merely because
the script supports selecting them. Tests launch a fresh isolated context with
networking disabled and close it afterward.

The release command runs the core suite followed by the browser suite and exits
unsuccessfully on failure. Browser checks cover launch, persisted CRUD, escaping,
quota failure/retry, run capture, CSV/JSON previews, downloaded JSON, cascade undo,
competing tabs, simultaneous-write races, routes, and corrupt-startup recovery.

Remaining limits: full-database serialization still has size/performance limits;
recovery copies and unpruned history increase quota use; browser storage can be
cleared; imported external evidence is not bundled automatically; local data is
not encrypted; no private installation or actual power-loss event was tested.
