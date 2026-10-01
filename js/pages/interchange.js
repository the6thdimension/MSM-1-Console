/* ============================================================
   Interchange, data management and search.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
Views.interchange = function () {
  const nReq = Store.all("requirements").length;
  const nCase = Store.all("cases").length;
  return `
    ${pageHead([{ label: "Interchange" }], "Import / Export", "",
      "Move data between this console and your team's tools. Current targets: Jira RTM (requirements + traceability) and Zephyr (test cases). Full-database JSON backup lives here too.")}
    ${Scope.system ? `<div class="ready-strip info"><span class="lamp"></span>IMPORTS AND EXPORTS ALWAYS COVER THE WHOLE PROGRAM, NOT ONLY THE SYSTEM IN SCOPE</div>` : ""}
    <div class="grid-2">
      <div>
        ${panel("Jira RTM — Requirements", `
          <p class="small muted" style="margin-top:0">Export produces a CSV shaped for Jira's CSV importer (Issue Type = Requirement; code, type, and measure carried as labels; threshold/objective embedded in the description). Import accepts a Jira CSV export — rows are matched by Issue key, then embedded REQ-code, then title, so round-trips update instead of duplicating.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${actBtn(`Export ${nReq} Requirements (CSV)`, "exp-jira-req", null, "", false)}
            ${actBtn("Export Traceability (CSV)", "exp-trace", null)}
            ${actBtn("Import Jira CSV…", "imp-jira", null)}
          </div>`)}
        ${panel("Zephyr — Test Cases", `
          <p class="small muted" style="margin-top:0">Export uses the Zephyr Squad import layout (step rows repeat under one case; procedure steps become test-script steps; entry criteria become the precondition; requirement codes, venue, and test type ride as labels). Import accepts the same shape — a TC-code label updates the existing case; unknown components are created under an "Imported" system.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${actBtn(`Export ${nCase} Test Cases (CSV)`, "exp-zephyr", null, "", false)}
            ${actBtn("Import Zephyr CSV…", "imp-zephyr", null)}
          </div>`)}
      </div>
      <div>
        ${panel("Sync Settings", `
          <p class="small muted" style="margin-top:0">Requirements and test cases carry a <b>Jira/Zephyr Issue Key</b> (edit it on the entity, or let imports set it — imports match by key first, so re-imports update instead of duplicating). Set your Jira base URL and every key becomes a link straight into Jira.</p>
          <div class="form-field">
            <label>Jira Base URL (e.g. https://yourteam.atlassian.net)</label>
            <div style="display:flex;gap:8px">
              <input type="text" id="jira-base" value="${esc(Store.db.meta.jiraBaseUrl || "")}" placeholder="https://yourteam.atlassian.net" style="flex:1;background:var(--bg-0);border:1px solid var(--line);border-radius:4px;color:var(--ink);padding:8px 10px;font-family:var(--mono);font-size:12px;outline:none">
              ${actBtn("Save", "save-jira-url", null, "", false)}
            </div>
          </div>
          <div class="small faint" style="margin-top:8px">Keys with a URL set render as ${Store.db.meta.jiraBaseUrl ? `working links, e.g. ` : ""}<span class="ev-ref">↗ MSM-123</span></div>`)}
        ${panel("Full Database (JSON)", `
          <p class="small muted" style="margin-top:0">Complete backup of everything — systems, requirements, cases, procedures, criteria, plans, runs, risks, and M&S assets. Import replaces the whole database.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${actBtn("Export JSON", "export-data", null, "", false)}
            ${actBtn("Import JSON…", "import-data", null)}
            ${actBtn("Export recovery copy", "export-recovery", null)}
            ${actBtn("Export unsaved draft", "export-draft", null)}
            ${actBtn("Reset to Demo Data", "reset-data", null)}
            ${actBtn("Start Blank Program…", "start-blank", null)}
          </div>
          <p class="small faint" style="margin-bottom:0">Start Blank wipes everything and names a fresh program (Jira base URL is kept; Undo available for 10 s). Export first if in doubt.</p>`)}
        ${panel("Format Notes", `
          <dl class="def-grid">
            <dt>Jira columns</dt><dd class="small">Issue Type, Issue key, Summary, Description, Priority, Labels</dd>
            <dt>Zephyr columns</dt><dd class="small">Name, Objective, Precondition, Priority, Labels, Component, Step, Test Data, Expected Result</dd>
            <dt>Trace columns</dt><dd class="small">Requirement, Summary, Measure, Test Case, Case Status, Latest Result, Run Date, Coverage Rollup</dd>
            <dt>Round-trip keys</dt><dd class="small">Jira Issue key ↔ requirement; TC-xxx label ↔ test case</dd>
          </dl>`)}
      </div>
    </div>
    <input type="file" id="import-jira-file" accept=".csv,text/csv" hidden>
    <input type="file" id="import-zephyr-file" accept=".csv,text/csv" hidden>`;
};

Views.searchResults = function (q) {
  const hits = Store.search(q);
  const html = hits.length ? hits.map(h => {
    const name = h.entity.name || h.entity.title || h.entity.notes || h.entity.code;
    return `<a class="panel search-hit" href="${h.route}" style="display:block">
      <div class="hit-type">${esc(h.label)}</div>
      <span class="code">${esc(h.entity.code)}</span> ${esc(name)}
    </a>`;
  }).join("") : emptyMsg(`Nothing found for “${q}”`);
  return `${pageHead([{ label: "Search" }], `Search: ${esc(q)}`, "", `${hits.length} result${hits.length === 1 ? "" : "s"}`)}${html}`;
};

Object.assign(Actions, {
  /* ---- start blank program ---- */
  "start-blank": () => Modal.open("Start Blank Program", [
    { key: "name", label: "Program Name", required: true, default: "" },
  ], {}, v => {
    Store.checkpoint();
    Store.startBlank(v.name);
    toastUndo(`Blank program “${v.name}” started`);
    App.go("#/dashboard");
    App.refreshNavCounts();
  }, "Start Blank"),

  "save-jira-url": () => {
    const el = document.getElementById("jira-base");
    if (!el) return;
    if (el.value.trim() && !safeHttp(el.value.trim())) throw new Error('Jira base URL must be a full HTTP(S) URL.');
    Store.db.meta.jiraBaseUrl = el.value.trim();
    Store.save();
    Toast.show(Store.db.meta.jiraBaseUrl ? "Jira base URL saved — issue keys are now links" : "Jira base URL cleared");
    App.render();
  },

  /* ---- interchange ---- */
  "exp-jira-req": () => { const n = IO.exportJiraRequirements(); Toast.show(`Exported ${n} requirements for Jira RTM`); },
  "exp-trace": () => { const n = IO.exportTraceability(); Toast.show(`Exported ${n} traceability rows`); },
  "exp-zephyr": () => { const n = IO.exportZephyrCases(); Toast.show(`Exported ${n} test cases for Zephyr`); },
  "imp-jira": () => document.getElementById("import-jira-file").click(),
  "imp-zephyr": () => document.getElementById("import-zephyr-file").click(),

  /* ---- data management ---- */
  "export-data": () => {
    const blob = new Blob([Store.exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `msm1-te-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    Toast.show("Database exported");
  },
  "import-data": () => document.getElementById("import-file").click(),
  "export-recovery": () => {
    const raw=localStorage.getItem(DB_KEY+'-recovery');
    if(raw===null){Toast.show('No recovery copy exists yet',true);return;}
    IO.download('previous-database.json',raw,'application/json');
  },
  "export-draft": () => {
    if(!Store.failedDraft){Toast.show('No unsaved draft exists',true);return;}
    IO.download('unsaved-draft.json',Store.failedDraft,'application/json');
  },
  "reset-data": () => Modal.confirm("Reset the database to the demo dataset? Export your program first. A recovery copy will be saved before replacement.", () => {
    Store.reset(); toastUndo("Reset to demo data"); App.render(); App.refreshNavCounts();
  },'Reset')
});
