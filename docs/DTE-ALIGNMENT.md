# DT&E Alignment — DoD T&E Enterprise Guidebook Digest

How this console maps to the **DoD Test and Evaluation Enterprise Guidebook** (DOT&E + OUSD(R&E), June/August 2022, implementing DoDI 5000.89), read with our program in mind: a development team building a **3D simulation with a hardware truck in the loop (HWIL)** emulating the real MSM-1 vehicle, where the simulation itself will undergo **VV&A** (DoDI 5000.61 / MIL-STD-3022).

Source: [T&E Enterprise Guidebook (dote.osd.mil)](https://www.dote.osd.mil/Portals/97/pub/policies/2022/TE%20Enterprise%20Guidebook%208.02.pdf)

---

## 1. What the guidebook says DT&E is for (§2.1)

DT&E is "the disciplined process of generating substantiated knowledge on the capabilities and limitations of systems." Among its enumerated purposes, the ones that shaped this tool:

- **Verify achievement of critical technical parameters (CTPs) and key performance parameters (KPPs)** → requirements carry a *Measure* classification (KPP / KSA / CTP / TPM / MOP / MOE / Spec) plus explicit **Threshold** and **Objective** values.
- **Provide DT&E data to validate parameters in modeling and simulation** → test runs are first-class records linked to requirements; validation-type cases (`V&V – Validation`) generate the evidence.
- **Assess entry criteria for follow-on test** → entry/exit criteria exist at two levels (see §3).
- **Root-cause data for failures** → run notes + risk linkage (a failing run can cite the risk it feeds, e.g., RUN-006 → RSK-001).

## 2. The T&E Strategy and IDSK (§3.1)

The guidebook requires a T&E Strategy (TEMP/SAMP/etc.) that includes, at minimum:

| Guidebook requirement | Where it lives in the console |
|---|---|
| **IDSK** — correlate program *decisions* with the *data* (CT, DT, LFT, OT, M&S) that informs them | The **IDSK page**: decisions × informing measures × supporting test plans, with per-decision evidence readiness; plans link to the decision they support |
| Resources & test support, **including M&S VV&A where required** | The **M&S / VV&A** register (resources with V/V/A state, authority, artifacts) |
| Test **phase objectives, including entrance and exit criteria** | Entry/exit criteria attach to **test plans** (phases) as well as procedures |
| **Data collection requirements**, incl. from live events and M&S | Case venue (Live/Virtual/Constructive/HWIL/Hybrid) + linked resources identify each data source |
| Schedule of T&E events | Plan windows (start/end) + run log |

Test plans must detail (§3.2): purpose relative to the strategy, schedule/location/resources, data requirements, and **test limitations** — the credibility caveat on unaccredited M&S is one such limitation, surfaced automatically.

## 3. Entrance / exit criteria at two levels

The guidebook applies entrance/exit criteria to **test phases** ("Test phase objectives, including entrance and exit criteria") while test procedures carry their own execution gates. The console mirrors that:

- **Procedures** → operational readiness gates (calibration current, config frozen, safety brief done) with the GO/HOLD lamp.
- **Test plans (phases)** → programmatic gates (V&V Plan approved, referent data baselined, prior phase exit satisfied).

## 4. VV&A for our simulation (DoDI 5000.61 / MIL-STD-3022)

Because our *product is itself an M&S asset* destined for accreditation, the console tracks per asset:

- **Verification** — "built right": the model implements its conceptual model/spec correctly (e.g., deterministic replay, TC-007).
- **Validation** — "is right": outputs match the real-world referent for the intended use (e.g., maneuver-set comparison vs the instrumented truck telemetry, TC-003; SME face validation, TC-014).
- **Accreditation** — an *authority's* official determination that the asset is acceptable **for a specific intended use** — hence the Intended Use statement and Accreditation Scope fields. Workflow: Not Started → Plan Approved → Evidence In Review → (Conditionally) Accredited.
- **MIL-STD-3022 artifact set** — Accreditation Plan, V&V Plan, V&V Report, Accreditation Report checklist per asset.

Key modeling choices that follow from the guidebook and 5000.61:

1. **The referent is an asset too.** The real-truck telemetry set (RES-04) is registered and accredited *as referent data* — validation evidence is only as credible as its referent.
2. **Credibility caveats propagate.** Any test case using an M&S asset not yet (conditionally) accredited displays a data-credibility caveat; per the guidebook, contractor/DT data feeds decisions only when tools' "verification and validation plans, and the credibility of those tools for the intended use" are understood (§3.1).
3. **Accreditation scope may be narrower than the sim.** RSK-001's third mitigation models the real-world outcome where the AO accredits with an envelope exclusion (washboard regime).

## 5. Data management (§1.1, §3.1)

The guidebook pushes a **common data repository** available to all test teams, and reuse of contractor/government data across DT/OT. This console's interchange layer serves that goal at team scale:

- **Jira RTM**: requirements CSV (Jira importer shape, Issue key round-trip) + traceability CSV.
- **Zephyr**: test case CSV (Squad import layout, step rows, TC-code round-trip).
- **JSON**: full-database backup/restore.

## 6. Deliberately out of scope (for now)

- **Reliability growth tracking**, cyber T&E (§ cyber survivability focus area), and LFT&E — not applicable to a simulation program at this stage.
- **STAT/DOE** design-of-experiments fields on cases.

## Glossary (as used here)

| Term | Meaning |
|---|---|
| CTP | Critical Technical Parameter — measurable, testable technical parameter whose achievement is critical |
| TPM | Technical Performance Measure |
| MOP / MOE | Measure of Performance / Effectiveness |
| KPP / KSA | Key Performance Parameter / Key System Attribute |
| IDSK | Integrated Decision Support Key — decisions ↔ data sources mapping |
| VV&A | Verification, Validation & Accreditation (DoDI 5000.61) |
| Referent | The authoritative real-world data/knowledge a model is validated against |
| HWIL | Hardware-in-the-loop |
| LVC | Live / Virtual / Constructive test venue taxonomy |
