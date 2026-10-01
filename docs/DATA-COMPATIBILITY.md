# Offline data compatibility and release contract

## Operating assumption

An existing user works in a separate installation with sensitive program data.
They cannot synchronize with this repository. New application releases must let
them import their existing data locally. Their actual application version and
any private code/schema modifications have not been inspected.

**Separate software delivery from data ownership.** Distribute a self-contained
application release; the user retains custody of their database, attachments,
backups, and migration reports. No repository account, upload, cloud API, or
developer access to their working data may be required.

This remains the release contract. [HARDENING.md](HARDENING.md) identifies implemented staging, validation, previews and preservation protections and their remaining limits. The richer versioned package format below remains a proposal.

## What works today and its limits

- Full JSON export/import is the available program transfer mechanism.
- The current app recognizes `msm1-te-db-v1` and legacy `msm4-te-db-v1` storage keys.
- The current importer requires `meta`, `systems`, `components`, `requirements`,
  `cases`, `procedures`, `criteria`, `plans`, `runs`, and `risks` to exist. It does
  validates types and relationships after normalizing supported legacy defaults.
- Migration already handles some older shapes, including procedure-owned
  criteria and plan decisions previously stored as free text.
- JSON import replaces the active database. CSV only transfers selected fields.
- Linked evidence files are not included in JSON unless embedded in documents.
- Different file locations or browser profiles may expose different storage.
  Conversely, opening another release may share storage and immediately migrate
  it. A separate folder alone is not reliable isolation.

We can test known supported formats without seeing sensitive data. We cannot
promise compatibility with arbitrary private code changes. Unknown formats must
be retained and reported locally, never silently coerced or discarded.

## User procedure for the current release

1. In the original installation, export the complete JSON database. Keep the
   original installation, export, and externally linked evidence in the user's
   controlled storage. Do not put the export in this repository.
2. Record the app release if known, program name, collection counts, and several
   representative linked records locally. Include document/evidence inventory.
3. Test the new app in a separate browser profile or another verified isolated
   storage context. Do not rely on folder separation alone.
4. Import a copy of the JSON. Inspect systems, case links, run histories, notes,
   risks/mitigations, criteria, documents, and reports. Download representative
   embedded attachments and confirm external evidence remains accessible locally.
5. Export from the new copy, reload, and verify the same records remain. Begin
   operational work there only after the local checks succeed.
6. If validation fails, keep using the old installation and original export.
   Do not attempt to repair the only copy. New-version exports are not guaranteed
   to work in an old app. Rollback to the old backup also omits work performed
   after that backup; preserve newer exports separately for later recovery.

This procedure complements staged imports and the write fence; it does not establish compatibility for an untested private release. Browser recovery storage is not an independent backup.

## Required import pipeline

1. Read the selected file without changing the active database.
2. Retain the original bytes and prepare a restorable pre-import backup.
3. Identify the format and schema version. Accept legacy raw database objects
   through a dedicated legacy reader. Reject unsupported future versions safely.
4. Validate structure, identifiers, reference types, dates, enum values, attachment
   encoding, and storage requirements. Report errors locally by record/path.
5. Apply ordered migrations to a deep copy. Preserve the original database and
   unknown fields. Record the migration sequence and any explicit transformations.
6. Show a preview: source/target format, counts before/after, changed/defaulted
   fields, unresolved references, warnings, attachment totals, and loss checks.
7. Activate only after validation and successful persistence. Treat record,
   attachment, and metadata changes as one commit. Read back and verify the saved
   candidate; a failure must leave the original active and recoverable.
8. Offer a local migration receipt and export of the migrated database. Reports
   may contain sensitive information and remain with the user by default.

For localStorage, retaining a second full copy may exceed quota. Do not erase the
old key to make staging fit. Require a verified backup and use an appropriately
transactional storage design, or stop with a clear local recovery path.

### Proposed format metadata

Future exports should identify `format`, `schemaVersion`, `appVersion`,
`programId`, `exportedAt`, and the data payload. These are proposed fields, not
fields expected by today's importer. Keep a reader for today's raw JSON format.
Treat application version, schema version, and storage key as separate concepts.

Use a manifest with record counts and attachment hashes for integrity checking.
A checksum detects accidental changes; it is not proof of authorship. Sensitive
encrypted packages need authenticated encryption and an explicit user-held key
recovery policy. Avoid rolling your own cryptographic algorithms.

## Preservation rules

| Subject | Required behavior |
|---|---|
| IDs and codes | Preserve original IDs/codes and references. Check uniqueness; never silently renumber a user's program. New entities receive collision-checked identities. |
| Unknown fields | Carry through unknown top-level and record/nested properties. Unsupported meaning gets a warning or blocked activation, not silent deletion. |
| Defaults | Add only missing values; distinguish absent, empty, false, zero, and null. Do not overwrite deliberate user values. |
| History | Retain runs, audit, snapshots, nested notes/mitigations, criteria states, external keys and links. Archive rather than prune during migration. |
| Attachments | Preserve filename, type, content and associations. Compare hashes before/after; report linked files as references, not embedded payloads. |
| New structures | Keep original free text alongside any parsed measurements or converted fields. Preserve provenance of inferred values. |
| Program identity | Do not mix independent programs solely because they have matching `REQ-001`/`TC-001` codes. |
| New defaults/templates | Offer separately; never inject demo records or overwrite operational procedures during an application update. |
| Rollback | Retain original-format export and old application. Never assume backward import is possible after a schema change. |
| Logging/support | Local diagnostics by default. Synthetic reproductions should be sufficient for developer debugging. |

Run migrations exactly once by version, and make retry behavior deterministic.
Repeated import of the same full backup in replacement mode must not accumulate
records, audit entries, or generated decisions. Re-running normalization should
not alter already normalized data. Test skipped-version upgrades explicitly.

## Release gates for any storage/import change

Use synthetic fixtures for every known supported release, including an export of
this baseline's migrated seed and a blank program. Keep fixtures free of real user
data. Add older fixtures when an actual old format can be established; do not
call a guessed fixture proof of compatibility with an unknown private fork.

| Test | Acceptance condition |
|---|---|
| Current JSON round trip | Export → isolated import → export preserves all records, links, unknown fields and attachment content, apart from documented metadata changes. |
| Old-format migration | Old criteria, decision text, missing optional collections, and historical keys migrate without losing their original information. |
| Skipped versions/retries | Every supported source reaches current format; repeat processing is deterministic and does not duplicate records. |
| Blank/sparse input | Valid empty programs load; malformed arrays/meta fail without replacing active state. |
| Referential integrity | Missing references and duplicate IDs/codes are reported; any repair is explicit and previewed. |
| Interrupted/quota failure | Inject read/write failure and insufficient space; original data remains recoverable and no false success is shown. |
| Future/private extension | Unsupported versions remain unmodified; unknown scalar, object, and array fields survive supported imports. |
| Documents | Binary content hashes agree before/after; embedded and externally linked evidence remain distinguishable. |
| Semantic preservation | On synthetic fixtures, compare coverage, latest runs, plan counts, risk scores and decision readiness; explain any intentional rule changes. |
| Storage relocation | Transfer works without discovering the old browser storage automatically. |
| Concurrent tabs | Reject or resolve stale writes without silently losing another tab's edits. |
| Offline run | Complete launch, import, edit, export and report generation with network disabled and no mandatory remote assets. |
| Rollback drill | Restore original export in the original application/storage context after a failed trial upgrade. |

Publish the tested compatibility range and known limitations with each release.
Never claim “all past and future versions supported.” Add a small local verifier
so the sensitive user can run equivalent checks and keep the results privately.

## If offline merging is introduced

Replacement import and merge import must be separate choices. Merge requires
program identity, stable entity identity, a common baseline or revisions,
field-level conflict review, deletion tombstones, provenance, and attachment
deduplication. “Last file wins” and exact-title matching are insufficient.
Application updates do not require merging with the developer's database.
