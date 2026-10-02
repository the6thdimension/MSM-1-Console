/* ============================================================
   Backups & Files — automatic folder backups, evidence folder, browser storage use.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
function agoText(iso) {
  if (!iso) return "never";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}
function sizeText(bytes) {
  if (bytes == null) return "—";
  return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

Views.storage = function () {
  const b = Backup.status, last = b.last;
  const unsupported = !Folders.supported() && b.state === "off";
  const lamp = { on: "ok", paused: "warn", error: "bad", off: "" }[b.state];
  const backupBody = unsupported
    ? `<p class="small muted" style="margin-top:0">Folder backups need Chrome or Microsoft Edge. In this browser, use <b>Export JSON</b> on the Interchange page and keep the file somewhere safe.</p>`
    : b.state === "off"
      ? `<p class="small muted" style="margin-top:0">Pick a folder once — a OneDrive folder or a network share works well. After every change, the program is copied there automatically, so your work survives clearing browser data, a broken browser profile or a new computer.</p>
         <div style="display:flex;gap:8px;flex-wrap:wrap">${actBtn("Choose backup folder…", "backup-choose", null, "", false)}</div>`
      : `<dl class="def-grid">
           <dt>Status</dt><dd><span class="state-lamp ${lamp}"></span>${{ on: "On — backs up a few seconds after every change", paused: "Paused — the browser needs your OK to use this folder again", error: "Last backup failed" }[b.state]}</dd>
           <dt>Folder</dt><dd class="mono">${esc(b.folder)}</dd>
           <dt>Last backup</dt><dd>${last ? `${agoText(last.at)} · ${esc(new Date(last.at).toLocaleString())} · ${sizeText(last.bytes)} · read back and verified` : "not yet"}</dd>
           ${last ? `<dt>Files</dt><dd class="small"><span class="mono">${esc(last.latest)}</span> (always the newest)<br><span class="mono">${esc(last.daily)}</span> (one per day, newest ${Backup.KEEP} kept)</dd>` : ""}
           ${b.error ? `<dt>Error</dt><dd class="bad small">${esc(b.error)}</dd>` : ""}
         </dl>
         <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
           ${b.state === "paused" ? actBtn("Reconnect folder", "backup-reconnect", null, "", false) : actBtn("Back up now", "backup-now", null, "", false)}
           ${actBtn("Change folder…", "backup-choose", null)}
           ${actBtn("Stop backups", "backup-stop", null)}
         </div>
         <p class="small faint" style="margin-bottom:0">To restore, use <b>Import JSON</b> and pick a file from this folder. Files the console did not name are never touched.</p>`;

  const raw = localStorage.getItem(DB_KEY) || "", rec = localStorage.getItem(DB_KEY + "-recovery") || "";
  const used = raw.length + rec.length, limit = 5000000, pct = Math.min(100, Math.round(used / limit * 100));
  const embedded = Store.all("documents").filter(d => d.dataUrl);
  const embeddedChars = embedded.reduce((n, d) => n + d.dataUrl.length, 0);

  return `
    ${pageHead([{ label: "Backups & Files" }], "Backups & Files", "",
      "Where your program lives and how it is protected. Browser storage is the working copy; a backup folder keeps copies outside the browser.")}
    <div class="grid-2">
      <div>${panel("Automatic backups", backupBody)}</div>
      <div>
        ${panel("Browser storage", `
          <p class="small muted" style="margin-top:0">The program and one recovery copy live in this browser's storage, which holds about 5 MB.</p>
          <div class="meter-row"><div class="meter"><span style="width:${pct}%" class="${pct > 80 ? "bad" : pct > 60 ? "warn" : ""}"></span></div><span class="mono small">${pct}%</span></div>
          <div class="small faint">≈ ${sizeText(used)} of about 5 MB (character count of the program plus its recovery copy).${embedded.length ? ` Embedded attachments: ${embedded.length}, ≈ ${sizeText(embeddedChars)}.` : ""}</div>`)}
      </div>
    </div>`;
};

/* Folder pickers and permission prompts must run straight from the click, so these
   actions run outside the command boundary (they never change program records). */
const backupAction = fn => async () => {
  try { await fn(); } catch (err) { Toast.show(`Backup: ${err.message || err}`, true); }
  App.render();
};
Object.assign(Actions, {
  "backup-choose": backupAction(async () => { if (await Backup.choose()) Toast.show(`Backing up to “${Backup.status.folder}”`); }),
  "backup-now": backupAction(async () => { if (await Backup.run()) Toast.show("Backed up and verified"); }),
  "backup-reconnect": backupAction(async () => { if (await Backup.reconnect()) Toast.show("Backups resumed"); else Toast.show("The folder was not reconnected", true); }),
  "backup-stop": () => Modal.confirm("Stop automatic backups? Files already in the folder stay there.", () => {
    Backup.stop().then(() => { Toast.show("Backups stopped"); App.render(); });
  }, "Stop backups", true)
});

Backup.onChange(() => { if (typeof App !== "undefined" && (location.hash || "").startsWith("#/storage")) App.render(); });
