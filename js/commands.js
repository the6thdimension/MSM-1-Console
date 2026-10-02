/* UI boundary: defer success/navigation until the entire command commits. */
const Commands = {
  /* opts are Store.command options; opts.onConflict receives field conflicts with
     another tab so the open form can ask which value to keep. */
  async run(label, fn, opts = {}) {
    try { await Store.command(label, fn, opts); return true; }
    catch (err) {
      if (err.conflicts && opts.onConflict) { opts.onConflict(err.conflicts); return false; }
      this.error(err); return false;
    }
  },
  error(err) {
    Toast.show(`Not saved: ${err.message}`, true, Store.failedDraft ? {
      label:'Export unsaved draft', fn:()=>IO.download('unsaved-draft.json',Store.failedDraft,'application/json')
    } : undefined);
  },
  install() {
    for (const [obj, names] of [[Toast,['show']], [Modal,['open','confirm']], [App,['render','go','refreshNavCounts']]]) {
      for (const name of names) {
        const original=obj[name];
        obj[name]=function(...args) { return Store.effect(()=>original.apply(this,args)); };
      }
    }
    const immediate = new Set(['export-data','export-recovery','export-draft','import-data','imp-jira','imp-zephyr','exp-jira-req','exp-trace','exp-zephyr','doc-download','add-doc-upload','print-page','matrix-cell','matrix-clear','toggle-closed','trace-gaps','trace-jump','backup-choose','backup-now','backup-reconnect','scope-to','scope-shared-toggle']);
    for (const [name, fn] of Object.entries(Actions)) {
      if (immediate.has(name)) continue;
      Actions[name]=(id,el)=>this.run(name,()=> {
        const coll={'del-system':'systems','del-component':'components','del-case':'cases','del-requirement':'requirements','del-plan':'plans','del-run':'runs','del-procedure':'procedures','del-resource':'resources','del-decision':'decisions','del-event':'events','del-defect':'defects','del-risk':'risks','del-doc':'documents','del-crit':'criteria','del-testrun':'testRuns','del-release':'releases','del-build':'builds'}[name];
        if(coll) {
          const original=Modal.confirm;
          Modal.confirm=(message,yes,label,safe)=>original.call(Modal,message+' Affected records: '+Store.deletionImpact(coll,id),yes,label,safe);
          try { return fn(id,el); } finally { Modal.confirm=original; }
        }
        return fn(id,el);
      });
    }
  },
  previewJSON(text) {
    try {
      const expected=Store._committed;
      const {db,changes}=Store.prepareImport(text);
      const counts=DataGuard.collections.filter(c=>!['audit','snapshots'].includes(c)).map(c=>`${c}: ${Store.all(c).length} → ${db[c].length}`).join('; ');
      Modal.confirm(`Replace the active program with “${db.meta.program}”? ${counts}. ${changes.length} normalization changes. Existing IDs, unknown fields and embedded files are retained. A recovery copy of the active database is required before saving. Keep your original export.`,()=> {
        if (Store._committed!==expected) throw new Error('The program changed after this preview. Select the import file again.');
        Store.importJSON(text);
        Toast.show('Database imported and verified'); App.render();
      },'Import');
      const box=document.createElement('details');
      const summary=document.createElement('summary'); summary.textContent='Normalization details';box.appendChild(summary);
      const pre=document.createElement('pre');pre.style.whiteSpace='pre-wrap';pre.textContent=changes.join('\n')||'No normalization required';box.appendChild(pre);
      document.querySelector('.modal-body').appendChild(box);
    } catch(err) { this.error(err); }
  },
  previewCSV(text,isJira) {
    try {
      const expected=Store._committed;
      const stage=Store.stage(()=>isJira?IO.importJiraRequirements(text):IO.importZephyrCases(text));
      const label=isJira?'Jira':'Zephyr';
      Modal.confirm(`${label} import: ${stage.result.added} added, ${stage.result.updated} updated. The complete candidate passed validation. Apply these changes?`,()=>{
        if(Store._committed!==expected)throw new Error('The program changed after this preview. Select the CSV again.');
        Store.checkpoint();Store.db=stage.db;Store.save();Toast.show(`${label} import saved and verified`);App.render();
      },'Import');
    }catch(err){this.error(err);}
  }
};
