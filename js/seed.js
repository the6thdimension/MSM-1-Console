/* ============================================================
   Seed / demo dataset — MSM-1 "Virtual Proving Ground"
   DT&E of a 3D simulation environment with a hardware truck
   (HWIL) emulating the real MSM-1 laser truck and its behavior.
   The simulation itself is the system under test and will go
   through formal VV&A (DoDI 5000.61 / MIL-STD-3022).
   ============================================================ */

const SEED_DB = {
  meta: {
    program: "MSM-1 Virtual Proving Ground",
    version: 2,
    seq: { systems: 3, components: 12, requirements: 12, cases: 14, procedures: 5, criteria: 31, plans: 2, runs: 9, risks: 7, mitigations: 13, resources: 5, decisions: 3, events: 9, notes: 5, defects: 4, documents: 3 }
  },

  systems: [
    { id: "sys-1", code: "SYS-01", name: "Simulation Core", description: "Real-time 3D simulation engine: physics, terrain/environment, scenario control, and rendering for the virtual proving ground." },
    { id: "sys-2", code: "SYS-02", name: "Vehicle & Payload Models", description: "High-fidelity models of the MSM-1 truck and laser payload: dynamics, powertrain/APU, effector, and thermal behavior." },
    { id: "sys-3", code: "SYS-03", name: "HWIL Integration", description: "Hardware-in-the-loop layer coupling the real truck hardware to the simulation: bus bridging, time sync, operator station, and safety chain." }
  ],

  components: [
    { id: "cmp-1",  code: "CMP-01", systemId: "sys-1", name: "Physics Engine",             description: "Rigid-body dynamics, contact, and terrain interaction solver running the simulation world at fixed timestep." },
    { id: "cmp-2",  code: "CMP-02", systemId: "sys-1", name: "Terrain & Environment",      description: "Terrain database, surface materials, weather/visibility effects; correlated to the surveyed proving-ground course." },
    { id: "cmp-3",  code: "CMP-03", systemId: "sys-1", name: "Scenario Manager",           description: "Scenario authoring, scripted events, deterministic replay, and fault injection control." },
    { id: "cmp-4",  code: "CMP-04", systemId: "sys-1", name: "Visual / Render System",     description: "3D rendering pipeline and sensor-view channels for crew displays and out-the-window views." },
    { id: "cmp-5",  code: "CMP-05", systemId: "sys-2", name: "Vehicle Dynamics Model",     description: "Suspension, tire, and chassis model reproducing ride and handling of the reference truck." },
    { id: "cmp-6",  code: "CMP-06", systemId: "sys-2", name: "Powertrain & APU Model",     description: "Engine, driveline, and auxiliary power unit models including electrical load behavior." },
    { id: "cmp-7",  code: "CMP-07", systemId: "sys-2", name: "Laser Effector Model",       description: "Beam director kinematics, engagement timeline, and power draw of the laser payload." },
    { id: "cmp-8",  code: "CMP-08", systemId: "sys-2", name: "Thermal Model",              description: "Coolant loop and thermal response model of the laser thermal management system." },
    { id: "cmp-9",  code: "CMP-09", systemId: "sys-3", name: "Truck Hardware Interface",   description: "CAN/J1939 bridge between the real truck hardware rig and the simulation's virtual bus." },
    { id: "cmp-10", code: "CMP-10", systemId: "sys-3", name: "Time Sync & Latency Mgr",    description: "Clock distribution, timestep scheduling, and latency budget management across sim and hardware." },
    { id: "cmp-11", code: "CMP-11", systemId: "sys-3", name: "Operator Station & HMI",     description: "Replicated cab controls and crew displays driving the simulation as the real truck would." },
    { id: "cmp-12", code: "CMP-12", systemId: "sys-3", name: "Safety Interlock Chain",     description: "Hardware e-stops and interlocks that safe both the hardware rig and the simulation outputs." }
  ],

  /* measure: None | KPP | KSA | CTP | TPM | MOP | MOE | Spec */
  requirements: [
    { id: "req-1",  code: "REQ-001", title: "End-to-end HWIL latency",    text: "The HWIL loop (hardware input → simulation response → hardware output) shall exhibit end-to-end latency ≤ 20 ms.", type: "Performance", priority: "Critical", method: "Test", measure: "CTP", threshold: "≤ 20 ms", objective: "≤ 10 ms", extKey: "MSM-101", componentIds: ["cmp-9", "cmp-10"] },
    { id: "req-2",  code: "REQ-002", title: "Vehicle dynamics fidelity",  text: "Vehicle dynamics model outputs shall match reference truck telemetry within 5% RMS error across the standard maneuver set.", type: "Performance", priority: "Critical", method: "Analysis", measure: "CTP", threshold: "≤ 5% RMS", objective: "≤ 3% RMS", extKey: "MSM-102", componentIds: ["cmp-5", "cmp-1"] },
    { id: "req-3",  code: "REQ-003", title: "Render frame rate",          text: "The visual system shall sustain ≥ 60 FPS at full scene density on the reference hardware configuration.", type: "Performance", priority: "High", method: "Test", measure: "TPM", threshold: "≥ 60 FPS", objective: "≥ 90 FPS", componentIds: ["cmp-4"] },
    { id: "req-4",  code: "REQ-004", title: "Bus message coverage",       text: "The hardware interface shall emulate 100% of the reference truck's operational CAN/J1939 message set.", type: "Interface", priority: "High", method: "Inspection", measure: "MOP", threshold: "100% of message set", objective: "", componentIds: ["cmp-9"] },
    { id: "req-5",  code: "REQ-005", title: "Powertrain model accuracy",  text: "Powertrain model torque and fuel-burn curves shall match dynamometer reference data within 3%.", type: "Performance", priority: "High", method: "Analysis", measure: "TPM", threshold: "≤ 3% deviation", objective: "≤ 1.5%", componentIds: ["cmp-6"] },
    { id: "req-6",  code: "REQ-006", title: "Thermal model accuracy",     text: "The thermal model shall predict coolant supply/return temperatures within ±2 °C of hardware test data across the engagement duty cycle.", type: "Performance", priority: "Critical", method: "Analysis", measure: "CTP", threshold: "±2 °C", objective: "±1 °C", componentIds: ["cmp-8"] },
    { id: "req-7",  code: "REQ-007", title: "Deterministic replay",       text: "A recorded scenario shall replay to an identical state trajectory (bit-exact physics state) on the same configuration.", type: "Functional", priority: "High", method: "Test", measure: "Spec", threshold: "Bit-exact over 30 min", objective: "", componentIds: ["cmp-3", "cmp-1"] },
    { id: "req-8",  code: "REQ-008", title: "Fault injection coverage",   text: "The scenario manager shall inject all defined fault classes (sensor dropout, bus errors, actuator degradation, thermal derate) on operator command.", type: "Functional", priority: "Medium", method: "Demonstration", measure: "MOP", threshold: "4/4 fault classes", objective: "", componentIds: ["cmp-3"] },
    { id: "req-9",  code: "REQ-009", title: "Time sync drift",            text: "Clock drift between simulation time and hardware rig time shall remain < 1 ms over a 4-hour continuous run.", type: "Performance", priority: "High", method: "Test", measure: "TPM", threshold: "< 1 ms / 4 h", objective: "< 0.2 ms / 4 h", componentIds: ["cmp-10"] },
    { id: "req-10", code: "REQ-010", title: "E-stop propagation",         text: "Activation of any hardware e-stop shall halt hardware motion outputs and freeze the simulation within 100 ms.", type: "Safety", priority: "Critical", method: "Test", measure: "CTP", threshold: "≤ 100 ms", objective: "≤ 50 ms", componentIds: ["cmp-12", "cmp-9"] },
    { id: "req-11", code: "REQ-011", title: "Terrain correlation",        text: "Simulated terrain geometry shall correlate with the surveyed proving-ground course within 10 cm RMS.", type: "Environmental", priority: "Medium", method: "Analysis", measure: "TPM", threshold: "≤ 10 cm RMS", objective: "≤ 5 cm RMS", componentIds: ["cmp-2"] },
    { id: "req-12", code: "REQ-012", title: "Control mapping fidelity",   text: "The operator station shall replicate 100% of reference truck cab controls with correct feel, range, and bus behavior.", type: "Interface", priority: "High", method: "Demonstration", measure: "MOP", threshold: "100% control mapping", objective: "", componentIds: ["cmp-11"] }
  ],

  /* M&S assets & test resources with VV&A tracking.
     verification/validation: Not Started | Planned | In Progress | Complete
     accreditation: Not Started | Plan Approved | Evidence In Review |
                    Conditionally Accredited | Accredited | Not Accredited */
  resources: [
    { id: "res-1", code: "RES-01", name: "Vehicle Dynamics Model v2.3", type: "Model", vvaRequired: true,
      description: "Multibody dynamics model of the MSM-1 chassis, suspension, and tires used inside the simulation core.",
      intendedUse: "Generate vehicle response data credible for DT&E of crew procedures and control software over primary/secondary roads and 30% grades.",
      owner: "Vehicle Model IPT", authority: "PEO Sim Accreditation Authority",
      verification: "Complete", validation: "In Progress", accreditation: "Plan Approved", accDate: "", accScope: "",
      artifacts: { accPlan: true, vvPlan: true, vvReport: false, accReport: false } },
    { id: "res-2", code: "RES-02", name: "MSM-1 Integrated Simulation", type: "Simulation", vvaRequired: true,
      description: "The integrated 3D simulation environment (physics, terrain, models, HWIL coupling) — the system this program is developing.",
      intendedUse: "DT&E venue for MSM-1 crew training, control-software regression, and engagement-sequence rehearsal prior to live range events.",
      owner: "Program Office", authority: "PEO Sim Accreditation Authority",
      verification: "In Progress", validation: "Planned", accreditation: "Not Started", accDate: "", accScope: "",
      artifacts: { accPlan: false, vvPlan: true, vvReport: false, accReport: false } },
    { id: "res-3", code: "RES-03", name: "HWIL Truck Rig", type: "HWIL Rig", vvaRequired: true,
      description: "Real MSM-1 truck hardware (cab, bus architecture, power system) on a fixture, coupled live to the simulation.",
      intendedUse: "Provide real hardware behavior (bus traffic, control feel, power transients) in the loop for integration and validation testing.",
      owner: "HWIL Team", authority: "PEO Sim Accreditation Authority",
      verification: "Complete", validation: "In Progress", accreditation: "Not Started", accDate: "", accScope: "",
      artifacts: { accPlan: false, vvPlan: true, vvReport: false, accReport: false } },
    { id: "res-4", code: "RES-04", name: "Reference Truck Telemetry Set", type: "Reference Dataset", vvaRequired: true,
      description: "Instrumented drive data from the real MSM-1 truck (maneuver set, grades, washboard, dyno pulls) — the validation referent.",
      intendedUse: "Serve as the authoritative real-world referent for validating vehicle dynamics, powertrain, and thermal models.",
      owner: "Data Management", authority: "PEO Sim Accreditation Authority",
      verification: "Complete", validation: "Complete", accreditation: "Accredited", accDate: "2026-07-15", accScope: "Referent data for model validation within the recorded maneuver envelope.",
      artifacts: { accPlan: true, vvPlan: true, vvReport: true, accReport: true } },
    { id: "res-5", code: "RES-05", name: "Latency Instrumentation Suite", type: "Instrumentation", vvaRequired: false,
      description: "Hardware timestamping probes and analysis toolchain used to measure end-to-end HWIL latency and clock drift.",
      intendedUse: "Measure latency and time-sync performance; calibration current through 2026-12-01.",
      owner: "HWIL Team", authority: "",
      verification: "Complete", validation: "Complete", accreditation: "Not Started", accDate: "", accScope: "",
      artifacts: { accPlan: false, vvPlan: false, vvReport: false, accReport: false } }
  ],

  procedures: [
    { id: "proc-1", code: "PROC-01", title: "HWIL Latency Characterization", description: "Instrumented measurement of end-to-end loop latency and jitter across load conditions using hardware timestamping.",
      steps: [
        "Install timestamp probes at hardware input, sim ingress, sim egress, and hardware output.",
        "Verify probe calibration against reference clock (RES-05 suite).",
        "Run idle-scene baseline: 10,000 loop samples.",
        "Run full-scene load: repeat 10,000 samples at max scenario density.",
        "Run transient load: scripted scenario with fault injection bursts.",
        "Compute latency distribution; flag any sample > 20 ms.",
        "Archive raw timestamp logs to program data store."
      ] },
    { id: "proc-2", code: "PROC-02", title: "Vehicle Dynamics Validation vs Referent", description: "Replay the standard maneuver set in sim and compare state trajectories against the reference truck telemetry (RES-04).",
      steps: [
        "Load baselined referent dataset; verify checksum against CM record.",
        "Configure sim vehicle to match as-tested truck configuration (mass, CG, tire pressures).",
        "Execute maneuver set: double lane change, J-turn, 30% grade ascent, washboard loop, braking series.",
        "Log sim state at referent sample rate; align time bases.",
        "Compute per-channel RMS error (speed, accelerations, pitch/roll, suspension travel).",
        "Disposition channels exceeding 5% RMS with model team.",
        "Produce validation comparison report for the V&V evidence package."
      ] },
    { id: "proc-3", code: "PROC-03", title: "Endurance & Time Sync Run", description: "4-hour continuous HWIL run monitoring clock drift, memory/performance stability, and bus health.",
      steps: [
        "Start synchronized clocks; record initial offsets.",
        "Run continuous mixed scenario playlist for 4 hours.",
        "Sample clock offset, frame rate, and memory every 60 s.",
        "Inject scheduled bus-error faults at hour 2 and hour 3.",
        "Verify automatic recovery and no desync after fault clearing.",
        "Analyze drift trend; flag if projected 4-h drift ≥ 1 ms."
      ] },
    { id: "proc-4", code: "PROC-04", title: "Safety Chain & E-Stop Verification", description: "Exercise every e-stop and interlock path; measure propagation into both hardware outputs and simulation freeze.",
      steps: [
        "Configure rig in low-power safe mode with motion outputs to dummy loads.",
        "Instrument e-stop signal path with timestamp capture.",
        "Trigger each of the 3 e-stop stations; record hardware-halt and sim-freeze latency.",
        "Open each interlock (rig enclosure, coolant sense, comms watchdog) individually; verify inhibit.",
        "Verify sim refuses scenario start with any interlock open.",
        "Restore chain; verify normal start-up path recovers."
      ] },
    { id: "proc-5", code: "PROC-05", title: "SME Face Validation Review", description: "Structured review where experienced MSM-1 truck operators drive the sim and rate behavioral fidelity against the real vehicle (validation evidence).",
      steps: [
        "Brief SMEs on scenario set and rating rubric (5-point per behavior area).",
        "SME session 1: on-road handling and braking feel.",
        "SME session 2: off-road/washboard ride and grade behavior.",
        "SME session 3: cab controls, displays, and engagement sequence timing.",
        "Collect rubric scores and structured comments.",
        "Adjudicate items scoring < 3 with the model teams; log actions.",
        "Append signed review record to the V&V evidence package."
      ] }
  ],

  /* Entry & exit criteria. parentType: procedure | plan.
     status: open | met | waived */
  criteria: [
    { id: "cri-1",  parentType: "procedure", parentId: "proc-1", kind: "entry", text: "Latency instrumentation calibration current (RES-05, ≤ 90 days)", status: "met" },
    { id: "cri-2",  parentType: "procedure", parentId: "proc-1", kind: "entry", text: "Sim build under configuration management with tagged release", status: "met" },
    { id: "cri-3",  parentType: "procedure", parentId: "proc-1", kind: "exit",  text: "≥ 30,000 valid samples captured across all three load conditions", status: "open" },
    { id: "cri-4",  parentType: "procedure", parentId: "proc-1", kind: "exit",  text: "Latency distribution report archived; exceedances written up", status: "open" },

    { id: "cri-5",  parentType: "procedure", parentId: "proc-2", kind: "entry", text: "Referent dataset (RES-04) baselined, checksummed, and accredited for this use", status: "met" },
    { id: "cri-6",  parentType: "procedure", parentId: "proc-2", kind: "entry", text: "Sim vehicle configuration matches as-tested truck configuration record", status: "met" },
    { id: "cri-7",  parentType: "procedure", parentId: "proc-2", kind: "entry", text: "Time-base alignment method peer-reviewed by data team", status: "open" },
    { id: "cri-8",  parentType: "procedure", parentId: "proc-2", kind: "exit",  text: "Per-channel RMS error computed for all maneuvers; exceedances dispositioned", status: "open" },
    { id: "cri-9",  parentType: "procedure", parentId: "proc-2", kind: "exit",  text: "Validation comparison report added to V&V evidence package", status: "open" },

    { id: "cri-10", parentType: "procedure", parentId: "proc-3", kind: "entry", text: "Clock distribution verified end-to-end; initial offsets recorded", status: "met" },
    { id: "cri-11", parentType: "procedure", parentId: "proc-3", kind: "entry", text: "4-hour scenario playlist validated in short-form dry run", status: "met" },
    { id: "cri-12", parentType: "procedure", parentId: "proc-3", kind: "exit",  text: "Full 4-hour run completed or abort cause documented", status: "open" },
    { id: "cri-13", parentType: "procedure", parentId: "proc-3", kind: "exit",  text: "Drift/perf telemetry reviewed; trend analysis attached", status: "open" },

    { id: "cri-14", parentType: "procedure", parentId: "proc-4", kind: "entry", text: "Rig in safe mode with motion outputs on dummy loads (verified)", status: "met" },
    { id: "cri-15", parentType: "procedure", parentId: "proc-4", kind: "entry", text: "E-stop timestamp capture chain verified with known-good trigger", status: "met" },
    { id: "cri-16", parentType: "procedure", parentId: "proc-4", kind: "exit",  text: "Every e-stop and interlock path exercised with recorded latency", status: "met" },
    { id: "cri-17", parentType: "procedure", parentId: "proc-4", kind: "exit",  text: "Any propagation > 100 ms written up as test incident", status: "met" },

    { id: "cri-18", parentType: "procedure", parentId: "proc-5", kind: "entry", text: "≥ 3 qualified MSM-1 operators scheduled with current vehicle time", status: "met" },
    { id: "cri-19", parentType: "procedure", parentId: "proc-5", kind: "entry", text: "Rating rubric approved by V&V agent", status: "open" },
    { id: "cri-20", parentType: "procedure", parentId: "proc-5", kind: "exit",  text: "All rubric areas scored by every SME; comments transcribed", status: "open" },
    { id: "cri-21", parentType: "procedure", parentId: "proc-5", kind: "exit",  text: "Signed face-validation record appended to V&V evidence package", status: "open" },

    /* Phase-level criteria on test plans (T&E Enterprise Guidebook:
       test phase objectives include entrance and exit criteria). */
    { id: "cri-22", parentType: "plan", parentId: "plan-1", kind: "entry", text: "V&V Plan approved by accreditation authority (MIL-STD-3022 format)", status: "met" },
    { id: "cri-23", parentType: "plan", parentId: "plan-1", kind: "entry", text: "Referent datasets baselined under configuration management", status: "met" },
    { id: "cri-24", parentType: "plan", parentId: "plan-1", kind: "entry", text: "Model versions frozen for the validation campaign (no mid-campaign drops)", status: "open" },
    { id: "cri-25", parentType: "plan", parentId: "plan-1", kind: "exit",  text: "All validation cases executed; results dispositioned with model teams", status: "open" },
    { id: "cri-26", parentType: "plan", parentId: "plan-1", kind: "exit",  text: "V&V Report drafted and submitted to accreditation authority", status: "open" },

    { id: "cri-27", parentType: "plan", parentId: "plan-2", kind: "entry", text: "TP-01 validation campaign exit criteria satisfied", status: "open" },
    { id: "cri-28", parentType: "plan", parentId: "plan-2", kind: "entry", text: "HWIL rig safety chain verification (PROC-04) passed", status: "met" },
    { id: "cri-29", parentType: "plan", parentId: "plan-2", kind: "entry", text: "Integrated sim release candidate tagged and deployed to rig", status: "open" },
    { id: "cri-30", parentType: "plan", parentId: "plan-2", kind: "exit",  text: "All acceptance cases pass or waivers signed by program office", status: "open" },
    { id: "cri-31", parentType: "plan", parentId: "plan-2", kind: "exit",  text: "Sim Readiness Review package delivered (results, caveats, VV&A status)", status: "open" }
  ],

  /* Test cases. venue: Live | Virtual | Constructive | HWIL | Hybrid
     testType: CT | DT&E | Integration | Regression | V&V – Verification | V&V – Validation */
  cases: [
    { id: "tc-1",  code: "TC-001", componentId: "cmp-9",  title: "End-to-end latency under load", objective: "Measure HWIL loop latency distribution at idle, full-scene, and transient load; verify ≤ 20 ms.", requirementIds: ["req-1"], procedureId: "proc-1", priority: "Critical", status: "In Progress", venue: "HWIL", testType: "DT&E", extKey: "MSMT-11", extLinks: [{ url: "https://yourteam.atlassian.net/projects/MSM?selectedItem=com.thed.zephyr.je%3Azephyr-tests-page#TC-MSMT-11", label: "Zephyr test page" }], resourceIds: ["res-3", "res-5", "res-2"] },
    { id: "tc-2",  code: "TC-002", componentId: "cmp-10", title: "4-hour clock drift", objective: "Quantify sim-to-hardware clock drift over a 4-hour continuous run; verify < 1 ms.", requirementIds: ["req-9"], procedureId: "proc-3", priority: "High", status: "Ready", venue: "HWIL", testType: "DT&E", resourceIds: ["res-3", "res-5"] },
    { id: "tc-3",  code: "TC-003", componentId: "cmp-5",  title: "Maneuver-set dynamics validation", objective: "Compare sim vehicle state trajectories against referent telemetry across the standard maneuver set; ≤ 5% RMS.", requirementIds: ["req-2"], procedureId: "proc-2", priority: "Critical", status: "In Progress", venue: "Virtual", testType: "V&V – Validation", resourceIds: ["res-1", "res-4", "res-2"] },
    { id: "tc-4",  code: "TC-004", componentId: "cmp-6",  title: "Powertrain curves vs dyno data", objective: "Validate torque and fuel-burn curves against dynamometer referent within 3%.", requirementIds: ["req-5"], procedureId: "proc-2", priority: "High", status: "Complete", venue: "Virtual", testType: "V&V – Validation", resourceIds: ["res-4"] },
    { id: "tc-5",  code: "TC-005", componentId: "cmp-8",  title: "Thermal model vs hardware test data", objective: "Validate coolant temperature predictions against instrumented hardware engagement-cycle data within ±2 °C.", requirementIds: ["req-6"], procedureId: "proc-2", priority: "Critical", status: "In Progress", venue: "Virtual", testType: "V&V – Validation", resourceIds: ["res-4"] },
    { id: "tc-6",  code: "TC-006", componentId: "cmp-4",  title: "Frame rate at full scene density", objective: "Measure sustained FPS on the reference hardware configuration with maximum scenario density.", requirementIds: ["req-3"], procedureId: "proc-3", priority: "High", status: "Complete", venue: "Virtual", testType: "DT&E", resourceIds: ["res-2"] },
    { id: "tc-7",  code: "TC-007", componentId: "cmp-3",  title: "Deterministic replay verification", objective: "Record a 30-minute scenario and verify bit-exact physics state on replay.", requirementIds: ["req-7"], procedureId: "proc-3", priority: "High", status: "Complete", venue: "Virtual", testType: "V&V – Verification", resourceIds: ["res-2"] },
    { id: "tc-8",  code: "TC-008", componentId: "cmp-12", title: "E-stop propagation timing", objective: "Measure e-stop to hardware-halt and sim-freeze latency for all stations; verify ≤ 100 ms.", requirementIds: ["req-10"], procedureId: "proc-4", priority: "Critical", status: "Complete", venue: "HWIL", testType: "DT&E", resourceIds: ["res-3", "res-5"] },
    { id: "tc-9",  code: "TC-009", componentId: "cmp-12", title: "Interlock inhibit verification", objective: "Open each interlock individually; verify inhibit of both hardware outputs and scenario start.", requirementIds: ["req-10"], procedureId: "proc-4", priority: "Critical", status: "Complete", venue: "HWIL", testType: "DT&E", resourceIds: ["res-3"] },
    { id: "tc-10", code: "TC-010", componentId: "cmp-9",  title: "J1939 message set coverage audit", objective: "Audit emulated bus traffic against the reference truck's operational message catalog; verify 100% coverage.", requirementIds: ["req-4"], procedureId: null, priority: "High", status: "Ready", venue: "HWIL", testType: "Integration", resourceIds: ["res-3"] },
    { id: "tc-11", code: "TC-011", componentId: "cmp-2",  title: "Terrain correlation survey check", objective: "Compare simulated course geometry against survey control points; verify ≤ 10 cm RMS.", requirementIds: ["req-11"], procedureId: null, priority: "Medium", status: "Ready", venue: "Constructive", testType: "V&V – Validation", resourceIds: ["res-2"] },
    { id: "tc-12", code: "TC-012", componentId: "cmp-11", title: "Cab control mapping audit", objective: "Exercise every cab control on the operator station; verify correct mapping, range, and bus behavior vs the real cab.", requirementIds: ["req-12"], procedureId: "proc-5", priority: "High", status: "Ready", venue: "HWIL", testType: "DT&E", resourceIds: ["res-3"] },
    { id: "tc-13", code: "TC-013", componentId: "cmp-3",  title: "Fault injection class demonstration", objective: "Inject each defined fault class on command; verify correct system response and event logging.", requirementIds: ["req-8"], procedureId: null, priority: "Medium", status: "Draft", venue: "Virtual", testType: "DT&E", resourceIds: ["res-2"] },
    { id: "tc-14", code: "TC-014", componentId: "cmp-5",  title: "SME face validation — ride & handling", objective: "Structured SME driving sessions rating behavioral fidelity vs the real truck (validation evidence for accreditation).", requirementIds: ["req-2", "req-12"], procedureId: "proc-5", priority: "High", status: "Draft", venue: "HWIL", testType: "V&V – Validation", resourceIds: ["res-2", "res-3", "res-1"] }
  ],

  /* Program decisions — the rows of the IDSK. requirementIds are the
     measures whose evidence informs the decision. */
  decisions: [
    { id: "dec-1", code: "DP-01", title: "M&S Accreditation Decision", status: "At Risk", date: "2026-10-30",
      authority: "PEO Sim Accreditation Authority",
      description: "Accreditation authority determination that the integrated simulation is acceptable for its intended use (DT&E of crew procedures and control software). Informed by the TP-01 V&V evidence package.",
      requirementIds: ["req-2", "req-5", "req-6", "req-7", "req-11"] },
    { id: "dec-2", code: "DP-02", title: "Sim Readiness Review (SRR-2)", status: "On Track", date: "2026-11-25",
      authority: "Program Office",
      description: "Program-level review that the coupled sim + HWIL rig is ready for crew-in-the-loop DT&E events: latency, time sync, safety chain, and operator station acceptance.",
      requirementIds: ["req-1", "req-3", "req-4", "req-9", "req-10", "req-12"] },
    { id: "dec-3", code: "DP-03", title: "Increment 1 Delivery Gate", status: "Pending", date: "2026-12-18",
      authority: "Customer / Program Office",
      description: "Go/no-go for delivering Increment 1 of the virtual proving ground to the customer site, including scenario tooling and fault-injection capability.",
      requirementIds: ["req-7", "req-8", "req-3"] }
  ],

  plans: [
    { id: "plan-1", code: "TP-01", name: "Model V&V Campaign", description: "Verification and validation of the component models against accredited referent data and SME judgment — builds the V&V evidence package supporting the accreditation decision.",
      phase: "V&V", status: "Active", start: "2026-08-03", end: "2026-10-16", decisionId: "dec-1",
      caseIds: ["tc-3", "tc-4", "tc-5", "tc-7", "tc-11", "tc-14"] },
    { id: "plan-2", code: "TP-02", name: "HWIL Integration & Acceptance", description: "Integration and acceptance testing of the coupled sim + hardware rig: latency, time sync, safety chain, bus coverage, and operator station — supports the Sim Readiness Review.",
      phase: "Integration", status: "Active", start: "2026-08-24", end: "2026-11-20", decisionId: "dec-2",
      caseIds: ["tc-1", "tc-2", "tc-6", "tc-8", "tc-9", "tc-10", "tc-12", "tc-13"] }
  ],

  /* Schedule events. type: Test Event | Review | Milestone | Decision Point |
     Delivery | Range Window.  status: Planned | In Progress | Complete |
     Slipped | Cancelled.  notes: dated annotations. */
  events: [
    { id: "evt-1", code: "EVT-01", title: "Sim build 0.9 release to rig", type: "Delivery", status: "Complete",
      start: "2026-08-03", end: "", location: "HWIL Lab", planId: "", decisionId: "",
      description: "Tagged 0.9 build deployed to the HWIL rig; baseline for the V&V campaign.",
      notes: [{ id: "note-1", date: "2026-08-03", text: "Deployed clean; smoke suite green. Build hash recorded in CM log." }] },
    { id: "evt-2", code: "EVT-02", title: "TP-01 Model V&V campaign window", type: "Test Event", status: "In Progress",
      start: "2026-08-03", end: "2026-10-16", location: "Sim Lab", planId: "plan-1", decisionId: "dec-1",
      description: "Execution window for the model validation campaign against the accredited referent set.",
      notes: [{ id: "note-2", date: "2026-09-01", text: "RUN-006 washboard fidelity failure — recalibration in work (RSK-001). Campaign schedule holds for now." }] },
    { id: "evt-3", code: "EVT-03", title: "4-hour endurance & time-sync run", type: "Test Event", status: "Complete",
      start: "2026-08-21", end: "", location: "HWIL Lab", planId: "plan-2", decisionId: "",
      description: "First full-duration endurance run with drift sampling (PROC-03).",
      notes: [{ id: "note-3", date: "2026-08-21", text: "Frame rate and memory stable. Drift trend suggests ~0.8 ms at hour 4 — watch item (RSK-006)." }] },
    { id: "evt-4", code: "EVT-04", title: "AO acceptability-criteria working session", type: "Review", status: "Planned",
      start: "2026-09-30", end: "", location: "PEO Sim (virtual)", planId: "", decisionId: "dec-1",
      description: "Working session with the accreditation authority to baseline acceptability criteria against the intended-use statement (RSK-004 mitigation).",
      notes: [] },
    { id: "evt-5", code: "EVT-05", title: "Latency retest after thread isolation", type: "Test Event", status: "Planned",
      start: "2026-09-29", end: "", location: "HWIL Lab", planId: "plan-2", decisionId: "dec-2",
      description: "Re-run PROC-01 transient-load condition after render-thread isolation fix (RSK-002 mitigation).",
      notes: [] },
    { id: "evt-6", code: "EVT-06", title: "Referent supplemental data collection", type: "Range Window", status: "Planned",
      start: "2026-10-05", end: "2026-10-09", location: "Proving Ground, Lane C", planId: "", decisionId: "dec-1",
      description: "Instrumented drives on the real truck: hot-ambient engagement cycles and night ops to close referent gaps (RSK-003).",
      notes: [{ id: "note-4", date: "2026-09-08", text: "Truck program confirmed window share; instrumentation package request submitted." }] },
    { id: "evt-7", code: "EVT-07", title: "V&V Report submission to AO", type: "Milestone", status: "Planned",
      start: "2026-10-23", end: "", location: "", planId: "plan-1", decisionId: "dec-1",
      description: "MIL-STD-3022 V&V Report delivered to the accreditation authority — closes TP-01 exit criteria.",
      notes: [] },
    { id: "evt-8", code: "EVT-08", title: "M&S Accreditation Decision", type: "Decision Point", status: "Planned",
      start: "2026-10-30", end: "", location: "PEO Sim", planId: "", decisionId: "dec-1",
      description: "AO renders the accreditation determination for the integrated simulation's intended use.",
      notes: [{ id: "note-5", date: "2026-09-05", text: "Risk: acceptability criteria still unbaselined (RSK-004). Date holds pending EVT-04 outcome." }] },
    { id: "evt-9", code: "EVT-09", title: "Sim Readiness Review (SRR-2)", type: "Decision Point", status: "Planned",
      start: "2026-11-25", end: "", location: "Program Office", planId: "plan-2", decisionId: "dec-2",
      description: "Readiness review for crew-in-the-loop DT&E — TP-02 results, caveats, and VV&A status package.",
      notes: [] }
  ],

  runs: [
    { id: "run-1", code: "RUN-001", caseId: "tc-4",  planId: "plan-1", date: "2026-08-14", operator: "M. Reyes",   result: "Pass", measured: "1.8% torque dev / 2.4% fuel dev", evidence: "VV-PT-01.pdf\ndyno-cmp-0814.csv", notes: "Torque curve within 1.8%, fuel burn within 2.4% of dyno referent. Report VV-PT-01 archived." },
    { id: "run-2", code: "RUN-002", caseId: "tc-7",  planId: "plan-1", date: "2026-08-19", operator: "A. Chen",    result: "Pass", notes: "Bit-exact replay over 30 min confirmed on two configurations. Hash logs archived." },
    { id: "run-3", code: "RUN-003", caseId: "tc-6",  planId: "plan-2", date: "2026-08-21", operator: "A. Chen",    result: "Pass", measured: "71 FPS sustained (64 FPS transient min)", evidence: "perf-0821.json", notes: "Sustained 71 FPS at max density; transient dips to 64 FPS during fault bursts — within spec." },
    { id: "run-4", code: "RUN-004", caseId: "tc-8",  planId: "plan-2", date: "2026-08-27", operator: "J. Novak",   result: "Pass", measured: "41 ms worst path", evidence: "estop-timing-0827.csv", notes: "Worst path 41 ms (station 2 → sim freeze). All stations well under 100 ms." },
    { id: "run-5", code: "RUN-005", caseId: "tc-9",  planId: "plan-2", date: "2026-08-27", operator: "J. Novak",   result: "Pass", notes: "All interlocks inhibit correctly; comms-watchdog annunciation delayed ~1 s (cosmetic, OBS-007)." },
    { id: "run-6", code: "RUN-006", caseId: "tc-3",  planId: "plan-1", date: "2026-09-01", operator: "M. Reyes",   result: "Fail", measured: "7.2% RMS (washboard, susp travel)", evidence: "vvcmp-0901/\nDEF-001", notes: "Washboard maneuver RMS error 7.2% (suspension travel channel). On-road maneuvers all ≤ 3.1%. See RSK-001 — tire model off-road regime." },
    { id: "run-7", code: "RUN-007", caseId: "tc-1",  planId: "plan-2", date: "2026-09-04", operator: "J. Novak",   result: "Fail", measured: "26 ms P99 (transient load)", evidence: "lat-0904.parquet\nDEF-002", notes: "P99 latency 26 ms under transient load (render thread contention). Idle/full-scene within spec. See RSK-002." },
    { id: "run-8", code: "RUN-008", caseId: "tc-5",  planId: "plan-1", date: "2026-09-08", operator: "M. Reyes",   result: "In Progress", measured: "+1.7 °C worst dev (6/10 segments)", evidence: "", notes: "6 of 10 duty-cycle segments compared; worst deviation so far +1.7 °C on return line." },
    { id: "run-9", code: "RUN-009", caseId: "tc-6",  planId: "plan-2", date: "2026-09-06", operator: "A. Chen",    result: "Pass", measured: "74 FPS sustained", evidence: "perf-0906.json", notes: "Re-run after shader batching optimization; sustained rate up from 71 to 74 FPS at max density." }
  ],

  /* Documents: external links or embedded uploads (dataUrl). */
  documents: [
    { id: "doc-1", code: "DOC-01", title: "MSM-1 T&E Strategy (TEMP) v0.4", docType: "Test Plan",
      url: "\\\\program-share\\msm1\\TE-Strategy_v0.4.docx", fileName: "", fileSize: 0, fileType: "", dataUrl: "",
      relatedCodes: "DP-01, TP-01, TP-02", added: "2026-08-01",
      description: "Working draft of the T&E Strategy including the IDSK and resource summary. CM-controlled on the program share." },
    { id: "doc-2", code: "DOC-02", title: "V&V Plan (MIL-STD-3022 format)", docType: "V&V Artifact",
      url: "\\\\program-share\\msm1\\vva\\VV-Plan_signed.pdf", fileName: "", fileSize: 0, fileType: "", dataUrl: "",
      relatedCodes: "RES-02, RES-01, DP-01", added: "2026-08-12",
      description: "Approved V&V Plan for the integrated simulation and component models; basis of the accreditation evidence package." },
    { id: "doc-3", code: "DOC-03", title: "Referent Dataset Description & CM Record", docType: "Reference",
      url: "https://wiki.example.mil/msm1/referent-dataset", fileName: "", fileSize: 0, fileType: "", dataUrl: "",
      relatedCodes: "RES-04, TC-003", added: "2026-08-05",
      description: "Instrumentation configuration, maneuver catalog, and checksum record for the reference truck telemetry set." }
  ],

  /* Bugs / defects. severity: Critical | Major | Minor | Cosmetic.
     status: Open | In Analysis | Fix In Work | Ready for Retest | Closed | Deferred */
  defects: [
    { id: "def-1", code: "DEF-001", title: "Suspension travel under-predicted on washboard", severity: "Major", status: "Fix In Work",
      componentId: "cmp-5", caseIds: ["tc-3"], runId: "run-6", owner: "Vehicle Model IPT", opened: "2026-09-01", closed: "",
      description: "Tire/terrain model under-predicts suspension travel on washboard surface by ~7% RMS vs referent (RUN-006). Root cause suspected in tire lug-stiffness table extrapolation beyond 30 Hz input. Blocks REQ-002 validation off-road; feeds RSK-001." },
    { id: "def-2", code: "DEF-002", title: "Render thread starves bus bridge under fault bursts", severity: "Critical", status: "Fix In Work",
      componentId: "cmp-4", caseIds: ["tc-1"], runId: "run-7", owner: "Sim Core Team", opened: "2026-09-04", closed: "",
      description: "During fault-injection bursts the render thread contends with the bus-bridge thread, pushing P99 HWIL latency to 26 ms (REQ-001 threshold 20 ms). Fix: core isolation + priority decoupling (RSK-002 mitigation)." },
    { id: "def-3", code: "DEF-003", title: "Comms-watchdog interlock annunciation delayed ~1 s", severity: "Minor", status: "Open",
      componentId: "cmp-12", caseIds: ["tc-9"], runId: "run-5", owner: "HWIL Team", opened: "2026-08-27", closed: "",
      description: "Interlock inhibit is immediate but the HMI annunciation for the comms-watchdog path lags about 1 second (observation OBS-007 on RUN-005). Cosmetic to safety function; still needs disposition before SRR-2." },
    { id: "def-4", code: "DEF-004", title: "Terrain LOD pop-in above 40 m/s", severity: "Cosmetic", status: "Open",
      componentId: "cmp-2", caseIds: [], runId: "", owner: "Sim Core Team", opened: "2026-08-24", closed: "",
      description: "Visible level-of-detail transitions on terrain meshes at high closure speeds. No effect on physics or measured fidelity; noted by SMEs during dry runs." }
  ],

  risks: [
    { id: "rsk-1", code: "RSK-001", title: "Tire model fidelity gap off-road", category: "Technical",
      description: "The tire/terrain interaction model under-predicts suspension travel on washboard surfaces (7.2% RMS on RUN-006 vs 5% requirement), threatening validation of the dynamics model and downstream accreditation for off-road use cases.",
      likelihood: 4, impact: 4, initialLikelihood: 3, initialImpact: 4, residualLikelihood: 2, residualImpact: 3, status: "Mitigating", owner: "Vehicle Model IPT",
      relatedRequirementIds: ["req-2"], relatedCaseIds: ["tc-3", "tc-14"],
      mitigations: [
        { id: "mit-1", text: "Recalibrate tire model stiffness/damping against washboard segment of referent set.", status: "In Progress", owner: "Vehicle Model IPT", due: "2026-09-18" },
        { id: "mit-2", text: "Add dedicated off-road validation case to TP-01 to bound the accredited envelope.", status: "Approved", owner: "Test Team", due: "2026-09-25" },
        { id: "mit-3", text: "If gap persists, propose accreditation scope excluding washboard regime (AO decision).", status: "Proposed", owner: "Program Office", due: "2026-10-09" }
      ] },
    { id: "rsk-2", code: "RSK-002", title: "Latency exceedance under transient load", category: "Technical",
      description: "Render-thread contention pushes P99 HWIL latency to 26 ms during fault-injection bursts (RUN-007), exceeding the 20 ms CTP and risking control-feel artifacts for HWIL crew testing.",
      likelihood: 3, impact: 4, status: "Mitigating", owner: "HWIL Team",
      relatedRequirementIds: ["req-1"], relatedCaseIds: ["tc-1"],
      mitigations: [
        { id: "mit-4", text: "Move physics/bus bridge to isolated cores; decouple render thread priority.", status: "In Progress", owner: "Sim Core Team", due: "2026-09-22" },
        { id: "mit-5", text: "Re-run PROC-01 transient condition after thread isolation change.", status: "Proposed", owner: "Test Team", due: "2026-09-29" }
      ] },
    { id: "rsk-3", code: "RSK-003", title: "Referent data gaps for validation", category: "Programmatic",
      description: "The accredited referent set (RES-04) lacks high-temperature engagement cycles and night operations, which may leave parts of the intended-use envelope unvalidatable and force accreditation caveats.",
      likelihood: 4, impact: 3, status: "Open", owner: "Data Management",
      relatedRequirementIds: ["req-6", "req-2"], relatedCaseIds: ["tc-5", "tc-3"],
      mitigations: [
        { id: "mit-6", text: "Request supplemental instrumented drives from the truck program's next range window.", status: "Approved", owner: "Program Office", due: "2026-10-02" }
      ] },
    { id: "rsk-4", code: "RSK-004", title: "Accreditation criteria undefined", category: "Programmatic",
      description: "The accreditation authority has not yet issued acceptability criteria for the integrated sim's intended use; V&V evidence being collected now may not match what the AO ultimately requires (rework risk to the VV&A package).",
      likelihood: 3, impact: 4, initialLikelihood: 3, initialImpact: 4, residualLikelihood: 2, residualImpact: 2, status: "Mitigating", owner: "Program Office",
      relatedRequirementIds: [], relatedCaseIds: ["tc-14"],
      mitigations: [
        { id: "mit-7", text: "Convene AO working session to baseline acceptability criteria against intended-use statement.", status: "In Progress", owner: "Program Office", due: "2026-09-30" },
        { id: "mit-8", text: "Map every TP-01 case to a draft acceptability criterion; identify evidence gaps.", status: "Proposed", owner: "V&V Agent", due: "2026-10-14" }
      ] },
    { id: "rsk-5", code: "RSK-005", title: "HWIL rig personnel safety", category: "Safety",
      description: "The rig couples live truck hardware (high-voltage power system, moving actuators) to software under development; a sim fault commanding hardware could endanger personnel at the rig.",
      likelihood: 2, impact: 5, initialLikelihood: 3, initialImpact: 5, residualLikelihood: 1, residualImpact: 5, status: "Mitigating", owner: "Safety Officer",
      relatedRequirementIds: ["req-10"], relatedCaseIds: ["tc-8", "tc-9"],
      mitigations: [
        { id: "mit-9", text: "Hardware output limiter independent of sim software (verified in PROC-04).", status: "Verified", owner: "HWIL Team", due: "2026-08-20" },
        { id: "mit-10", text: "Two-person rule for any run with actuators live; barrier zone marked.", status: "In Progress", owner: "Safety Officer", due: "2026-11-20" }
      ] },
    { id: "rsk-6", code: "RSK-006", title: "Clock drift accumulation on long runs", category: "Technical",
      description: "Early spot checks suggest drift may approach the 1 ms budget near hour 4, which would corrupt time-aligned validation comparisons and long-duration crew sessions.",
      likelihood: 3, impact: 3, status: "Open", owner: "HWIL Team",
      relatedRequirementIds: ["req-9"], relatedCaseIds: ["tc-2"],
      mitigations: [
        { id: "mit-11", text: "Evaluate PTP grandmaster upgrade for the rig network.", status: "Proposed", owner: "HWIL Team", due: "2026-10-05" }
      ] },
    { id: "rsk-7", code: "RSK-007", title: "GPU obsolescence vs frame-rate requirement", category: "Cost",
      description: "The reference GPU configuration is end-of-life; replacement hardware changes the performance baseline and could invalidate frame-rate and latency results already collected.",
      likelihood: 2, impact: 3, status: "Monitoring", owner: "Program Office",
      relatedRequirementIds: ["req-3", "req-1"], relatedCaseIds: ["tc-6"],
      mitigations: [
        { id: "mit-12", text: "Lifetime-buy two spare reference GPUs; hold under CM.", status: "Complete", owner: "Program Office", due: "2026-08-28" },
        { id: "mit-13", text: "Define regression subset to re-run on any hardware baseline change.", status: "Approved", owner: "Test Team", due: "2026-10-30" }
      ] }
  ]
};
