/* ============================================================
   Store — localStorage-backed database with codes & relations
   ============================================================ */

const DB_KEY = "msm1-te-db-v1";
const OLD_DB_KEYS = ["msm4-te-db-v1"];

const CODE_PREFIX = {
  systems: "SYS", components: "CMP", requirements: "REQ", cases: "TC",
  procedures: "PROC", criteria: "CRI", plans: "TP", runs: "RUN",
  risks: "RSK", mitigations: "MIT", resources: "RES", decisions: "DP", events: "EVT", notes: "NOTE", defects: "DEF", documents: "DOC", testRuns: "TR"
};

const CODE_PAD = { systems: 2, components: 2, procedures: 2, plans: 2, resources: 2, decisions: 2, events: 2, requirements: 3, cases: 3, runs: 3, risks: 3, criteria: 3, mitigations: 3, notes: 3, defects: 3, documents: 2, testRuns: 3 };

/* Case lifecycle implied by a case's latest run result. */
const RUN_CASE_STATUS = { Pass: 'Complete', Fail: 'In Progress', 'In Progress': 'In Progress', Blocked: 'Blocked', Waived: 'Complete', 'Review for Removal': 'Draft' };
/* Results that close out a case inside a test run (Blocked / In Progress do not). */
const RUN_DONE_RESULTS = ['Pass', 'Fail', 'Waived', 'Review for Removal'];

const Store = {
  db: null,

  // All UI mutations enter command(), which serializes writers using Web Locks.
  _raw: null,
  _committed: null,
  _tx: null,
  failedDraft: null,
  stage(fn) {
    const db=this.db, tx=this._tx, undo=this.undoStack.slice();
    try {
      this.db=DataGuard.clone(db);this._tx={effects:[],replacement:false};
      const result=fn();DataGuard.validate(this.db);
      return {db:this.db,result};
    } finally {this.db=db;this._tx=tx;this.undoStack=undo;}
  },
  async command(label, fn) {
    if (!globalThis.navigator?.locks) throw new Error('This browser cannot coordinate safe writes. Use a current browser with Web Locks; export remains available.');
    return navigator.locks.request(DB_KEY, () => this.transaction(label, fn));
  },
  async transaction(label, fn) {
    if (this._tx) return fn();
    const before = this._committed || JSON.stringify(this.db);
    const undo = this.undoStack.slice();
    const original=this.db;
    const tx = this._tx = {label, effects: [], replacement: false};
    let result;
    try {
      result = fn();
      if (result && typeof result.then === 'function') throw new Error('Commands must be synchronous inside the storage lock.');
      // Re-importing the same payload is a no-op, including its prior receipt.
      if (tx.replacement) {
        const prior=JSON.parse(before), last=prior.audit?.at(-1);
        if (last?.coll==='database' && last.action==='replaced') {
          prior.audit.pop();
          if(JSON.stringify(prior)===JSON.stringify(this.db))this.db=JSON.parse(before);
        }
      }
      if (JSON.stringify(this.db) !== before) {
        if (!tx.replacement) this.reconcileRuns(JSON.parse(before));
        DataGuard.validate(this.db);
        if (!tx.replacement) this.auditChanges(JSON.parse(before), label);
        else this.db.audit.push({ts:new Date().toISOString(),coll:'database',entityId:'database',code:'',action:'replaced',summary:label+'; previous active bytes retained in recovery storage'});
        await this.persist();
      }
    } catch (err) {
      try {this.failedDraft = JSON.stringify(this.db);}catch(_){this.failedDraft=null;}
      this.db = DataGuard.restore(original,JSON.parse(before));
      this.undoStack = undo;
      this._tx = null;
      throw err;
    }
    this._tx = null;
    for (const effect of tx.effects) {
      try { effect(); }
      catch (err) {
        console.error(err);
        if (typeof Toast !== 'undefined') Toast.show('The command completed, but the display could not refresh. Reload to view the saved data.',true);
      }
    }
    return result;
  },
  effect(fn) { if (this._tx) this._tx.effects.push(fn); else fn(); },
  load() {
    const active = localStorage.getItem(DB_KEY);
    let raw = active;
    if (raw === null) for (const key of OLD_DB_KEYS) {
      const old = localStorage.getItem(key);
      if (old !== null) { raw = old; break; }
    }
    // Never seed when data exists but cannot be read, parsed, validated or migrated.
    const candidate = DataGuard.normalize(raw === null ? SEED_DB : JSON.parse(raw));
    this.db = candidate.db;
    this._raw = active;
    // Loading is read-only. The original bytes remain until a verified write.
    this._committed = JSON.stringify(this.db);
    this.loadChanges = candidate.changes;
    return this.db;
  },
  migrate() {
    this.db = DataGuard.normalize(this.db).db;
    this.save();
  },
  async persist() {
    const next=JSON.stringify(this.db), previous=this._raw;
    await WriteFence.commit(DB_KEY,previous,next,()=>this.persistLocal(next,previous),()=>{
      if(previous===null)localStorage.removeItem(DB_KEY);else localStorage.setItem(DB_KEY,previous);
    });
    this._raw=next;this._committed=next;this.failedDraft=null;
  },
  persistLocal(next, previous) {
    if (localStorage.getItem(DB_KEY) !== this._raw) throw new Error('Another tab or release changed this database. Export your unsaved draft, then reload before editing.');
    // Backup before replacement. Quota failure aborts; never delete the old copy to make room.
    if (previous !== null) {
      localStorage.setItem(DB_KEY + '-recovery', previous);
      if (localStorage.getItem(DB_KEY + '-recovery') !== previous) throw new Error('Recovery copy verification failed; save stopped.');
    }
    localStorage.setItem(DB_KEY, next);
    try {
      if (localStorage.getItem(DB_KEY) !== next) throw new Error('Saved data could not be verified.');
    } catch (err) {
      try {
        if (previous === null) localStorage.removeItem(DB_KEY);
        else localStorage.setItem(DB_KEY, previous);
      } catch (_) { /* Original bytes remain in the recovery key. */ }
      throw err;
    }
  },
  auditChanges(before, label) {
    const ts = new Date().toISOString();
    const append = (coll, old, item) => {
      if (JSON.stringify(old) === JSON.stringify(item)) return;
      const e = item || old;
      const fields = [...new Set([...Object.keys(old || {}), ...Object.keys(item || {})])].filter(k=>JSON.stringify(old?.[k])!==JSON.stringify(item?.[k]));
      const describe=(key,value)=>key==='dataUrl'&&value ? `[embedded content: ${value.length} characters]` : value === undefined ? null : DataGuard.clone(value);
      const changes=Object.fromEntries(fields.map(key=>[key,{before:describe(key,old?.[key]),after:describe(key,item?.[key])}]));
      this.db.audit.push({ts, coll, entityId:e.id || 'meta', code:e.code || '', action:!old?'created':!item?'deleted':'updated', summary:label + ': ' + fields.join(', '),changes});
    };
    for (const coll of DataGuard.collections.filter(c=>!['audit','snapshots'].includes(c))) {
      const old = new Map((before[coll] || []).map(e=>[e.id,e]));
      const current = new Map((this.db[coll] || []).map(e=>[e.id,e]));
      for (const id of new Set([...old.keys(),...current.keys()])) append(coll,old.get(id),current.get(id));
    }
    append('meta', before.meta, this.db.meta);
    if (JSON.stringify(before.snapshots)!==JSON.stringify(this.db.snapshots)) this.db.audit.push({ts,coll:'snapshots',entityId:'snapshots',code:'',action:'updated',summary:label});
  },
  reconcileRuns(before) {
    const old=new Map(before.runs.map(r=>[r.id,r]));
    const now=new Map(this.db.runs.map(r=>[r.id,r]));
    const affected=new Set(), nominate=new Set();
    for(const id of new Set([...old.keys(),...now.keys()])) {
      const a=old.get(id), b=now.get(id);
      if(JSON.stringify(a)!==JSON.stringify(b)) { if(a)affected.add(a.caseId); if(b)affected.add(b.caseId); }
      // Nominate only when a run newly becomes Review for Removal, so a later
      // unrelated edit cannot re-raise a nomination the user already resolved.
      if(b && b.result==='Review for Removal' && (!a || a.result!==b.result)) nominate.add(b.caseId);
    }
    for(const id of affected) {
      const tc=this.get('cases',id); if(!tc)continue;
      // Retirement is a deliberate disposition; run edits never silently undo it.
      if(tc.status==='Retired')continue;
      const run=this.latestRun(id);
      tc.status=run?RUN_CASE_STATUS[run.result]:'Draft';
      if(nominate.has(id) && run && run.result==='Review for Removal' && !tc.removalNominated) {
        tc.removalNominated=true;
        tc.reviewDisposition=`Nominated for review/removal by ${run.code} on ${run.date}${run.notes?` — ${run.notes}`:''}`;
      }
    }
  },

  /* ---------- audit trail ---------- */
  // Compatibility hook: commit-time diff auditing covers direct mutations too.
  logAudit() {},

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
    if (!this._tx) throw new Error('Use Store.command() for undo.');
    const snap = this.undoStack.pop();
    if (!snap) return false;
    const audit=this.db.audit;
    this.db = JSON.parse(snap);
    this.db.audit=audit;
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
    // Preserve historical snapshots; no silent pruning.
    this.save();
  },

  save() {
    if (this._tx) return;
    throw new Error('Writes must run inside Store.command().');
  },

  reset() {
    this.checkpoint();
    this._tx.replacement = true;
    this.db = DataGuard.normalize(SEED_DB).db;
  },

  /* Wipe everything and begin a fresh, empty program. */
  startBlank(programName) {
    const keepJira = (this.db && this.db.meta && this.db.meta.jiraBaseUrl) || "";
    this._tx.replacement = true;
    this.db = {
      meta: { program: programName || "New T&E Program", version: 2, jiraBaseUrl: keepJira, seq: {} },
      systems: [], components: [], requirements: [], cases: [], procedures: [], criteria: [],
      plans: [], runs: [], risks: [], resources: [], decisions: [], events: [], defects: [],
      documents: [], testRuns: [], snapshots: [], audit: []
    };
    this.migrate();
  },

  storageBytes() {
    try { return JSON.stringify(this.db).length; } catch (e) { return 0; }
  },

  all(coll) { return this.db[coll] || []; },

  get(coll, id) { return (this.db[coll] || []).find(x => x.id === id) || null; },

  byCode(code) {
    for (const coll of ["systems", "components", "requirements", "cases", "procedures", "plans", "runs", "risks", "resources", "decisions", "events", "defects", "documents", "testRuns"]) {
      const hit = this.all(coll).find(x => x.code === code);
      if (hit) return { coll, entity: hit };
    }
    return null;
  },

  nextId(coll) {
    this.db.meta.seq[coll] = (this.db.meta.seq[coll] || 0) + 1;
    const id = coll.slice(0, 3) + '-' + Date.now().toString(36) + '-' + this.db.meta.seq[coll];
    const all = DataGuard.collections.flatMap(c=>this.db[c] || []).concat(this.db.risks.flatMap(r=>r.mitigations),this.db.events.flatMap(e=>e.notes));
    return all.some(e=>e.id===id) ? this.nextId(coll) : id;
  },

  nextCode(coll) {
    let n = (this.db.meta.seq[coll] || 0) + 1;
    while (this.all(coll).some(e=>e.code===CODE_PREFIX[coll]+'-'+String(n).padStart(CODE_PAD[coll]||3,'0'))) n++;
    this.db.meta.seq[coll] = n - 1;
    return `${CODE_PREFIX[coll]}-${String(n).padStart(CODE_PAD[coll] || 3, "0")}`;
  },

  add(coll, obj) {
    if (!this._tx) throw new Error('Use Store.command() for changes.');
    for(const key of DataGuard.arrays[coll]||[])if(obj[key]===undefined)obj[key]=[];
    if (coll === 'runs' && obj.recordedAt === undefined) obj.recordedAt = new Date().toISOString();
    obj.code = obj.code || this.nextCode(coll);
    obj.id = this.nextId(coll);
    this.db[coll].push(obj);
    this.logAudit(coll, obj, "created");
    this.save();
    return obj;
  },

  update(coll, id, patch) {
    if (!this._tx) throw new Error('Use Store.command() for changes.');
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
    if (!this._tx) throw new Error('Use Store.command() for changes.');
    this.checkpoint();
    const item = this.get(coll, id);
    if (item) this.logAudit(coll, item, "deleted");
    this.db[coll] = this.db[coll].filter(x => x.id !== id);
    this.cleanupRefs(coll, id, item);
    this.save();
  },

  /* Remove dangling references after a delete. `removed` is the deleted record. */
  cleanupRefs(coll, id, removed) {
    const db = this.db;
    if (coll === "systems") {
      db.components.filter(c => c.systemId === id).forEach(c => this.cleanupRefs("components", c.id, c));
      db.components = db.components.filter(c => c.systemId !== id);
      // System-level cases go with their system; a stray systemId on a case owned
      // by another system's component is cleared instead.
      db.cases.filter(tc => tc.systemId === id && !tc.componentId).forEach(tc => this.cleanupRefs("cases", tc.id, tc));
      db.cases = db.cases.filter(tc => !(tc.systemId === id && !tc.componentId));
      db.cases.forEach(tc => { if (tc.systemId === id) tc.systemId = ""; });
      db.plans.forEach(p => { if (p.regressionSystemId === id) p.regressionSystemId = ""; });
      // Records the system owned are not deleted with it; they become program-level.
      for (const c of this.OWNED) (db[c] || []).forEach(r => { if (r.systemId === id) r.systemId = ""; });
    }
    if (coll === "components") {
      db.cases.filter(tc => tc.componentId === id).forEach(tc => this.cleanupRefs("cases", tc.id, tc));
      db.cases = db.cases.filter(tc => tc.componentId !== id);
      db.requirements.forEach(r => r.componentIds = (r.componentIds || []).filter(x => x !== id));
      (db.defects || []).forEach(d => { if (d.componentId === id) d.componentId = ""; });
      // Subcomponents move up one level rather than being deleted with their parent.
      db.components.forEach(c => { if (c.parentComponentId === id) c.parentComponentId = (removed && removed.parentComponentId) || ""; });
      (db.testRuns || []).forEach(t => { if (t.componentId === id) t.componentId = ""; });
    }
    if (coll === "cases") {
      db.plans.forEach(p => p.caseIds = (p.caseIds || []).filter(x => x !== id));
      db.runs.filter(r => r.caseId === id).forEach(r => this.cleanupRefs("runs", r.id));
      db.runs = db.runs.filter(r => r.caseId !== id);
      db.risks.forEach(r => r.relatedCaseIds = (r.relatedCaseIds || []).filter(x => x !== id));
      (db.defects || []).forEach(d => d.caseIds = (d.caseIds || []).filter(x => x !== id));
      (db.testRuns || []).forEach(t => t.caseIds = (t.caseIds || []).filter(x => x !== id));
    }
    if (coll === "testRuns") {
      // Results recorded during a test run are real execution history; keep them.
      db.runs.forEach(r => { if (r.testRunId === id) r.testRunId = ""; });
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
      (db.testRuns || []).forEach(t => { if (t.planId === id) t.planId = ""; });
    }
    if (coll === "resources") {
      db.cases.forEach(tc => tc.resourceIds = (tc.resourceIds || []).filter(x => x !== id));
    }
  },

  /* -------- relation helpers -------- */
  componentsOf(systemId) { return this.all("components").filter(c => c.systemId === systemId); },
  casesOf(componentId) { return this.all("cases").filter(tc => tc.componentId === componentId); },
  /* Includes system-level cases (systemId set, no owning component). */
  casesOfSystem(systemId) {
    const ids = new Set(this.componentsOf(systemId).map(c => c.id));
    return this.all("cases").filter(tc => ids.has(tc.componentId) || (!tc.componentId && tc.systemId === systemId));
  },
  systemLevelCases(systemId) { return this.all("cases").filter(tc => !tc.componentId && tc.systemId === systemId); },
  /* A case's system: its component's system wins over a denormalized systemId. */
  caseSystemId(tc) {
    const comp = tc.componentId ? this.get("components", tc.componentId) : null;
    return comp ? comp.systemId : (tc.systemId || "");
  },

  /* ---------- system ownership ----------
     The system a record belongs to, or "" for program-level / shared. Structural
     records derive it (component → its system, case → its component's system,
     run → its case, criterion → its parent); the rest carry an explicit systemId. */
  OWNED: ["requirements", "procedures", "plans", "testRuns", "risks", "defects", "decisions", "events", "documents", "resources"],
  ownerOf(coll, r) {
    if (!r) return "";
    switch (coll) {
      case "systems": return r.id;
      case "components": return r.systemId || "";
      case "cases": return this.caseSystemId(r);
      case "runs": { const tc = this.get("cases", r.caseId); return tc ? this.caseSystemId(tc) : ""; }
      case "criteria": { const pc = r.parentType === "plan" ? "plans" : "procedures"; return this.ownerOf(pc, this.get(pc, r.parentId)); }
      case "defects": { if (r.systemId) return r.systemId; const c = this.get("components", r.componentId); return c ? c.systemId : ""; }
      case "plans": return r.systemId || r.regressionSystemId || "";
      default: return r.systemId || "";
    }
  },
  /* A suggested owner for a program-level record, only when its links point to exactly one system. */
  suggestOwner(coll, r) {
    const caseSys = ids => (ids || []).map(id => this.get("cases", id)).filter(Boolean).map(tc => this.caseSystemId(tc));
    const owners = (c, ids) => (ids || []).map(id => this.ownerOf(c, this.get(c, id)));
    let basis = [], why = "";
    switch (coll) {
      case "requirements": basis = (r.componentIds || []).map(id => (this.get("components", id) || {}).systemId).concat(this.casesOfRequirement(r.id).map(tc => this.caseSystemId(tc))); why = "traced components and verifying cases"; break;
      case "procedures": basis = this.casesOfProcedure(r.id).map(tc => this.caseSystemId(tc)); why = "test cases using it"; break;
      case "plans": case "testRuns": basis = caseSys(r.caseIds); why = "assigned test cases"; break;
      case "risks": basis = caseSys(r.relatedCaseIds).concat(owners("requirements", r.relatedRequirementIds)); why = "related cases and requirements"; break;
      case "defects": basis = caseSys(r.caseIds).concat(r.runId ? [this.ownerOf("runs", this.get("runs", r.runId))] : []); why = "affected cases and discovery run"; break;
      case "decisions": basis = owners("requirements", r.requirementIds).concat(this.plansOfDecision(r.id).map(p => this.ownerOf("plans", p))); why = "informing measures and supporting plans"; break;
      case "events": basis = [r.planId && this.ownerOf("plans", this.get("plans", r.planId)), r.decisionId && this.ownerOf("decisions", this.get("decisions", r.decisionId))]; why = "linked plan and decision"; break;
      case "documents": basis = String(r.relatedCodes || "").split(/[,\s]+/).filter(Boolean).map(c => { const hit = this.byCode(c.toUpperCase()); return hit ? this.ownerOf(hit.coll, hit.entity) : ""; }); why = "related codes"; break;
      case "resources": basis = this.casesOfResource(r.id).map(tc => this.caseSystemId(tc)); why = "test cases using it"; break;
    }
    const set = new Set(basis.filter(Boolean));
    return set.size === 1 ? { systemId: [...set][0], why } : null;
  },

  /* ---------- component hierarchy (parentComponentId) ---------- */
  byCodeOrder(a, b) { return String(a.code || a.id).localeCompare(String(b.code || b.id), "en", { numeric: true }); },
  /* A component whose parent is missing or lives in another system is treated as a root. */
  parentOf(comp) {
    const p = comp && comp.parentComponentId ? this.get("components", comp.parentComponentId) : null;
    return p && p.systemId === comp.systemId ? p : null;
  },
  childrenOf(compId) {
    const c = this.get("components", compId);
    return this.all("components").filter(x => x.parentComponentId === compId && c && x.systemId === c.systemId).sort(this.byCodeOrder);
  },
  ancestorIds(compId) {
    const out = [];
    for (let c = this.parentOf(this.get("components", compId)); c && !out.includes(c.id); c = this.parentOf(c)) out.unshift(c.id);
    return out;
  },
  componentDepth(compId) { return this.ancestorIds(compId).length; },
  /* Cases owned by a component or any of its subcomponents. */
  casesOfBranch(compId) { const ids = this.descendantIds(compId); return this.all("cases").filter(tc => ids.has(tc.componentId)); },
  descendantIds(compId) {
    const out = new Set([compId]);
    for (const id of out) for (const ch of this.childrenOf(id)) out.add(ch.id);
    return out;
  },
  /* Depth-first: each root, then its children recursively. */
  componentTree(systemId) {
    const out = [], visit = (c, depth) => { out.push({ comp: c, depth }); for (const ch of this.childrenOf(c.id)) visit(ch, depth + 1); };
    this.componentsOf(systemId).filter(c => !this.parentOf(c)).sort(this.byCodeOrder).forEach(c => visit(c, 0));
    return out;
  },

  /* ---------- regression scope & test runs ---------- */
  /* Every non-retired case in the system, across components, subcomponents and system level. */
  regressionScope(systemId) { return this.casesOfSystem(systemId).filter(tc => tc.status !== "Retired"); },
  regressionPlanFor(systemId) {
    const sys = this.get("systems", systemId);
    return this.all("plans").find(p => p.regressionSystemId === systemId) ||
      (sys && this.all("plans").find(p => p.phase === "Regression" && !p.regressionSystemId && String(p.name || "").includes(sys.name))) || null;
  },
  testRunTime(t) { return Date.parse(t.startedAt || t.createdAt || "") || 0; },
  testRunsSorted(filter) {
    return this.all("testRuns").filter(filter || (() => true)).sort((a, b) => this.testRunTime(b) - this.testRunTime(a) || this.byCodeOrder(b, a));
  },
  testRunIsOpen(t) { return !/^(complete|completed|closed|aborted|cancelled)$/i.test(t.status || ""); },
  /* The case's result inside one test run: its latest run carrying that testRunId. */
  testRunResult(testRunId, caseId) {
    return this.runsOf(caseId).find(r => r.testRunId === testRunId) || null;
  },
  /* The earlier test run to compare against: the latest earlier run of the same plan,
     else of the same component scope, else of the same system. */
  previousTestRun(t) {
    const mine = this.testRunTime(t);
    const earlier = key => this.testRunsSorted(x => x.id !== t.id && key(x) && this.testRunTime(x) < mine)[0] || null;
    return (t.planId && earlier(x => x.planId === t.planId)) ||
      (t.componentId && earlier(x => x.componentId === t.componentId)) ||
      (t.systemId && earlier(x => x.systemId === t.systemId)) || null;
  },
  criteriaOf(parentId, kind) {
    return this.all("criteria").filter(c => c.parentId === parentId && (!kind || c.kind === kind));
  },
  casesOfProcedure(procedureId) { return this.all("cases").filter(tc => tc.procedureId === procedureId); },
  casesOfRequirement(reqId) { return this.all("cases").filter(tc => (tc.requirementIds || []).includes(reqId)); },
  runsOf(caseId) {
    return this.all("runs").filter(r => r.caseId === caseId)
      .sort((a, b) => this.compareRuns(a, b));
  },
  compareRuns(a, b) {
    return (b.date || '').localeCompare(a.date || '') ||
      (b.recordedAt || '').localeCompare(a.recordedAt || '') ||
      String(b.id).localeCompare(String(a.id), 'en', {numeric:true});
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
    const cases = this.casesOf(compId).filter(tc => tc.status !== "Retired");
    const runs = cases.map(tc => this.latestRun(tc.id));
    const anyFail = runs.some(r => r && r.result === "Fail");
    if (anyFail || openBad) return "Failing";
    // Health, not verification: waived and removal-nominated cases are settled outcomes.
    if (cases.length && runs.every(r => r && ["Pass", "Waived", "Review for Removal"].includes(r.result))) return "Passing";
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
    // Retired cases no longer provide coverage. Waived is not a verified pass.
    const cases = this.casesOfRequirement(reqId).filter(tc => tc.status !== "Retired");
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
  exportJSON() { return JSON.stringify(this._tx ? JSON.parse(this._committed) : this.db, null, 2); },

  prepareImport(text) { return DataGuard.normalize(JSON.parse(text)); },
  importJSON(text) {
    if (!this._tx) throw new Error('Use Store.command() for import.');
    const candidate = this.prepareImport(text);
    this.checkpoint();
    this._tx.replacement = true;
    this.db = candidate.db;
    this.save();
    return candidate;
  },
  deletionImpact(coll, id) {
    const previous = this.db;
    this.db = DataGuard.clone(previous);
    const removed = this.db[coll].find(e=>e.id===id);
    this.db[coll] = this.db[coll].filter(e=>e.id!==id);
    this.cleanupRefs(coll,id,removed);
    const lines = [];
    for (const name of DataGuard.collections.filter(c=>!['audit','snapshots'].includes(c))) {
      const removed = previous[name].filter(e=>!this.db[name].some(n=>n.id===e.id));
      const changed = this.db[name].filter(e=>JSON.stringify(e)!==JSON.stringify(previous[name].find(n=>n.id===e.id)));
      if (removed.length || changed.length) lines.push(name + ': ' + removed.length + ' deleted, ' + changed.length + ' updated');
    }
    this.db = previous;
    return lines.join('; ');
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
    scan("testRuns", "Test Run Session", ["code", "name", "notes", "operator"], e => `#/testruns/${e.id}`);
    return hits.slice(0, 40);
  }
};
