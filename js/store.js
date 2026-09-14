/* ============================================================
   Store — localStorage-backed database with codes & relations
   ============================================================ */

const DB_KEY = "msm1-te-db-v1";
const OLD_DB_KEYS = ["msm4-te-db-v1"];

const CODE_PREFIX = {
  systems: "SYS", components: "CMP", requirements: "REQ", cases: "TC",
  procedures: "PROC", criteria: "CRI", plans: "TP", runs: "RUN",
  risks: "RSK", mitigations: "MIT", resources: "RES", decisions: "DP", events: "EVT", notes: "NOTE", defects: "DEF", documents: "DOC"
};

const CODE_PAD = { systems: 2, components: 2, procedures: 2, plans: 2, resources: 2, decisions: 2, events: 2, requirements: 3, cases: 3, runs: 3, risks: 3, criteria: 3, mitigations: 3, notes: 3, defects: 3, documents: 2 };

const Store = {
  db: null,

  load() {
    try {
      let raw = localStorage.getItem(DB_KEY);
      if (!raw) {
        for (const oldKey of OLD_DB_KEYS) {
          raw = localStorage.getItem(oldKey);
          if (raw) { localStorage.removeItem(oldKey); break; }
        }
      }
      if (raw) { this.db = JSON.parse(raw); this.migrate(); return; }
    } catch (e) { /* corrupted or storage unavailable — fall through to seed */ }
    this.db = JSON.parse(JSON.stringify(SEED_DB));
    this.migrate();
  },

  /* Upgrade older saved databases in place. */
  migrate() {
    const db = this.db;
    db.resources = db.resources || [];
    db.meta.seq.resources = db.meta.seq.resources || db.resources.length;
    (db.criteria || []).forEach(c => {
      if (!c.parentType) { c.parentType = "procedure"; c.parentId = c.procedureId; }
    });
    (db.requirements || []).forEach(r => {
      if (r.measure === undefined) { r.measure = "None"; r.threshold = ""; r.objective = ""; }
    });
    (db.cases || []).forEach(tc => {
      if (tc.venue === undefined) tc.venue = "";
      if (tc.testType === undefined) tc.testType = "";
      if (!Array.isArray(tc.resourceIds)) tc.resourceIds = [];
    });
    db.decisions = db.decisions || [];
    db.events = db.events || [];
    db.meta.seq.decisions = db.meta.seq.decisions || db.decisions.length;
    db.meta.seq.events = db.meta.seq.events || db.events.length;
    db.meta.seq.notes = db.meta.seq.notes || 0;
    /* older plans carried a free-text decision — promote it to a Decision entity */
    (db.plans || []).forEach(p => {
      if (p.decisionId === undefined) p.decisionId = "";
      if (p.decision && !p.decisionId) {
        let dec = db.decisions.find(d => d.title === p.decision);
        if (!dec) {
          dec = { title: p.decision, status: "Pending", date: "", authority: "", description: "", requirementIds: [] };
          dec.code = this.nextCode("decisions");
          dec.id = this.nextId("decisions");
          db.decisions.push(dec);
        }
        p.decisionId = dec.id;
      }
      delete p.decision;
    });
    (db.decisions || []).forEach(d => { if (!Array.isArray(d.requirementIds)) d.requirementIds = []; });
    (db.events || []).forEach(ev => { if (!Array.isArray(ev.notes)) ev.notes = []; });
    db.defects = db.defects || [];
    db.meta.seq.defects = db.meta.seq.defects || db.defects.length;
    db.snapshots = db.snapshots || [];
    (db.risks || []).forEach(r => {
      if (r.initialLikelihood === undefined) { r.initialLikelihood = r.likelihood; r.initialImpact = r.impact; }
      if (r.residualLikelihood === undefined) { r.residualLikelihood = null; r.residualImpact = null; }
    });
    (db.runs || []).forEach(r => {
      if (r.measured === undefined) r.measured = "";
      if (r.evidence === undefined) r.evidence = "";
    });
    (db.defects || []).forEach(d => { if (!Array.isArray(d.caseIds)) d.caseIds = []; });
    db.audit = db.audit || [];
    if (db.meta.jiraBaseUrl === undefined) db.meta.jiraBaseUrl = "";
    db.documents = db.documents || [];
    db.meta.seq.documents = db.meta.seq.documents || db.documents.length;
    (db.requirements || []).forEach(r => { if (r.extKey === undefined) r.extKey = ""; });
    (db.cases || []).forEach(tc => {
      if (tc.extKey === undefined) tc.extKey = "";
      if (!Array.isArray(tc.extLinks)) tc.extLinks = [];
    });
    (db.plans || []).forEach(p => {
      if (p.extKey === undefined) p.extKey = "";
      if (!Array.isArray(p.extLinks)) p.extLinks = [];
    });
    (db.runs || []).forEach(r => { if (r.extKey === undefined) r.extKey = ""; });
    this.save();
  },

  /* ---------- audit trail ---------- */
  logAudit(coll, entity, action, summary) {
    if (!entity || !entity.id) return;
    this.db.audit = this.db.audit || [];
    this.db.audit.push({
      ts: new Date().toISOString().slice(0, 16).replace("T", " "),
      coll, entityId: entity.id, code: entity.code || "", action, summary: summary || ""
    });
    if (this.db.audit.length > 600) this.db.audit = this.db.audit.slice(-600);
  },

  auditOf(entityId) {
    return (this.db.audit || []).filter(a => a.entityId === entityId);
  },

  /* ---------- undo (soft delete) ---------- */
  undoStack: [],

  checkpoint() {
    this.undoStack.push(JSON.stringify(this.db));
    if (this.undoStack.length > 5) this.undoStack.shift();
  },

  undo() {
    const snap = this.undoStack.pop();
    if (!snap) return false;
    this.db = JSON.parse(snap);
    this.save();
    return true;
  },

  /* ---------- daily readiness snapshots ---------- */
  snapshotToday() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.db.snapshots.some(s => s.date === today)) return;
    let pass = 0, fail = 0, other = 0;
    for (const tc of this.all("cases")) {
      const run = this.latestRun(tc.id);
      if (!run) other++;
      else if (run.result === "Pass") pass++;
      else if (run.result === "Fail") fail++;
      else other++;
    }
    const reqs = this.all("requirements");
    const verified = reqs.filter(r => this.reqStatus(r.id) === "verified").length;
    const defOpen = this.openDefects().length;
    this.db.snapshots.push({ date: today, pass, fail, other, verified, reqTotal: reqs.length, defOpen });
    if (this.db.snapshots.length > 120) this.db.snapshots = this.db.snapshots.slice(-120);
    this.save();
  },

  save() {
    try { localStorage.setItem(DB_KEY, JSON.stringify(this.db)); }
    catch (e) { Toast.show("Warning: could not persist to localStorage", true); }
  },

  reset() {
    this.db = JSON.parse(JSON.stringify(SEED_DB));
    this.migrate();
  },

  /* Wipe everything and begin a fresh, empty program. */
  startBlank(programName) {
    const keepJira = (this.db && this.db.meta && this.db.meta.jiraBaseUrl) || "";
    this.db = {
      meta: { program: programName || "New T&E Program", version: 2, jiraBaseUrl: keepJira, seq: {} },
      systems: [], components: [], requirements: [], cases: [], procedures: [], criteria: [],
      plans: [], runs: [], risks: [], resources: [], decisions: [], events: [], defects: [],
      documents: [], snapshots: [], audit: []
    };
    this.migrate();
  },

  storageBytes() {
    try { return JSON.stringify(this.db).length; } catch (e) { return 0; }
  },

  all(coll) { return this.db[coll] || []; },

  get(coll, id) { return (this.db[coll] || []).find(x => x.id === id) || null; },

  byCode(code) {
    for (const coll of ["systems", "components", "requirements", "cases", "procedures", "plans", "runs", "risks", "resources", "decisions", "events", "defects", "documents"]) {
      const hit = this.all(coll).find(x => x.code === code);
      if (hit) return { coll, entity: hit };
    }
    return null;
  },

  nextId(coll) {
    this.db.meta.seq[coll] = (this.db.meta.seq[coll] || 0) + 1;
    return `${coll.slice(0, 3)}-${Date.now().toString(36)}-${this.db.meta.seq[coll]}`;
  },

  nextCode(coll) {
    const n = (this.db.meta.seq[coll] || 0) + 1; // nextId will bump seq; peek ahead
    return `${CODE_PREFIX[coll]}-${String(n).padStart(CODE_PAD[coll] || 3, "0")}`;
  },

  add(coll, obj) {
    obj.code = obj.code || this.nextCode(coll);
    obj.id = this.nextId(coll);
    this.db[coll].push(obj);
    this.logAudit(coll, obj, "created");
    this.save();
    return obj;
  },

  update(coll, id, patch) {
    const item = this.get(coll, id);
    if (!item) return null;
    const fmt = v => {
      if (Array.isArray(v)) return `[${v.length} item${v.length === 1 ? "" : "s"}]`;
      const s = String(v == null ? "—" : v);
      return s.length > 26 ? s.slice(0, 24) + "…" : s;
    };
    const changes = [];
    for (const k of Object.keys(patch)) {
      if (JSON.stringify(item[k]) !== JSON.stringify(patch[k])) changes.push(`${k}: ${fmt(item[k])} → ${fmt(patch[k])}`);
    }
    Object.assign(item, patch);
    if (changes.length) this.logAudit(coll, item, "updated", changes.join("; "));
    this.save();
    return item;
  },

  remove(coll, id) {
    this.checkpoint();
    const item = this.get(coll, id);
    if (item) this.logAudit(coll, item, "deleted");
    this.db[coll] = this.db[coll].filter(x => x.id !== id);
    this.cleanupRefs(coll, id);
    this.save();
  },

  /* Remove dangling references after a delete. */
  cleanupRefs(coll, id) {
    const db = this.db;
    if (coll === "systems") {
      db.components.filter(c => c.systemId === id).forEach(c => this.cleanupRefs("components", c.id));
      db.components = db.components.filter(c => c.systemId !== id);
    }
    if (coll === "components") {
      db.cases.filter(tc => tc.componentId === id).forEach(tc => this.cleanupRefs("cases", tc.id));
      db.cases = db.cases.filter(tc => tc.componentId !== id);
      db.requirements.forEach(r => r.componentIds = (r.componentIds || []).filter(x => x !== id));
      (db.defects || []).forEach(d => { if (d.componentId === id) d.componentId = ""; });
    }
    if (coll === "cases") {
      db.plans.forEach(p => p.caseIds = (p.caseIds || []).filter(x => x !== id));
      db.runs = db.runs.filter(r => r.caseId !== id);
      db.risks.forEach(r => r.relatedCaseIds = (r.relatedCaseIds || []).filter(x => x !== id));
      (db.defects || []).forEach(d => d.caseIds = (d.caseIds || []).filter(x => x !== id));
    }
    if (coll === "runs") {
      (db.defects || []).forEach(d => { if (d.runId === id) d.runId = ""; });
    }
    if (coll === "requirements") {
      db.cases.forEach(tc => tc.requirementIds = (tc.requirementIds || []).filter(x => x !== id));
      db.risks.forEach(r => r.relatedRequirementIds = (r.relatedRequirementIds || []).filter(x => x !== id));
      (db.decisions || []).forEach(d => d.requirementIds = (d.requirementIds || []).filter(x => x !== id));
    }
    if (coll === "decisions") {
      db.plans.forEach(p => { if (p.decisionId === id) p.decisionId = ""; });
      (db.events || []).forEach(ev => { if (ev.decisionId === id) ev.decisionId = ""; });
    }
    if (coll === "procedures") {
      db.criteria = db.criteria.filter(c => !(c.parentType === "procedure" && c.parentId === id));
      db.cases.forEach(tc => { if (tc.procedureId === id) tc.procedureId = null; });
    }
    if (coll === "plans") {
      db.criteria = db.criteria.filter(c => !(c.parentType === "plan" && c.parentId === id));
      db.runs.forEach(r => { if (r.planId === id) r.planId = null; });
      (db.events || []).forEach(ev => { if (ev.planId === id) ev.planId = ""; });
    }
    if (coll === "resources") {
      db.cases.forEach(tc => tc.resourceIds = (tc.resourceIds || []).filter(x => x !== id));
    }
  },

  /* -------- relation helpers -------- */
  componentsOf(systemId) { return this.all("components").filter(c => c.systemId === systemId); },
  casesOf(componentId) { return this.all("cases").filter(tc => tc.componentId === componentId); },
  casesOfSystem(systemId) {
    const ids = new Set(this.componentsOf(systemId).map(c => c.id));
    return this.all("cases").filter(tc => ids.has(tc.componentId));
  },
  criteriaOf(parentId, kind) {
    return this.all("criteria").filter(c => c.parentId === parentId && (!kind || c.kind === kind));
  },
  casesOfProcedure(procedureId) { return this.all("cases").filter(tc => tc.procedureId === procedureId); },
  casesOfRequirement(reqId) { return this.all("cases").filter(tc => (tc.requirementIds || []).includes(reqId)); },
  runsOf(caseId) {
    return this.all("runs").filter(r => r.caseId === caseId)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  },
  latestRun(caseId) { return this.runsOf(caseId)[0] || null; },
  plansOf(caseId) { return this.all("plans").filter(p => (p.caseIds || []).includes(caseId)); },
  risksOfCase(caseId) { return this.all("risks").filter(r => (r.relatedCaseIds || []).includes(caseId)); },
  resourcesOf(tc) { return (tc.resourceIds || []).map(id => this.get("resources", id)).filter(Boolean); },
  casesOfResource(resId) { return this.all("cases").filter(tc => (tc.resourceIds || []).includes(resId)); },

  /* ---------- defects ---------- */
  defectIsOpen(d) { return !["Closed", "Deferred"].includes(d.status); },
  openDefects() { return this.all("defects").filter(d => this.defectIsOpen(d)); },
  defectsOfComponent(compId) { return this.all("defects").filter(d => d.componentId === compId); },
  defectsOfCase(caseId) { return this.all("defects").filter(d => (d.caseIds || []).includes(caseId)); },

  /* Derived component test status: Failing | In Test | Passing | Untested.
     Open Critical/Major defects count as Failing. */
  componentStatus(compId) {
    const openBad = this.defectsOfComponent(compId).some(d =>
      this.defectIsOpen(d) && (d.severity === "Critical" || d.severity === "Major"));
    const cases = this.casesOf(compId);
    const runs = cases.map(tc => this.latestRun(tc.id));
    const anyFail = runs.some(r => r && r.result === "Fail");
    if (anyFail || openBad) return "Failing";
    if (cases.length && runs.every(r => r && r.result === "Pass")) return "Passing";
    if (runs.some(r => r)) return "In Test";
    return "Untested";
  },

  systemStatus(sysId) {
    const statuses = this.componentsOf(sysId).map(c => this.componentStatus(c.id));
    if (!statuses.length) return "Untested";
    for (const s of ["Failing", "In Test", "Passing"]) if (statuses.includes(s)) {
      // Failing dominates; then a mix of tested states reads as In Test unless all pass
      if (s === "Failing") return "Failing";
      if (s === "In Test") return "In Test";
      return statuses.every(x => x === "Passing") ? "Passing" : "In Test";
    }
    return "Untested";
  },

  plansOfDecision(decId) { return this.all("plans").filter(p => p.decisionId === decId); },
  eventsOfDecision(decId) { return this.all("events").filter(ev => ev.decisionId === decId); },
  eventsOfPlan(planId) { return this.all("events").filter(ev => ev.planId === planId); },

  /* Decision readiness: fraction of its linked measures currently verified. */
  decisionReadiness(dec) {
    const ids = dec.requirementIds || [];
    if (!ids.length) return null;
    const verified = ids.filter(rid => this.reqStatus(rid) === "verified").length;
    return { verified, total: ids.length, pct: Math.round((verified / ids.length) * 100) };
  },

  /* M&S assets linked to a case that still lack accreditation —
     a data-credibility caveat for DT&E evidence (DoDI 5000.61). */
  unaccreditedAssets(tc) {
    return this.resourcesOf(tc).filter(r =>
      r.vvaRequired && r.accreditation !== "Accredited" && r.accreditation !== "Conditionally Accredited");
  },
  risksOfRequirement(reqId) { return this.all("risks").filter(r => (r.relatedRequirementIds || []).includes(reqId)); },

  /* Requirement verification rollup: "verified" | "failing" | "covered" | "uncovered" */
  reqStatus(reqId) {
    const cases = this.casesOfRequirement(reqId);
    if (!cases.length) return "uncovered";
    let anyFail = false, allPass = true;
    for (const tc of cases) {
      const run = this.latestRun(tc.id);
      if (!run || run.result !== "Pass") allPass = false;
      if (run && run.result === "Fail") anyFail = true;
    }
    if (anyFail) return "failing";
    if (allPass) return "verified";
    return "covered";
  },

  riskScore(r) { return (r.likelihood || 1) * (r.impact || 1); },

  riskBand(score) {
    if (score >= 17) return "critical";
    if (score >= 10) return "high";
    if (score >= 5) return "moderate";
    return "low";
  },

  /* -------- export / import -------- */
  exportJSON() { return JSON.stringify(this.db, null, 2); },

  importJSON(text) {
    const data = JSON.parse(text);
    const required = ["systems", "components", "requirements", "cases", "procedures", "criteria", "plans", "runs", "risks", "meta"];
    for (const k of required) if (!(k in data)) throw new Error(`Missing collection: ${k}`);
    this.db = data;
    this.migrate();
  },

  /* -------- search -------- */
  search(q) {
    q = q.trim().toLowerCase();
    if (!q) return [];
    const hits = [];
    const scan = (coll, label, fields, route) => {
      for (const e of this.all(coll)) {
        const hay = fields.map(f => e[f] || "").join(" ").toLowerCase();
        if (hay.includes(q)) hits.push({ coll, label, entity: e, route: route(e) });
      }
    };
    scan("systems", "System", ["code", "name", "description"], e => `#/systems/${e.id}`);
    scan("components", "Component", ["code", "name", "description"], e => `#/components/${e.id}`);
    scan("requirements", "Requirement", ["code", "title", "text", "extKey"], e => `#/requirements/${e.id}`);
    scan("cases", "Test Case", ["code", "title", "objective", "extKey"], e => `#/cases/${e.id}`);
    scan("procedures", "Procedure", ["code", "title", "description"], e => `#/procedures/${e.id}`);
    scan("plans", "Test Plan", ["code", "name", "description"], e => `#/plans/${e.id}`);
    scan("runs", "Test Run", ["code", "notes", "operator"], e => `#/runs`);
    scan("risks", "Risk", ["code", "title", "description"], e => `#/risks/${e.id}`);
    scan("resources", "M&S Asset / Resource", ["code", "name", "description", "intendedUse"], e => `#/resources/${e.id}`);
    scan("decisions", "Decision", ["code", "title", "description"], e => `#/decisions/${e.id}`);
    scan("events", "Schedule Event", ["code", "title", "description", "location"], e => `#/events/${e.id}`);
    scan("defects", "Defect", ["code", "title", "description"], e => `#/defects/${e.id}`);
    scan("documents", "Document", ["code", "title", "description", "url", "fileName", "relatedCodes"], e => `#/documents`);
    return hits.slice(0, 40);
  }
};
