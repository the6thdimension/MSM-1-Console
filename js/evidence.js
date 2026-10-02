/* ============================================================
   Evidence — attachments kept as real files in a folder on disk
   ============================================================
   Attaching copies the file into the chosen evidence folder, filed by document code:
     <evidence folder>/DOC-07/<file name>
   The program stores only the path inside that folder (`evidencePath`), the file's
   name, size and type, and its SHA-256 (`fileSha256`), so large files never enter
   browser storage and a moved, deleted or edited file is noticed. The console never
   deletes or overwrites a file in the evidence folder. The folder itself is not inside
   the program backups; keep it on a drive or share that is backed up. */
const Evidence = {
  status: { state: "off", folder: "" },   // off | on | paused
  checks: {},                              // document id → ok | missing | changed (this tab, last check)
  _listeners: [],
  onChange(fn) { this._listeners.push(fn); },
  _emit() { for (const fn of this._listeners) { try { fn(this.status); } catch (e) { console.error(e); } } },

  async init() {
    const handle = await Folders.get("evidence");
    if (!handle) { this.status = { state: "off", folder: "" }; this._emit(); return; }
    this.status = { state: await Folders.permission(handle) === "granted" ? "on" : "paused", folder: handle.name };
    this._emit();
  },
  async choose() {
    const handle = await Folders.choose("evidence");
    if (!handle) return false;
    this.status = { state: "on", folder: handle.name }; this.checks = {}; this._emit();
    return true;
  },
  async useFolder(handle) {
    await Folders.set("evidence", handle);
    this.status = { state: "on", folder: handle.name }; this.checks = {}; this._emit();
  },
  async forget() {
    await Folders.set("evidence", null);
    this.status = { state: "off", folder: "" }; this.checks = {}; this._emit();
  },
  /* The folder, with permission. From a click this may show the browser's prompt. */
  async folder() {
    const handle = await Folders.get("evidence");
    if (!handle) throw new Error("No evidence folder is set. Choose one on the Backups & Files page.");
    let perm = await Folders.permission(handle);
    if (perm !== "granted") perm = await Folders.request(handle);
    if (perm !== "granted") { this.status = { state: "paused", folder: handle.name }; this._emit(); throw new Error(`The browser did not allow access to “${handle.name}”.`); }
    if (this.status.state !== "on") { this.status = { state: "on", folder: handle.name }; this._emit(); }
    return handle;
  },

  async sha256(data) {
    const buf = data instanceof ArrayBuffer ? data : await new Response(data).arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  },
  /* A name Windows accepts; keeps the extension. */
  safeName(name) {
    const n = String(name || "file").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/[. ]+$/, "").trim();
    return (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(n) ? "_" + n : n) || "file";
  },
  async _find(dir, name) {
    try { return await dir.getFileHandle(name); } catch (_) { return null; }
  },

  /* Copy a file (File/Blob with a name) into <code>/ and prove it landed.
     A file already there with the same content is reused; a different file with the
     same name is never replaced — the new one gets " (2)", " (3)"… */
  async store(file, code, name = file.name) {
    const root = await this.folder();
    const sub = this.safeName(code || "unfiled");
    const dir = await Folders.dirAt(root, [sub], true);
    const bytes = await new Response(file).arrayBuffer();
    const sha = await this.sha256(bytes);
    const clean = this.safeName(name), dot = clean.lastIndexOf(".");
    const stem = dot > 0 ? clean.slice(0, dot) : clean, ext = dot > 0 ? clean.slice(dot) : "";
    for (let i = 1; ; i++) {
      const candidate = i === 1 ? clean : `${stem} (${i})${ext}`;
      const existing = await this._find(dir, candidate);
      if (existing) {
        if (await this.sha256(await existing.getFile()) === sha) return this._record(sub, candidate, bytes.byteLength, file.type, sha);
        continue;
      }
      const written = await Folders.write(dir, [], candidate, new Blob([bytes]));
      if (await this.sha256(written) !== sha) throw new Error(`${candidate} did not copy correctly; the original was not changed.`);
      return this._record(sub, candidate, bytes.byteLength, file.type, sha);
    }
  },
  _record(sub, name, size, type, sha) {
    return { evidencePath: `${sub}/${name}`, fileName: name, fileSize: size, fileType: type || "", fileSha256: sha, dataUrl: "" };
  },

  async file(doc) {
    const root = await this.folder();
    const parts = String(doc.evidencePath).split("/");
    const name = parts.pop();
    let dir;
    try { dir = await Folders.dirAt(root, parts); } catch (_) { return null; }
    const fh = await this._find(dir, name);
    return fh ? fh.getFile() : null;
  },
  /* ok | missing | changed — and remembers it for the pages. */
  async check(doc) {
    const f = await this.file(doc);
    const result = !f ? "missing" : doc.fileSha256 && await this.sha256(f) !== doc.fileSha256 ? "changed" : "ok";
    this.checks[doc.id] = result;
    return result;
  }
};
