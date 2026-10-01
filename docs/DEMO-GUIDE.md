# Demo data guide — VANGUARD RIDGE MILSIM Training Suite

Job of this document: tell a hand tester where each workflow lives in the demo data
and what the app should show. It describes `js/seed.js` as shipped; everything in it
is invented. **Reset** in the sidebar restores it at any time.

Dates were written around **2026-10-01**. Opening the app later is fine; more events
simply become past-due, and countdowns shrink.

## The program

| System | What it is | Current build | Release |
|---|---|---|---|
| SYS-01 Desktop Tactical Trainer | PC squad/platoon trainer, instructor console, desktop AAR | 1.1.0-beta1 | REL-01 R1.1 (in test), REL-02 R1.0 (released) |
| SYS-02 Shared Simulation Services | Ballistics, OPFOR AI, terrain, networking, AAR recorder | SSS 3.3.0 | REL-03 R3.3 |
| SYS-03 Immersive Virtual Trainer | VR pod: headset, haptics, recoil replicas, treadmill, safety chain | IVT 0.9.1 | REL-04 Early Access 0.9 |

Counts: 23 components (three nesting chains), 26 requirements (16 system, 5 PSPEC,
5 SW), 33 cases, 29 runs, 4 test run sessions, 12 builds, 10 defects, 8 risks,
8 M&S assets, 4 decisions, 15 schedule events, 5 documents, 9 weekly snapshots.

## Where to look

**Systems and components**
- Every system lamp reads Failing; the reason line on each component card says why.
  CMP-08 fails on a failed run (TC-001) and an open Critical defect (DEF-002); CMP-04
  on the TC-017 regression and DEF-005. Hover the pills on the Systems page for the
  same reasons. CMP-03 reads Passing, CMP-07 and CMP-20 In Test, CMP-02 Untested.
- Subcomponent chains three levels deep: CMP-01 → CMP-16 → CMP-17 and
  CMP-05 → CMP-13 → CMP-14. Two-level: CMP-09 → CMP-23, CMP-11 → CMP-21,
  CMP-12 → CMP-15, CMP-03 → CMP-18, CMP-08 → CMP-19.
- System-level cases (no component): TC-020, TC-024, TC-032.

**Test cases**
- Every result type is present: Pass, Fail, Blocked (TC-019, TC-031), In Progress
  (TC-005, TC-020, TC-023), Waived (TC-022), Review for Removal (TC-025 — in the review
  queue with Keep / Retire).
- Retired: TC-021. A case that verifies nothing: TC-018.
- Full spec fields (preconditions, test data, expected results, pass/fail): TC-006, TC-015.
- A run recorded before builds were tracked: TC-023 shows "build not recorded".
- Cross-system link: TC-025 (SYS-02) verifies REQ-003 (SYS-01).

**Requirements and trace**
- Flow-down: REQ-010 → PSPEC-005 and SWR-003; SWR-003 derives from two parents.
- SWR-004 has no verifying case — flagged in the SW grid of the trace matrix.
- REQ-015 and REQ-016 are program-level (no owning system).

**Builds, releases and regression**
- REL-01: its candidate 1.1.0-rc1 is untested, so readiness shows 0 run on the
  candidate and results carried forward. 1.1.0-beta2 was rejected and never counts.
- BLD-003 (1.1.0-beta1) compared with 1.1.0-alpha: TC-017 regressed, TC-007 not re-run.
- REL-04: target date falls after the IVT safety decision — the margin shows in red.
- Sessions: TR-002 (complete) and TR-003 (active) on the desktop — TR-003's
  "vs previous" shows the TC-017 regression. TR-001 is the IVT acceptance regression;
  TR-004 is a component test of CMP-05 including its subcomponents.
- Runs on a rejected build: RUN-028 (IVT 0.9.0).

**Defects and retest prompts**
- DEF-004: fix delivered in beta1 and TC-006 has passed there → "verify and close".
- DEF-007: fix is in the current build IVT 0.9.1 → "ready to retest".
- DEF-001, DEF-005, DEF-006: fix is in a build that is not yet under test → no prompt.
- DEF-003: passed on the same build it was found in → deliberately no prompt.
- Statuses Open, In Analysis, Fix In Work, Closed and Deferred all appear. None starts
  at Ready for Retest — accept DEF-007's prompt to move it there. DEF-009 is closed with
  a verified build; DEF-010 is deferred. DEF-002 carries a Jira link.

**Schedule**
- Overdue: EVT-04 is past its date and still Planned.
- Slipped (EVT-12), cancelled (EVT-13), in progress (EVT-02, EVT-05, EVT-15).
- Multi-day windows draw as spans; four decision points are labeled on the chart.

**Decisions, risks and M&S**
- DP-01 is at risk with 0 of 4 measures verified; DP-02 is half verified.
- Risks span every category; RSK-004 has initial, current and residual scores.
- Accreditation states range from Not Started to Accredited. Cases using an asset that
  is neither Accredited nor Conditionally Accredited show a data-credibility caveat —
  for example TC-003 (RES-01, evidence in review). TC-010 uses RES-08, which is
  conditionally accredited, so it shows no caveat.

**Ownership and scope**
- 27 program-level records; the Ownership page suggests an owner for most and none
  where links span systems (for example PROC-07, TP-04, DOC-01).
- Switch the sidebar scope to one system to check lists and counts filter while
  statuses stay the same.

**Documents**
- DOC-04 is an embedded text file — download it to check the round trip.
- DOC-01 is a file-share path (shown as a text reference, not a link).

**Dashboard**
- Trend lines come from 9 weekly snapshots reconstructed from the run and defect
  dates; the app adds today's snapshot on first open.
