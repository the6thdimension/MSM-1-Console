/* ============================================================
   Backup — automatic copies of the program in a folder on disk
   ============================================================
   A few seconds after any save in this tab, the whole program (the same JSON that
   Export produces and Import accepts) is written to the chosen folder:
     <program>-latest.json            replaced on every backup
     daily/<program>-YYYY-MM-DD.json  one per day, the day's last state
   The newest KEEP daily copies are kept; older daily copies made by this app are
   removed. Files the app did not name are never touched. Each file is read back
   after writing. Browser storage stays the working copy; the folder is the backup. */
const Backup = {
  KEEP: 30,
  DELAY: 4000,
  status: { state: "off", folder: "", last: null, error: "" },   // off | on | paused | error
  _timer: null,
  _listeners: [],

  slug(program) {
    return String(program || "program").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "program";
  },
  localDate(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },
  onChange(fn) { this._listeners.push(fn); },
  _emit() { for (const fn of this._listeners) { try { fn(this.status); } catch (e) { console.error(e); } } },

  /* Called once at startup: pick up a folder chosen earlier. */
  async init() {
    const handle = await Folders.get("backup");
    this.status.last = await Folders.state("backup:last");
    if (!handle) { this.status.state = "off"; this._emit(); return; }
    this.status.folder = handle.name;
    const perm = await Folders.permission(handle);
    if (perm === "granted") { this.status.state = "on"; this._emit(); this.schedule(0); }
    else { this.status.state = "paused"; this._emit(); }
  },
  /* Click handlers. */
  async choose() {
    const handle = await Folders.choose("backup");
    if (handle) await this.useFolder(handle);
    return !!handle;
  },
  async useFolder(handle) {
    await Folders.set("backup", handle);
    this.status = { state: "on", folder: handle.name, last: this.status.last, error: "" };
    this._emit();
    return this.run();
  },
  async reconnect() {
    const handle = await Folders.get("backup");
    if (!handle) return false;
    if (await Folders.request(handle) !== "granted") return false;
    this.status.state = "on"; this.status.error = ""; this._emit();
    return this.run();
  },
  async stop() {
    clearTimeout(this._timer);
    await Folders.set("backup", null);
    this.status = { state: "off", folder: "", last: this.status.last, error: "" };
    this._emit();
  },

  /* After a save: back up once the burst of saves settles. */
  schedule(delay = this.DELAY) {
    if (this.status.state !== "on") return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.run().catch(() => {}), delay);
  },

  /* Write latest + today's copy, then keep the newest KEEP daily copies. */
  async run() {
    const handle = await Folders.get("backup");
    if (!handle) return false;
    const go = async () => {
      if (await Folders.permission(handle) !== "granted") { this.status.state = "paused"; this._emit(); return false; }
      const text = localStorage.getItem(DB_KEY);
      if (text === null) return false;
      let program = "program";
      try { program = JSON.parse(text).meta.program; } catch (_) { /* name falls back */ }
      const slug = this.slug(program), today = this.localDate();
      try {
        await Folders.write(handle, [], `${slug}-latest.json`, text);
        await Folders.write(handle, ["daily"], `${slug}-${today}.json`, text);
        const daily = await Folders.dirAt(handle, ["daily"]);
        const mine = new RegExp(`^${slug.replace(/[-]/g, "\\-")}-(\\d{4}-\\d{2}-\\d{2})\\.json$`);
        const dated = (await Folders.names(daily)).filter(n => mine.test(n)).sort();
        for (const old of dated.slice(0, Math.max(0, dated.length - this.KEEP))) await daily.removeEntry(old);
        const last = { at: new Date().toISOString(), bytes: new Blob([text]).size, latest: `${slug}-latest.json`, daily: `daily/${slug}-${today}.json`, kept: Math.min(dated.length, this.KEEP) };
        await Folders.state("backup:last", last);
        this.status = { state: "on", folder: handle.name, last, error: "" };
        this._emit();
        return true;
      } catch (err) {
        this.status = { ...this.status, state: "error", error: err.message || String(err) };
        this._emit();
        return false;
      }
    };
    // One backup at a time across tabs.
    return globalThis.navigator?.locks ? navigator.locks.request("msm-te-backup", go) : go();
  }
};
