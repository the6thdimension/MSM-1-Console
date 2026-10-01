/* Optional developer smoke suite. Runtime users do not need Node or Playwright. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
const entry=pathToFileURL(path.join(root,'index.html')).href;
(async()=>{
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const context=await browser.newContext({offline:true,acceptDownloads:true,viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[],remote=[];
  page.on('pageerror',e=>errors.push(e.message));
  context.on('request',r=>{if(/^https?:/.test(r.url()))remote.push(r.url());});
  try {
    await page.goto(entry);await page.waitForFunction(()=>Store.db?.snapshots.length>0 && !Store._tx);
    assert.equal(await page.evaluate(()=>!!navigator.locks),true);
    await page.locator('[data-nav="systems"]').click();
    await page.locator('[data-act="add-system"]').click();await page.locator('#modal-form input[name="name"]').fill('Synthetic browser system');
    await page.locator('#modal-form textarea[name="description"]').fill('<img src=x onerror=alert(1)>');
    await page.locator('#modal-form [type="submit"]').click();
    await page.waitForFunction(()=>Store.db.systems.some(s=>s.name==='Synthetic browser system'));
    assert.equal(await page.locator('#view img').count(),0);
    await page.reload();await page.waitForFunction(()=>Store.db?.systems.some(s=>s.name==='Synthetic browser system'));
    console.log('PASS offline file launch, CRUD, escaping, reload');

    await page.evaluate(()=>App.go('#/systems/sys-1'));
    await page.locator('[data-act="edit-system"]').click();await page.locator('#modal-form input[name="name"]').fill('Unsaved quota draft');
    await page.evaluate(()=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='msm1-te-db-v1')throw new DOMException('Synthetic quota','QuotaExceededError');return window.originalSet.call(this,k,v);};});
    await page.locator('#modal-form [type="submit"]').click();await page.locator('.toast.err').filter({hasText:'Not saved'}).last().waitFor();
    assert.equal(await page.locator('#modal-form input[name="name"]').inputValue(),'Unsaved quota draft');
    assert.notEqual(await page.evaluate(()=>Store.get('systems','sys-1').name),'Unsaved quota draft');
    await page.evaluate(()=>Storage.prototype.setItem=window.originalSet);
    await page.locator('#modal-form [type="submit"]').click();await page.waitForFunction(()=>Store.get('systems','sys-1').name==='Unsaved quota draft');
    console.log('PASS quota failure retains form, rollback and retry');

    await page.evaluate(()=>App.go('#/execute/tc-1'));
    await page.locator('#exec-date').fill('2026-12-01');await page.locator('#exec-result').selectOption('Pass');
    await page.locator('[data-act="exec-save"]').click();await page.waitForFunction(()=>Store.latestRun('tc-1')?.date==='2026-12-01');
    assert.equal(await page.evaluate(()=>Store.get('cases','tc-1').status),'Complete');
    console.log('PASS execution and consistent status');

    await page.evaluate(()=>App.go('#/systems/sys-3'));
    await page.locator('#view [data-act="full-regression"]').click();await page.locator('#confirm-yes').click();
    await page.waitForFunction(()=>location.hash.startsWith('#/testruns/'));
    const trId=await page.evaluate(()=>location.hash.split('/')[2]);
    assert.equal(await page.evaluate(id=>Store.get('testRuns',id).caseIds.length,trId),await page.evaluate(()=>Store.regressionScope('sys-3').length));
    await page.locator('a.filter-pill',{hasText:'Safety Interlock Chain'}).click();await page.waitForFunction(()=>location.hash.endsWith('?comp=cmp-12'));
    await page.locator('.pill-box.sub a.filter-pill').first().waitFor();
    const filtered=await page.evaluate(()=>location.hash);
    await page.evaluate(()=>window.scrollTo(0,400));
    await page.locator('[data-act="record-run-tr"][data-id="tc-8"]').click();
    await page.locator('#modal-form select[name="result"]').selectOption('Review for Removal');await page.locator('#modal-form [type="submit"]').click();
    await page.waitForFunction(id=>Store.testRunResult(id,'tc-8')?.result==='Review for Removal',trId);
    assert.equal(await page.evaluate(()=>location.hash),filtered,'filter survives recording');
    assert.equal(await page.evaluate(()=>document.getElementById('trc-tc-8')?.classList.contains('flash')),true,'recorded row restored into view');
    assert.equal(await page.evaluate(()=>Store.get('cases','tc-8').removalNominated),true);
    await page.locator('#trc-tc-9 a',{hasText:'Execute'}).click();await page.waitForFunction(()=>location.hash.startsWith('#/execute/tc-9?tr='));
    await page.locator('#exec-result').selectOption('Waived');await page.locator('[data-act="exec-save"]').click();
    await page.waitForFunction(f=>location.hash===f,filtered);
    assert.equal(await page.evaluate(id=>Store.testRunResult(id,'tc-9').result,trId),'Waived');
    assert.equal(await page.evaluate(()=>Store.get('cases','tc-9').status),'Complete');
    console.log('PASS full regression, filtered recording, execute round trip, new results');

    await page.evaluate(()=>App.go('#/cases'));
    assert.ok(await page.locator('.case-card.sub').count()>=2,'subcomponent cards rendered');
    assert.notEqual(await page.locator('.case-card.sub').first().evaluate(e=>getComputedStyle(e).borderLeftStyle),
      await page.locator('.case-card.top').first().evaluate(e=>getComputedStyle(e).borderLeftStyle),'subcomponent cards styled differently');
    await page.evaluate(()=>App.go('#/components/cmp-5'));
    await page.locator('.page-actions [data-act="comp-test"]').click();await page.locator('#confirm-yes').click();
    await page.waitForFunction(()=>location.hash.startsWith('#/testruns/'));
    const ct=await page.evaluate(()=>Store.get('testRuns',location.hash.split('/')[2]));
    assert.equal(ct.componentId,'cmp-5');assert.ok(ct.caseIds.includes('tc-15'),'component test includes nested subcomponent cases');
    console.log('PASS component cards and component test from component page');

    await page.evaluate(()=>App.go('#/requirements/req-3'));
    await page.locator('.page-actions [data-act="add-requirement"][data-cls="SW"]').click();
    assert.equal(await page.locator('#modal-form select[name="reqClass"]').inputValue(),'SW');
    assert.equal(await page.locator('#modal-form input[name="derivedFromIds"][value="req-3"]').isChecked(),true,'derived button presets the parent');
    await page.locator('#modal-form input[name="title"]').fill('Synthetic frame pacing');
    await page.locator('#modal-form textarea[name="text"]').fill('The render loop software shall pace frames to the display refresh.');
    await page.locator('#modal-form [type="submit"]').click();
    await page.waitForFunction(()=>Store.db.requirements.some(r=>r.title==='Synthetic frame pacing'));
    const sw=await page.evaluate(()=>Store.db.requirements.find(r=>r.title==='Synthetic frame pacing'));
    assert.equal(sw.code,'SWR-005');assert.equal(sw.reqClass,'SW');assert.deepEqual(sw.derivedFromIds,['req-3']);
    await page.evaluate(()=>App.go('#/requirements'));
    assert.equal(await page.locator('.req-section').count(),3);
    assert.equal(await page.locator('.req-section.cls-sw tbody tr:not(.req-group)').count(),await page.evaluate(()=>Store.all('requirements').filter(r=>r.reqClass==='SW').length));
    await page.evaluate(()=>App.go('#/trace'));
    assert.equal(await page.locator('.trace-grid-wrap').count(),3);
    assert.ok(await page.locator('.trace-grid-wrap.cls-sw tr.uncovered').count()>=1,'uncovered SW requirement flagged in its own grid');
    console.log('PASS requirement classes, derived requirement input, per-class trace grids');

    await page.evaluate(()=>App.go('#/defects/def-1'));
    await page.locator('#extlink-url').fill('https://example.test/browse/BUG-42');
    await page.locator('#extlink-label').fill('Synthetic bug');
    await page.locator('[data-act="add-extlink"][data-coll="defects"]').click();
    await page.waitForFunction(()=>(Store.get('defects','def-1').extLinks||[]).some(l=>l.label==='Synthetic bug'));
    assert.equal(await page.locator('#view a[href="https://example.test/browse/BUG-42"]').count(),1);
    await page.locator('[data-act="del-extlink"][data-coll="defects"]').first().click();
    await page.waitForFunction(()=>!(Store.get('defects','def-1').extLinks||[]).length);
    console.log('PASS defect external links add and remove');

    await page.evaluate(()=>App.go('#/schedule'));
    assert.ok(await page.locator('.gantt-tag.dec').count()>=1,'decision points are labeled on the chart');
    assert.ok(await page.locator('.gantt-span').count()>=1,'multi-day events drawn as spans');
    await page.locator('.gantt-zoom a',{hasText:'This quarter'}).click();
    await page.waitForFunction(()=>document.querySelector('.gantt-zoom a.active')?.textContent==='This quarter');
    assert.match(await page.locator('.gantt-window').textContent(),/outside/,'items beyond the quarter are counted, not silently dropped');
    const lane=await page.locator('.gantt-lane').first().boundingBox(),ov=await page.locator('.gantt-overlay').boundingBox();
    assert.ok(Math.abs(lane.x-ov.x)<1&&Math.abs(lane.width-ov.width)<1,'today line and gridlines share the lane coordinates');
    console.log('PASS campaign overview zoom, labels and spans');

    await page.evaluate(()=>App.go('#/requirements'));
    await page.locator('#scope-select').selectOption('sys-3');
    await page.locator('.scope-banner').waitFor();
    const scopedReqs=await page.evaluate(()=>Store.all('requirements').filter(r=>Store.ownerOf('requirements',r)==='sys-3'||!Store.ownerOf('requirements',r)).length);
    assert.equal(await page.locator('[data-count="requirements"]').textContent(),String(scopedReqs));
    await page.locator('#scope-shared').uncheck();
    assert.equal(await page.evaluate(()=>Scope.list('requirements').every(r=>Store.ownerOf('requirements',r)==='sys-3')),true);
    await page.reload();await page.waitForFunction(()=>!!Store.db&&!Store._tx);
    assert.equal(await page.locator('#scope-select').inputValue(),'sys-3','scope survives reload as a view preference');
    await page.evaluate(()=>App.go('#/ownership'));
    const unowned=()=>page.evaluate(()=>Store.OWNED.reduce((n,c)=>n+Store.all(c).filter(r=>!Store.ownerOf(c,r)).length,0));
    const before=await unowned();
    await page.locator('[data-act="own-accept"]').click();await page.locator('#confirm-yes').click();
    await page.waitForFunction(n=>Store.OWNED.reduce((m,c)=>m+Store.all(c).filter(r=>!Store.ownerOf(c,r)).length,0)<n,before);
    await page.locator('#scope-select').selectOption('');
    assert.equal(await page.locator('.scope-banner').count(),0);
    console.log('PASS scope switcher, persisted preference, ownership suggestions');

    await page.evaluate(()=>App.go('#/interchange'));
    const beforeCSV=await page.evaluate(()=>Store.db.requirements.length);
    await page.locator('#import-jira-file').setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from('Summary,Priority\nBrowser CSV,High')});
    await page.locator('#confirm-yes').waitFor();assert.equal(await page.evaluate(()=>Store.db.requirements.length),beforeCSV);
    await page.locator('#confirm-yes').click();await page.waitForFunction(n=>Store.db.requirements.length===n+1,beforeCSV);
    console.log('PASS CSV preview and atomic apply');

    const exported=await page.evaluate(()=>Store.exportJSON());
    const payload=JSON.parse(exported);payload.meta.program='Synthetic import preview';
    await page.locator('#import-file').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
    await page.locator('#confirm-yes').waitFor();assert.notEqual(await page.evaluate(()=>Store.db.meta.program),payload.meta.program);
    await page.locator('#confirm-yes').click();await page.waitForFunction(()=>Store.db.meta.program==='Synthetic import preview');
    const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#sidebar [data-act="export-data"]').click()]);
    const file=await download.path();assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).meta.program,payload.meta.program);
    console.log('PASS JSON preview, import, download');

    await page.evaluate(()=>App.go('#/systems/sys-2'));await page.locator('[data-act="del-system"]').click();
    assert.match(await page.locator('.modal-body').textContent(),/Affected records:.*runs:/);
    await page.locator('#confirm-yes').click();await page.waitForFunction(()=>!Store.get('systems','sys-2'));
    assert.equal(await page.evaluate(()=>Store.get('defects','def-1').runId),'');
    await page.locator('.toast-act').filter({hasText:'Undo'}).last().click();await page.waitForFunction(()=>!!Store.get('systems','sys-2'));
    await page.reload();await page.waitForFunction(()=>!!Store.db && !!Store.get('systems','sys-2'));
    console.log('PASS cascade preview, cleanup and undo');

    const tab=await context.newPage();await tab.goto(entry);await tab.waitForFunction(()=>!!Store.db);
    await page.evaluate(()=>Store.command('first tab',()=>Store.update('systems','sys-1',{name:'First tab wins'})));
    const stale=await tab.evaluate(async()=>{try{await Store.command('stale tab',()=>Store.update('systems','sys-1',{name:'Stale write'}));return '';}catch(e){return e.message;}});
    assert.match(stale,/Another tab/);assert.equal(await page.evaluate(()=>Store.get('systems','sys-1').name),'First tab wins');
    for(let i=0;i<5;i++) {
      await Promise.all([page.reload(),tab.reload()]);
      await Promise.all([page.waitForFunction(()=>!!Store.db&&!Store._tx),tab.waitForFunction(()=>!!Store.db&&!Store._tx)]);
      const writes=await Promise.all([page,tab].map((p,n)=>p.evaluate(async name=>{
        try {await Store.command('race',()=>Store.update('systems','sys-1',{name}));return 'saved';}catch(e){return e.message;}
      },`Race ${i} writer ${n}`)));
      assert.equal(writes.filter(x=>x==='saved').length,1);
      assert.ok(writes.some(x=>/Another tab/.test(x)));
    }
    await tab.close();await page.reload();await page.waitForFunction(()=>!!Store.db&&!Store._tx);
    console.log('PASS real browser competing tabs and five simultaneous-write races');

    for(const route of ['dashboard','schedule','systems','requirements','cases','trace','idsk','procedures','plans','runs','defects','risks','resources','documents','interchange','sitrep','decisions/dec-1/report','testruns/tr-1','components/cmp-14','ownership']) {
      await page.evaluate(r=>App.go('#/'+r),route);await page.waitForFunction(r=>location.hash==='#/'+r,route);
      assert.doesNotMatch(await page.locator('#view').textContent(),/Something went wrong rendering/);
    }
    const good=await page.evaluate(()=>localStorage.getItem('msm1-te-db-v1'));
    await page.evaluate(()=>localStorage.setItem('msm1-te-db-v1','{broken'));
    await page.reload();await page.locator('#recovery-error').waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('msm1-te-db-v1')),'{broken');
    await page.evaluate(raw=>localStorage.setItem('msm1-te-db-v1',raw),good);
    console.log('PASS route smoke and corrupt-startup recovery');
    assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
    console.log('PASS no runtime exceptions or remote requests');
  } finally {await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
