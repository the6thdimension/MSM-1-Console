/* ============================================================
   Store — localStorage-backed database with codes & relations
   ============================================================ */

const DB_KEY = "msm1-te-db-v1";
const OLD_DB_KEYS = ["msm4-te-db-v1"];

const CODE_PREFIX = {
  systems: "SYS", components: "CMP", requirements: "REQ", cases: "TC",
  procedures: "PROC", criteria: "CRI", plans: "TP", runs: "RUN",
  risks: "RSK", mitigations: "MIT", resources: "RES", decisions: "DP", events: "EVT", notes: "NOTE", defects: "DEF", documents: "DOC", testRuns: "TR",
  releases: "REL", builds: "BLD"
};

const CODE_PAD = { systems: 2, components: 2, procedures: 2, plans: 2, resources: 2, decisions: 2, events: 2, requirements: 3, cases: 3, runs: 3, risks: 3, criteria: 3, mitigations: 3, notes: 3, defects: 3, documents: 2, testRuns: 3, releases: 2, builds: 3 };

/* Which collection a criterion's parentType points into. */
const CRITERIA_PARENT = { procedure: "procedures", plan: "plans", release: "releases" };

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
  /* Called after every verified save in this tab (e.g. Backup.schedule). */
  onCommit: [],
  stage(fn) {
    const db=this.db, tx=this._tx, undo=this.undoStack.slice();
    try {
      this.db=DataGuard.clone(db);this._tx={effects:[],replacement:false};
      const result=fn();DataGuard.validate(this.db);
      return {db:this.db,result};
    } finally {this.db=db;this._tx=tx;this.undoStack=undo;}
  },
  /* opts.base: the program (JSON) when a form opened. When another tab saved since,
     this tab's change is merged field by field instead of overwriting theirs.
     opts.subject: {coll, id} the form edits; opts.resolutions: conflict choices. */
  async command(label, fn, opts = {}) {
    if (!globalThis.navigator?.locks) throw new Error('This browser cannot coordinate safe writes. Use a current browser with Web Locks; export remains available.');
    return navigator.locks.request(DB_KEY, async () => {
      // Inside the lock no other tab can write, so catching up here means every change
      // lands on top of the latest saved program rather than being refused as stale.
      if (!this._tx) {
        if (WriteFence.settle) await WriteFence.settle(DB_KEY);
        this.syncFromStorage();
      }
      return this.transaction(label, fn, opts);
    });
  },
  /* Bring this tab up to date with what another tab saved. The update is applied in
     place (records matched by id) so objects held by an open form stay live.
     Returns true when anything changed. */
  syncFromStorage() {
    const raw = localStorage.getItem(DB_KEY);
    if (raw === this._raw || raw === null) return false;
    const next = DataGuard.normalize(JSON.parse(raw)).db;
    DataGuard.restore(this.db, next);
    this._raw = raw;
    this._committed = JSON.stringify(this.db);
    return true;
  },
  async transaction(label, fn, opts = {}) {
    if (this._tx) return fn();
    const before = this._committed || JSON.stringify(this.db);
    if (opts.subject && opts.base && !this.get(opts.subject.coll, opts.subject.id)) {
      const was = (JSON.parse(opts.base)[opts.subject.coll] || []).find(x => x.id === opts.subject.id);
      if (was) throw new Error(`${was.code || was.name || 'This record'} was deleted in another tab, so this form cannot be saved. Copy anything you need from it, then close it.`);
    }
    const undo = this.undoStack.slice();
    const original=this.db;
    const tx = this._tx = {label, effects: [], replacement: false};
    let result;
    try {
      result = fn();
      if (result && typeof result.then === 'function') throw new Error('Commands must be synchronous inside the storage lock.');
      if (opts.base && opts.base !== before) this.mergeOver(JSON.parse(opts.base), JSON.parse(before), opts.resolutions);
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
        for (const hook of this.onCommit) { try { hook(); } catch (err) { console.error(err); } }
      }
      // An undo point taken during this command records the state it produced.
      for (const entry of this.undoStack) if (entry.after === null) entry.after = this._committed;
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
  /* Replace this tab's result (this.db, built on `theirs`) with the three-way merge of
     base → theirs and base → this tab. Throws with `conflicts` when both changed a field. */
  mergeOver(base, theirs, resolutions) {
    const { db, conflicts } = Merge.db(base, theirs, DataGuard.clone(this.db), resolutions || {});
    if (conflicts.length) throw Object.assign(new Error(`${conflicts.length} field${conflicts.length === 1 ? ' was' : 's were'} changed in another tab while you were editing.`), { conflicts });
    DataGuard.restore(this.db, DataGuard.clone(db));
  },
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

  /* An undo point keeps the program before and after this tab's change. Undo reverses
     only that change, merged over whatever other tabs saved since. */
  checkpoint() {
    this.undoStack.push({ before: JSON.stringify(this.db), after: null });
    if (this.undoStack.length > 5) this.undoStack.shift();
  },

  undo() {
    if (!this._tx) throw new Error('Use Store.command() for undo.');
    const entry = this.undoStack.pop();
    if (!entry || entry.after === null) return false;
    const { db, conflicts } = Merge.db(JSON.parse(entry.after), DataGuard.clone(this.db), JSON.parse(entry.before));
    if (conflicts.length) {
      const codes = [...new Set(conflicts.map(c => c.code))].join(', ');
      throw new Error(`Cannot undo: ${codes} changed in another tab after your change. Edit ${conflicts.length === 1 ? 'it' : 'them'} directly instead.`);
    }
    DataGuard.restore(this.db, DataGuard.clone(db));
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
      documents: [], testRuns: [], releases: [], builds: [], snapshots: [], audit: []
    };
    this.migrate();
  },

  storageBytes() {
    try { return JSON.stringify(this.db).length; } catch (e) { return 0; }
  },

  all(coll) { return this.db[coll] || []; },

  get(coll, id) { return (this.db[coll] || []).find(x => x.id === id) || null; },

  byCode(code) {
    for (const coll of ["systems", "components", "requirements", "cases", "procedures", "plans", "runs", "risks", "resources", "decisions", "events", "defects", "documents", "testRuns", "releases", "builds"]) {
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

  /* The code nextCode would assign now, without taking it. */
  peekCode(coll) {
    let n = (this.db.meta.seq[coll] || 0) + 1;
    while (this.all(coll).some(e=>e.code===CODE_PREFIX[coll]+'-'+String(n).padStart(CODE_PAD[coll]||3,'0'))) n++;
    return `${CODE_PREFIX[coll]}-${String(n).padStart(CODE_PAD[coll] || 3, "0")}`;
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
    obj.code = obj.code || (coll === "requirements" ? this.nextReqCode(obj.reqClass) : this.nextCode(coll));
    if (coll === "requirements") this.claimReqCode(obj);
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
      db.requirements.forEach(r => { if (Array.isArray(r.derivedFromIds)) r.derivedFromIds = r.derivedFromIds.filter(x => x !== id); });
    }
    if (coll === "decisions") {
      db.plans.forEach(p => { if (p.decisionId === id) p.decisionId = ""; });
      (db.releases || []).forEach(rel => { if (rel.decisionId === id) rel.decisionId = ""; });
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
    // Builds outlive a deleted release; results outlive a deleted build (they become "build not recorded").
    if (coll === "releases") {
      (db.builds || []).forEach(b => { if (b.releaseId === id) b.releaseId = ""; });
      db.criteria = db.criteria.filter(c => !(c.parentType === "release" && c.parentId === id));
    }
    if (coll === "builds") {
      db.runs.forEach(r => { if (r.buildId === id) r.buildId = ""; });
      (db.testRuns || []).forEach(t => { if (t.buildId === id) t.buildId = ""; });
      (db.defects || []).forEach(d => { for (const k of ["foundInBuildId", "fixedInBuildId", "verifiedInBuildId"]) if (d[k] === id) d[k] = ""; });
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

  /* ---------- requirement classes ----------
     Absent reqClass = System. PSPECs and SW requirements get their own code series. */
  REQ_CLASSES: [
    { key: "System", label: "System Requirements", one: "System Requirement", prefix: "REQ" },
    { key: "PSPEC", label: "PSPECs", one: "PSPEC", prefix: "PSPEC" },
    { key: "SW", label: "SW Requirements", one: "SW Requirement", prefix: "SWR" }
  ],
  reqClass(r) { return (r && r.reqClass) || "System"; },
  reqClassInfo(key) { return this.REQ_CLASSES.find(c => c.key === key) || this.REQ_CLASSES[0]; },
  /* Next free code in a class's own series; System uses the normal REQ counter. */
  /* Each class numbers its own series in meta.seq["requirements.<PREFIX>"], so adding PSPECs
     never skips System numbers and a deleted code is never handed out again. Before the System
     key exists, the legacy shared counter is its floor. Peeks only; add() records the claim. */
  reqSeqKey(prefix) { return `requirements.${prefix}`; },
  nextReqCode(cls) {
    const prefix = this.reqClassInfo(cls || "System").prefix;
    const seq = this.db.meta.seq, key = this.reqSeqKey(prefix);
    const floor = seq[key] !== undefined ? seq[key] : prefix === "REQ" ? (seq.requirements || 0) : 0;
    const used = new Set(DataGuard.collections.flatMap(c => (this.db[c] || []).map(r => r.code)));
    let n = this.all("requirements").reduce((m, r) => Math.max(m, this.reqCodeNumber(r.code, prefix)), floor) + 1;
    while (used.has(`${prefix}-${String(n).padStart(3, "0")}`)) n++;
    return `${prefix}-${String(n).padStart(3, "0")}`;
  },
  reqCodeNumber(code, prefix) { return Number((String(code || "").match(new RegExp(`^${prefix}-(\\d+)$`)) || [])[1]) || 0; },
  claimReqCode(r) {
    // Pin the System series before the shared id counter moves past it.
    const sysKey = this.reqSeqKey("REQ");
    if (this.db.meta.seq[sysKey] === undefined) this.db.meta.seq[sysKey] = Number(this.nextReqCode("System").slice(4)) - 1;
    const c = this.REQ_CLASSES.find(x => this.reqCodeNumber(r.code, x.prefix));
    if (!c) return;
    const key = this.reqSeqKey(c.prefix), n = this.reqCodeNumber(r.code, c.prefix);
    if (!(this.db.meta.seq[key] >= n)) this.db.meta.seq[key] = n;
  },
  derivedParents(r) { return (r.derivedFromIds || []).map(id => this.get("requirements", id)).filter(Boolean); },
  derivedChildren(reqId) { return this.all("requirements").filter(r => (r.derivedFromIds || []).includes(reqId)); },

  /* ---------- system ownership ----------
     The system a record belongs to, or "" for program-level / shared. Structural
     records derive it (component → its system, case → its component's system,
     run → its case, criterion → its parent); the rest carry an explicit systemId. */
  OWNED: ["requirements", "procedures", "plans", "testRuns", "risks", "defects", "decisions", "events", "documents", "resources", "releases", "builds"],
  ownerOf(coll, r) {
    if (!r) return "";
    switch (coll) {
      case "systems": return r.id;
      case "components": return r.systemId || "";
      case "cases": return this.caseSystemId(r);
      case "runs": { const tc = this.get("cases", r.caseId); return tc ? this.caseSystemId(tc) : ""; }
      case "criteria": { const pc = CRITERIA_PARENT[r.parentType] || "procedures"; return this.ownerOf(pc, this.get(pc, r.parentId)); }
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
      case "releases": basis = this.buildsOfRelease(r.id).map(b => b.systemId); why = "its builds"; break;
      case "builds": basis = [r.releaseId && this.ownerOf("releases", this.get("releases", r.releaseId))].concat(this.runsOfBuild(r.id).map(x => this.ownerOf("runs", x))); why = "its release and the runs recorded on it"; break;
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

  /* Derived component test status: Failing | In Test | Passing | Untested, with the records that
     decided it. Open Critical/Major defects count as Failing. Retired cases are ignored.
     Reasons are ordered: failing cases, blocking defects, then unsettled or unrun cases. */
  componentStatusDetail(compId) {
    const blocking = this.defectsOfComponent(compId).filter(d =>
      this.defectIsOpen(d) && (d.severity === "Critical" || d.severity === "Major"));
    const cases = this.casesOf(compId).filter(tc => tc.status !== "Retired");
    const latest = cases.map(tc => ({ tc, run: this.latestRun(tc.id) }));
    const failed = latest.filter(x => x.run && x.run.result === "Fail").map(x => x.tc);
    // Health, not verification: waived and removal-nominated cases are settled outcomes.
    const settled = x => x.run && ["Pass", "Waived", "Review for Removal"].includes(x.run.result);
    const unrun = latest.filter(x => !x.run).map(x => x.tc);
    const open = latest.filter(x => x.run && !settled(x)).map(x => x.tc);
    let status;
    if (failed.length || blocking.length) status = "Failing";
    else if (cases.length && latest.every(settled)) status = "Passing";
    else if (latest.some(x => x.run)) status = "In Test";
    else status = "Untested";
    return { status, cases: cases.length, failed, blocking, unrun, open, settled: latest.filter(settled).length };
  },
  componentStatus(compId) { return this.componentStatusDetail(compId).status; },

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

  /* ---------- case specification health ----------
     A case is fully specified when it states what it is for, what result to expect, how to
     judge pass/fail, how to run it, and what it verifies. Advisory only: nothing is blocked. */
  caseSpec(tc) {
    const checks = [
      { key: "objective", label: "Objective", ok: !!(tc.objective || "").trim() },
      { key: "expectedResults", label: "Expected results", ok: !!(tc.expectedResults || "").trim() },
      { key: "passFailCriteria", label: "Pass/fail criteria", ok: !!(tc.passFailCriteria || "").trim() },
      { key: "procedureId", label: "Procedure", ok: !!tc.procedureId },
      { key: "requirementIds", label: "Verifies a requirement", ok: (tc.requirementIds || []).length > 0 }
    ];
    return { checks, done: checks.filter(c => c.ok).length, total: checks.length, missing: checks.filter(c => !c.ok).map(c => c.label) };
  },
  /* Specification fields edited after the case's latest passing result, read from the change
     log. null when the case has no passing result or nothing relevant changed since. */
  SPEC_FIELDS: ["objective", "preconditions", "testData", "expectedResults", "passFailCriteria", "procedureId", "requirementIds"],
  caseChangedSincePass(tc) {
    const pass = this.runsOf(tc.id).find(r => r.result === "Pass" || r.result === "Waived");
    if (!pass) return null;
    const since = pass.recordedAt || `${pass.date || ""}T23:59:59.999Z`;
    const fields = new Set(), at = [];
    for (const a of this.auditOf(tc.id)) {
      if (a.action !== "updated" || !a.changes || (a.ts || "") <= since) continue;
      const hit = Object.keys(a.changes).filter(k => this.SPEC_FIELDS.includes(k));
      if (hit.length) { hit.forEach(k => fields.add(k)); at.push(a.ts); }
    }
    return fields.size ? { run: pass, fields: [...fields], last: at.sort().pop() } : null;
  },
  /* Whole days since a YYYY-MM-DD date (UTC). null for a missing date. */
  daysSince(iso) {
    if (!iso) return null;
    return Math.max(0, Math.floor((Date.parse(new Date().toISOString().slice(0, 10)) - Date.parse(iso.slice(0, 10))) / 86400000));
  },

  /* ---------- releases and builds ----------
     Each system has its own build stream and its own releases; a build belongs to at most one
     release of the same system. A run records the build it was measured on in buildId. Build
     order is by received date, then code. Rejected builds never count as "newer". */
  buildOrder(a, b) { return (a.received || "").localeCompare(b.received || "") || this.byCodeOrder(a, b); },
  buildsOf(sysId) { return this.all("builds").filter(b => b.systemId === sysId).sort((a, b) => this.buildOrder(b, a)); },
  buildsOfRelease(relId) { return this.all("builds").filter(b => b.releaseId === relId).sort((a, b) => this.buildOrder(b, a)); },
  releasesOf(sysId) { return this.all("releases").filter(r => r.systemId === sysId).sort((a, b) => (a.targetDate || "9999").localeCompare(b.targetDate || "9999") || this.byCodeOrder(a, b)); },
  runsOfBuild(buildId) { return this.all("runs").filter(r => r.buildId === buildId); },
  /* The build a system is testing now: its newest Under Test build, else its newest build that
     was not rejected. Derived from build records, so every tab and user sees the same answer. */
  currentBuild(sysId) {
    const list = this.buildsOf(sysId).filter(b => b.status !== "Rejected");
    return list.find(b => b.status === "Under Test") || list[0] || null;
  },
  /* How many non-rejected builds of the same system arrived after the build a run was measured
     on. null when the run has no recorded build. */
  buildsBehind(run) {
    const b = run && run.buildId ? this.get("builds", run.buildId) : null;
    if (!b) return null;
    return this.buildsOf(b.systemId).filter(x => x.id !== b.id && x.status !== "Rejected" && this.buildOrder(x, b) > 0).length;
  },
  /* Each case's latest result on one build. */
  buildResults(buildId) {
    const out = new Map();
    for (const r of this.runsOfBuild(buildId).sort((a, b) => this.compareRuns(a, b))) if (!out.has(r.caseId)) out.set(r.caseId, r);
    return out;
  },
  /* x is the same build as y or a later one in the same system's stream. */
  buildAtLeast(x, y) { return !!(x && y && x.systemId === y.systemId && this.buildOrder(x, y) >= 0); },
  /* The next older build of the same system that was not rejected. */
  previousBuild(b) {
    return b && b.systemId ? this.buildsOf(b.systemId).find(x => x.id !== b.id && x.status !== "Rejected" && this.buildOrder(x, b) < 0) || null : null;
  },
  /* The build a release is converging on: its newest build that was not rejected. */
  releaseCandidate(relId) { return this.buildsOfRelease(relId).find(b => b.status !== "Rejected") || null; },
  /* Per-case comparison of the latest result on build b against build a. Pass and Waived
     count as passing; anything that is neither passing nor Fail lands in `other`. */
  compareBuilds(bId, aId) {
    const rb = this.buildResults(bId), ra = this.buildResults(aId);
    const out = { regressed: [], fixed: [], stillFailing: [], stillPassing: [], notRerun: [], newOnB: [], other: [] };
    const pass = r => r && ["Pass", "Waived"].includes(r.result), fail = r => r && r.result === "Fail";
    for (const caseId of new Set([...rb.keys(), ...ra.keys()])) {
      const tc = this.get("cases", caseId);
      if (!tc) continue;
      const a = ra.get(caseId) || null, b = rb.get(caseId) || null, item = { tc, a, b };
      if (!b) out.notRerun.push(item);
      else if (!a) out.newOnB.push(item);
      else if (pass(a) && fail(b)) out.regressed.push(item);
      else if (fail(a) && pass(b)) out.fixed.push(item);
      else if (fail(a) && fail(b)) out.stillFailing.push(item);
      else if (pass(a) && pass(b)) out.stillPassing.push(item);
      else out.other.push(item);
    }
    for (const k of Object.keys(out)) out[k].sort((x, y) => this.byCodeOrder(x.tc, y.tc));
    return out;
  },
  /* Retest prompts for an open defect — proposals only; nothing changes until the user confirms.
     fixReady: the build holding the fix (or a later one) is now the system's current build, the
       defect is not yet Ready for Retest, and no passing retest has been found.
     passedOn: a linked case's latest result is a Pass measured on the fix build or later; with no
       fix build, on a build later than the one it was found in; with neither, dated after it opened. */
  defectRetest(d) {
    if (!d || !this.defectIsOpen(d)) return null;
    const fix = d.fixedInBuildId ? this.get("builds", d.fixedInBuildId) : null;
    const found = d.foundInBuildId ? this.get("builds", d.foundInBuildId) : null;
    const sys = (fix || found || {}).systemId || this.ownerOf("defects", d);
    const cur = sys ? this.currentBuild(sys) : null;
    const fixReady = fix && cur && this.buildAtLeast(cur, fix) && d.status !== "Ready for Retest" ? cur : null;
    let passedOn = null;
    for (const caseId of d.caseIds || []) {
      const r = this.latestRun(caseId);
      if (!r || r.result !== "Pass") continue;
      const b = r.buildId ? this.get("builds", r.buildId) : null;
      const later = fix ? this.buildAtLeast(b, fix)
        : found ? !!(b && b.systemId === found.systemId && this.buildOrder(b, found) > 0)
        : (r.date || "") > (d.opened || "");
      if (later) { passedOn = { tc: this.get("cases", caseId), run: r, build: b }; break; }
    }
    // Once a retest has passed, "ready to retest" is moot; only the verify prompt remains.
    return fixReady || passedOn ? { fixReady: passedOn ? null : fixReady, passedOn, fix, found } : null;
  },
  /* Everything the release readiness page needs, as records; the page does the counting.
     Scope is the system's active cases (the same scope as a full regression). */
  releaseReadiness(relId) {
    const rel = this.get("releases", relId);
    if (!rel) return null;
    const cand = this.releaseCandidate(relId);
    const scope = rel.systemId ? this.regressionScope(rel.systemId) : [];
    const onCand = cand ? this.buildResults(cand.id) : new Map();
    const rows = scope.map(tc => ({ tc, latest: this.latestRun(tc.id), here: onCand.get(tc.id) || null }));
    const scopeIds = new Set(scope.map(tc => tc.id));
    const compIds = new Set(rel.systemId ? this.componentsOf(rel.systemId).map(c => c.id) : []);
    const reqs = this.all("requirements").filter(r => (rel.systemId && r.systemId === rel.systemId) ||
      (r.componentIds || []).some(c => compIds.has(c)) || this.casesOfRequirement(r.id).some(tc => scopeIds.has(tc.id)));
    // Verified, but at least one verifying case's latest result was not measured on the candidate.
    const olderOnly = cand ? reqs.filter(r => this.reqStatus(r.id) === "verified" &&
      this.casesOfRequirement(r.id).some(tc => tc.status !== "Retired" && !onCand.has(tc.id))) : [];
    const defects = this.openDefects().filter(d => rel.systemId && this.ownerOf("defects", d) === rel.systemId);
    return { rel, cand, rows, reqs, olderOnly, defects, exit: this.criteriaOf(relId, "exit"),
      decision: rel.decisionId ? this.get("decisions", rel.decisionId) : null };
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
    scan("runs", "Test Run", ["code", "notes", "operator", "measured", "evidence"], e => `#/runs/${e.id}`);
    scan("risks", "Risk", ["code", "title", "description"], e => `#/risks/${e.id}`);
    scan("resources", "M&S Asset / Resource", ["code", "name", "description", "intendedUse"], e => `#/resources/${e.id}`);
    scan("decisions", "Decision", ["code", "title", "description"], e => `#/decisions/${e.id}`);
    scan("events", "Schedule Event", ["code", "title", "description", "location"], e => `#/events/${e.id}`);
    scan("defects", "Defect", ["code", "title", "description"], e => `#/defects/${e.id}`);
    scan("documents", "Document", ["code", "title", "description", "url", "fileName", "relatedCodes"], e => `#/documents/${e.id}`);
    scan("testRuns", "Test Run Session", ["code", "name", "notes", "operator"], e => `#/testruns/${e.id}`);
    scan("releases", "Release", ["code", "name", "description", "fixVersion"], e => `#/releases/${e.id}`);
    scan("builds", "Build", ["code", "label", "description", "cycle"], e => `#/builds/${e.id}`);
    return hits.slice(0, 40);
  }
};
