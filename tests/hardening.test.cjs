const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const KEY='msm1-te-db-v1';
const fixture=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/current.json'),'utf8'));
// The app's own script order, read from index.html so the harness loads exactly what ships.
function scriptOrder(){return [...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="js\/([^"]+)\.js"><\/script>/g)].map(m=>m[1]);}
function harness(memory=new Map(),fail=()=>false) {
  const writes=[];
  let queue=Promise.resolve();
  const ctx=vm.createContext({console,URL,URLSearchParams,Date,setTimeout,clearTimeout,
    WriteFence:{commit:async(_key,_previous,_next,write)=>write()},
    document:{addEventListener(){}},window:{},
    navigator:{locks:{request:(_key,fn)=>{const pending=queue.then(fn);queue=pending.catch(()=>{});return pending;}}},
    localStorage:{getItem(k){if(fail('get',k))throw Error('read denied');return memory.get(k)??null;},setItem(k,v){if(fail('set',k))throw Error('quota exceeded');memory.set(k,v);writes.push(k);},removeItem(k){memory.delete(k);}}
  });
  for(const name of scriptOrder().filter(n=>!['fence','commands','app'].includes(n)))vm.runInContext(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),ctx,{filename:name});
  const api=vm.runInContext('({Store,DataGuard,IO,Views,Scope,safeHttp,externalLink})',ctx);
  return {...api,ctx,memory,writes,load:()=>api.Store.load()};
}
async function ready(fail=()=>false) {const h=harness(new Map([[KEY,JSON.stringify(fixture())]]),fail);h.load();return h;}
const copy=v=>JSON.parse(JSON.stringify(v));
test('current fixture normalizes idempotently without rewriting storage at load',async()=>{
  const h=await ready();assert.equal(h.writes.length,0);const one=h.Store.exportJSON();
  await h.Store.command('import',()=>h.Store.importJSON(one));assert.equal(h.Store.exportJSON(),one);
  assert.equal(JSON.stringify(h.DataGuard.normalize(h.Store.db).db),JSON.stringify(h.Store.db));
});
test('corrupted, invalid and future databases never seed or overwrite',()=>{
  for(const value of ['{','null','',JSON.stringify({...fixture(),cases:{}}),JSON.stringify({...fixture(),meta:{version:99}})]) {
    const h=harness(new Map([[KEY,value]]));assert.throws(()=>h.load());assert.equal(h.memory.get(KEY),value);assert.equal(h.writes.length,0);
  }
});
test('unavailable storage fails closed',()=>{const h=harness(new Map(),()=>true);assert.throws(()=>h.load(),/read denied/);assert.equal(h.Store.db,null);});
test('legacy key retained after first successful write',async()=>{
  const raw=JSON.stringify(fixture()),h=harness(new Map([['msm4-te-db-v1',raw]]));h.load();
  await h.Store.command('edit',()=>h.Store.update('systems','sys-1',{name:'Synthetic'}));
  assert.equal(h.memory.get('msm4-te-db-v1'),raw);assert.ok(h.memory.has(KEY));
});
test('legacy criteria and decisions migrate deterministically and preserve source text',()=>{
  const old=fixture();old.criteria=old.criteria.filter(c=>c.parentType==='procedure').map(c=>{c.procedureId=c.parentId;delete c.parentType;delete c.parentId;return c;});
  old.plans.forEach(p=>{p.decision='Synthetic legacy decision';delete p.decisionId;});old.events=[];delete old.decisions;
  const h=harness();const one=h.DataGuard.normalize(old).db,two=h.DataGuard.normalize(old).db;
  assert.deepEqual(copy(one),copy(two));assert.equal(one.plans[0].decision,'Synthetic legacy decision');assert.equal(one.decisions.length,1);
  assert.deepEqual(copy(h.DataGuard.normalize(one).db),copy(one));
});
test('unknown fields, nested extensions, history and binary attachments survive import',async()=>{
  const h=await ready(),db=fixture();db.privateExtension={zero:0,no:false,empty:'',nested:[null,{x:4}]};db.cases[0].custom={a:[1,2]};
  db.systems[0].notes={privateExtension:true};db.systems[0].steps={privateExtension:true};db.systems[0].status={privateExtension:true};
  db.documents[0].dataUrl='data:application/octet-stream;base64,AAECA/8=';db.documents[0].fileSize=5;
  db.audit=[];
  for(let i=0;i<650;i++)db.audit.push({ts:'2026-09-01 12:00',coll:'cases',entityId:'tc-1',code:'TC-001',action:'updated',summary:String(i)});
  await h.Store.command('import',()=>h.Store.importJSON(JSON.stringify(db)));
  assert.deepEqual(copy(h.Store.db.privateExtension),db.privateExtension);assert.equal(h.Store.db.audit.filter(a=>a.coll!=='database').length,650);
  assert.deepEqual(copy(h.Store.db.systems[0].notes),db.systems[0].notes);
  const digest=s=>crypto.createHash('sha256').update(Buffer.from(s.split(',')[1],'base64')).digest('hex');
  assert.equal(digest(db.documents[0].dataUrl),digest(h.Store.db.documents[0].dataUrl));
  await h.Store.command('edit',()=>h.Store.update('systems','sys-1',{name:'new'}));assert.ok(h.Store.db.audit.length>650);
});
test('bad references, duplicate identities, array types, dates and attachment corruption are rejected',async()=>{
  const h=await ready(),before=h.Store.exportJSON(),raw=h.memory.get(KEY);
  const invalid=[d=>d.cases[0].componentId='missing',d=>d.cases[1].id=d.cases[0].id,d=>d.systems[1].code=d.systems[0].code,d=>d.cases[0].resourceIds=null,d=>d.runs[0].date='2026-02-30',d=>d.runs[0].result='Bogus',d=>d.documents[0].dataUrl='data:text/html;base64,%%%%'];
  for(const mutate of invalid){const d=fixture();mutate(d);await assert.rejects(h.Store.command('bad import',()=>h.Store.importJSON(JSON.stringify(d))));assert.equal(h.Store.exportJSON(),before);assert.equal(h.memory.get(KEY),raw);}
});
test('prototype keys rejected without changing input bytes',()=>{const h=harness();const text=JSON.stringify(fixture()).replace('"meta":{','"__proto__":{"x":1},"meta":{');assert.throws(()=>h.Store.prepareImport(text),/unsupported property/);assert.equal({}.x,undefined);});
test('quota failure rolls back full command, suppresses effects, preserves draft and closure references',async()=>{
  let fail=false;const h=await ready((op,k)=>fail&&op==='set'&&k===KEY);const before=h.Store.exportJSON(),raw=h.memory.get(KEY),ref=h.Store.db.procedures[0];let effect=false;fail=true;
  await assert.rejects(h.Store.command('multi',()=>{ref.steps[0]='changed';h.Store.add('runs',{caseId:'tc-1',date:'2026-09-20',result:'Pass'});h.Store.effect(()=>effect=true);}),/quota/);
  assert.equal(h.Store.exportJSON(),before);assert.equal(h.memory.get(KEY),raw);assert.equal(effect,false);assert.equal(h.Store.db.procedures[0],ref);assert.match(h.Store.failedDraft,/changed/);
  fail=false;await h.Store.command('retry',()=>{ref.steps[0]='retry';h.Store.save();});assert.equal(h.Store.db.procedures[0].steps[0],'retry');
});
test('recovery quota failure stops before active key write',async()=>{
  const h=await ready((op,k)=>op==='set'&&k.endsWith('-recovery'));const raw=h.memory.get(KEY);
  await assert.rejects(h.Store.command('edit',()=>h.Store.update('systems','sys-1',{name:'new'})),/quota/);assert.equal(h.memory.get(KEY),raw);
});
test('read-back failure restores original active bytes',async()=>{
  const h=await ready();const raw=h.memory.get(KEY);let written=false;
  const storage=h.ctx.localStorage,originalSet=storage.setItem,originalGet=storage.getItem;
  storage.setItem=(k,v)=>{originalSet(k,v);if(k===KEY)written=true;};
  storage.getItem=k=>{if(k===KEY&&written){written=false;return 'mismatch';}return originalGet(k);};
  await assert.rejects(h.Store.command('edit',()=>h.Store.update('systems','sys-1',{name:'new'})),/verified/);
  assert.equal(h.memory.get(KEY),raw);assert.equal(h.memory.get(KEY+'-recovery'),raw);
});
test('stale tab refuses to overwrite newer data',async()=>{
  const mem=new Map([[KEY,JSON.stringify(fixture())]]),a=harness(mem),b=harness(mem);a.load();b.load();
  await a.Store.command('A',()=>a.Store.update('systems','sys-1',{name:'A'}));
  await assert.rejects(b.Store.command('B',()=>b.Store.update('systems','sys-1',{name:'B'})),/Another tab/);
  assert.equal(JSON.parse(mem.get(KEY)).systems[0].name,'A');assert.match(b.Store.failedDraft,/"name":"B"/);
});
test('writes require browser locking capability',async()=>{const h=await ready();delete h.ctx.navigator.locks;await assert.rejects(h.Store.command('edit',()=>{}),/Web Locks/);});
test('run and case status are committed in a single active-key write',async()=>{
  const h=await ready();await h.Store.command('run',()=>h.Store.add('runs',{caseId:'tc-1',date:'2026-09-20',result:'Pass'}));
  assert.equal(h.writes.filter(k=>k===KEY).length,1);assert.equal(h.Store.get('cases','tc-1').status,'Complete');
  const run=h.Store.latestRun('tc-1');await h.Store.command('edit',()=>h.Store.update('runs',run.id,{result:'Blocked'}));assert.equal(h.Store.get('cases','tc-1').status,'Blocked');
  await h.Store.command('delete',()=>h.Store.remove('runs',run.id));assert.equal(h.Store.get('cases','tc-1').status,'In Progress');
});
test('same-day run ordering is deterministic for historical and new records',async()=>{
  const h=await ready();await h.Store.command('runs',()=>{h.Store.add('runs',{caseId:'tc-1',date:'2026-09-20',result:'Fail'});h.Store.add('runs',{caseId:'tc-1',date:'2026-09-20',result:'Pass'});});
  assert.equal(h.Store.latestRun('tc-1').result,'Pass');const id=h.Store.latestRun('tc-1').id;h.Store.db.runs.reverse();assert.equal(h.Store.latestRun('tc-1').id,id);
});
test('cascade deletion cleans discovery-run references and audit covers descendants',async()=>{
  const h=await ready();const impact=h.Store.deletionImpact('systems','sys-2');assert.match(impact,/runs:/);
  await h.Store.command('delete system',()=>h.Store.remove('systems','sys-2'));assert.equal(h.Store.get('defects','def-1').runId,'');h.DataGuard.validate(h.Store.db);
  assert.ok(h.Store.db.audit.some(a=>a.coll==='runs'&&a.entityId==='run-6'&&a.action==='deleted'));
  await h.Store.command('undo',()=>h.Store.undo());assert.ok(h.Store.get('runs','run-6'));h.DataGuard.validate(h.Store.db);
});
test('direct assignment, nested mitigation, artifact and meta changes are audited',async()=>{
  const h=await ready();await h.Store.command('direct',()=>{h.Store.db.plans[0].caseIds=[];h.Store.db.risks[0].mitigations[0].text='new';h.Store.db.resources[0].artifacts.vvReport=true;h.Store.db.meta.jiraBaseUrl='https://example.test';h.Store.save();});
  for(const coll of ['plans','risks','resources','meta'])assert.ok(h.Store.db.audit.some(a=>a.coll===coll));
});
test('CSV parser rejects malformed input and preserves multiline/quoted cells',()=>{
  const {IO}=harness();assert.deepEqual(copy(IO.parseCSV('a,b\r\n"one\nline","two,""quoted"""')),[['a','b'],['one\nline','two,"quoted"']]);
  for(const s of ['a,b\n"bad,x','a,a\nx,y','a,b\nx,y,z','a,b\n"x"z,y'])assert.throws(()=>IO.parseCSV(s));
  assert.match(IO.csvCell('=SUM(A1)'),/^'/);
});
test('CSV stage is isolated and a later invalid row aborts every change',async()=>{
  const h=await ready(),before=h.Store.exportJSON();
  assert.throws(()=>h.Store.stage(()=>h.IO.importJiraRequirements('Summary,Priority\nFirst,High\nSecond,Unsupported')),/priority/);
  assert.equal(h.Store.exportJSON(),before);assert.equal(h.writes.length,0);
  const stage=h.Store.stage(()=>h.IO.importJiraRequirements('Summary,Priority\nFirst,High'));
  assert.equal(stage.result.added,1);assert.equal(h.Store.exportJSON(),before);
  await h.Store.command('CSV',()=>{h.Store.db=stage.db;h.Store.save();});assert.equal(h.Store.db.requirements.at(-1).title,'First');
});
test('CSV partial updates preserve fields absent from the input',async()=>{
  const h=await ready(),text=h.Store.db.requirements[0].text;
  await h.Store.command('CSV',()=>h.IO.importJiraRequirements('Summary\nREQ-001: Changed title'));
  assert.equal(h.Store.db.requirements[0].text,text);
});
test('ambiguous CSV matching aborts without choosing an arbitrary record',async()=>{
  const h=await ready();await h.Store.command('prepare',()=>h.Store.update('requirements','req-2',{extKey:'MSM-101'}));
  const raw=h.Store.exportJSON();assert.throws(()=>h.Store.stage(()=>h.IO.importJiraRequirements('Issue key,Summary\nMSM-101,Change')),/Ambiguous/);assert.equal(h.Store.exportJSON(),raw);
});
test('repeated replacement import does not accumulate receipt entries',async()=>{
  const h=await ready(),db=fixture();db.meta.program='Replacement';const text=JSON.stringify(db);
  await h.Store.command('import',()=>h.Store.importJSON(text));const first=h.Store.exportJSON();
  await h.Store.command('import',()=>h.Store.importJSON(text));assert.equal(h.Store.exportJSON(),first);
});
test('counter migration never renumbers existing IDs or codes',async()=>{
  const h=await ready(),db=fixture();db.systems[0].code='SYS-999';db.meta.seq.systems=0;
  await h.Store.command('import',()=>h.Store.importJSON(JSON.stringify(db)));
  await h.Store.command('add',()=>h.Store.add('systems',{name:'New',description:''}));
  assert.equal(h.Store.db.systems[0].id,'sys-1');assert.equal(h.Store.db.systems[0].code,'SYS-999');assert.equal(h.Store.db.systems.at(-1).code,'SYS-1000');
});
test('migration preserves baseline semantic rollups',async()=>{
  const h=await ready();const results=()=>({requirements:h.Store.db.requirements.map(r=>h.Store.reqStatus(r.id)),components:h.Store.db.components.map(c=>h.Store.componentStatus(c.id)),risks:h.Store.db.risks.map(r=>h.Store.riskScore(r)),decisions:h.Store.db.decisions.map(d=>copy(h.Store.decisionReadiness(d)))});
  const original=copy(results());const text=h.Store.exportJSON();await h.Store.command('blank',()=>h.Store.startBlank('Blank'));await h.Store.command('restore',()=>h.Store.importJSON(text));assert.deepEqual(copy(results()),original);
});
test('URL renderer disables executable and credential-bearing addresses',()=>{
  const h=harness();for(const url of ['javascript:alert(1)','data:text/html,x','https://u:p@example.test','https:\n//example.test','//example.test'])assert.equal(h.safeHttp(url),'');
  assert.equal(h.safeHttp('https://example.test/a'),'https://example.test/a');assert.doesNotMatch(h.externalLink('javascript:alert(1)','<img>'),/<a|<img/);
});
test('blank program round trip and restoration preserve original data',async()=>{
  const h=await ready(),original=h.Store.exportJSON();await h.Store.command('blank',()=>{h.Store.checkpoint();h.Store.startBlank('Synthetic blank');});
  const blank=h.Store.exportJSON();await h.Store.command('import blank',()=>h.Store.importJSON(blank));assert.equal(h.Store.exportJSON(),blank);
  await h.Store.command('restore',()=>h.Store.importJSON(original));const restored=copy(h.Store.db);restored.audit.pop();assert.deepEqual(restored,JSON.parse(original));
});
test('existing lists, details, reports and execution views render',async()=>{
  const h=await ready();const pages=['dashboard','systems','requirements','cases','trace','procedures','plans','runs','risks','documents','sitrep','defects','idsk','schedule','resources','interchange'];
  for(const p of pages)assert.equal(typeof h.Views[p](new URLSearchParams()),'string');
  const details={systemDetail:'systems',componentDetail:'components',requirementDetail:'requirements',caseDetail:'cases',procedureDetail:'procedures',planDetail:'plans',riskDetail:'risks',defectDetail:'defects',decisionDetail:'decisions',decisionReport:'decisions',eventDetail:'events',resourceDetail:'resources',execute:'cases',testRun:'testRuns'};
  for(const [view,coll] of Object.entries(details))for(const e of h.Store.all(coll))assert.equal(typeof h.Views[view](e.id),'string');
});
/* Synthetic database shaped like the independent regression-enabled copy: the field
   names come from its schema skeleton (names/types only); every value here is invented. */
function forkShaped(){
  const d=fixture();
  Object.assign(d.meta,{version:2,syncRevision:7,syncWriter:'synthetic-writer',syncSavedAt:'2026-09-30T12:00:00.000Z',rwsAudit:{entries:[{x:1}]},hierarchicalTcImport:{lastFile:'synthetic.csv',rows:3}});
  d.components.push({id:'cmp-sub-a',code:'CMP-90',systemId:'sys-2',parentComponentId:'cmp-5',name:'Synthetic sub',description:''},
                    {id:'cmp-sub-b',code:'CMP-91',systemId:'sys-2',parentComponentId:'cmp-sub-a',name:'Synthetic sub-sub',description:''});
  d.requirements[0]=Object.assign(d.requirements[0],{sourceType:'jira',sourceRef:'SYN-1',sourceIssueKeys:['SYN-1'],sourceMappings:[{a:1}],sourceLinks:{k:'v'}});
  for(const tc of d.cases)tc.systemId=d.components.find(c=>c.id===tc.componentId).systemId;
  Object.assign(d.cases[0],{sourceRelationships:{r:1},sourceRequirementKeys:['SYN-1'],traceEvidence:[{e:1}],allocationBasis:'synthetic',preconditions:'p',testData:'t',expectedResults:'e',passFailCriteria:'c',defectsNotes:'n',baselineRequired:true,legacyTitle:'old',removalNominated:true,coveredByReadyCaseIds:['tc-2'],reviewDisposition:'Review nominated based on latest execution result',reviewOriginalComponentId:'cmp-9',reviewMoveReason:'synthetic move',sourceFile:'synthetic.xlsx'});
  d.cases.push({id:'tc-syslevel',code:'TC-900',systemId:'sys-3',componentId:'',title:'Synthetic system-level case',objective:'',requirementIds:[],procedureId:null,priority:'High',status:'Ready',venue:'',testType:'',extKey:'',extLinks:[],resourceIds:[]});
  d.testRuns=[{id:'tr-fork',code:'TR-900',name:'Synthetic regression',operator:'synthetic',startedAt:'2026-09-01T10:00:00.000Z',notes:'',componentId:'',systemId:'sys-3',status:'In Progress',createdAt:'2026-09-01T10:00:00.000Z',completedAt:'',caseIds:['tc-1','tc-syslevel'],planId:'plan-2'}];
  d.runs.push({id:'run-fork',code:'RUN-900',caseId:'tc-syslevel',testRunId:'tr-fork',planId:'plan-2',date:'2026-09-01',operator:'synthetic',result:'Waived',measured:'',evidence:'',notes:'',extKey:''});
  return d;
}
test('regression-fork shaped database imports with every private field and record preserved',async()=>{
  const h=await ready(),input=forkShaped();
  await h.Store.command('import fork',()=>h.Store.importJSON(JSON.stringify(input)));
  const db=copy(h.Store.db);
  // seq counters are reconciled upward to the highest existing code (documented); everything else is untouched.
  for(const k of Object.keys(input.meta).filter(k=>k!=='seq'))assert.deepEqual(db.meta[k],input.meta[k],`meta.${k}`);
  assert.equal(db.meta.seq.testRuns,900);
  // Every incoming field survives unchanged (documented absent-only defaults may be added alongside).
  for(const coll of ['components','requirements','cases','runs','testRuns'])for(const rec of input[coll]){
    const out=db[coll].find(x=>x.id===rec.id);assert.ok(out,`${coll}.${rec.id} kept`);
    for(const [k,v] of Object.entries(rec))assert.deepEqual(out[k],v,`${coll}.${rec.id}.${k}`);
  }
  assert.equal(h.Store.testRunResult('tr-fork','tc-syslevel').result,'Waived');
  assert.ok(h.Store.casesOfSystem('sys-3').some(tc=>tc.id==='tc-syslevel'));
  assert.deepEqual(copy([...h.Store.descendantIds('cmp-5')]),['cmp-5','cmp-sub-a','cmp-sub-b']);
  for(const html of [h.Views.testRun('tr-fork'),h.Views.testRun('tr-fork',new URLSearchParams('comp=sys:sys-3')),h.Views.caseDetail('tc-1'),h.Views.caseDetail('tc-syslevel'),h.Views.systemDetail('sys-3'),h.Views.componentDetail('cmp-sub-b')])assert.equal(typeof html,'string');
  assert.match(h.Views.testRun('tr-fork'),/System-level/);assert.match(h.Views.caseDetail('tc-1'),/Review \/ Removal Recommendation/);
  const once=h.Store.exportJSON();await h.Store.command('reimport',()=>h.Store.importJSON(once));assert.equal(h.Store.exportJSON(),once);
});
test('component hierarchy rejects cycles, keeps subtrees on delete, and orders as a tree',async()=>{
  const h=await ready(),d=forkShaped();
  const cyc=copy(d);cyc.components.find(c=>c.id==='cmp-5').parentComponentId='cmp-sub-b';
  await assert.rejects(h.Store.command('cycle',()=>h.Store.importJSON(JSON.stringify(cyc))),/cycle/);
  const none=copy(d);none.cases.push({...none.cases.at(-1),id:'tc-orphan',code:'TC-901',systemId:'',componentId:''});
  await assert.rejects(h.Store.command('orphan',()=>h.Store.importJSON(JSON.stringify(none))),/componentId or systemId/);
  await h.Store.command('import',()=>h.Store.importJSON(JSON.stringify(d)));
  assert.deepEqual(copy(h.Store.componentTree('sys-2').map(e=>e.comp.id+':'+e.depth).slice(0,3)),['cmp-5:0','cmp-sub-a:1','cmp-sub-b:2']);
  await h.Store.command('delete middle',()=>h.Store.remove('components','cmp-sub-a'));
  assert.equal(h.Store.get('components','cmp-sub-b').parentComponentId,'cmp-5');h.DataGuard.validate(h.Store.db);
});
test('Waived, Review for Removal and Retired drive case state without overriding dispositions',async()=>{
  const h=await ready();
  await h.Store.command('waive',()=>h.Store.add('runs',{caseId:'tc-2',date:'2026-10-01',result:'Waived'}));
  assert.equal(h.Store.get('cases','tc-2').status,'Complete');assert.notEqual(h.Store.reqStatus('req-9'),'verified');
  await h.Store.command('nominate',()=>h.Store.add('runs',{caseId:'tc-3',date:'2026-10-01',result:'Review for Removal',notes:'obsolete maneuver'}));
  let tc=h.Store.get('cases','tc-3');assert.equal(tc.status,'Draft');assert.equal(tc.removalNominated,true);assert.match(tc.reviewDisposition,/obsolete maneuver/);
  await h.Store.command('keep',()=>h.Store.update('cases','tc-3',{removalNominated:false,reviewDisposition:'Kept'}));
  const run=h.Store.latestRun('tc-3');await h.Store.command('edit notes',()=>h.Store.update('runs',run.id,{notes:'edited'}));
  assert.equal(h.Store.get('cases','tc-3').removalNominated,false,'a resolved nomination is not re-raised');
  await h.Store.command('retire',()=>h.Store.update('cases','tc-14',{status:'Retired'}));
  await h.Store.command('run on retired',()=>h.Store.add('runs',{caseId:'tc-14',date:'2026-10-02',result:'Pass'}));
  assert.equal(h.Store.get('cases','tc-14').status,'Retired');
  assert.ok(!h.Store.regressionScope('sys-2').some(c=>c.id==='tc-14'));
});
test('test run sessions keep results as runs, freeze scope and compare with the previous session',async()=>{
  const h=await ready();
  const mk=(id,at)=>({name:id,status:'Active',planId:'',systemId:'sys-3',componentId:'',createdAt:at,startedAt:at,completedAt:'',notes:'',operator:'',caseIds:['tc-1','tc-2']});
  let a,b;await h.Store.command('runs',()=>{a=h.Store.add('testRuns',mk('A','2026-10-01T00:00:00.000Z'));b=h.Store.add('testRuns',mk('B','2026-10-02T00:00:00.000Z'));
    h.Store.add('runs',{caseId:'tc-2',testRunId:a.id,date:'2026-10-01',result:'Pass'});h.Store.add('runs',{caseId:'tc-2',testRunId:b.id,date:'2026-10-02',result:'Fail'});});
  assert.equal(h.Store.previousTestRun(h.Store.get('testRuns',b.id)).id,a.id);
  assert.match(h.Views.testRun(b.id),/Regressed/);
  await h.Store.command('del case',()=>h.Store.remove('cases','tc-1'));assert.deepEqual(copy(h.Store.get('testRuns',b.id).caseIds),['tc-2']);
  await h.Store.command('del run',()=>h.Store.remove('testRuns',a.id));
  const kept=h.Store.all('runs').find(r=>r.caseId==='tc-2'&&r.date==='2026-10-01');assert.ok(kept);assert.equal(kept.testRunId,'');h.DataGuard.validate(h.Store.db);
});
test('cases page renders component cards in tree order and component tests scope the whole branch',async()=>{
  const h=await ready(),d=forkShaped();
  d.cases.push({...d.cases.find(c=>c.id==='tc-3'),id:'tc-deep',code:'TC-950',componentId:'cmp-sub-b',title:'Synthetic deep case',removalNominated:false});
  await h.Store.command('import',()=>h.Store.importJSON(JSON.stringify(d)));
  const html=h.Views.cases(new URLSearchParams());
  const order=[...html.matchAll(/case-card (top|sub|syslevel)[^"]*" style="--depth:(\d)"/g)].map(m=>m[1]+m[2]);
  assert.ok(order.includes('sub1')&&order.includes('sub2')&&order.includes('syslevel0'),'subcomponent and system-level cards present');
  const iParent=html.indexOf('>CMP-05<'),iChild=html.indexOf('>CMP-90<'),iGrand=html.indexOf('>CMP-91<');
  assert.ok(iParent>0&&iParent<iChild&&iChild<iGrand,'parent, child, grandchild in tree order');
  assert.match(html,/Subcomponent · level 2/);
  assert.match(h.Views.cases(new URLSearchParams('view=table')),/<th[^>]*>Component<\/th>/);
  const filtered=h.Views.cases(new URLSearchParams('component=cmp-sub-a'));
  assert.doesNotMatch(filtered,/>CMP-06</);assert.match(filtered,/>CMP-91</);
  assert.deepEqual(copy(h.Store.casesOfBranch('cmp-5').map(c=>c.id).sort()),['tc-14','tc-3','tc-deep']);
  let t;await h.Store.command('component test',()=>{t=h.Store.add('testRuns',{name:'c',status:'Active',planId:'',systemId:'sys-2',componentId:'cmp-sub-a',createdAt:'2026-10-01T00:00:00.000Z',startedAt:'2026-10-01T00:00:00.000Z',completedAt:'',notes:'',operator:'',caseIds:['tc-deep']});});
  assert.match(h.Views.componentDetail('cmp-5'),/Component Test Scope/);assert.match(h.Views.componentDetail('cmp-5'),new RegExp(t.code),'parent lists subcomponent tests');
});
test('system scope filters lists by owner without changing computed status',async()=>{
  const h=await ready(),S=h.Store,Sc=h.Scope;
  // Derived ownership follows structure; explicit ownership uses systemId.
  assert.equal(S.ownerOf('cases',S.get('cases','tc-1')),'sys-3');
  assert.equal(S.ownerOf('runs',S.get('runs','run-7')),'sys-3');
  assert.equal(S.ownerOf('criteria',S.get('criteria','cri-1')),'');
  assert.equal(S.ownerOf('defects',S.get('defects','def-2')),'sys-1','defect follows its component');
  assert.equal(S.ownerOf('requirements',S.get('requirements','req-1')),'','unassigned fixture records are program-level');
  assert.deepEqual(copy(S.suggestOwner('requirements',S.get('requirements','req-1'))),{systemId:'sys-3',why:'traced components and verifying cases'});
  const statuses=()=>S.all('requirements').map(r=>S.reqStatus(r.id)).join();
  const before=statuses();
  await S.command('assign',()=>{S.update('requirements','req-1',{systemId:'sys-3'});S.update('requirements','req-2',{systemId:'sys-2'});});
  Sc.system='sys-3';Sc.shared=false;
  assert.deepEqual(copy(Sc.list('requirements').map(r=>r.id)),['req-1']);
  assert.ok(Sc.list('cases').every(tc=>S.caseSystemId(tc)==='sys-3'));
  assert.deepEqual(copy(Sc.list('systems').map(s=>s.id)),['sys-3']);
  Sc.shared=true;
  assert.ok(Sc.list('requirements').some(r=>r.id==='req-3'),'program-level items shown when shared');
  assert.ok(!Sc.list('requirements').some(r=>r.id==='req-2'),'other systems never shown');
  assert.equal(statuses(),before,'scope never changes computed status');
  for(const p of ['dashboard','systems','requirements','cases','trace','procedures','plans','runs','risks','documents','sitrep','defects','idsk','schedule','resources','interchange','ownership'])assert.equal(typeof h.Views[p](new URLSearchParams()),'string');
  assert.match(h.Views.caseDetail('tc-3'),/xsys/,'cross-system links are marked');
  Sc.system='';
  await S.command('delete system',()=>S.remove('systems','sys-2'));
  assert.equal(S.get('requirements','req-2').systemId,'','owned records become program-level, not deleted');h.DataGuard.validate(S.db);
});
test('requirement classes: own code series, flow-down, validation and one trace grid per class',async()=>{
  const h=await ready(),S=h.Store;
  assert.ok(S.all('requirements').every(r=>r.reqClass===undefined&&S.reqClass(r)==='System'),'absent class reads as System without a rewrite');
  assert.equal(S.nextReqCode('PSPEC'),'PSPEC-001');assert.equal(S.nextReqCode('SW'),'SWR-001');
  const sysCode=S.nextReqCode('System');assert.match(sysCode,/^REQ-/);
  let p,w;
  await S.command('add',()=>{
    p=S.add('requirements',{title:'Bridge latency',text:'',type:'Performance',priority:'High',method:'Test',measure:'TPM',threshold:'',objective:'',componentIds:[],reqClass:'PSPEC',derivedFromIds:['req-1'],code:S.nextReqCode('PSPEC')});
    w=S.add('requirements',{title:'Freeze handler',text:'',type:'Safety',priority:'High',method:'Test',measure:'CTP',threshold:'',objective:'',componentIds:[],reqClass:'SW',derivedFromIds:['req-1',p.id],code:S.nextReqCode('SW')});
  });
  assert.equal(p.code,'PSPEC-001');assert.equal(w.code,'SWR-001');
  assert.equal(S.nextReqCode('PSPEC'),'PSPEC-002');assert.equal(S.nextReqCode('System'),sysCode,'class series do not consume system codes');
  assert.deepEqual(copy(S.derivedChildren('req-1').map(r=>r.id).sort()),[p.id,w.id].sort());
  assert.deepEqual(copy(S.derivedParents(w).map(r=>r.id)),['req-1',p.id]);
  const bad=copy(S.db);bad.requirements.find(r=>r.id===p.id).derivedFromIds=[p.id];
  assert.throws(()=>h.DataGuard.validate(bad),/cannot derive from itself/);
  const bad2=copy(S.db);bad2.requirements.find(r=>r.id===p.id).reqClass='Hardware';
  assert.throws(()=>h.DataGuard.validate(bad2),/unsupported requirement class/);
  const bad3=copy(S.db);bad3.requirements.find(r=>r.id===p.id).derivedFromIds=['req-missing'];
  assert.throws(()=>h.DataGuard.validate(bad3));
  // register: one section per class, class filter, flow chips
  const reg=h.Views.requirements(new URLSearchParams());
  for(const c of ['system','pspec','sw'])assert.match(reg,new RegExp(`req-section cls-${c}`));
  assert.match(reg,/flow-chip up/);
  const only=h.Views.requirements(new URLSearchParams('class=SW'));
  assert.match(only,/SWR-001/);assert.doesNotMatch(only,/req-section cls-pspec/);
  // trace: one grid per class, columns limited to cases verifying that class
  await S.command('link',()=>{const tc=S.get('cases','tc-1');S.update('cases','tc-1',{requirementIds:[...(tc.requirementIds||[]),p.id]});});
  const tr=h.Views.trace(new URLSearchParams());
  assert.equal([...tr.matchAll(/trace-grid-wrap cls-/g)].length,3);
  const swGrid=tr.slice(tr.indexOf('trace-grid-wrap cls-sw'));
  assert.match(swGrid,/no verifying test cases/,'uncovered class grid has no case columns');
  const pGrid=tr.slice(tr.indexOf('trace-grid-wrap cls-pspec'),tr.indexOf('trace-grid-wrap cls-sw'));
  assert.equal([...pGrid.matchAll(/class="tc-col"/g)].length,1,'PSPEC grid shows only its verifying case');
  assert.match(pGrid,/↑ REQ-/);
  assert.match(h.Views.requirementDetail('req-1'),/Requirement Flow-Down/);
  // deleting a parent removes the flow-down link but keeps the child
  await S.command('delete',()=>S.remove('requirements',p.id));
  assert.deepEqual(copy(S.get('requirements',w.id).derivedFromIds),['req-1']);h.DataGuard.validate(S.db);
});
test('CSV interchange keeps requirement class: labels and trace columns out, PSPEC/SWR codes in',async()=>{
  const h=await ready(),S=h.Store;
  await S.command('import',()=>h.IO.importJiraRequirements('Summary,Description\n"PSPEC-077: Synthetic bridge jitter",The bridge shall bound jitter.\n"Plain synthetic requirement",x'));
  const p=S.all('requirements').find(r=>r.title==='Synthetic bridge jitter'),q=S.all('requirements').find(r=>r.title==='Plain synthetic requirement');
  assert.equal(p.reqClass,'PSPEC');assert.equal(p.code,'PSPEC-077');
  assert.equal(q.reqClass,undefined);assert.match(q.code,/^REQ-/);
  assert.equal(S.nextReqCode('PSPEC'),'PSPEC-078');
  let csv='';h.IO.download=(_n,text)=>{csv=text;};
  h.IO.exportTraceability();
  assert.match(csv.split('\n')[0],/Coverage Rollup,Requirement Class,Derived From/);
  assert.match(csv,/PSPEC-077,Synthetic bridge jitter.*,PSPEC,/);
  h.IO.exportJiraRequirements();assert.match(csv,/PSPEC-077 Performance|PSPEC-077 Functional[^\n]*PSPEC/);
});
test('defects carry optional external links without defaulting existing records',async()=>{
  const h=await ready(),S=h.Store;
  assert.ok(S.all('defects').every(d=>d.extLinks===undefined),'fixture defects have no links and none are added');
  await S.command('link',()=>S.update('defects','def-1',{extLinks:[{url:'https://example.test/browse/BUG-1',label:'Jira'}]}));
  assert.match(h.Views.defectDetail('def-1'),/External Links — Jira \/ Zephyr \/ Share/);
  assert.match(h.Views.defectDetail('def-1'),/BUG-1|Jira/);
  const bad=copy(S.db);bad.defects[0].extLinks=[{label:'no url'}];
  assert.throws(()=>h.DataGuard.validate(bad),/invalid link record/);
  const bad2=copy(S.db);bad2.defects[0].extLinks='https://x';
  assert.throws(()=>h.DataGuard.validate(bad2),/expected an array/);
});
test('campaign overview: one UTC day scale, zoom windows, ranged spans and labeled decisions',async()=>{
  const h=await ready(),S=h.Store,run=src=>vm.runInContext(src,h.ctx);
  const g=run('ganttScale("2026-07-31","2026-11-28")');
  assert.equal(g.x('2026-07-31'),0);assert.equal(g.xEnd('2026-11-28'),100);
  assert.deepEqual(copy(g.ticks),['2026-08-01','2026-09-01','2026-10-01','2026-11-01'],'ticks are UTC month starts inside the window');
  assert.ok(g.inView('2026-07-01','2026-08-02'),'a span crossing the window edge is in view');assert.ok(!g.inView('2026-12-01'));
  assert.deepEqual(copy(run('ganttWindow("90",[],"2026-10-01")')),['2026-07-03','2026-12-30']);
  assert.deepEqual(copy(run('ganttWindow("quarter",[],"2026-11-15")')),['2026-10-01','2026-12-31']);
  assert.deepEqual(copy(run('ganttWindow("quarter",[],"2027-02-28")')),['2027-01-01','2027-03-31']);
  const w=run('ganttScale(...ganttWindow("90",[],"2026-10-01"))');
  assert.equal(w.x('2026-10-01')+(w.xEnd('2026-10-01')-w.x('2026-10-01'))/2,50,'today is centered in the ±90 day window');
  await S.command('events',()=>{
    S.add('events',{title:'Synthetic range window',description:'',type:'Range Window',status:'Planned',start:'2026-10-05',end:'2026-10-09',location:'',planId:'',decisionId:'',notes:[]});
    S.add('events',{title:'Synthetic decision',description:'',type:'Decision Point',status:'Planned',start:'2026-10-20',end:'',location:'',planId:'',decisionId:'',notes:[]});
  });
  const html=h.Views.schedule(new URLSearchParams());
  assert.match(html,/class="gantt-span[^"]*"[^>]*Synthetic range window/,'multi-day event drawn as a span');
  assert.match(html,/gantt-glyph gk-decision/);assert.match(html,/gantt-tag [^"]*dec[^"]*">EVT-/,'decision points carry a visible label');
  assert.doesNotMatch(html,/calc\(128px/,'no label width duplicated in markup');
  const out=h.Views.schedule(new URLSearchParams('zoom=quarter'));
  assert.match(out,/class="active" href="#\/schedule\?zoom=quarter"/);
  for(const m of out.matchAll(/style="left:(-?[\d.]+)%(?:;width:([\d.]+)%)?"/g)){const l=+m[1],wd=+(m[2]||0);assert.ok(l>=0&&l+wd<=100.01,`position ${l}+${wd} stays inside the track`);}
});
test('component cards state the records that decided their status',async()=>{
  const h=await ready(),S=h.Store,why=(id,html)=>vm.runInContext(`componentWhy(${JSON.stringify(id)},${html})`,h.ctx);
  for(const c of S.all('components'))assert.equal(S.componentStatusDetail(c.id).status,S.componentStatus(c.id),'one rule for status and reasons');
  const failing=S.all('components').find(c=>S.componentStatusDetail(c.id).failed.length);
  if(failing)assert.match(why(failing.id,false),/^Failing — latest run failed: /);
  // A blocking defect on a component whose cases pass is named as the reason.
  const comp=S.all('components').find(c=>S.componentStatus(c.id)!=='Failing');
  await S.command('defect',()=>S.add('defects',{title:'Synthetic blocker',description:'',severity:'Critical',status:'Open',componentId:comp.id,caseIds:[],runId:'',owner:'',opened:'2026-10-01',closed:''}));
  const d=S.all('defects').find(x=>x.title==='Synthetic blocker');
  assert.equal(S.componentStatus(comp.id),'Failing');
  assert.match(why(comp.id,false),new RegExp(`open Critical defect: ${d.code}`));
  assert.match(why(comp.id,true),new RegExp(`class="why st-failing"[^]*href="#/defects/${d.id}"`),'reason links to the defect');
  assert.match(h.Views.cases(new URLSearchParams()),/class="why st-/);
  assert.match(h.Views.componentDetail(comp.id),new RegExp(d.code));
  await S.command('close',()=>S.update('defects',d.id,{status:'Closed',closed:'2026-10-01'}));
  assert.doesNotMatch(why(comp.id,false),/Synthetic|defect/,'closed defects drop out of the reason');
});
test('every page module is loaded by index.html after the views core and before the command boundary',()=>{
  const order=scriptOrder(),pages=fs.readdirSync(path.join(root,'js/pages')).filter(f=>f.endsWith('.js')).map(f=>'pages/'+f.slice(0,-3));
  assert.ok(pages.length>=10);
  for(const p of pages){const i=order.indexOf(p);assert.ok(i>order.indexOf('views')&&i<order.indexOf('commands'),`${p} loads between views and commands`);}
  assert.equal(new Set(order).size,order.length,'no script loaded twice');
  const h=harness();
  for(const a of ['add-requirement','add-event','add-extlink','bulk-status','add-doc-link','del-risk','add-defect-case'])assert.equal(vm.runInContext(`typeof Actions[${JSON.stringify(a)}]`,h.ctx),'function',`${a} is registered`);
});
test('releases and builds: per-system streams, current build, builds-old age, cleanup and old data untouched',async()=>{
  const h=await ready(),S=h.Store,run=src=>vm.runInContext(src,h.ctx);
  // Existing data: nothing is added to runs and nothing new is shown until builds exist.
  assert.ok(S.all('runs').every(r=>r.buildId===undefined),'no buildId defaulted onto existing runs');
  assert.deepEqual(copy(S.all('builds')),[]);
  assert.equal(run(`buildTag(Store.all('runs')[0])`),'','no build tag before a system has builds');
  const tc=S.all('cases').find(c=>S.latestRun(c.id)&&S.caseSystemId(c)),sys=S.caseSystemId(tc),other=S.all('systems').find(s=>s.id!==sys).id;
  let rel,b1,b2,b3,bx,otherRel;
  await S.command('builds',()=>{
    rel=S.add('releases',{name:'Synthetic R1',systemId:sys,status:'In Test',targetDate:'2026-11-01',releasedDate:'',decisionId:'',fixVersion:'',description:''});
    otherRel=S.add('releases',{name:'Other R1',systemId:other,status:'Planning',targetDate:'',releasedDate:'',decisionId:'',fixVersion:'',description:''});
    b1=S.add('builds',{label:'1.0.0',systemId:sys,releaseId:rel.id,status:'Accepted',received:'2026-08-01',url:'',cycle:'',description:''});
    b2=S.add('builds',{label:'1.0.1',systemId:sys,releaseId:rel.id,status:'Under Test',received:'2026-09-01',url:'',cycle:'',description:''});
    bx=S.add('builds',{label:'1.0.2',systemId:sys,releaseId:rel.id,status:'Rejected',received:'2026-09-10',url:'',cycle:'',description:''});
    b3=S.add('builds',{label:'1.0.3',systemId:sys,releaseId:rel.id,status:'Received',received:'2026-09-20',url:'',cycle:'',description:''});
  });
  assert.match(rel.code,/^REL-\d{2}$/);assert.match(b1.code,/^BLD-\d{3}$/);
  assert.equal(S.currentBuild(sys).id,b2.id,'Under Test wins over a newer Received build');
  assert.deepEqual(copy(S.buildsOf(sys).map(b=>b.label)),['1.0.3','1.0.2','1.0.1','1.0.0']);
  const r=S.latestRun(tc.id);
  const statuses=()=>S.all('requirements').map(q=>S.reqStatus(q.id)).join()+'|'+S.all('components').map(c=>S.componentStatus(c.id)).join();
  const before=statuses();
  await S.command('tag',()=>S.update('runs',r.id,{buildId:b1.id}));
  assert.equal(statuses(),before,'an older-build result still counts: tagging a build never changes rollups');
  assert.equal(S.buildsBehind(S.get('runs',r.id)),2,'rejected builds never count as newer');
  assert.match(run(`buildTag(Store.get('runs',${JSON.stringify(r.id)}))`),/1\.0\.0[^]*2 builds old/);
  // A session defaults to the system's current build.
  let t;await S.command('session',()=>{t=run(`startTestRun({name:'s',systemId:${JSON.stringify(sys)},caseIds:[${JSON.stringify(tc.id)}]})`);});
  assert.equal(t.buildId,b2.id);
  // Validation: same-system release, known status, existing build.
  const bad=copy(S.db);bad.builds.find(b=>b.id===b3.id).releaseId=otherRel.id;assert.throws(()=>h.DataGuard.validate(bad),/different system/);
  const bad2=copy(S.db);bad2.builds[0].status='Shipping';assert.throws(()=>h.DataGuard.validate(bad2),/builds/);
  const bad3=copy(S.db);bad3.runs[0].buildId='bld-missing';assert.throws(()=>h.DataGuard.validate(bad3),/missing builds reference/);
  // Pages render.
  for(const html of [h.Views.releases(new URLSearchParams()),h.Views.releaseDetail(rel.id),h.Views.buildDetail(b1.id),h.Views.systemDetail(sys)])assert.equal(typeof html,'string');
  assert.match(h.Views.buildDetail(b1.id),new RegExp(tc.code));
  assert.match(h.Views.cases(new URLSearchParams()),/builds old/);
  // Deleting keeps history: results lose only the build link; builds outlive their release.
  await S.command('del build',()=>S.remove('builds',b1.id));
  assert.equal(S.get('runs',r.id).buildId,'');
  await S.command('del release',()=>S.remove('releases',rel.id));
  assert.equal(S.get('builds',b2.id).releaseId,'');
  await S.command('del system',()=>S.remove('systems',sys));
  assert.equal(S.get('builds',b2.id).systemId,'','builds become program-level, not deleted');h.DataGuard.validate(S.db);
});
test('phase 2: release readiness, build comparison and defect retest proposals',async()=>{
  const h=await ready(),S=h.Store;
  const tc=S.all('cases').find(c=>S.latestRun(c.id)&&S.caseSystemId(c)),sys=S.caseSystemId(tc);
  const tc2=S.casesOfSystem(sys).find(c=>c.id!==tc.id&&c.status!=='Retired');
  const B=(label,status,received,rel)=>S.add('builds',{label,systemId:sys,releaseId:rel||'',status,received,url:'',cycle:'',description:''});
  let rel,a,b,c,x,d,crit;
  await S.command('setup',()=>{
    rel=S.add('releases',{name:'Synthetic R2',systemId:sys,status:'In Test',targetDate:'2026-11-01',releasedDate:'',decisionId:'',fixVersion:'',description:''});
    a=B('2.0.0','Accepted','2026-08-01',rel.id);b=B('2.0.1','Under Test','2026-09-01',rel.id);x=B('2.0.2','Rejected','2026-09-15',rel.id);
    const add=(caseId,buildId,result,date)=>S.add('runs',{caseId,buildId,result,date,operator:'',planId:'',measured:'',evidence:'',notes:'',extKey:''});
    add(tc.id,a.id,'Pass','2026-08-02'); if(tc2)add(tc2.id,a.id,'Fail','2026-08-02');
    add(tc.id,b.id,'Fail','2026-09-02'); if(tc2)add(tc2.id,b.id,'Pass','2026-09-02');
    d=S.add('defects',{title:'Synthetic regression',description:'',severity:'Major',status:'Fix In Work',componentId:tc.componentId||'',caseIds:[tc.id],runId:'',owner:'',opened:'2026-09-02',closed:'',systemId:sys,foundInBuildId:b.id});
    crit=S.add('criteria',{parentType:'release',parentId:rel.id,kind:'exit',text:'Synthetic exit',status:'open'});
  });
  // Rejected builds are never the candidate or the comparison baseline.
  assert.equal(S.releaseCandidate(rel.id).id,b.id);
  assert.equal(S.previousBuild(b).id,a.id);
  const cmp=S.compareBuilds(b.id,a.id);
  assert.deepEqual(copy(cmp.regressed.map(i=>i.tc.id)),[tc.id]);
  if(tc2)assert.deepEqual(copy(cmp.fixed.map(i=>i.tc.id)),[tc2.id]);
  assert.match(h.Views.buildDetail(b.id,new URLSearchParams()),/Regressed[^]*passed before, fails here/);
  // Readiness: candidate results, release exit criteria (owned through the release), open defects.
  const R=S.releaseReadiness(rel.id);
  assert.equal(R.rows.find(r=>r.tc.id===tc.id).here.result,'Fail');
  assert.ok(R.defects.some(q=>q.id===d.id));assert.equal(R.exit[0].id,crit.id);
  assert.equal(S.ownerOf('criteria',crit),sys,'release criteria belong to the release system');
  assert.match(h.Views.releaseDetail(rel.id),/Run On Candidate[^]*Exit Criteria/);
  // Retest proposals never change the defect by themselves.
  assert.equal(S.defectRetest(d),null,'no fix build and no later pass yet');
  let c2;await S.command('fix',()=>{c=B('2.0.3','Under Test','2026-09-20',rel.id);S.update('defects',d.id,{fixedInBuildId:c.id});});
  const before=JSON.stringify(S.get('defects',d.id));
  assert.equal(S.defectRetest(S.get('defects',d.id)).fixReady.id,c.id,'fix build is current: ready to retest');
  assert.equal(JSON.stringify(S.get('defects',d.id)),before,'proposal is read-only');
  await S.command('retest',()=>{c2=S.add('runs',{caseId:tc.id,buildId:c.id,result:'Pass',date:'2026-09-21',operator:'',planId:'',measured:'',evidence:'',notes:'',extKey:''});});
  const rt=S.defectRetest(S.get('defects',d.id));
  assert.equal(rt.passedOn.run.id,c2.id);assert.equal(rt.fixReady,null,'a passed retest replaces the ready-to-retest prompt');
  assert.match(h.Views.defectDetail(d.id),/Close as verified/);
  // A pass on the very build it was found in is not a retest.
  await S.command('same build',()=>S.update('defects',d.id,{fixedInBuildId:'',foundInBuildId:c.id}));
  assert.equal(S.defectRetest(S.get('defects',d.id)),null);
  // Validation and cleanup.
  const bad=copy(S.db);bad.defects.find(q=>q.id===d.id).fixedInBuildId='bld-missing';assert.throws(()=>h.DataGuard.validate(bad),/missing builds reference/);
  await S.command('del build',()=>S.remove('builds',c.id));
  assert.equal(S.get('defects',d.id).foundInBuildId,'');
  await S.command('del release',()=>S.remove('releases',rel.id));
  assert.equal(S.get('criteria',crit.id),null,'release criteria go with their release');h.DataGuard.validate(S.db);
});
test('schedule lists upcoming events first and past events in their own section, most recent first',async()=>{
  const h=await ready(),S=h.Store;
  const day=n=>new Date(Date.now()+n*864e5).toISOString().slice(0,10);
  const ev=(title,start,end,status)=>S.add('events',{title,description:'',type:'Test Event',status,start,end,location:'',planId:'',decisionId:'',notes:[]});
  await S.command('events',()=>{
    for(const e of S.all('events').slice())S.remove('events',e.id);
    ev('Synthetic far past',day(-40),'','Complete');
    ev('Synthetic recent past',day(-3),'','Planned');
    ev('Synthetic running now',day(-5),day(5),'In Progress');
    ev('Synthetic tomorrow',day(1),'','Planned');
    ev('Synthetic next month',day(30),'','Planned');
  });
  const full=h.Views.schedule(new URLSearchParams());
  // Event titles also appear in the chart's tooltips; check order within the dated list only.
  const html=full.slice(full.indexOf('class="tl-section"'));
  const at=t=>html.indexOf(t);
  assert.ok(at('>Upcoming')<at('>Past'),'upcoming section comes first');
  assert.ok(at('Synthetic running now')<at('Synthetic tomorrow')&&at('Synthetic tomorrow')<at('Synthetic next month'),'upcoming: soonest first, events still running included');
  assert.ok(at('>Past')<at('Synthetic recent past')&&at('Synthetic recent past')<at('Synthetic far past'),'past: below upcoming, most recent first');
  assert.match(html,/Synthetic recent past[^]*?past due — update status/,'a past event still Planned is flagged');
  assert.doesNotMatch(full,/sched-pin/,'the campaign overview scrolls with the page');
  await S.command('plan event',()=>{const p=S.all('plans')[0];ev('Synthetic plan event',day(2),'','Planned').planId=p.id;});
  const chart=h.Views.schedule(new URLSearchParams());
  const rowsAt=[...chart.matchAll(/class="gantt-label">([^]*?)<\/div>/g)].map(m=>m[1]);
  assert.match(rowsAt[0],/Program/,'the Program (no plan) row sits above every test plan row');
});
test('cases page: aligned result-first tables, spec and change signals, attention filters',async()=>{
  const h=await ready(),S=h.Store;
  const tc=S.all('cases').find(c=>S.latestRun(c.id)&&c.status!=='Retired'&&c.componentId);
  // Spec completeness reads the five fields; advisory, never blocking.
  const spec=S.caseSpec(tc);assert.equal(spec.total,5);assert.equal(spec.done+spec.missing.length,5);
  await S.command('fill',()=>S.update('cases',tc.id,{objective:'o',expectedResults:'e',passFailCriteria:'p',procedureId:S.all('procedures')[0].id,requirementIds:[S.all('requirements')[0].id]}));
  assert.equal(S.caseSpec(S.get('cases',tc.id)).done,5);
  // Changed since pass: only spec edits recorded after the latest passing result count.
  const pass=()=>S.add('runs',{caseId:tc.id,result:'Pass',date:'2026-01-01',operator:'',planId:'',measured:'',evidence:'',notes:'',extKey:'',recordedAt:'2999-01-01T00:00:00.000Z'});
  await S.command('pass',()=>{pass().recordedAt='2000-01-01T00:00:00.000Z';});
  await S.command('spec edit',()=>S.update('cases',tc.id,{expectedResults:'e2'}));
  const ch=S.caseChangedSincePass(S.get('cases',tc.id));
  assert.ok(ch,'a spec edit after the pass counts');assert.ok(ch.fields.includes('expectedResults'));assert.ok(!ch.fields.includes('title'));
  await S.command('pass again',()=>pass());
  assert.equal(S.caseChangedSincePass(S.get('cases',tc.id)),null,'no spec edit after the latest pass');
  await S.command('edit',()=>S.update('cases',tc.id,{title:'Renamed only'}));
  assert.equal(S.caseChangedSincePass(S.get('cases',tc.id)),null,'title edits are not spec changes');
  const html=h.Views.cases(new URLSearchParams());
  assert.match(html,/class="data case-table"/);assert.match(html,/<th class="c-result">Latest result<\/th>/);
  assert.ok(html.indexOf('c-result')<html.indexOf('c-plans col-lo'),'result column comes before low-priority columns');
  assert.match(html,/data-act="record-run-row"/,'each row can record a result');
  assert.match(h.Views.cases(new URLSearchParams('attn=spec')),/Needs attention/);
  const stale=h.Views.cases(new URLSearchParams('attn=stale'));
  assert.doesNotMatch(stale,new RegExp(`id="case-row-${tc.id}"`),'a case passed in the future is not stale');
  assert.match(h.Views.caseDetail(S.all('cases').find(c=>S.caseSpec(c).done<5&&c.status!=='Retired').id),/SPEC \d\/5 — MISSING/);
});
test('runs have their own page and the log filters and groups',async()=>{
  const h=await ready(),S=h.Store;
  const r=S.all('runs').find(x=>{const tc=S.get('cases',x.caseId);return tc&&(tc.requirementIds||[]).length;});
  const tc=S.get('cases',r.caseId);
  const page=h.Views.runDetail(r.id);
  assert.match(page,new RegExp(`href="#/cases/${tc.id}"`),'links back to its case');
  assert.match(page,/Measured vs Threshold/);assert.match(page,/run \d+ of \d+ for this case/);
  assert.match(h.Views.runDetail('run-missing'),/not found/i);
  assert.equal(vm.runInContext(`ROUTE_OF.runs(${JSON.stringify(r.id)})`,h.ctx),`#/runs/${r.id}`,'run codes link to the run page');
  const log=h.Views.runs(new URLSearchParams());
  assert.match(log,new RegExp(`href="#/runs/${r.id}"`));
  const only=h.Views.runs(new URLSearchParams(`result=${encodeURIComponent(r.result)}`));
  assert.ok([...only.matchAll(/<td>.*?badge[^>]*>([^<]+)<\/span><\/td>/g)].every(m=>m[1]===r.result),'result filter');
  assert.match(h.Views.runs(new URLSearchParams('group=session')),/class="group-row"/);
  assert.match(h.Views.runs(new URLSearchParams('build=none')),/runs-log|No runs match/);
  assert.match(h.Views.runs(new URLSearchParams(`q=${encodeURIComponent(tc.code)}`)),new RegExp(tc.code));
});
test('runtime shell has no remote assets and disallows background connections',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.doesNotMatch(html,/(?:src|href)="https?:/);assert.match(html,/connect-src 'none'/);
  assert.doesNotMatch(fs.readFileSync(path.join(root,'js/views.js'),'utf8'),/fetch\(/);
});
test('write journal rejects stale fingerprints and rolls back an aborted journal commit',async()=>{
  // Small evented IDB substitute tests the journal's failure branches. Browser
  // tests exercise real IndexedDB transactions across competing renderers.
  let head,abortCommit=false;
  const indexedDB={open(){
    const req={};
    setImmediate(()=>{
      req.result={close(){},transaction(){
        let aborted=false,pending;
        const tx={abort(){aborted=true;setImmediate(()=>tx.onabort());},objectStore(){return {
          get(){const r={};setImmediate(()=>{
            r.result=head;r.onsuccess();
            if(!aborted)setImmediate(()=>{if(abortCommit)tx.onabort();else{head=pending;tx.oncomplete();}});
          });return r;},put(value){pending=value;}
        };}};
        return tx;
      }};req.onsuccess();
    });return req;
  }};
  const ctx=vm.createContext({indexedDB,crypto:crypto.webcrypto,TextEncoder,Uint8Array,Promise,Error});
  vm.runInContext(fs.readFileSync(path.join(root,'js/fence.js'),'utf8'),ctx);
  const fence=vm.runInContext('WriteFence',ctx);let active=null;
  await fence.commit(KEY,null,'first',()=>active='first',()=>active=null);
  assert.equal(active,'first');
  await assert.rejects(fence.commit(KEY,null,'stale',()=>active='stale',()=>active=null),/Another tab/);
  assert.equal(active,'first');
  abortCommit=true;
  await assert.rejects(fence.commit(KEY,'first','second',()=>active='second',()=>active='first'),/journal failed/);
  assert.equal(active,'first');assert.equal(head,await fence.fingerprint('first'));
});
