# Project working instructions

Read `docs/PROJECT-HANDBOOK.md`, `docs/ARCHITECTURE.md`, and
`docs/DATA-COMPATIBILITY.md` before changing application behavior or storage.
`docs/UPGRADE-ROADMAP.md` describes proposals, not implemented features.

## Non-negotiable product constraint

An existing user operates an independent copy with sensitive data. Their copy
cannot sync to this repository. Ship application updates separately from their
data; migrations and validation must run on their machine without network access.
Never require their real database, attachments, exports, or logs to be committed,
uploaded, or sent to a developer. Use synthetic fixtures for development.

Preserve existing IDs, relationships, history, attachments, and unrecognized
fields when evolving the data format. Keep supported old full-JSON backups
importable. Do not silently reset, discard, reseed, renumber, or overwrite user
data to make a migration succeed. Keep the original backup recoverable.

For storage/import changes, implement and verify the compatibility release gates
in `docs/DATA-COMPATIBILITY.md` relevant to the change. Do not describe migration
safety as guaranteed until those checks pass. CSV is partial interchange, not a
full-fidelity program backup. Do not treat demo seed data as the user's baseline.

Maintain the offline, self-contained operation. No mandatory cloud service,
account, telemetry, CDN, or repository connection. Existing external font links
are documented technical debt, not a precedent for new network dependencies.

Update the handbook and architecture when behavior or structure changes. Keep
current implementation facts distinct from intended future behavior.
