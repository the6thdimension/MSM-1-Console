/* IndexedDB supplies a shared, transactional write fence across renderer caches.
   It stores only a SHA-256 fingerprint, not a second program database. */
const WriteFence = {
  async fingerprint(raw) {
    const bytes=new TextEncoder().encode(raw===null?'absent:':'json:'+raw);
    const digest=await crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  },
  async commit(key, previous, next, write, rollback) {
    if(!globalThis.indexedDB || !globalThis.crypto?.subtle)throw new Error('Safe writes require IndexedDB and Web Crypto. Export your data and use a supported browser.');
    const [expected,hash]=await Promise.all([this.fingerprint(previous),this.fingerprint(next)]);
    const db=await new Promise((resolve,reject)=>{
      const request=indexedDB.open('msm-te-write-fence',1);
      request.onupgradeneeded=()=>request.result.createObjectStore('heads');
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(new Error('Cannot open the write journal; database unchanged.'));
      request.onblocked=()=>reject(new Error('Write journal blocked by another browser window.'));
    });
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
