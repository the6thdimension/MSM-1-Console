/* IndexedDB supplies a shared, transactional write fence across renderer caches.
   It stores only a SHA-256 fingerprint, not a second program database. */
const WriteFence = {
  async fingerprint(raw) {
    const bytes=new TextEncoder().encode(raw===null?'absent:':'json:'+raw);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  },
  open() {
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open('msm-te-write-fence',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('heads');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(new Error('Cannot open the write journal; database unchanged.'));
      request.onblocked=()=>reject(new Error('Write journal blocked by another browser window.'));
    });
  },
  /* Another tab's save reaches this tab's copy of localStorage a moment after it commits.
     Before saving, wait (briefly) until this tab sees the last committed write, so the
     change is applied on top of it instead of being refused as stale. */
  async settle(key, timeout=3000) {
    if(!globalThis.indexedDB || !globalThis.crypto?.subtle)return false;
    const db=await this.open();
    let head;
    try { head=await new Promise((resolve,reject)=>{const r=db.transaction('heads').objectStore('heads').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);}); }
    finally { db.close(); }
    if(head===undefined)return true;
    const end=Date.now()+timeout;
    for(;;) {
      if(await this.fingerprint(localStorage.getItem(key))===head)return true;
      if(Date.now()>end)return false;   // the commit below still refuses rather than overwrite
      await new Promise(r=>setTimeout(r,25));
    }
  },
  async commit(key, previous, next, write, rollback) {
    if(!globalThis.indexedDB || !globalThis.crypto?.subtle)throw new Error('Safe writes require IndexedDB and Web Crypto. Export your data and use a supported browser.');
    const [expected,hash]=await Promise.all([this.fingerprint(previous),this.fingerprint(next)]);
    const db=await this.open();
    let written=false;
    try {
      await new Promise((resolve,reject)=>{
        const tx=db.transaction('heads','readwrite'),store=tx.objectStore('heads');
        let problem=null;
        tx.oncomplete=resolve;
        tx.onabort=()=>reject(problem||new Error('Write journal failed; restoring the previous database.'));
        tx.onerror=()=>{};
        const read=store.get(key);
        read.onsuccess=()=>{
          try {
            if(read.result!==undefined && read.result!==expected)throw new Error('Another tab changed the database, or the write journal needs recovery. Export your draft and reload. If this persists, export the active/recovery copies and restore in an isolated browser profile.');
            write();written=true;
            store.put(hash,key);
          }catch(err){problem=err;tx.abort();}
        };
      });
    }catch(err){
      if(written) {
        try {rollback();}catch(_){throw new Error('Write journal failed and rollback could not finish. Export the recovery copy before continuing.');}
      }
      throw err;
    }finally{db.close();}
  }
};
