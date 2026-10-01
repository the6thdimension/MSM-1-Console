const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const KEY='msm1-te-db-v1';
const fixture=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/current.json'),'utf8'));
function harness(memory=new Map(),fail=()=>false) {
  const writes=[];
  let queue=Promise.resolve();
  const ctx=vm.createContext({console,URL,URLSearchParams,Date,setTimeout,clearTimeout,
    WriteFence:{commit:async(_key,_previous,_next,write)=>write()},
    document:{addEventListener(){}},window:{},
    navigator:{locks:{request:(_key,fn)=>{const pending=queue.then(fn);queue=pending.catch(()=>{});return pending;}}},
    localStorage:{getItem(k){if(fail('get',k))throw Error('read denied');return memory.get(k)??null;},setItem(k,v){if(fail('set',k))throw Error('quota exceeded');memory.set(k,v);writes.push(k);},removeItem(k){memory.delete(k);}}
  });
  for(const name of ['seed','guard','store','io','ui','views'])vm.runInContext(fs.readFileSync(path.join(root,'js',name+'.js'),'utf8'),ctx,{filename:name});
  const api=vm.runInContext('({Store,DataGuard,IO,Views,safeHttp,externalLink})',ctx);
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
  const details={systemDetail:'systems',componentDetail:'components',requirementDetail:'requirements',caseDetail:'cases',procedureDetail:'procedures',planDetail:'plans',riskDetail:'risks',defectDetail:'defects',decisionDetail:'decisions',decisionReport:'decisions',eventDetail:'events',resourceDetail:'resources',execute:'cases'};
  for(const [view,coll] of Object.entries(details))for(const e of h.Store.all(coll))assert.equal(typeof h.Views[view](e.id),'string');
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
