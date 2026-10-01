/* ============================================================
   Seed / demo dataset — VANGUARD RIDGE MILSIM Training Suite
   A fictional military-simulation training game with two
   trainers and the shared simulation services both run on:
     SYS-01 Desktop Tactical Trainer   (PC, keyboard/mouse/gamepad)
     SYS-02 Shared Simulation Services (ballistics, OPFOR AI,
            terrain, networking, after-action review)
     SYS-03 Immersive Virtual Trainer  (VR pod: headset, haptics,
            recoil replicas, treadmill, physical safety chain)
   All names, people, numbers and links are invented demo data,
   laid out so every page and workflow has something to exercise:
   passes/fails/blocked/waived/review-for-removal results, a
   retired case, system-level cases, nested subcomponents, PSPEC
   and SW requirements with flow-down, an uncovered requirement,
   program-level records with ownership suggestions, builds that
   were rejected or are untested release candidates, defects at
   every workflow stage with retest prompts, overdue events, and
   weekly snapshot history for the dashboard trends.
   ============================================================ */

const SEED_DB = {
  meta: {
    program: "VANGUARD RIDGE MILSIM Training Suite",
    version: 2,
    seq: { systems: 3, components: 23, requirements: 26, "requirements.REQ": 16, "requirements.PSPEC": 5, "requirements.SWR": 5, cases: 33, procedures: 7, criteria: 33, plans: 4, runs: 29, risks: 8, mitigations: 17, resources: 8, decisions: 4, events: 15, notes: 10, defects: 10, documents: 5, testRuns: 4, releases: 4, builds: 12 }
  },

  systems: [
    { id: "sys-1", code: "SYS-01", name: "Desktop Tactical Trainer", team: "Desktop Trainer Team", lead: "R. Okafor",
      description: "PC-based squad and platoon tactics trainer for home-station use: keyboard/mouse or gamepad, up to 32 trainees per exercise, an instructor console for live intervention, and desktop after-action review." },
    { id: "sys-2", code: "SYS-02", name: "Shared Simulation Services", team: "Sim Services Core", lead: "D. Vance",
      description: "The common simulation backbone both trainers run on: ballistics and weapons effects, OPFOR AI, terrain database and streaming, exercise control and networking (DIS/HLA), and the after-action data recorder." },
    { id: "sys-3", code: "SYS-03", name: "Immersive Virtual Trainer", team: "Immersive Systems Team", lead: "L. Haddad",
      description: "Fully immersive VR trainer: tracked headsets, haptic vests, recoil-enabled weapon replicas and an omnidirectional treadmill inside a training pod, with a physical safety chain protecting the trainee." }
  ],

  components: [
    /* SYS-01 Desktop Tactical Trainer */
    { id: "cmp-1",  code: "CMP-01", systemId: "sys-1", name: "Game Client & Renderer",       description: "Windows game client: Vulkan renderer, UI shell, settings and crash reporting." },
    { id: "cmp-2",  code: "CMP-02", systemId: "sys-1", name: "Input & Controls",             description: "Keyboard/mouse and gamepad mapping, remapping UI and one-handed accessibility schemes." },
    { id: "cmp-3",  code: "CMP-03", systemId: "sys-1", name: "Instructor Console",           description: "Exercise setup, trainee monitoring and live intervention (pause, inject events, resume)." },
    { id: "cmp-4",  code: "CMP-04", systemId: "sys-1", name: "Comms & Radio Sim",            description: "Simulated radio nets with push-to-talk, range-based degradation and jamming effects." },
    { id: "cmp-16", code: "CMP-16", systemId: "sys-1", parentComponentId: "cmp-1",  name: "HUD & Map Overlays",       description: "Heads-up display, minimap and tactical map overlays rendered by the client." },
    { id: "cmp-17", code: "CMP-17", systemId: "sys-1", parentComponentId: "cmp-16", name: "Compass & Laser Overlay",  description: "Compass tape and laser-designator overlay drawn inside the HUD layer." },
    { id: "cmp-18", code: "CMP-18", systemId: "sys-1", parentComponentId: "cmp-3",  name: "AAR Playback Viewer",      description: "Desktop after-action review viewer that plays back recorded exercises for the instructor." },
    /* SYS-02 Shared Simulation Services */
    { id: "cmp-5",  code: "CMP-05", systemId: "sys-2", name: "Ballistics & Weapons Effects", description: "Projectile flight, terminal effects and weapon behaviour shared by both trainers." },
    { id: "cmp-13", code: "CMP-13", systemId: "sys-2", parentComponentId: "cmp-5",  name: "External Ballistics Solver", description: "Point-mass trajectory solver with wind, drag and Coriolis terms." },
    { id: "cmp-14", code: "CMP-14", systemId: "sys-2", parentComponentId: "cmp-13", name: "Drag Coefficient Tables",    description: "G1/G7 drag tables by Mach number used by the solver (suspected root of DEF-001)." },
    { id: "cmp-6",  code: "CMP-06", systemId: "sys-2", name: "OPFOR AI Behavior",            description: "Opposing-force behaviour trees: cover use, fire and movement, flanking and morale." },
    { id: "cmp-7",  code: "CMP-07", systemId: "sys-2", name: "Terrain Database & Streaming", description: "Correlated training terrain, materials and runtime tile streaming to both trainers." },
    { id: "cmp-8",  code: "CMP-08", systemId: "sys-2", name: "Exercise Control & Networking", description: "Session server, entity-state replication and exercise lifecycle for up to 32 trainees." },
    { id: "cmp-19", code: "CMP-19", systemId: "sys-2", parentComponentId: "cmp-8",  name: "DIS/HLA Gateway",           description: "Bridges exercises to unit simulations over DIS and HLA." },
    { id: "cmp-20", code: "CMP-20", systemId: "sys-2", name: "AAR Data Recorder",            description: "Records entity state and events for after-action review and xAPI training-record export." },
    /* SYS-03 Immersive Virtual Trainer */
    { id: "cmp-9",  code: "CMP-09", systemId: "sys-3", name: "Headset & Tracking",           description: "VR headsets, inside-out tracking and pose prediction." },
    { id: "cmp-23", code: "CMP-23", systemId: "sys-3", parentComponentId: "cmp-9",  name: "Comfort & Cybersickness Settings", description: "Vignetting, snap-turn and session-length comfort features." },
    { id: "cmp-10", code: "CMP-10", systemId: "sys-3", name: "Locomotion Treadmill",         description: "Omnidirectional treadmill and its controller firmware." },
    { id: "cmp-11", code: "CMP-11", systemId: "sys-3", name: "Haptics & Weapon Replicas",    description: "Haptic vests and tethered weapon replicas with recoil." },
    { id: "cmp-21", code: "CMP-21", systemId: "sys-3", parentComponentId: "cmp-11", name: "Recoil Actuator Controller", description: "Gas-free recoil actuator and its impulse profiles per weapon." },
    { id: "cmp-12", code: "CMP-12", systemId: "sys-3", name: "Safety Interlock Chain",       description: "Pod door, harness and tether interlocks that inhibit the treadmill and session start." },
    { id: "cmp-15", code: "CMP-15", systemId: "sys-3", parentComponentId: "cmp-12", name: "E-Stop & Guardian Network", description: "Three e-stop stations and the guardian boundary that halt the treadmill and black out the headset." },
    { id: "cmp-22", code: "CMP-22", systemId: "sys-3", name: "Pod Operator Station",          description: "Operator console for session control, trainee monitoring and emergency stop." }
  ],

  /* measure: None | KPP | KSA | CTP | TPM | MOP | MOE | Spec.  reqClass: absent = System. */
  requirements: [
    { id: "req-1",  code: "REQ-001", systemId: "sys-2", title: "Exercise network latency", text: "Exercise state updates shall reach every connected trainee client within 100 ms (P95) in a 32-trainee exercise.", type: "Performance", priority: "Critical", method: "Test", measure: "KPP", threshold: "≤ 100 ms P95", objective: "≤ 60 ms P95", extKey: "VR-101", componentIds: ["cmp-8", "cmp-19"] },
    { id: "req-2",  code: "REQ-002", systemId: "sys-2", title: "Ballistic trajectory fidelity", text: "Simulated trajectories for 5.56 mm and 7.62 mm service ammunition shall match published firing tables within 2% drop out to 600 m.", type: "Performance", priority: "Critical", method: "Analysis", measure: "CTP", threshold: "≤ 2% drop error to 600 m", objective: "≤ 1% drop error", extKey: "VR-102", componentIds: ["cmp-5", "cmp-13"] },
    { id: "req-3",  code: "REQ-003", systemId: "sys-1", title: "Desktop frame rate", text: "The desktop trainer shall sustain at least 60 FPS at 1080p (high preset) on the minimum-spec training PC with a 32-trainee exercise loaded.", type: "Performance", priority: "High", method: "Test", measure: "TPM", threshold: "≥ 60 FPS", objective: "≥ 120 FPS", componentIds: ["cmp-1"] },
    { id: "req-4",  code: "REQ-004", systemId: "sys-3", title: "Motion-to-photon latency", text: "Head motion to displayed image latency in the IVT shall not exceed 20 ms.", type: "Performance", priority: "Critical", method: "Test", measure: "CTP", threshold: "≤ 20 ms", objective: "≤ 12 ms", extKey: "VR-104", componentIds: ["cmp-9"] },
    { id: "req-5",  code: "REQ-005", systemId: "sys-2", title: "OPFOR tactical realism", text: "OPFOR AI shall use cover, fire and movement, and flanking consistent with the threat doctrine handbook in at least 90% of SME-rated engagements.", type: "Operational", priority: "High", method: "Demonstration", measure: "MOE", threshold: "≥ 90% rated realistic", objective: "", componentIds: ["cmp-6"] },
    { id: "req-6",  code: "REQ-006", systemId: "sys-3", title: "Treadmill boundary deceleration", text: "The treadmill shall bring a trainee from 3 m/s to rest within 0.5 s on boundary approach without loss of footing.", type: "Safety", priority: "Critical", method: "Test", measure: "CTP", threshold: "≤ 0.5 s, no falls", objective: "≤ 0.35 s", componentIds: ["cmp-10"] },
    { id: "req-7",  code: "REQ-007", systemId: "sys-2", title: "Deterministic AAR replay", text: "A recorded exercise shall replay in the AAR to an identical entity-state trajectory on the same build.", type: "Functional", priority: "High", method: "Test", measure: "Spec", threshold: "Bit-exact over 60 min", objective: "", componentIds: ["cmp-20", "cmp-8"] },
    { id: "req-8",  code: "REQ-008", systemId: "sys-1", title: "Instructor live intervention", text: "The instructor shall be able to pause, inject events (casualty, ammo cache, comms jam, weather, OPFOR reinforcement) and resume an exercise without disconnecting trainees.", type: "Functional", priority: "Medium", method: "Demonstration", measure: "MOP", threshold: "5/5 intervention types", objective: "", componentIds: ["cmp-3"] },
    { id: "req-9",  code: "REQ-009", systemId: "sys-3", title: "Haptic hit feedback timing", text: "Haptic vest hit feedback shall fire within 50 ms of the simulated round impact.", type: "Performance", priority: "High", method: "Test", measure: "TPM", threshold: "≤ 50 ms", objective: "≤ 25 ms", componentIds: ["cmp-11"] },
    { id: "req-10", code: "REQ-010", systemId: "sys-3", title: "E-stop and guardian response", text: "Activation of any pod e-stop or a guardian boundary breach shall halt the treadmill and black out the headset within 100 ms.", type: "Safety", priority: "Critical", method: "Test", measure: "CTP", threshold: "≤ 100 ms", objective: "≤ 50 ms", componentIds: ["cmp-12", "cmp-10"] },
    { id: "req-11", code: "REQ-011", systemId: "sys-2", title: "Terrain correlation", text: "Training terrain shall correlate with the source elevation data and range survey within 1 m horizontal and 0.5 m vertical.", type: "Environmental", priority: "Medium", method: "Analysis", measure: "TPM", threshold: "≤ 1 m H / 0.5 m V", objective: "", componentIds: ["cmp-7"] },
    { id: "req-12", code: "REQ-012", systemId: "sys-3", title: "Weapon replica recoil fidelity", text: "Weapon replicas shall reproduce recoil impulse within 15% of the live weapon, with sight picture aligned within 1 MOA.", type: "Interface", priority: "High", method: "Demonstration", measure: "MOP", threshold: "≤ 15% impulse, ≤ 1 MOA", objective: "", componentIds: ["cmp-11", "cmp-21"] },
    { id: "req-13", code: "REQ-013", systemId: "sys-1", title: "Radio net fidelity", text: "The comms simulator shall support 6 simultaneous radio nets with push-to-talk, range-based degradation and jamming effects for a 2-hour exercise.", type: "Functional", priority: "Medium", method: "Test", measure: "MOP", threshold: "6 nets, 2 h", objective: "", componentIds: ["cmp-4"] },
    { id: "req-14", code: "REQ-014", systemId: "sys-3", title: "Cybersickness exposure", text: "At least 90% of trainees shall complete a 30-minute IVT session with an SSQ total score of 20 or less.", type: "Safety", priority: "High", method: "Test", measure: "MOE", threshold: "≥ 90% at SSQ ≤ 20", objective: "≥ 95%", componentIds: ["cmp-9", "cmp-23"] },
    /* Program-level (no owning system yet) — the Ownership page suggests an owner for each. */
    { id: "req-15", code: "REQ-015", title: "Training record export (xAPI)", text: "Each exercise shall export trainee performance records as xAPI statements to the unit learning record store.", type: "Interface", priority: "Medium", method: "Inspection", measure: "Spec", threshold: "100% of scored events", objective: "", componentIds: ["cmp-20"] },
    { id: "req-16", code: "REQ-016", title: "Accessible controls", text: "Every desktop trainer action shall be remappable and operable with a one-handed control scheme.", type: "Operational", priority: "Low", method: "Inspection", measure: "Spec", threshold: "100% of actions", objective: "", componentIds: ["cmp-2"] },
    /* PSPECs */
    { id: "req-17", code: "PSPEC-001", reqClass: "PSPEC", systemId: "sys-2", title: "Session server tick stability", text: "The session server shall simulate at a fixed 60 Hz tick with at most 2 ms jitter under 32 clients.", type: "Performance", priority: "High", method: "Test", measure: "TPM", threshold: "60 Hz, ≤ 2 ms jitter", objective: "", componentIds: ["cmp-8"], derivedFromIds: ["req-1"] },
    { id: "req-18", code: "PSPEC-002", reqClass: "PSPEC", systemId: "sys-2", title: "Drag table resolution", text: "Drag coefficient tables shall cover Mach 0.5 to 3.0 in steps of 0.05 Mach or finer for G1 and G7 models.", type: "Performance", priority: "High", method: "Analysis", measure: "TPM", threshold: "Mach 0.5–3.0, ≤ 0.05 step", objective: "", componentIds: ["cmp-14"], derivedFromIds: ["req-2"] },
    { id: "req-19", code: "PSPEC-003", reqClass: "PSPEC", systemId: "sys-1", title: "Desktop frame-time budget", text: "Each desktop frame shall complete within 16.6 ms (P99) on the minimum-spec PC.", type: "Performance", priority: "High", method: "Test", measure: "TPM", threshold: "≤ 16.6 ms P99", objective: "≤ 8.3 ms", componentIds: ["cmp-1"], derivedFromIds: ["req-3"] },
    { id: "req-20", code: "PSPEC-004", reqClass: "PSPEC", systemId: "sys-3", title: "Pose prediction accuracy", text: "Head-pose prediction shall extrapolate at least 15 ms ahead with no more than 0.3° error.", type: "Performance", priority: "High", method: "Test", measure: "TPM", threshold: "≤ 0.3° at 15 ms", objective: "", componentIds: ["cmp-9"], derivedFromIds: ["req-4"] },
    { id: "req-21", code: "PSPEC-005", reqClass: "PSPEC", systemId: "sys-3", title: "Guardian boundary distances", text: "Guardian warnings shall trigger at least 0.6 m from the pod wall and hard-stop the treadmill at 0.3 m.", type: "Safety", priority: "Critical", method: "Test", measure: "CTP", threshold: "warn ≥ 0.6 m, stop at 0.3 m", objective: "", componentIds: ["cmp-15"], derivedFromIds: ["req-10"] },
    /* SW requirements */
    { id: "req-22", code: "SWR-001", reqClass: "SW", systemId: "sys-1", title: "Pause/resume state integrity", text: "The instructor console software shall pause and resume an exercise without desynchronizing any trainee client.", type: "Functional", priority: "Medium", method: "Test", measure: "Spec", threshold: "0 desyncs in 50 cycles", objective: "", componentIds: ["cmp-3"], derivedFromIds: ["req-8"] },
    { id: "req-23", code: "SWR-002", reqClass: "SW", systemId: "sys-2", title: "AAR state checksum", text: "The AAR recorder software shall checksum the full entity state at least once per simulated second.", type: "Functional", priority: "High", method: "Test", measure: "Spec", threshold: "≥ 1 Hz", objective: "", componentIds: ["cmp-20"], derivedFromIds: ["req-7"] },
    { id: "req-24", code: "SWR-003", reqClass: "SW", systemId: "sys-3", title: "Treadmill stop command handler", text: "On an e-stop the treadmill controller software shall command zero belt velocity within one 10 ms control cycle.", type: "Safety", priority: "Critical", method: "Test", measure: "CTP", threshold: "≤ 10 ms", objective: "", componentIds: ["cmp-15", "cmp-10"], derivedFromIds: ["req-10", "req-6"] },
    { id: "req-25", code: "SWR-004", reqClass: "SW", systemId: "sys-3", title: "Haptic event queue", text: "The haptics service shall process impact events in arrival order with no drops at 200 events per second.", type: "Performance", priority: "High", method: "Test", measure: "TPM", threshold: "0 drops at 200/s", objective: "", componentIds: ["cmp-11"], derivedFromIds: ["req-9"] },
    { id: "req-26", code: "SWR-005", reqClass: "SW", systemId: "sys-2", title: "OPFOR decision logging", text: "The OPFOR AI software shall log every tactical decision with its stimulus and chosen action for AAR review.", type: "Functional", priority: "Medium", method: "Test", measure: "Spec", threshold: "100% of decisions logged", objective: "", componentIds: ["cmp-6"], derivedFromIds: ["req-5"] }
  ],

  /* M&S assets & test resources with VV&A tracking. */
  resources: [
    { id: "res-1", code: "RES-01", systemId: "sys-2", name: "Ballistics Model v3", type: "Model", vvaRequired: true,
      description: "Point-mass external ballistics and terminal-effects model shared by both trainers.",
      intendedUse: "Marksmanship and squad live-fire rehearsal with 5.56 mm and 7.62 mm service ammunition out to 600 m.",
      owner: "Sim Services Core", authority: "Training M&S Accreditation Authority",
      verification: "Complete", validation: "In Progress", accreditation: "Evidence In Review", accDate: "", accScope: "",
      artifacts: { accPlan: true, vvPlan: true, vvReport: false, accReport: false } },
    { id: "res-2", code: "RES-02", name: "VANGUARD RIDGE Integrated Trainer", type: "Simulation", vvaRequired: true,
      description: "The integrated training game across both trainers and the shared services — the system this program is building.",
      intendedUse: "Squad and platoon collective training at home station (desktop) and immersive close-quarters training (IVT).",
      owner: "Program Office", authority: "Training M&S Accreditation Authority",
      verification: "In Progress", validation: "Planned", accreditation: "Not Started", accDate: "", accScope: "",
      artifacts: { accPlan: false, vvPlan: true, vvReport: false, accReport: false } },
    { id: "res-3", code: "RES-03", systemId: "sys-3", name: "IVT Pod Rig", type: "HWIL Rig", vvaRequired: true,
      description: "Production training pod: treadmill, harness, tether, e-stop stations and guardian sensors, coupled to the IVT software.",
      intendedUse: "Provide real treadmill, haptic and safety-chain behaviour in the loop for acceptance and safety testing.",
      owner: "Immersive Systems Team", authority: "Safety Review Board",
      verification: "Complete", validation: "In Progress", accreditation: "Plan Approved", accDate: "", accScope: "",
      artifacts: { accPlan: true, vvPlan: true, vvReport: false, accReport: false } },
    { id: "res-4", code: "RES-04", name: "Published Firing Tables & Range Data", type: "Reference Dataset", vvaRequired: true,
      description: "Published firing tables plus instrumented range data for service ammunition — the ballistics validation referent.",
      intendedUse: "Authoritative referent for validating trajectory, drop and wind drift.",
      owner: "Data Management", authority: "Training M&S Accreditation Authority",
      verification: "Complete", validation: "Complete", accreditation: "Accredited", accDate: "2026-07-10", accScope: "Referent for 5.56 mm and 7.62 mm ball ammunition, 0–800 m, standard atmosphere.",
      artifacts: { accPlan: true, vvPlan: true, vvReport: true, accReport: true } },
    { id: "res-5", code: "RES-05", name: "Photon & Latency Measurement Kit", type: "Instrumentation", vvaRequired: false,
      description: "Photodiode rig, high-speed camera and timestamping toolchain for motion-to-photon and haptic timing.",
      intendedUse: "Measure display and haptic latency; calibration current through 2027-01-15.",
      owner: "Immersive Systems Team", authority: "",
      verification: "Complete", validation: "Complete", accreditation: "Not Started", accDate: "", accScope: "",
      artifacts: { accPlan: false, vvPlan: false, vvReport: false, accReport: false } },
    { id: "res-6", code: "RES-06", systemId: "sys-2", name: "OPFOR Behavior Model", type: "Model", vvaRequired: true,
      description: "Behaviour-tree model of opposing-force tactics derived from the threat doctrine handbook.",
      intendedUse: "Provide credible opposing-force tactics for squad and platoon collective training.",
      owner: "Sim Services Core", authority: "Training M&S Accreditation Authority",
      verification: "In Progress", validation: "Not Started", accreditation: "Not Started", accDate: "", accScope: "",
      artifacts: { accPlan: false, vvPlan: false, vvReport: false, accReport: false } },
    { id: "res-7", code: "RES-07", systemId: "sys-1", name: "Minimum-Spec Training PC", type: "Test Facility", vvaRequired: false,
      description: "Reference home-station PC (6-core CPU, 16 GB RAM, mid-range GPU) held under configuration management.",
      intendedUse: "Baseline hardware for desktop performance requirements.",
      owner: "Desktop Trainer Team", authority: "",
      verification: "Complete", validation: "Complete", accreditation: "Not Started", accDate: "", accScope: "",
      artifacts: { accPlan: false, vvPlan: false, vvReport: false, accReport: false } },
    { id: "res-8", code: "RES-08", name: "Terrain Source Data (Training Area North)", type: "Reference Dataset", vvaRequired: true,
      description: "Elevation, imagery and range survey data the training terrain is built from.",
      intendedUse: "Referent for terrain correlation and line-of-sight.",
      owner: "Data Management", authority: "Training M&S Accreditation Authority",
      verification: "Complete", validation: "Complete", accreditation: "Conditionally Accredited", accDate: "2026-08-20", accScope: "Day terrain inside the surveyed training area; excludes building interiors.",
      artifacts: { accPlan: true, vvPlan: true, vvReport: true, accReport: false } }
  ],

  procedures: [
    { id: "proc-1", code: "PROC-01", systemId: "sys-2", title: "Exercise Network Load & Latency Test", description: "Load a 32-client exercise with scripted bot trainees and measure state-update latency, tick stability and packet loss tolerance.",
      steps: [
        "Deploy the build under test to the session server and 32 bot clients.",
        "Start the scripted company-attack scenario; confirm all 32 clients connected.",
        "Record state-update latency at every client for 20 minutes.",
        "Inject 2% packet loss on 8 clients for 5 minutes.",
        "Record server tick interval and jitter for the whole run.",
        "Compute P95 latency per client; flag any client above 100 ms.",
        "Archive captures to the program data store."
      ] },
    { id: "proc-2", code: "PROC-02", systemId: "sys-2", title: "Ballistics Validation vs Firing Tables", description: "Fire scripted shot strings in the sim and compare drop, drift and time of flight against the published firing tables (RES-04).",
      steps: [
        "Load the accredited firing-table referent; verify checksum against the CM record.",
        "Set standard atmosphere and zero the weapon at 300 m.",
        "Fire 10-round strings at 100 m increments from 100 to 600 m for each ammunition type.",
        "Repeat with 5 and 10 m/s crosswinds.",
        "Compute drop and drift error per range; flag errors above 2%.",
        "Disposition exceedances with the ballistics team.",
        "Add the comparison report to the V&V evidence package."
      ] },
    { id: "proc-3", code: "PROC-03", systemId: "sys-1", title: "Desktop Performance Profiling", description: "Profile frame rate and frame time on the minimum-spec PC with a full exercise loaded.",
      steps: [
        "Image the minimum-spec PC (RES-07) from the CM baseline.",
        "Install the build under test; set 1080p high preset.",
        "Join a 32-trainee exercise as a rifleman; run the scripted 15-minute route.",
        "Capture frame times with the built-in profiler.",
        "Compute average FPS, 1% lows and P99 frame time.",
        "Attach the capture and summary to the run."
      ] },
    { id: "proc-4", code: "PROC-04", systemId: "sys-3", title: "Pod Safety Chain & E-Stop Verification", description: "Exercise every e-stop, guardian and interlock path; measure treadmill halt and headset blackout timing.",
      steps: [
        "Put the pod in safe mode with a 75 kg test mannequin on the treadmill.",
        "Instrument the e-stop path with timestamp capture (RES-05).",
        "Trigger each of the 3 e-stop stations at 3 m/s belt speed; record halt and blackout time.",
        "Walk the mannequin into the guardian boundary; record warning and hard-stop distances.",
        "Open each interlock (pod door, harness, tether) individually; verify session start is inhibited.",
        "Restore the chain; verify normal start-up recovers."
      ] },
    { id: "proc-5", code: "PROC-05", title: "SME Tactical Realism Jury", description: "Experienced infantry SMEs play scripted engagements and rate realism per behaviour area on a 5-point rubric.",
      steps: [
        "Brief SMEs on the scenario set and the rating rubric.",
        "Session 1: OPFOR defence of a compound.",
        "Session 2: OPFOR counter-attack and flanking.",
        "Session 3: marksmanship and weapon feel.",
        "Collect rubric scores and comments.",
        "Adjudicate any area scored below 3 with the owning team.",
        "Append the signed jury record to the V&V evidence package."
      ] },
    { id: "proc-6", code: "PROC-06", systemId: "sys-3", title: "IVT Comfort & Cybersickness Session", description: "Structured 30-minute IVT session with Simulator Sickness Questionnaire (SSQ) before and after.",
      steps: [
        "Confirm human-use approval and signed consent for each participant.",
        "Administer the pre-session SSQ.",
        "Run the 30-minute standard patrol scenario with default comfort settings.",
        "Stop the session at the participant's request or any SSQ symptom above moderate.",
        "Administer the post-session SSQ; compute total score.",
        "Record completion and score for each participant."
      ] },
    { id: "proc-7", code: "PROC-07", title: "AAR Replay Integrity Check", description: "Record an exercise, replay it in the AAR and compare entity state checksums frame by frame.",
      steps: [
        "Record a 60-minute exercise on the build under test.",
        "Export the recording with per-second state checksums.",
        "Replay the recording in the AAR on the same build.",
        "Compare checksums for every simulated second.",
        "Flag the first divergent second, if any, and attach the diff."
      ] }
  ],

  /* Entry & exit criteria. parentType: procedure | plan | release.  status: open | met | waived */
  criteria: [
    { id: "cri-1",  parentType: "procedure", parentId: "proc-1", kind: "entry", text: "32 bot clients provisioned on the isolated test network", status: "met" },
    { id: "cri-2",  parentType: "procedure", parentId: "proc-1", kind: "entry", text: "Build under test tagged and recorded in CM", status: "met" },
    { id: "cri-3",  parentType: "procedure", parentId: "proc-1", kind: "exit",  text: "Latency captured at all 32 clients for the full 20 minutes", status: "open" },
    { id: "cri-4",  parentType: "procedure", parentId: "proc-2", kind: "entry", text: "Firing-table referent (RES-04) accredited for this use", status: "met" },
    { id: "cri-5",  parentType: "procedure", parentId: "proc-2", kind: "entry", text: "Atmosphere and zero settings peer-reviewed by the ballistics lead", status: "open" },
    { id: "cri-6",  parentType: "procedure", parentId: "proc-2", kind: "exit",  text: "Drop and drift errors computed at every range; exceedances dispositioned", status: "open" },
    { id: "cri-7",  parentType: "procedure", parentId: "proc-3", kind: "entry", text: "Minimum-spec PC re-imaged from the CM baseline", status: "met" },
    { id: "cri-8",  parentType: "procedure", parentId: "proc-3", kind: "exit",  text: "Profiler capture attached to the run record", status: "met" },
    { id: "cri-9",  parentType: "procedure", parentId: "proc-4", kind: "entry", text: "Pod in safe mode with test mannequin (verified by safety officer)", status: "met" },
    { id: "cri-10", parentType: "procedure", parentId: "proc-4", kind: "entry", text: "E-stop timestamp capture verified with a known-good trigger", status: "met" },
    { id: "cri-11", parentType: "procedure", parentId: "proc-4", kind: "exit",  text: "Every e-stop, guardian and interlock path exercised with recorded timing", status: "met" },
    { id: "cri-12", parentType: "procedure", parentId: "proc-4", kind: "exit",  text: "Any response over 100 ms written up as a safety incident", status: "met" },
    { id: "cri-13", parentType: "procedure", parentId: "proc-5", kind: "entry", text: "At least 4 qualified infantry SMEs scheduled", status: "met" },
    { id: "cri-14", parentType: "procedure", parentId: "proc-5", kind: "entry", text: "Rating rubric approved by the V&V agent", status: "waived" },
    { id: "cri-15", parentType: "procedure", parentId: "proc-5", kind: "exit",  text: "Signed jury record appended to the evidence package", status: "open" },
    { id: "cri-16", parentType: "procedure", parentId: "proc-6", kind: "entry", text: "Human-use review approval on file", status: "open" },
    { id: "cri-17", parentType: "procedure", parentId: "proc-6", kind: "entry", text: "Medical observer present for every session", status: "open" },
    { id: "cri-18", parentType: "procedure", parentId: "proc-6", kind: "exit",  text: "Pre and post SSQ recorded for every participant", status: "open" },
    { id: "cri-19", parentType: "procedure", parentId: "proc-7", kind: "entry", text: "AAR recorder build matches the session server build", status: "met" },
    { id: "cri-20", parentType: "procedure", parentId: "proc-7", kind: "exit",  text: "Checksum comparison covers every simulated second", status: "met" },
    /* Phase-level criteria on test plans */
    { id: "cri-21", parentType: "plan", parentId: "plan-1", kind: "entry", text: "R1.1 feature complete; beta build delivered", status: "met" },
    { id: "cri-22", parentType: "plan", parentId: "plan-1", kind: "exit",  text: "Every active desktop case run on the release candidate", status: "open" },
    { id: "cri-23", parentType: "plan", parentId: "plan-2", kind: "entry", text: "Safety chain verification (PROC-04) passed on the build under test", status: "met" },
    { id: "cri-24", parentType: "plan", parentId: "plan-2", kind: "entry", text: "Human-use review approval for comfort sessions", status: "open" },
    { id: "cri-25", parentType: "plan", parentId: "plan-2", kind: "exit",  text: "Safety Review Board package delivered", status: "open" },
    { id: "cri-26", parentType: "plan", parentId: "plan-3", kind: "entry", text: "V&V Plan approved by the accreditation authority", status: "met" },
    { id: "cri-27", parentType: "plan", parentId: "plan-3", kind: "exit",  text: "V&V Report submitted to the accreditation authority", status: "open" },
    { id: "cri-28", parentType: "plan", parentId: "plan-4", kind: "entry", text: "Unit simulation partner confirms an interoperability window", status: "open" },
    /* Release exit criteria */
    { id: "cri-29", parentType: "release", parentId: "rel-1", kind: "exit", text: "Every active desktop case run on the release candidate; failures dispositioned", status: "open" },
    { id: "cri-30", parentType: "release", parentId: "rel-1", kind: "exit", text: "No open Critical or Major defects against SYS-01", status: "open" },
    { id: "cri-31", parentType: "release", parentId: "rel-1", kind: "exit", text: "Release notes and installer signed and delivered to CM", status: "met" },
    { id: "cri-32", parentType: "release", parentId: "rel-3", kind: "exit", text: "Ballistics validation passes on the candidate within 2% drop error", status: "open" },
    { id: "cri-33", parentType: "release", parentId: "rel-4", kind: "exit", text: "Safety chain cases (PROC-04) pass on the release candidate", status: "met" }
  ],

  /* Test cases. venue: Live | Virtual | Constructive | HWIL | Hybrid
     testType: CT | DT&E | Integration | Regression | V&V – Verification | V&V – Validation */
  cases: [
    /* SYS-01 Desktop Tactical Trainer */
    { id: "tc-6",  code: "TC-006", componentId: "cmp-1",  title: "Frame rate on minimum-spec PC", objective: "Profile a full 32-trainee exercise on the minimum-spec PC; verify ≥ 60 FPS and P99 frame time ≤ 16.6 ms.", requirementIds: ["req-3", "req-19"], procedureId: "proc-3", priority: "High", status: "Complete", venue: "Virtual", testType: "DT&E", resourceIds: ["res-7"],
      preconditions: "Minimum-spec PC imaged from the CM baseline; 1080p high preset.", testData: "Company-attack exercise, 32 trainees, scripted rifleman route.", expectedResults: "Average ≥ 60 FPS; P99 frame time ≤ 16.6 ms.", passFailCriteria: "Pass if both thresholds are met for the full 15-minute route." },
    { id: "tc-7",  code: "TC-007", componentId: "cmp-3",  title: "Instructor pause, inject and resume", objective: "Exercise all five live-intervention types and resume without trainee desync.", requirementIds: ["req-8", "req-22"], procedureId: null, priority: "Medium", status: "Complete", venue: "Virtual", testType: "DT&E", resourceIds: [] },
    { id: "tc-16", code: "TC-016", componentId: "cmp-2",  title: "Control remapping and one-handed schemes", objective: "Remap every action and complete the qualification course with the left- and right-hand schemes.", requirementIds: ["req-16"], procedureId: null, priority: "Low", status: "Ready", venue: "Virtual", testType: "DT&E", resourceIds: [] },
    { id: "tc-17", code: "TC-017", componentId: "cmp-4",  title: "Six-net radio soak", objective: "Run 6 radio nets with PTT traffic, jamming and range degradation for 2 hours.", requirementIds: ["req-13"], procedureId: null, priority: "Medium", status: "In Progress", venue: "Virtual", testType: "Regression", extKey: "VRT-217", resourceIds: [] },
    { id: "tc-18", code: "TC-018", componentId: "cmp-16", title: "Tactical map overlay accuracy", objective: "Check grid references, unit icons and range rings on the tactical map against the exercise state.", requirementIds: [], procedureId: null, priority: "Low", status: "Draft", venue: "Virtual", testType: "DT&E", resourceIds: [] },
    { id: "tc-19", code: "TC-019", componentId: "cmp-18", title: "AAR playback on desktop", objective: "Play back a recorded exercise in the desktop AAR viewer with timeline scrubbing and bookmarks.", requirementIds: ["req-7"], procedureId: "proc-7", priority: "Medium", status: "Blocked", venue: "Virtual", testType: "Integration", resourceIds: [] },
    { id: "tc-20", code: "TC-020", componentId: "", systemId: "sys-1", title: "32-trainee desktop exercise soak", objective: "System-level soak: 32 desktop trainees in one exercise for 4 hours; watch memory, desync and crashes.", requirementIds: ["req-1", "req-3"], procedureId: null, priority: "High", status: "In Progress", venue: "Virtual", testType: "Integration", resourceIds: ["res-7"] },
    { id: "tc-21", code: "TC-021", componentId: "cmp-1",  title: "Legacy DX11 renderer smoke", objective: "Smoke test of the DX11 renderer path (removed in R1.1).", requirementIds: ["req-3"], procedureId: null, priority: "Low", status: "Retired", venue: "Virtual", testType: "Regression", resourceIds: [] },
    { id: "tc-30", code: "TC-030", componentId: "cmp-17", title: "Compass and laser overlay alignment", objective: "Verify compass bearing and laser spot overlay agree with the 3D scene within 0.5°.", requirementIds: ["req-19"], procedureId: null, priority: "Low", status: "Ready", venue: "Virtual", testType: "DT&E", resourceIds: [] },
    /* SYS-02 Shared Simulation Services */
    { id: "tc-1",  code: "TC-001", componentId: "cmp-8",  title: "32-client exercise latency", objective: "Measure state-update latency at all 32 clients under load and packet loss; verify ≤ 100 ms P95.", requirementIds: ["req-1", "req-17"], procedureId: "proc-1", priority: "Critical", status: "In Progress", venue: "Constructive", testType: "Integration", extKey: "VRT-101", extLinks: [{ url: "https://yourteam.atlassian.net/projects/VRT?selectedItem=com.thed.zephyr.je%3Azephyr-tests-page#VRT-T101", label: "Zephyr test page" }], resourceIds: ["res-2"] },
    { id: "tc-2",  code: "TC-002", componentId: "cmp-19", title: "DIS/HLA interoperability with unit sim", objective: "Join an exercise to the unit's constructive simulation over DIS and HLA; verify entity and fire events round-trip.", requirementIds: ["req-1"], procedureId: null, priority: "High", status: "Ready", venue: "Constructive", testType: "Integration", resourceIds: ["res-2"] },
    { id: "tc-3",  code: "TC-003", componentId: "cmp-13", title: "5.56 mm drop vs firing tables", objective: "Compare 5.56 mm drop from 100 to 600 m with the published tables; verify ≤ 2% error.", requirementIds: ["req-2"], procedureId: "proc-2", priority: "Critical", status: "In Progress", venue: "Constructive", testType: "V&V – Validation", extKey: "VRT-103", resourceIds: ["res-1", "res-4"] },
    { id: "tc-4",  code: "TC-004", componentId: "cmp-13", title: "Crosswind drift validation", objective: "Compare drift at 5 and 10 m/s crosswinds with the published tables.", requirementIds: ["req-2"], procedureId: "proc-2", priority: "High", status: "Complete", venue: "Constructive", testType: "V&V – Validation", resourceIds: ["res-1", "res-4"] },
    { id: "tc-5",  code: "TC-005", componentId: "cmp-6",  title: "OPFOR realism jury", objective: "SME jury rates OPFOR cover use, fire and movement, and flanking; verify ≥ 90% rated realistic.", requirementIds: ["req-5", "req-26"], procedureId: "proc-5", priority: "High", status: "In Progress", venue: "Virtual", testType: "V&V – Validation", resourceIds: ["res-6"] },
    { id: "tc-10", code: "TC-010", componentId: "cmp-7",  title: "Terrain correlation vs survey", objective: "Compare terrain heights at 200 survey control points; verify ≤ 1 m H / 0.5 m V.", requirementIds: ["req-11"], procedureId: null, priority: "Medium", status: "Ready", venue: "Constructive", testType: "V&V – Validation", resourceIds: ["res-8"] },
    { id: "tc-11", code: "TC-011", componentId: "cmp-20", title: "AAR deterministic replay", objective: "Record a 60-minute exercise and verify bit-exact replay by per-second checksum.", requirementIds: ["req-7", "req-23"], procedureId: "proc-7", priority: "High", status: "Complete", venue: "Constructive", testType: "V&V – Verification", resourceIds: ["res-2"] },
    { id: "tc-13", code: "TC-013", componentId: "cmp-6",  title: "OPFOR decision log completeness", objective: "Compare logged OPFOR decisions against an instrumented engagement trace.", requirementIds: ["req-26"], procedureId: null, priority: "Medium", status: "Draft", venue: "Constructive", testType: "DT&E", resourceIds: [] },
    { id: "tc-14", code: "TC-014", componentId: "cmp-5",  title: "SME marksmanship feel review", objective: "SMEs rate weapon feel and terminal effects across both trainers.", requirementIds: ["req-2", "req-12"], procedureId: "proc-5", priority: "High", status: "Draft", venue: "Hybrid", testType: "V&V – Validation", resourceIds: ["res-1", "res-3"] },
    { id: "tc-15", code: "TC-015", componentId: "cmp-14", title: "Drag table sweep Mach 0.5–3.0", objective: "Sweep the G1 and G7 drag tables across Mach 0.5–3.0 and check resolution and continuity; isolates DEF-001.", requirementIds: ["req-2", "req-18"], procedureId: "proc-2", priority: "High", status: "Ready", venue: "Constructive", testType: "V&V – Verification", resourceIds: ["res-1", "res-4"],
      preconditions: "Drag tables at the build under test exported from CM.", testData: "G1 and G7 tables; Mach 0.50 to 3.00 in 0.01 steps.", expectedResults: "No gaps wider than 0.05 Mach; no discontinuity above 1%.", passFailCriteria: "Pass if both conditions hold for both tables." },
    { id: "tc-22", code: "TC-022", componentId: "cmp-8",  title: "Session server tick stability", objective: "Measure server tick interval and jitter with 32 clients; verify 60 Hz with ≤ 2 ms jitter.", requirementIds: ["req-17"], procedureId: "proc-1", priority: "High", status: "Complete", venue: "Constructive", testType: "DT&E", resourceIds: ["res-2"] },
    { id: "tc-23", code: "TC-023", componentId: "cmp-20", title: "xAPI export to learning record store", objective: "Export a scored exercise and verify every scored event arrives at the LRS as an xAPI statement.", requirementIds: ["req-15"], procedureId: null, priority: "Medium", status: "In Progress", venue: "Constructive", testType: "Integration", resourceIds: [] },
    { id: "tc-24", code: "TC-024", componentId: "", systemId: "sys-2", title: "Cross-trainer joint exercise", objective: "System-level: desktop and IVT trainees in one exercise; verify shared state, fires and AAR across both trainers.", requirementIds: ["req-1", "req-7"], procedureId: null, priority: "High", status: "Ready", venue: "Hybrid", testType: "Integration", resourceIds: ["res-2", "res-3"] },
    { id: "tc-25", code: "TC-025", componentId: "cmp-7",  title: "Terrain streaming hitch check", objective: "Fly the streaming stress route and count frame hitches over 50 ms.", requirementIds: ["req-3"], procedureId: null, priority: "Low", status: "Draft", venue: "Virtual", testType: "Regression", resourceIds: [],
      removalNominated: true, reviewDisposition: "Nominated for review/removal by RUN-017 on 2026-09-11 — streaming moved client-side in R1.1; TC-006 now covers hitches." },
    /* SYS-03 Immersive Virtual Trainer */
    { id: "tc-8",  code: "TC-008", componentId: "cmp-15", title: "E-stop and guardian halt timing", objective: "Trigger each e-stop and walk into the guardian boundary; verify treadmill halt and headset blackout within 100 ms.", requirementIds: ["req-10", "req-21", "req-24"], procedureId: "proc-4", priority: "Critical", status: "Complete", venue: "HWIL", testType: "DT&E", resourceIds: ["res-3", "res-5"] },
    { id: "tc-9",  code: "TC-009", componentId: "cmp-12", title: "Interlock inhibit (door, harness, tether)", objective: "Open each interlock individually; verify session start is inhibited and the operator is alerted.", requirementIds: ["req-10"], procedureId: "proc-4", priority: "Critical", status: "Complete", venue: "HWIL", testType: "DT&E", resourceIds: ["res-3"] },
    { id: "tc-12", code: "TC-012", componentId: "cmp-22", title: "Operator station emergency controls", objective: "From the operator station, stop a session, recall a trainee and lock out the pod.", requirementIds: ["req-10"], procedureId: null, priority: "High", status: "Ready", venue: "HWIL", testType: "DT&E", resourceIds: ["res-3"] },
    { id: "tc-26", code: "TC-026", componentId: "cmp-9",  title: "Motion-to-photon latency", objective: "Measure head-motion to photon latency with the photodiode rig; verify ≤ 20 ms.", requirementIds: ["req-4", "req-20"], procedureId: null, priority: "Critical", status: "In Progress", venue: "HWIL", testType: "DT&E", extKey: "VRT-126", resourceIds: ["res-5"] },
    { id: "tc-27", code: "TC-027", componentId: "cmp-10", title: "Treadmill boundary deceleration", objective: "Drive the mannequin at 3 m/s toward the boundary; verify stop within 0.5 s without loss of footing.", requirementIds: ["req-6", "req-24"], procedureId: "proc-4", priority: "Critical", status: "Complete", venue: "HWIL", testType: "DT&E", resourceIds: ["res-3"] },
    { id: "tc-28", code: "TC-028", componentId: "cmp-11", title: "Haptic hit timing", objective: "Fire scripted hit sequences at the vest; verify feedback within 50 ms of impact.", requirementIds: ["req-9"], procedureId: null, priority: "High", status: "Complete", venue: "HWIL", testType: "DT&E", resourceIds: ["res-5"] },
    { id: "tc-29", code: "TC-029", componentId: "cmp-21", title: "Recoil impulse vs live weapon", objective: "Compare replica recoil impulse with live M4 data; verify within 15%.", requirementIds: ["req-12"], procedureId: null, priority: "High", status: "In Progress", venue: "HWIL", testType: "V&V – Validation", resourceIds: ["res-3"] },
    { id: "tc-31", code: "TC-031", componentId: "cmp-23", title: "30-minute comfort session (SSQ)", objective: "Run 30-minute sessions with SSQ before and after; verify ≥ 90% complete with SSQ ≤ 20.", requirementIds: ["req-14"], procedureId: "proc-6", priority: "High", status: "Blocked", venue: "HWIL", testType: "DT&E", resourceIds: ["res-3"] },
    { id: "tc-32", code: "TC-032", componentId: "", systemId: "sys-3", title: "Full IVT squad mission end-to-end", objective: "System-level: a four-trainee squad runs the full room-clearing mission in the pod bay.", requirementIds: ["req-4", "req-9", "req-14"], procedureId: null, priority: "High", status: "Draft", venue: "HWIL", testType: "Integration", resourceIds: ["res-3"] },
    { id: "tc-33", code: "TC-033", componentId: "cmp-9",  title: "Pose prediction accuracy", objective: "Compare predicted and measured head pose 15 ms ahead; verify ≤ 0.3° error.", requirementIds: ["req-20"], procedureId: null, priority: "Medium", status: "Ready", venue: "HWIL", testType: "DT&E", resourceIds: ["res-5"] }
  ],

  /* Program decisions — the rows of the IDSK. */
  decisions: [
    { id: "dec-1", code: "DP-01", title: "Ballistics Model Accreditation", status: "At Risk", date: "2026-11-06",
      authority: "Training M&S Accreditation Authority",
      description: "Accreditation of the ballistics model for marksmanship and squad live-fire rehearsal. Informed by the TP-03 V&V evidence package.",
      requirementIds: ["req-2", "req-18", "req-7", "req-11"] },
    { id: "dec-2", code: "DP-02", title: "IVT Early Access Safety Release", status: "On Track", date: "2026-11-18",
      authority: "Safety Review Board",
      description: "Safety Review Board go/no-go for releasing the immersive trainer to early-access units.",
      requirementIds: ["req-6", "req-10", "req-14", "req-21", "req-24", "req-4"] },
    { id: "dec-3", code: "DP-03", title: "Desktop Trainer R1.1 Fielding Decision", status: "Pending", date: "2026-11-12",
      authority: "Program Manager",
      description: "Decision to field Desktop Trainer R1.1 to home stations.",
      requirementIds: ["req-3", "req-8", "req-13", "req-16"] },
    { id: "dec-4", code: "DP-04", title: "Joint Exercise Capability Gate", status: "Pending", date: "2026-12-16",
      authority: "Customer / Program Office",
      description: "Gate for running joint exercises that mix desktop and immersive trainees with unit simulations.",
      requirementIds: ["req-1", "req-7", "req-15"] }
  ],

  plans: [
    { id: "plan-1", code: "TP-01", systemId: "sys-1", name: "Desktop Trainer R1.1 Regression", description: "Regression of every active desktop case against each R1.1 build, ending on the release candidate.",
      phase: "Regression", status: "Active", start: "2026-08-10", end: "2026-10-23", decisionId: "dec-3", regressionSystemId: "sys-1",
      caseIds: ["tc-6", "tc-7", "tc-16", "tc-17", "tc-18", "tc-19", "tc-20", "tc-30"] },
    { id: "plan-2", code: "TP-02", systemId: "sys-3", name: "IVT Early Access Acceptance", description: "Acceptance and safety testing of the immersive trainer for the early-access safety release.",
      phase: "Acceptance", status: "Active", start: "2026-08-24", end: "2026-11-13", decisionId: "dec-2", extKey: "VRT-TP2",
      caseIds: ["tc-8", "tc-9", "tc-12", "tc-26", "tc-27", "tc-28", "tc-29", "tc-31", "tc-32", "tc-33"] },
    { id: "plan-3", code: "TP-03", systemId: "sys-2", name: "Ballistics & OPFOR Model V&V", description: "Verification and validation of the ballistics and OPFOR models — builds the evidence package for the accreditation decision.",
      phase: "V&V", status: "Active", start: "2026-08-03", end: "2026-10-30", decisionId: "dec-1",
      caseIds: ["tc-3", "tc-4", "tc-5", "tc-13", "tc-14", "tc-15", "tc-10"] },
    { id: "plan-4", code: "TP-04", name: "Cross-Trainer Interoperability", description: "Joint exercises across both trainers and unit simulations. Program-level: its cases span all three systems.",
      phase: "Integration", status: "Planning", start: "2026-10-12", end: "2026-11-30", decisionId: "dec-4",
      caseIds: ["tc-1", "tc-2", "tc-24", "tc-20"] }
  ],

  /* Schedule events. type: Test Event | Review | Milestone | Decision Point | Delivery | Range Window.
     status: Planned | In Progress | Complete | Slipped | Cancelled. */
  events: [
    { id: "evt-1", code: "EVT-01", systemId: "sys-1", title: "Desktop Trainer R1.0 shipped to home stations", type: "Delivery", status: "Complete",
      start: "2026-07-15", end: "", location: "Home stations (12 units)", planId: "", decisionId: "",
      description: "Signed R1.0 installer (build 1.0.0) delivered to the first 12 units.",
      notes: [{ id: "note-1", date: "2026-07-16", text: "All 12 units confirmed install. Two reported the alt-tab crash later fixed as DEF-009." }] },
    { id: "evt-2", code: "EVT-02", title: "TP-03 Ballistics & OPFOR V&V campaign", type: "Test Event", status: "In Progress",
      start: "2026-08-03", end: "2026-10-30", location: "Sim Lab", planId: "plan-3", decisionId: "dec-1",
      description: "Execution window for the ballistics and OPFOR model validation campaign.",
      notes: [{ id: "note-2", date: "2026-08-28", text: "RUN-012 5.56 drop failure at 500 m (DEF-001). Campaign holds; fix expected in SSS 3.3.1." }] },
    { id: "evt-3", code: "EVT-03", systemId: "sys-3", title: "Playtest weekend #1 — 2nd Platoon", type: "Test Event", status: "Complete",
      start: "2026-08-22", end: "2026-08-23", location: "IVT Pod Bay", planId: "plan-2", decisionId: "",
      description: "First soldier playtest of the immersive trainer: 14 trainees, standard patrol and room-clearing scenarios.",
      notes: [{ id: "note-3", date: "2026-08-23", text: "9 of 14 completed 30 minutes; 3 reported mild nausea (RSK-003). Recoil felt soft (DEF-008). Summary in DOC-04." }] },
    { id: "evt-4", code: "EVT-04", title: "Safety Review Board pre-brief", type: "Review", status: "Planned",
      start: "2026-09-28", end: "", location: "Program Office (virtual)", planId: "", decisionId: "dec-2",
      description: "Pre-brief of the safety case to the board ahead of the early-access decision. Past its date and still Planned — update its status.",
      notes: [] },
    { id: "evt-5", code: "EVT-05", systemId: "sys-1", title: "Desktop R1.1 beta regression window", type: "Test Event", status: "In Progress",
      start: "2026-09-01", end: "2026-10-09", location: "Desktop Lab", planId: "plan-1", decisionId: "dec-3",
      description: "Regression of the 1.1.0 beta builds (TR-003).",
      notes: [{ id: "note-4", date: "2026-09-15", text: "1.1.0-beta2 rejected — instructor console crash on launch. Continuing on beta1 until the RC arrives." }] },
    { id: "evt-6", code: "EVT-06", title: "Live-fire range correlation shoot", type: "Range Window", status: "Planned",
      start: "2026-10-13", end: "2026-10-15", location: "Range 7", planId: "plan-3", decisionId: "dec-1",
      description: "Instrumented live fire to add 7.62 mm long-range points to the ballistics referent (RSK-001).",
      notes: [{ id: "note-5", date: "2026-09-20", text: "Range booked; chronograph and Doppler radar requested from the test range." }] },
    { id: "evt-7", code: "EVT-07", systemId: "sys-3", title: "Playtest weekend #2 — company level", type: "Test Event", status: "Planned",
      start: "2026-10-24", end: "2026-10-25", location: "IVT Pod Bay", planId: "plan-2", decisionId: "dec-2",
      description: "Company-level playtest with four pods running a joint mission.",
      notes: [] },
    { id: "evt-8", code: "EVT-08", title: "V&V Report to accreditation authority", type: "Milestone", status: "Planned",
      start: "2026-10-30", end: "", location: "", planId: "plan-3", decisionId: "dec-1",
      description: "Ballistics V&V report delivered — closes TP-03 exit criteria.",
      notes: [] },
    { id: "evt-9", code: "EVT-09", title: "Ballistics Model Accreditation", type: "Decision Point", status: "Planned",
      start: "2026-11-06", end: "", location: "Accreditation Authority", planId: "", decisionId: "dec-1",
      description: "Accreditation determination for the ballistics model.",
      notes: [{ id: "note-6", date: "2026-09-25", text: "At risk: DEF-001 fix not yet verified and the 7.62 mm referent gap is open." }] },
    { id: "evt-10", code: "EVT-10", title: "Desktop R1.1 Fielding Decision", type: "Decision Point", status: "Planned",
      start: "2026-11-12", end: "", location: "Program Office", planId: "plan-1", decisionId: "dec-3",
      description: "Program Manager fielding decision for Desktop Trainer R1.1.",
      notes: [] },
    { id: "evt-11", code: "EVT-11", title: "IVT Early Access Safety Release", type: "Decision Point", status: "Planned",
      start: "2026-11-18", end: "", location: "Safety Review Board", planId: "plan-2", decisionId: "dec-2",
      description: "Board decision on releasing the immersive trainer to early-access units.",
      notes: [] },
    { id: "evt-12", code: "EVT-12", systemId: "sys-3", title: "Treadmill vendor firmware drop", type: "Delivery", status: "Slipped",
      start: "2026-09-15", end: "", location: "IVT Pod Bay", planId: "", decisionId: "",
      description: "Vendor firmware with the improved boundary braking profile.",
      notes: [{ id: "note-7", date: "2026-09-14", text: "Vendor slipped delivery to 2026-10-06; boundary braking still on the old profile." }] },
    { id: "evt-13", code: "EVT-13", title: "Unit simulation interoperability event", type: "Test Event", status: "Cancelled",
      start: "2026-09-20", end: "2026-09-21", location: "Partner unit sim center", planId: "plan-4", decisionId: "dec-4",
      description: "Cancelled by the partner unit; to be rescheduled inside TP-04.",
      notes: [{ id: "note-8", date: "2026-09-10", text: "Partner unit cancelled due to a deployment exercise." }] },
    { id: "evt-14", code: "EVT-14", title: "Joint Exercise Capability Gate", type: "Decision Point", status: "Planned",
      start: "2026-12-16", end: "", location: "Program Office", planId: "plan-4", decisionId: "dec-4",
      description: "Gate review for joint desktop + immersive exercises.",
      notes: [] },
    { id: "evt-15", code: "EVT-15", systemId: "sys-2", title: "SME OPFOR realism jury", type: "Review", status: "In Progress",
      start: "2026-09-09", end: "2026-10-07", location: "Sim Lab", planId: "plan-3", decisionId: "dec-1",
      description: "Three jury sessions rating OPFOR behaviour (TC-005).",
      notes: [{ id: "note-9", date: "2026-09-09", text: "Session 1 complete: 86% rated realistic; flanking scored lowest." },
              { id: "note-10", date: "2026-09-23", text: "Session 2 rescheduled to 10/02 — two SMEs on leave." }] }
  ],

  runs: [
    /* SYS-01 Desktop — builds 1.0.0 → 1.1.0-alpha → 1.1.0-beta1 → (beta2 rejected) → 1.1.0-rc1 */
    { id: "run-1",  code: "RUN-001", caseId: "tc-21", buildId: "bld-1", planId: null, date: "2026-07-08", operator: "R. Okafor", result: "Pass", measured: "", evidence: "", notes: "DX11 path smoke passed on 1.0.0. Renderer path removed in R1.1; case retired." },
    { id: "run-2",  code: "RUN-002", caseId: "tc-6",  buildId: "bld-1", planId: null, date: "2026-07-09", operator: "S. Patel",  result: "Pass", measured: "61 FPS avg (1% low 47)", evidence: "perf-1.0.0.json", notes: "Just above threshold on 1.0.0." },
    { id: "run-3",  code: "RUN-003", caseId: "tc-7",  buildId: "bld-2", planId: "plan-1", testRunId: "tr-2", date: "2026-08-10", operator: "R. Okafor", result: "Pass", measured: "5/5 interventions, 0 desyncs in 50 cycles", evidence: "", notes: "All intervention types work; resume is clean." },
    { id: "run-4",  code: "RUN-004", caseId: "tc-6",  buildId: "bld-2", planId: "plan-1", testRunId: "tr-2", date: "2026-08-12", operator: "S. Patel",  result: "Pass", measured: "63 FPS avg, P99 15.9 ms", evidence: "perf-1.1.0a.json", notes: "Scope glint flicker visible on the HUD at night (DEF-004)." },
    { id: "run-5",  code: "RUN-005", caseId: "tc-17", buildId: "bld-2", planId: "plan-1", testRunId: "tr-2", date: "2026-08-13", operator: "S. Patel",  result: "Pass", measured: "6 nets, 2 h, 0 drops", evidence: "", notes: "Clean on the old codec." },
    { id: "run-6",  code: "RUN-006", caseId: "tc-17", buildId: "bld-3", planId: "plan-1", testRunId: "tr-3", date: "2026-09-03", operator: "S. Patel",  result: "Fail", measured: "2 of 6 nets dropped at ~20 min", evidence: "radio-0903.log\nDEF-005", extKey: "VRT-E-211", notes: "Regression: new Opus codec drops two nets after about 20 minutes." },
    { id: "run-7",  code: "RUN-007", caseId: "tc-6",  buildId: "bld-3", planId: "plan-1", testRunId: "tr-3", date: "2026-09-04", operator: "S. Patel",  result: "Pass", measured: "67 FPS avg, P99 14.8 ms", evidence: "perf-1.1.0b1.json", notes: "Faster than alpha; scope glint flicker gone (DEF-004 fix in beta1)." },
    { id: "run-8",  code: "RUN-008", caseId: "tc-19", buildId: "bld-3", planId: "plan-1", testRunId: "tr-3", date: "2026-09-05", operator: "R. Okafor", result: "Blocked", measured: "", evidence: "", notes: "AAR recorder from SSS 3.3 not yet deployed to the desktop lab." },
    { id: "run-9",  code: "RUN-009", caseId: "tc-20", buildId: "bld-3", planId: "plan-1", testRunId: "tr-3", date: "2026-09-10", operator: "R. Okafor", result: "In Progress", measured: "18 of 32 seats, 2 h", evidence: "", notes: "Memory climbing ~150 MB/h on the session host; continuing to 4 h." },
    /* SYS-02 Shared Services — SSS 3.2.0 → 3.3.0 → 3.3.1 (received, untested) */
    { id: "run-10", code: "RUN-010", caseId: "tc-4",  buildId: "bld-5", planId: "plan-3", date: "2026-08-06", operator: "D. Vance",  result: "Pass", measured: "0.4 MOA worst drift error", evidence: "VV-BAL-02.pdf", notes: "Drift within tables at both wind speeds." },
    { id: "run-11", code: "RUN-011", caseId: "tc-11", buildId: "bld-5", planId: null, date: "2026-08-07", operator: "K. Ibrahim", result: "Pass", measured: "Bit-exact, 3600/3600 s", evidence: "aar-cksum-0807.csv", notes: "Replay identical on 3.2.0." },
    { id: "run-12", code: "RUN-012", caseId: "tc-3",  buildId: "bld-6", planId: "plan-3", testRunId: "tr-4", date: "2026-08-28", operator: "D. Vance",  result: "Fail", measured: "3.4% drop error at 500 m", evidence: "VV-BAL-03-draft.pdf\nDEF-001", notes: "Within 2% to 400 m; error grows beyond 400 m. Drag table interpolation suspected." },
    { id: "run-13", code: "RUN-013", caseId: "tc-1",  buildId: "bld-6", planId: null, date: "2026-09-02", operator: "K. Ibrahim", result: "Fail", measured: "140 ms P95 (32 clients)", evidence: "net-0902.pcap\nDEF-002", extKey: "VRT-E-188", notes: "Fine to 24 clients; spikes above 24. Server tick stretches during entity bursts." },
    { id: "run-14", code: "RUN-014", caseId: "tc-11", buildId: "bld-6", planId: null, date: "2026-09-03", operator: "K. Ibrahim", result: "Pass", measured: "Bit-exact, 3600/3600 s", evidence: "aar-cksum-0903.csv", notes: "Still bit-exact on 3.3.0." },
    { id: "run-15", code: "RUN-015", caseId: "tc-22", buildId: "bld-6", planId: null, date: "2026-09-08", operator: "K. Ibrahim", result: "Waived", measured: "60 Hz, 1.6 ms jitter at 24 clients", evidence: "WAIVER-W03.pdf", notes: "Waiver W-03: measured at 24 clients only until DEF-002 is fixed." },
    { id: "run-16", code: "RUN-016", caseId: "tc-5",  buildId: "bld-6", planId: "plan-3", date: "2026-09-09", operator: "T. Morales", result: "In Progress", measured: "86% rated realistic (1 of 3 sessions)", evidence: "jury-s1.xlsx", notes: "Flanking rated lowest; OPFOR occasionally clips through doors (DEF-010)." },
    { id: "run-17", code: "RUN-017", caseId: "tc-25", buildId: "bld-6", planId: null, date: "2026-09-11", operator: "D. Vance",  result: "Review for Removal", measured: "", evidence: "", notes: "Streaming moved client-side in R1.1; TC-006 now covers hitches." },
    { id: "run-18", code: "RUN-018", caseId: "tc-4",  buildId: "bld-6", planId: "plan-3", testRunId: "tr-4", date: "2026-09-12", operator: "D. Vance",  result: "Pass", measured: "0.5 MOA worst drift error", evidence: "VV-BAL-02b.pdf", notes: "Re-run on 3.3.0: still within tables." },
    { id: "run-29", code: "RUN-029", caseId: "tc-23", planId: null, date: "2026-07-20", operator: "K. Ibrahim", result: "In Progress", measured: "LRS handshake only", evidence: "", notes: "Recorded before builds were tracked — shows as \"build not recorded\"." },
    /* SYS-03 Immersive — IVT 0.8.0 → (0.9.0 rejected) → 0.9.1 under test → 0.9.2 smoke passed */
    { id: "run-19", code: "RUN-019", caseId: "tc-28", buildId: "bld-7", planId: "plan-2", date: "2026-08-05", operator: "L. Haddad", result: "Pass", measured: "31 ms median, 44 ms worst", evidence: "haptic-0805.csv", notes: "Within 50 ms, but rapid multi-hit sequences dropped hits (DEF-007)." },
    { id: "run-27", code: "RUN-027", caseId: "tc-8",  buildId: "bld-7", planId: "plan-2", date: "2026-08-06", operator: "J. Brennan", result: "Pass", measured: "71 ms worst path", evidence: "estop-0806.csv", notes: "All three stations under 100 ms on 0.8.0." },
    { id: "run-28", code: "RUN-028", caseId: "tc-27", buildId: "bld-8", planId: "plan-2", date: "2026-08-19", operator: "J. Brennan", result: "Fail", measured: "Controller fault on start", evidence: "", notes: "0.9.0 treadmill controller firmware mismatch; build rejected." },
    { id: "run-20", code: "RUN-020", caseId: "tc-8",  buildId: "bld-9", planId: "plan-2", testRunId: "tr-1", date: "2026-08-27", operator: "J. Brennan", result: "Pass", measured: "62 ms worst path", evidence: "estop-0827.csv", notes: "Faster than 0.8.0; guardian warn 0.65 m, stop 0.31 m." },
    { id: "run-21", code: "RUN-021", caseId: "tc-9",  buildId: "bld-9", planId: "plan-2", testRunId: "tr-1", date: "2026-08-27", operator: "J. Brennan", result: "Pass", measured: "", evidence: "", notes: "All interlocks inhibit start; harness-sensor alert reaches the operator ~1 s late (DEF-003)." },
    { id: "run-22", code: "RUN-022", caseId: "tc-27", buildId: "bld-9", planId: "plan-2", testRunId: "tr-1", date: "2026-08-28", operator: "J. Brennan", result: "Pass", measured: "0.42 s from 3 m/s", evidence: "decel-0828.mp4", notes: "No loss of footing in 10 trials." },
    { id: "run-23", code: "RUN-023", caseId: "tc-26", buildId: "bld-9", planId: "plan-2", testRunId: "tr-1", date: "2026-08-29", operator: "L. Haddad", result: "Fail", measured: "24 ms P95", evidence: "m2p-0829.csv\nDEF-006", notes: "Over budget during fast head turns; prediction window too short." },
    { id: "run-24", code: "RUN-024", caseId: "tc-29", buildId: "bld-9", planId: "plan-2", date: "2026-09-02", operator: "J. Brennan", result: "Fail", measured: "Impulse 22% below live M4", evidence: "recoil-0902.csv\nDEF-008", notes: "Sight picture fine; impulse too soft (matches playtest feedback)." },
    { id: "run-25", code: "RUN-025", caseId: "tc-31", buildId: "bld-9", planId: "plan-2", date: "2026-09-15", operator: "L. Haddad", result: "Blocked", measured: "", evidence: "", notes: "Waiting on human-use review approval for SSQ sessions (PROC-06 entry criterion)." },
    { id: "run-26", code: "RUN-026", caseId: "tc-9",  buildId: "bld-7", planId: "plan-2", date: "2026-08-07", operator: "J. Brennan", result: "Pass", measured: "", evidence: "", notes: "Interlocks inhibit on 0.8.0." }
  ],

  /* Documents: external links or embedded uploads (dataUrl). */
  documents: [
    { id: "doc-1", code: "DOC-01", title: "VANGUARD RIDGE T&E Strategy v0.6", docType: "Test Plan",
      url: "\\\\program-share\\vanguard\\TE-Strategy_v0.6.docx", fileName: "", fileSize: 0, fileType: "", dataUrl: "",
      relatedCodes: "DP-01, DP-02, DP-03, TP-01, TP-02", added: "2026-07-30",
      description: "Working T&E strategy with the IDSK and resource summary. CM-controlled on the program share." },
    { id: "doc-2", code: "DOC-02", title: "Ballistics Model V&V Plan", docType: "V&V Artifact", systemId: "sys-2",
      url: "https://wiki.example.mil/vanguard/ballistics-vv-plan", fileName: "", fileSize: 0, fileType: "", dataUrl: "",
      relatedCodes: "RES-01, DP-01, TP-03", added: "2026-08-01",
      description: "Approved V&V plan for the ballistics model; basis of the accreditation evidence package." },
    { id: "doc-3", code: "DOC-03", title: "IVT Safety Assessment Report (draft)", docType: "Report", systemId: "sys-3",
      url: "https://wiki.example.mil/vanguard/ivt-safety-assessment", fileName: "", fileSize: 0, fileType: "", dataUrl: "",
      relatedCodes: "REL-04, DP-02, RSK-004", added: "2026-09-18",
      description: "Hazard analysis for the treadmill, harness and guardian systems; draft for the Safety Review Board." },
    { id: "doc-4", code: "DOC-04", title: "Playtest #1 feedback summary", docType: "Evidence",
      url: "", fileName: "playtest1-feedback.txt", fileSize: 462, fileType: "text/plain", dataUrl: "data:text/plain;base64,UGxheXRlc3Qgd2Vla2VuZCAjMSAtIDJuZCBQbGF0b29uIChzeW50aGV0aWMgZGVtbyBkYXRhKQpEYXRlczogMjAyNi0wOC0yMiB0byAyMDI2LTA4LTIzLCBJVlQgUG9kIEJheSwgYnVpbGQgSVZUIDAuOS4xCgotIDE0IHRyYWluZWVzOyA5IGNvbXBsZXRlZCB0aGUgZnVsbCAzMC1taW51dGUgcGF0cm9sCi0gMyByZXBvcnRlZCBtaWxkIG5hdXNlYSBhZnRlciBhYm91dCAyMCBtaW51dGVzIChSU0stMDAzKQotIEhhcm5lc3Mgc2Vuc29yIGFsZXJ0IGZlbHQgbGF0ZSB0byB0aGUgb3BlcmF0b3IgKERFRi0wMDMpCi0gUmVjb2lsIGRlc2NyaWJlZCBhcyAndG9vIHNvZnQnIGNvbXBhcmVkIHdpdGggYSBsaXZlIE00IChERUYtMDA4KQotIFJvb20tY2xlYXJpbmcgc2NlbmFyaW8gcmF0ZWQgdGhlIG1vc3QgcmVhbGlzdGljCi0gUmVxdWVzdDogc25hcC10dXJuIG9wdGlvbiBhbmQgYSB2aXNpYmxlIGJvdW5kYXJ5IGdyaWQK",
      relatedCodes: "EVT-03, TC-031, RSK-003, DEF-008", added: "2026-08-24",
      description: "Embedded file: short summary of soldier feedback from playtest weekend #1. Use Download to check embedded files round-trip." },
    { id: "doc-5", code: "DOC-05", title: "Firing table excerpt (5.56 / 7.62)", docType: "Reference",
      url: "https://example.org/firing-tables/excerpt", fileName: "", fileSize: 0, fileType: "", dataUrl: "",
      relatedCodes: "RES-04, TC-003, TC-004", added: "2026-07-25",
      description: "Excerpt of the published tables used as the ballistics referent." }
  ],

  /* Releases: what each system is tracking toward. Builds: each system's own build stream.
     A run records the build it was measured on (buildId). */
  releases: [
    { id: "rel-1", code: "REL-01", systemId: "sys-1", name: "Desktop Trainer R1.1", status: "In Test", targetDate: "2026-10-30", releasedDate: "",
      decisionId: "dec-3", fixVersion: "DTT-1.1", description: "New radio codec, HUD overlay fixes, instructor console improvements and client-side terrain streaming." },
    { id: "rel-2", code: "REL-02", systemId: "sys-1", name: "Desktop Trainer R1.0", status: "Released", targetDate: "2026-07-15", releasedDate: "2026-07-15",
      decisionId: "", fixVersion: "DTT-1.0", description: "First fielded desktop release." },
    { id: "rel-3", code: "REL-03", systemId: "sys-2", name: "Shared Services R3.3", status: "In Test", targetDate: "2026-10-23", releasedDate: "",
      decisionId: "dec-1", fixVersion: "SSS-3.3", description: "Ballistics drag-table update, network tick improvements and the xAPI exporter." },
    { id: "rel-4", code: "REL-04", systemId: "sys-3", name: "IVT Early Access 0.9", status: "In Test", targetDate: "2026-11-20", releasedDate: "",
      decisionId: "dec-2", fixVersion: "", description: "First early-access release of the immersive trainer. Target date falls after the safety decision on purpose — see the margin on the release page." }
  ],
  builds: [
    { id: "bld-1",  code: "BLD-001", systemId: "sys-1", releaseId: "rel-2", label: "1.0.0", status: "Shipped", received: "2026-06-30", url: "", cycle: "DTT 1.0.0 regression",
      description: "R1.0 gold build." },
    { id: "bld-2",  code: "BLD-002", systemId: "sys-1", releaseId: "rel-1", label: "1.1.0-alpha", status: "Accepted", received: "2026-08-04", url: "https://ci.example.org/vanguard/desktop/1.1.0-alpha", cycle: "DTT 1.1 alpha",
      description: "Alpha: instructor console improvements and alt-tab crash fix (DEF-009)." },
    { id: "bld-3",  code: "BLD-003", systemId: "sys-1", releaseId: "rel-1", label: "1.1.0-beta1", status: "Under Test", received: "2026-09-01", url: "", cycle: "DTT 1.1 beta",
      description: "Beta 1: new Opus radio codec, scope glint fix (DEF-004), client-side terrain streaming." },
    { id: "bld-10", code: "BLD-010", systemId: "sys-1", releaseId: "rel-1", label: "1.1.0-beta2", status: "Rejected", received: "2026-09-15", url: "", cycle: "",
      description: "Instructor console crashed on launch; failed smoke and was withdrawn." },
    { id: "bld-4",  code: "BLD-004", systemId: "sys-1", releaseId: "rel-1", label: "1.1.0-rc1", status: "Received", received: "2026-09-29", url: "", cycle: "",
      description: "Release candidate 1: radio codec keep-alive fix (DEF-005). Not yet smoke tested." },
    { id: "bld-5",  code: "BLD-005", systemId: "sys-2", releaseId: "", label: "SSS 3.2.0", status: "Accepted", received: "2026-07-22", url: "", cycle: "",
      description: "Previous shared-services release." },
    { id: "bld-6",  code: "BLD-006", systemId: "sys-2", releaseId: "rel-3", label: "SSS 3.3.0", status: "Under Test", received: "2026-08-26", url: "", cycle: "SSS 3.3 V&V",
      description: "Drag table update (G7), tick scheduler rework, xAPI exporter." },
    { id: "bld-11", code: "BLD-011", systemId: "sys-2", releaseId: "rel-3", label: "SSS 3.3.1", status: "Received", received: "2026-09-24", url: "", cycle: "",
      description: "Drag table interpolation fix for long range (DEF-001). Awaiting deployment to the V&V lab." },
    { id: "bld-7",  code: "BLD-007", systemId: "sys-3", releaseId: "", label: "IVT 0.8.0", status: "Accepted", received: "2026-07-29", url: "", cycle: "",
      description: "Pre-release build used for safety chain bring-up." },
    { id: "bld-8",  code: "BLD-008", systemId: "sys-3", releaseId: "rel-4", label: "IVT 0.9.0", status: "Rejected", received: "2026-08-18", url: "", cycle: "",
      description: "Treadmill controller firmware mismatch; failed smoke and was withdrawn." },
    { id: "bld-9",  code: "BLD-009", systemId: "sys-3", releaseId: "rel-4", label: "IVT 0.9.1", status: "Under Test", received: "2026-08-24", url: "", cycle: "IVT 0.9.1 acceptance",
      description: "Firmware alignment fix for 0.9.0; haptic event batching (DEF-007 fix)." },
    { id: "bld-12", code: "BLD-012", systemId: "sys-3", releaseId: "rel-4", label: "IVT 0.9.2", status: "Smoke Passed", received: "2026-09-26", url: "", cycle: "",
      description: "Longer pose-prediction window (DEF-006 fix). Passed smoke; not yet regression tested." }
  ],

  /* Test run sessions: a frozen case scope; each case result is a run with testRunId. */
  testRuns: [
    { id: "tr-1", code: "TR-001", buildId: "bld-9", name: "IVT 0.9.1 acceptance regression", operator: "J. Brennan", status: "Active",
      planId: "plan-2", systemId: "sys-3", componentId: "", caseIds: ["tc-8", "tc-9", "tc-12", "tc-26", "tc-27", "tc-28", "tc-29", "tc-31", "tc-32", "tc-33"],
      createdAt: "2026-08-27T09:00:00.000Z", startedAt: "2026-08-27T09:00:00.000Z", completedAt: "",
      notes: "Scope frozen at start: every active SYS-03 case, including the E-Stop & Guardian Network subcomponent and the system-level squad mission." },
    { id: "tr-2", code: "TR-002", buildId: "bld-2", name: "Desktop 1.1.0-alpha regression", operator: "S. Patel", status: "Complete",
      planId: "plan-1", systemId: "sys-1", componentId: "", caseIds: ["tc-6", "tc-7", "tc-17"],
      createdAt: "2026-08-10T13:00:00.000Z", startedAt: "2026-08-10T13:00:00.000Z", completedAt: "2026-08-14T17:00:00.000Z",
      notes: "Alpha regression of the three cases ready at the time." },
    { id: "tr-3", code: "TR-003", buildId: "bld-3", name: "Desktop 1.1.0-beta1 regression", operator: "S. Patel", status: "Active",
      planId: "plan-1", systemId: "sys-1", componentId: "", caseIds: ["tc-6", "tc-7", "tc-16", "tc-17", "tc-19", "tc-20", "tc-30"],
      createdAt: "2026-09-02T13:00:00.000Z", startedAt: "2026-09-02T13:00:00.000Z", completedAt: "",
      notes: "Compare with TR-002: TC-017 regressed on the new codec." },
    { id: "tr-4", code: "TR-004", buildId: "bld-6", name: "Ballistics component test", operator: "D. Vance", status: "Active",
      planId: "plan-3", systemId: "sys-2", componentId: "cmp-5", caseIds: ["tc-3", "tc-4", "tc-14", "tc-15"],
      createdAt: "2026-08-27T15:00:00.000Z", startedAt: "2026-08-27T15:00:00.000Z", completedAt: "",
      notes: "Component test of CMP-05 including the solver and drag-table subcomponents." }
  ],

  /* Defects. severity: Critical | Major | Minor | Cosmetic.
     status: Open | In Analysis | Fix In Work | Ready for Retest | Closed | Deferred */
  defects: [
    { id: "def-1", code: "DEF-001", foundInBuildId: "bld-6", fixedInBuildId: "bld-11", title: "5.56 mm drop error grows beyond 400 m", severity: "Major", status: "Fix In Work",
      componentId: "cmp-13", caseIds: ["tc-3"], runId: "run-12", owner: "Sim Services Core", opened: "2026-08-28", closed: "",
      description: "Drop error is within 2% to 400 m but reaches 3.4% at 500 m (RUN-012). Drag table interpolation between Mach steps suspected. Fix delivered in SSS 3.3.1, which is received but not yet under test — no retest prompt until it is." },
    { id: "def-2", code: "DEF-002", foundInBuildId: "bld-6", extLinks: [{ url: "https://yourteam.atlassian.net/browse/VRT-412", label: "Jira bug VRT-412" }], title: "Exercise latency spikes above 24 clients", severity: "Critical", status: "In Analysis",
      componentId: "cmp-8", caseIds: ["tc-1"], runId: "run-13", owner: "Sim Services Core", opened: "2026-09-02", closed: "",
      description: "P95 latency jumps to 140 ms with more than 24 clients; server tick stretches during entity-state bursts (RSK-002)." },
    { id: "def-3", code: "DEF-003", foundInBuildId: "bld-9", title: "Harness sensor alert reaches operator ~1 s late", severity: "Minor", status: "Open",
      componentId: "cmp-12", caseIds: ["tc-9"], runId: "run-21", owner: "Immersive Systems Team", opened: "2026-08-27", closed: "",
      description: "Inhibit is immediate but the operator-station alert lags about 1 s. TC-009 passed on the same build it was found in, so the app does not offer a retest." },
    { id: "def-4", code: "DEF-004", foundInBuildId: "bld-2", fixedInBuildId: "bld-3", title: "Scope glint flickers on HUD overlay at night", severity: "Cosmetic", status: "Open",
      componentId: "cmp-16", caseIds: ["tc-6"], runId: "", owner: "Desktop Trainer Team", opened: "2026-08-12", closed: "",
      description: "Flicker on the scope glint overlay in night scenes. Fixed in beta1, and TC-006 has since passed on beta1 — the defect page offers \"verify and close\"." },
    { id: "def-5", code: "DEF-005", foundInBuildId: "bld-3", fixedInBuildId: "bld-4", title: "Radio nets drop after ~20 minutes on new codec", severity: "Major", status: "Fix In Work",
      componentId: "cmp-4", caseIds: ["tc-17"], runId: "run-6", owner: "Desktop Trainer Team", opened: "2026-09-03", closed: "",
      description: "Two of six nets drop after about 20 minutes on 1.1.0-beta1 (RUN-006, a regression from alpha). Keep-alive fix is in 1.1.0-rc1, which has not been tested yet." },
    { id: "def-6", code: "DEF-006", foundInBuildId: "bld-9", fixedInBuildId: "bld-12", title: "Motion-to-photon 24 ms at P95", severity: "Major", status: "Fix In Work",
      componentId: "cmp-9", caseIds: ["tc-26"], runId: "run-23", owner: "Immersive Systems Team", opened: "2026-08-29", closed: "",
      description: "Latency exceeds 20 ms during fast head turns. Fix in IVT 0.9.2 (smoke passed); 0.9.1 is still the build under test, so no retest prompt yet." },
    { id: "def-7", code: "DEF-007", foundInBuildId: "bld-7", fixedInBuildId: "bld-9", title: "Haptic vest drops rapid multi-hit sequences", severity: "Minor", status: "Fix In Work",
      componentId: "cmp-11", caseIds: ["tc-28"], runId: "run-19", owner: "Immersive Systems Team", opened: "2026-08-05", closed: "",
      description: "Hits closer than 30 ms apart are dropped. Fixed in 0.9.1, which is now the build under test — the defect page offers \"ready to retest\"." },
    { id: "def-8", code: "DEF-008", foundInBuildId: "bld-9", title: "Recoil impulse 22% below live weapon", severity: "Major", status: "Open",
      componentId: "cmp-21", caseIds: ["tc-29"], runId: "run-24", owner: "Immersive Systems Team", opened: "2026-09-02", closed: "",
      description: "Replica impulse 22% under the live M4 (15% allowed). Playtesters also described recoil as soft." },
    { id: "def-9", code: "DEF-009", foundInBuildId: "bld-1", fixedInBuildId: "bld-2", verifiedInBuildId: "bld-2", title: "Crash on alt-tab during loading screen", severity: "Critical", status: "Closed",
      componentId: "cmp-1", caseIds: ["tc-6"], runId: "", owner: "Desktop Trainer Team", opened: "2026-07-20", closed: "2026-08-14",
      description: "Client crashed when alt-tabbing during a loading screen. Fixed in 1.1.0-alpha and verified there." },
    { id: "def-10", code: "DEF-010", foundInBuildId: "bld-6", title: "OPFOR occasionally clips through doors", severity: "Cosmetic", status: "Deferred",
      componentId: "cmp-6", caseIds: ["tc-5"], runId: "run-16", owner: "Sim Services Core", opened: "2026-09-09", closed: "",
      description: "Rare navigation-mesh clipping at narrow doors. Deferred to R3.4." }
  ],

  risks: [
    { id: "rsk-1", code: "RSK-001", systemId: "sys-2", title: "Ballistics evidence gap at long range", category: "Technical",
      description: "Drop error beyond 400 m (DEF-001) and no 7.62 mm referent points past 500 m threaten the ballistics accreditation for 600 m marksmanship.",
      likelihood: 4, impact: 4, initialLikelihood: 3, initialImpact: 4, residualLikelihood: 2, residualImpact: 3, status: "Mitigating", owner: "Sim Services Core",
      relatedRequirementIds: ["req-2", "req-18"], relatedCaseIds: ["tc-3", "tc-15"],
      mitigations: [
        { id: "mit-1", text: "Fix drag table interpolation (SSS 3.3.1) and re-run TC-003.", status: "In Progress", owner: "Sim Services Core", due: "2026-10-09" },
        { id: "mit-2", text: "Collect 7.62 mm long-range points at the Range 7 shoot (EVT-06).", status: "Approved", owner: "Test Team", due: "2026-10-15" },
        { id: "mit-3", text: "If the gap persists, request accreditation limited to 500 m.", status: "Proposed", owner: "Program Office", due: "2026-10-30" }
      ] },
    { id: "rsk-2", code: "RSK-002", systemId: "sys-2", title: "Network latency at company scale", category: "Technical",
      description: "Latency spikes above 24 clients (DEF-002) could make 32-trainee exercises unplayable and block the joint exercise gate.",
      likelihood: 3, impact: 4, status: "Mitigating", owner: "Sim Services Core",
      relatedRequirementIds: ["req-1", "req-17"], relatedCaseIds: ["tc-1", "tc-22"],
      mitigations: [
        { id: "mit-4", text: "Profile the tick scheduler under entity bursts; split replication onto its own thread.", status: "In Progress", owner: "Sim Services Core", due: "2026-10-16" },
        { id: "mit-5", text: "Interest management: only replicate entities within 1 km of each client.", status: "Proposed", owner: "Sim Services Core", due: "2026-11-06" }
      ] },
    { id: "rsk-3", code: "RSK-003", systemId: "sys-3", title: "Cybersickness limits session length", category: "Safety",
      description: "3 of 14 playtesters reported nausea after 20 minutes; the 30-minute session requirement (REQ-014) may not be met.",
      likelihood: 3, impact: 3, status: "Open", owner: "Immersive Systems Team",
      relatedRequirementIds: ["req-14"], relatedCaseIds: ["tc-31"],
      mitigations: [
        { id: "mit-6", text: "Enable dynamic vignetting by default; add snap-turn option.", status: "Approved", owner: "Immersive Systems Team", due: "2026-10-20" },
        { id: "mit-7", text: "Obtain human-use approval so SSQ sessions (TC-031) can run.", status: "In Progress", owner: "Program Office", due: "2026-10-06" }
      ] },
    { id: "rsk-4", code: "RSK-004", systemId: "sys-3", title: "Trainee fall on the treadmill", category: "Safety",
      description: "A trainee could fall if the treadmill does not decelerate in time at the boundary or the harness fails.",
      likelihood: 2, impact: 5, initialLikelihood: 3, initialImpact: 5, residualLikelihood: 1, residualImpact: 5, status: "Mitigating", owner: "Safety Officer",
      relatedRequirementIds: ["req-6", "req-10", "req-21"], relatedCaseIds: ["tc-27", "tc-8"],
      mitigations: [
        { id: "mit-8", text: "Harness and tether mandatory; interlock blocks session start without them.", status: "Verified", owner: "Immersive Systems Team", due: "2026-08-20" },
        { id: "mit-9", text: "Guardian warn at 0.6 m and hard stop at 0.3 m (PSPEC-005).", status: "Complete", owner: "Immersive Systems Team", due: "2026-08-30" },
        { id: "mit-10", text: "Install vendor firmware with the improved braking profile (slipped, EVT-12).", status: "In Progress", owner: "Immersive Systems Team", due: "2026-10-06" }
      ] },
    { id: "rsk-5", code: "RSK-005", title: "Training effectiveness criteria undefined", category: "Programmatic",
      description: "The customer has not defined how training effectiveness will be judged; evidence collected now may not match what is required later.",
      likelihood: 3, impact: 4, status: "Mitigating", owner: "Program Office",
      relatedRequirementIds: [], relatedCaseIds: ["tc-14", "tc-5"],
      mitigations: [
        { id: "mit-11", text: "Working session with the customer to agree effectiveness measures.", status: "Approved", owner: "Program Office", due: "2026-10-21" }
      ] },
    { id: "rsk-6", code: "RSK-006", systemId: "sys-1", title: "Minimum-spec PC baseline drift", category: "Technical",
      description: "Driver and OS updates on unit PCs could drop frame rates below 60 FPS after fielding.",
      likelihood: 2, impact: 3, status: "Monitoring", owner: "Desktop Trainer Team",
      relatedRequirementIds: ["req-3", "req-19"], relatedCaseIds: ["tc-6"],
      mitigations: [
        { id: "mit-12", text: "Publish a supported driver list and re-run TC-006 on each new driver.", status: "Complete", owner: "Desktop Trainer Team", due: "2026-08-30" }
      ] },
    { id: "rsk-7", code: "RSK-007", title: "Headset vendor end-of-life", category: "Cost",
      description: "The current headset model is end-of-life in 2027; a replacement would change latency and comfort baselines.",
      likelihood: 2, impact: 4, status: "Open", owner: "Program Office",
      relatedRequirementIds: ["req-4"], relatedCaseIds: ["tc-26"],
      mitigations: [
        { id: "mit-13", text: "Lifetime-buy 20 spare headsets; hold under CM.", status: "Proposed", owner: "Program Office", due: "2026-11-15" },
        { id: "mit-14", text: "Define the regression subset to re-run on a headset change.", status: "Proposed", owner: "Test Team", due: "2026-11-30" }
      ] },
    { id: "rsk-8", code: "RSK-008", systemId: "sys-3", title: "Haptics vendor schedule slip", category: "Schedule",
      description: "The haptic vest vendor is late with the multi-hit firmware; could slip early access.",
      likelihood: 4, impact: 2, status: "Open", owner: "Immersive Systems Team",
      relatedRequirementIds: ["req-9", "req-25"], relatedCaseIds: ["tc-28"],
      mitigations: [
        { id: "mit-15", text: "Weekly vendor status call; escalate if the firmware is not delivered by 10/15.", status: "In Progress", owner: "Immersive Systems Team", due: "2026-10-15" },
        { id: "mit-16", text: "Software batching workaround in IVT 0.9.1.", status: "Complete", owner: "Immersive Systems Team", due: "2026-08-24" },
        { id: "mit-17", text: "Qualify a second vest supplier.", status: "Proposed", owner: "Program Office", due: "2026-12-01" }
      ] }
  ],

  /* Weekly readiness snapshots for the dashboard trend lines, reconstructed from the run and
     defect dates above (other = cases whose latest result is neither Pass nor Fail, including
     never run). The app adds one snapshot per day it is opened. */
  snapshots: [
    { date: "2026-07-31", pass: 2,  fail: 0, other: 22, verified: 1, reqTotal: 20, defOpen: 1 },
    { date: "2026-08-07", pass: 7,  fail: 0, other: 20, verified: 4, reqTotal: 21, defOpen: 2 },
    { date: "2026-08-14", pass: 9,  fail: 0, other: 20, verified: 5, reqTotal: 22, defOpen: 2 },
    { date: "2026-08-21", pass: 9,  fail: 1, other: 20, verified: 5, reqTotal: 23, defOpen: 2 },
    { date: "2026-08-28", pass: 10, fail: 1, other: 20, verified: 6, reqTotal: 24, defOpen: 4 },
    { date: "2026-09-04", pass: 9,  fail: 5, other: 18, verified: 6, reqTotal: 25, defOpen: 8 },
    { date: "2026-09-11", pass: 9,  fail: 5, other: 19, verified: 6, reqTotal: 26, defOpen: 8 },
    { date: "2026-09-18", pass: 9,  fail: 5, other: 19, verified: 6, reqTotal: 26, defOpen: 8 },
    { date: "2026-09-25", pass: 9,  fail: 5, other: 19, verified: 6, reqTotal: 26, defOpen: 8 }
  ]
};
