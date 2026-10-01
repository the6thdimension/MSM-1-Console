/* Pure, offline schema checks. Unknown fields are retained, never projected away. */
const DataGuard = {
  collections: ['systems', 'components', 'requirements', 'cases', 'procedures', 'criteria', 'plans', 'runs', 'risks', 'resources', 'decisions', 'events', 'defects', 'documents', 'testRuns', 'snapshots', 'audit'],
  required: ['systems', 'components', 'requirements', 'cases', 'procedures', 'criteria', 'plans', 'runs', 'risks'],
  arrays: {
    requirements: ['componentIds'], cases: ['requirementIds', 'resourceIds', 'extLinks'],
    procedures: ['steps'], plans: ['caseIds', 'extLinks'], risks: ['relatedRequirementIds', 'relatedCaseIds', 'mitigations'],
    decisions: ['requirementIds'], events: ['notes'], defects: ['caseIds'], testRuns: ['caseIds']
  },
  // systemId on owned collections = owning system ('' = program-level / shared).
  refs: {
    components: { systemId: 'systems', parentComponentId: 'components' }, requirements: { componentIds: 'components', systemId: 'systems', derivedFromIds: 'requirements' },
    cases: { componentId: 'components', systemId: 'systems', procedureId: 'procedures', requirementIds: 'requirements', resourceIds: 'resources' },
    procedures: { systemId: 'systems' },
    plans: { caseIds: 'cases', decisionId: 'decisions', regressionSystemId: 'systems', systemId: 'systems' }, runs: { caseId: 'cases', planId: 'plans', testRunId: 'testRuns' },
    defects: { componentId: 'components', caseIds: 'cases', runId: 'runs', systemId: 'systems' },
    risks: { relatedRequirementIds: 'requirements', relatedCaseIds: 'cases', systemId: 'systems' },
    decisions: { requirementIds: 'requirements', systemId: 'systems' }, events: { planId: 'plans', decisionId: 'decisions', systemId: 'systems' },
    documents: { systemId: 'systems' }, resources: { systemId: 'systems' },
    testRuns: { planId: 'plans', systemId: 'systems', componentId: 'components', caseIds: 'cases' }
  },
  enums: {
    cases: {status: ['Draft','Ready','In Progress','Complete','Blocked','Retired']},
    runs: {result: ['Pass','Fail','Blocked','In Progress','Waived','Review for Removal']},
    plans: {status: ['Planning','Active','Complete','On Hold','Closed']},
    criteria: {parentType: ['procedure','plan'], kind: ['entry','exit'], status: ['open','met','waived']},
    defects: {severity: ['Critical','Major','Minor','Cosmetic'], status: ['Open','In Analysis','Fix In Work','Ready for Retest','Closed','Deferred']},
    risks: {status: ['Open','Mitigating','Monitoring','Closed']},
    decisions: {status: ['Pending','On Track','At Risk','Complete']},
    events: {status: ['Planned','In Progress','Complete','Slipped','Cancelled']},
    resources: {verification: ['Not Started','Planned','In Progress','Complete'], validation: ['Not Started','Planned','In Progress','Complete'], accreditation: ['Not Started','Plan Approved','Evidence In Review','Conditionally Accredited','Accredited','Not Accredited']}
  },
  clone(value) { return JSON.parse(JSON.stringify(value)); },
  // Keep modal callback references alive when rolling back an unsuccessful edit.
  restore(target, source) {
    if (!source || typeof source!=='object') return source;
    if (Array.isArray(source)) {
      const previous=Array.isArray(target)?target:[];
      const items=source.map((item,i)=>this.restore(item?.id?previous.find(x=>x?.id===item.id):previous[i],item));
      previous.length=0;for(const item of items)previous.push(item);return previous;
    }
    if (!this.object(target))target={};
    for (const key of Object.keys(target))if(!Object.hasOwn(source,key))delete target[key];
    for (const key of Object.keys(source))target[key]=this.restore(target[key],source[key]);
    return target;
  },
  object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); },
  fail(path, message) { throw new Error(`${path}: ${message}`); },
  safeTree(value, path = 'database', depth = 0) {
    if (depth > 80) this.fail(path, 'nesting is too deep');
    if (typeof value==='number'&&!Number.isFinite(value))this.fail(path,'non-finite numbers cannot be preserved in JSON');
    if (!value || typeof value !== 'object') return;
    for (const key of Object.keys(value)) {
      if (['__proto__','prototype','constructor'].includes(key)) this.fail(path, `unsupported property ${key}; original file is unchanged`);
      this.safeTree(value[key], `${path}.${key}`, depth + 1);
    }
  },
  shape(db) {
    this.safeTree(db);
    if (!this.object(db) || !this.object(db.meta)) this.fail('meta', 'expected an object');
    if (db.meta.version !== undefined && (!Number.isInteger(db.meta.version) || db.meta.version < 1 || db.meta.version > 2)) this.fail('meta.version', 'unsupported database version');
    if (db.meta.schemaVersion !== undefined && db.meta.schemaVersion !== 1) this.fail('meta.schemaVersion', 'unsupported schema version');
    if (db.meta.seq !== undefined && !this.object(db.meta.seq)) this.fail('meta.seq', 'expected an object');
    for (const coll of this.collections) {
      if (db[coll] === undefined && !this.required.includes(coll)) continue;
      if (!Array.isArray(db[coll])) this.fail(coll, 'expected an array');
      for (const [i, record] of db[coll].entries()) {
        if (!this.object(record)) this.fail(`${coll}[${i}]`, 'expected a record');
        for (const field of this.arrays[coll] || []) {
          if (record[field] !== undefined && !Array.isArray(record[field])) this.fail(`${coll}[${i}].${field}`, 'expected an array');
        }
      }
    }
  },
  normalize(input) {
    this.shape(input);
    const db = this.clone(input);
    const changes = [];
    const put = (obj, key, value, path) => {
      if (obj[key] === undefined) { obj[key] = value; changes.push(`${path}.${key}: default added`); }
    };
    put(db.meta, 'seq', {}, 'meta');
    put(db.meta, 'jiraBaseUrl', '', 'meta');
    for (const coll of this.collections) {
      put(db, coll, [], 'database');
      for (const r of db[coll]) for (const key of this.arrays[coll] || []) put(r, key, [], `${coll}.${r.id}`);
    }
    for (const r of db.requirements) {
      for (const [key, value] of Object.entries({measure:'None',threshold:'',objective:'',extKey:''})) put(r,key,value,`requirements.${r.id}`);
    }
    for (const r of db.criteria) {
      put(r, 'parentType', 'procedure', `criteria.${r.id}`);
      if (r.parentId === undefined && r.procedureId !== undefined) put(r, 'parentId', r.procedureId, `criteria.${r.id}`);
    }
    for (const r of db.cases) for (const key of ['venue','testType','extKey']) put(r,key,'',`cases.${r.id}`);
    for (const r of db.runs) for (const key of ['measured','evidence','extKey']) put(r,key,'',`runs.${r.id}`);
    for (const r of db.risks) for (const [key,value] of Object.entries({initialLikelihood:r.likelihood,initialImpact:r.impact,residualLikelihood:null,residualImpact:null})) put(r,key,value,`risks.${r.id}`);
    for (const r of db.plans) {
      put(r,'decisionId','',`plans.${r.id}`); put(r,'extKey','',`plans.${r.id}`);
      if (r.decision && !r.decisionId) {
        let dec = db.decisions.find(d => d.title === r.decision);
        if (!dec) {
          let n = 1;
          while (db.decisions.some(d => d.id === `dec-legacy-${n}` || d.code === `DP-${String(n).padStart(2,'0')}`)) n++;
          dec = {id:`dec-legacy-${n}`,code:`DP-${String(n).padStart(2,'0')}`,title:r.decision,status:'Pending',date:'',authority:'',description:'',requirementIds:[]};
          db.decisions.push(dec);
        }
        r.decisionId = dec.id;
        changes.push(`plans.${r.id}: legacy decision linked; original text retained`);
      }
    }
    for (const coll of Object.keys(CODE_PREFIX)) {
      const records = coll === 'notes' ? db.events.flatMap(e=>e.notes) : coll === 'mitigations' ? db.risks.flatMap(r=>r.mitigations) : db[coll] || [];
      const previous = db.meta.seq[coll];
      if (previous !== undefined && (!Number.isSafeInteger(previous) || previous < 0)) this.fail(`meta.seq.${coll}`, 'expected a nonnegative integer');
      const max = records.reduce((n,r)=>Math.max(n,Number((String(r.code || '').match(/-(\d+)$/) || [])[1]) || 0),Math.max(previous || 0,records.length));
      if (previous !== max) { db.meta.seq[coll] = max; changes.push(`meta.seq.${coll}: counter reconciled`); }
    }
    this.validate(db);
    return {db, changes};
  },
  validate(db) {
    this.shape(db);
    const ids = new Set(), codes = new Set();
    const identity = (r, path) => {
      if (typeof r.id !== 'string' || !/^[A-Za-z0-9_.:-]+$/.test(r.id)) this.fail(path, 'missing or unsupported ID');
      if (ids.has(r.id)) this.fail(path, `duplicate ID ${r.id}`);
      ids.add(r.id);
      if (r.code !== undefined) {
        if (typeof r.code !== 'string' || !/^[A-Za-z0-9_.:-]+$/.test(r.code) || codes.has(r.code)) this.fail(path, 'invalid or duplicate code');
        codes.add(r.code);
      }
    };
    const strings = ['code','name','title','description','text','objective','threshold','measure','method','type','priority','status','phase','date','start','end','operator','result','measured','evidence','notes','extKey','venue','testType','owner','authority','intendedUse','accDate','accScope','opened','closed','category','docType','url','fileName','fileType','dataUrl','relatedCodes','added','decision','reviewDisposition','preconditions','testData','expectedResults','passFailCriteria','createdAt','startedAt','completedAt','team','lead','reqClass'];
    const known = {
      systems:'name description team lead', components:'systemId parentComponentId name description',
      requirements:'title text type priority method measure threshold objective extKey systemId reqClass',
      procedures:'title description systemId', criteria:'parentType parentId procedureId kind text status',
      cases:'componentId systemId title objective procedureId priority status venue testType extKey reviewDisposition preconditions testData expectedResults passFailCriteria',
      plans:'name description phase status start end decisionId decision extKey regressionSystemId systemId',
      runs:'caseId planId testRunId date operator result measured evidence notes extKey recordedAt',
      testRuns:'name operator status notes planId systemId componentId createdAt startedAt completedAt',
      defects:'title description severity status componentId runId owner opened closed systemId',
      risks:'title description category status owner likelihood impact initialLikelihood initialImpact residualLikelihood residualImpact systemId',
      resources:'name type description vvaRequired intendedUse owner authority verification validation accreditation accDate accScope artifacts systemId',
      decisions:'title description status date authority systemId', events:'title description type status start end location planId decisionId systemId',
      documents:'title docType description url fileName fileSize fileType dataUrl relatedCodes added systemId'
    };
    const dates = ['date','start','end','accDate','opened','closed','added'];
    const checkDate = (value,path) => {
      if (value === '' || value === undefined || value === null) return;
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) this.fail(path,'expected a valid YYYY-MM-DD date');
    };
    for (const coll of this.collections.filter(c=>!['audit','snapshots'].includes(c))) {
      for (const r of db[coll] || []) {
        const path = `${coll}.${r.id}`;
        identity(r,path);
        const fields=new Set((known[coll]||'').split(' ').concat('code'));
        for(const key of this.arrays[coll]||[])if(!Array.isArray(r[key]))this.fail(`${path}.${key}`,'expected an array');
        // Optional flow-down links and class: validated when present, never defaulted.
        if (coll==='requirements') {
          if (r.derivedFromIds!==undefined && !Array.isArray(r.derivedFromIds)) this.fail(`${path}.derivedFromIds`,'expected an array');
          if ((r.derivedFromIds||[]).includes(r.id)) this.fail(`${path}.derivedFromIds`,'a requirement cannot derive from itself');
          if (r.reqClass!==undefined && !['System','PSPEC','SW'].includes(r.reqClass)) this.fail(`${path}.reqClass`,'unsupported requirement class');
        }
        const requiredText={systems:['name'],components:['name'],requirements:['title'],cases:['title'],procedures:['title'],criteria:['text'],plans:['name'],risks:['title','description'],resources:['name'],decisions:['title'],events:['title'],defects:['title'],documents:['title']}[coll]||[];
        for(const key of requiredText)if(typeof r[key]!=='string'||!r[key].trim())this.fail(`${path}.${key}`,'required text is missing');
        for (const key of strings) if (fields.has(key) && r[key] !== undefined && !(coll === 'events' && key === 'notes') && typeof r[key] !== 'string') this.fail(`${path}.${key}`,'expected text');
        for (const key of dates) if(fields.has(key))checkDate(r[key],`${path}.${key}`);
        if(coll==='runs' && r.recordedAt!==undefined && (typeof r.recordedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.recordedAt)||!Number.isFinite(Date.parse(r.recordedAt))))this.fail(`${path}.recordedAt`,'invalid timestamp');
        if (fields.has('start') && r.start && r.end && r.end < r.start) this.fail(path,'end precedes start');
        for (const [key,values] of Object.entries(this.enums[coll] || {})) if (!values.includes(r[key])) this.fail(`${path}.${key}`,'missing or unsupported value');
        if (fields.has('priority') && r.priority !== undefined && !['Critical','High','Medium','Low'].includes(r.priority)) this.fail(`${path}.priority`,'unsupported value');
        for (const key of ['likelihood','impact','initialLikelihood','initialImpact','residualLikelihood','residualImpact']) {
          if (coll==='risks' && r[key] !== undefined && r[key] !== null && (!Number.isInteger(r[key]) || r[key]<1 || r[key]>5)) this.fail(`${path}.${key}`,'expected 1–5');
        }
        if(coll==='risks'&&(!Number.isInteger(r.likelihood)||!Number.isInteger(r.impact)))this.fail(path,'likelihood and impact are required');
        for (const [key,target] of Object.entries(this.refs[coll] || {})) {
          const values = Array.isArray(r[key]) ? r[key] : [r[key]];
          if (Array.isArray(r[key]) && new Set(values).size !== values.length) this.fail(`${path}.${key}`,'duplicate reference');
          for (const id of values) if (id !== '' && id !== null && id !== undefined && (typeof id !== 'string' || !db[target].some(e=>e.id===id))) this.fail(`${path}.${key}`,`missing ${target} reference ${String(id)}`);
        }
        if (coll === 'components' && !r.systemId) this.fail(path,'systemId is required');
        if (coll === 'components' && r.parentComponentId) {
          // Walk the parent chain; a cycle would make every tree view loop forever.
          const seen = new Set([r.id]);
          for (let p = r.parentComponentId; p; ) {
            if (seen.has(p)) this.fail(`${path}.parentComponentId`,'component hierarchy contains a cycle');
            seen.add(p);
            p = (db.components.find(c=>c.id===p) || {}).parentComponentId;
          }
        }
        // System-level cases carry systemId with no owning component.
        if (coll === 'cases' && !r.componentId && !r.systemId) this.fail(path,'componentId or systemId is required');
        if (coll === 'cases' && r.removalNominated !== undefined && typeof r.removalNominated !== 'boolean') this.fail(`${path}.removalNominated`,'expected true or false');
        for (const key of coll==='testRuns'?['createdAt','startedAt','completedAt']:[]) {
          if (r[key] && !Number.isFinite(Date.parse(r[key]))) this.fail(`${path}.${key}`,'expected a date-time');
        }
        if (coll === 'runs' && (!r.caseId || !r.date)) this.fail(path,'caseId and date are required');
        if (coll === 'criteria' && !db[r.parentType==='plan'?'plans':'procedures'].some(p=>p.id===r.parentId)) this.fail(path,'missing criterion parent');
        for (const step of coll==='procedures'?r.steps:[]) if (typeof step !== 'string') this.fail(`${path}.steps`,'expected text steps');
        // Defect links are optional: validated when present, never defaulted onto existing records.
        if (coll==='defects' && r.extLinks!==undefined && !Array.isArray(r.extLinks)) this.fail(`${path}.extLinks`,'expected an array');
        for (const link of ['cases','plans','defects'].includes(coll)?(r.extLinks||[]):[]) if (!this.object(link) || typeof link.url !== 'string' || (link.label !== undefined && typeof link.label !== 'string')) this.fail(`${path}.extLinks`,'invalid link record');
        for (const nested of coll==='risks'?r.mitigations:coll==='events'?r.notes:[]) {
          if (!this.object(nested)) this.fail(path,'invalid nested record');
          identity(nested,path);
          if (typeof nested.text !== 'string') this.fail(path,'nested text is required');
          checkDate(nested.date,`${path}.note.date`); checkDate(nested.due,`${path}.mitigation.due`);
          if (coll==='risks' && !['Proposed','Approved','In Progress','Complete','Verified'].includes(nested.status)) this.fail(path,'invalid mitigation status');
        }
        if (coll==='resources' && r.vvaRequired !== undefined && typeof r.vvaRequired !== 'boolean') this.fail(path,'vvaRequired must be boolean');
        if (coll==='resources' && r.artifacts !== undefined && (!this.object(r.artifacts) || Object.entries(r.artifacts).some(([k,v])=>['accPlan','vvPlan','vvReport','accReport'].includes(k)&&typeof v!=='boolean'))) this.fail(path,'invalid artifact flags');
        if (coll==='documents' && r.dataUrl) {
          const m = r.dataUrl.match(/^data:[^,\s]*;base64,([A-Za-z0-9+/]*={0,2})$/);
          if (!m || m[1].length%4) this.fail(path,'invalid embedded base64 file');
          const bytes=m[1].length/4*3-(m[1].endsWith('==')?2:m[1].endsWith('=')?1:0);
          if (r.fileSize !== undefined && r.fileSize !== bytes) this.fail(path,'embedded file size does not match content');
        }
        if(coll==='documents' && r.fileSize!==undefined&&(!Number.isSafeInteger(r.fileSize)||r.fileSize<0))this.fail(`${path}.fileSize`,'invalid file size');
      }
    }
    if (typeof db.meta.program !== 'string') this.fail('meta.program','expected text');
    if (typeof db.meta.jiraBaseUrl !== 'string') this.fail('meta.jiraBaseUrl','expected text');
    for(const [key,value] of Object.entries(db.meta.seq))if(!Number.isSafeInteger(value)||value<0)this.fail(`meta.seq.${key}`,'expected a nonnegative integer');
    for (const s of db.snapshots) { checkDate(s.date,'snapshot.date'); for (const k of ['pass','fail','other','verified','reqTotal','defOpen']) if (!Number.isFinite(s[k]) || s[k]<0) this.fail('snapshots',`invalid ${k}`); }
    for (const a of db.audit) for (const k of ['ts','coll','entityId','code','action','summary']) if (typeof a[k] !== 'string') this.fail(`audit.${k}`,'expected text');
    return true;
  }
};
