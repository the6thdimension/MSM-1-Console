/* ============================================================
   Folders — real folders on disk, chosen by the person (Chrome / Edge)
   ============================================================
   The browser hands out a folder only through its own picker, and only with the
   person's OK. The chosen folder is remembered in IndexedDB (outside the program
   data) under a role: "backup" or "evidence". After a browser restart the browser may
   ask again; that needs a click, so callers offer a Reconnect button. */
const Folders = {
  supported() { return typeof globalThis.showDirectoryPicker === "function"; },
  _mem: {},   // fallback when IndexedDB is unavailable (tests); also a cache

  _db() {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) return reject(new Error("IndexedDB unavailable"));
      const r = indexedDB.open("msm-te-folders", 1);
      r.onupgradeneeded = () => { r.result.createObjectStore("handles"); r.result.createObjectStore("state"); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  },
  async _io(store, mode, fn) {
    const db = await this._db();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode), req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req && req.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  },
  async get(role) {
    if (role in this._mem) return this._mem[role];
    try { return this._mem[role] = (await this._io("handles", "readonly", s => s.get(role))) || null; }
    catch (_) { return this._mem[role] = null; }
  },
  async set(role, handle) {
    this._mem[role] = handle;
    try { await this._io("handles", "readwrite", s => handle ? s.put(handle, role) : s.delete(role)); } catch (_) { /* memory only */ }
  },
  /* Small shared settings (last backup time, last error), visible to every tab. */
  async state(key, value) {
    if (value === undefined) {
      try { return (await this._io("state", "readonly", s => s.get(key))) ?? this._mem["state:" + key] ?? null; }
      catch (_) { return this._mem["state:" + key] ?? null; }
    }
    this._mem["state:" + key] = value;
    try { await this._io("state", "readwrite", s => s.put(value, key)); } catch (_) { /* memory only */ }
  },

  /* "granted", "prompt" (needs a click) or "denied". */
  async permission(handle) {
    if (!handle) return "denied";
    if (typeof handle.queryPermission !== "function") return "granted";
    return handle.queryPermission({ mode: "readwrite" });
  },
  /* Must run from a click. */
  async request(handle) {
    if (typeof handle.requestPermission !== "function") return "granted";
    return handle.requestPermission({ mode: "readwrite" });
  },
  /* Must run from a click. Returns the chosen folder or null if the person cancels. */
  async choose(role) {
    try {
      const handle = await showDirectoryPicker({ id: "msm-te-" + role, mode: "readwrite" });
      await this.set(role, handle);
      return handle;
    } catch (err) {
      if (err && err.name === "AbortError") return null;
      throw err;
    }
  },

  /* Write a text or binary file into dir/sub…/name, then read it back to prove it landed. */
  async write(dir, parts, name, data) {
    for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true });
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(data);
    await w.close();
    const file = await fh.getFile();
    const size = typeof data === "string" ? new Blob([data]).size : data.size ?? data.byteLength;
    if (file.size !== size) throw new Error(`${name} was not written completely (${file.size} of ${size} bytes).`);
    return file;
  },
  async dirAt(dir, parts, create = false) {
    for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
    return dir;
  },
  async names(dir) {
    const out = [];
    for await (const [name, h] of dir.entries()) if (h.kind === "file") out.push(name);
    return out;
  }
};
