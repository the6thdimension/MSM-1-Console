/* ============================================================
   App — hash router, event delegation, boot
   ============================================================ */

const App = {
  bulkSel: new Set(),
  _lastHash: null,
  _anchor: null,

  /* Bring an element (e.g. the test-run row just recorded) into view after the next render. */
  anchor(id) { this._anchor = id; },

  go(hash) {
    if (location.hash === hash) this.render();
    else location.hash = hash;
  },

  /* current query params from hash: #/route?x=y */
  params() {
    const q = location.hash.split("?")[1] || "";
    return new URLSearchParams(q);
  },

  route() {
    const raw = (location.hash || "#/dashboard").slice(1);
    const [path] = raw.split("?");
    return path.split("/").filter(Boolean);
  },

  render() {
    const seg = this.route();
    const params = this.params();
    const view = document.getElementById("view");
    let html, nav = seg[0] || "dashboard";

    try {
      switch (seg[0]) {
        case undefined:
        case "":
        case "dashboard":   html = Views.dashboard(); nav = "dashboard"; break;
        case "systems":     html = seg[1] ? Views.systemDetail(seg[1]) : Views.systems(); break;
        case "components":  html = seg[1] ? Views.componentDetail(seg[1]) : Views.systems(); nav = "systems"; break;
        case "requirements":html = seg[1] ? Views.requirementDetail(seg[1]) : Views.requirements(params); break;
        case "cases":       html = seg[1] ? Views.caseDetail(seg[1]) : Views.cases(params); break;
        case "trace":       html = Views.trace(params); break;
        case "procedures":  html = seg[1] ? Views.procedureDetail(seg[1]) : Views.procedures(); break;
        case "plans":       html = seg[1] ? Views.planDetail(seg[1]) : Views.plans(); break;
        case "runs":        html = Views.runs(params); break;
        case "testruns":    html = seg[1] ? Views.testRun(seg[1], params) : Views.runs(params); nav = "runs"; break;
        case "risks":       html = seg[1] ? Views.riskDetail(seg[1]) : Views.risks(params); break;
        case "resources":   html = seg[1] ? Views.resourceDetail(seg[1]) : Views.resources(); break;
        case "idsk":        html = Views.idsk(); break;
        case "decisions":
          html = seg[1] ? (seg[2] === "report" ? Views.decisionReport(seg[1]) : Views.decisionDetail(seg[1])) : Views.idsk();
          nav = "idsk"; break;
        case "defects":     html = seg[1] ? Views.defectDetail(seg[1]) : Views.defects(params); break;
        case "execute":     html = Views.execute(seg[1], params); nav = params.get("tr") ? "runs" : "cases"; break;
        case "sitrep":      html = Views.sitrep(); nav = "dashboard"; break;
        case "documents":   html = Views.documents(params); break;
        case "schedule":    html = Views.schedule(params); break;
        case "events":      html = seg[1] ? Views.eventDetail(seg[1]) : Views.schedule(params); nav = "schedule"; break;
        case "interchange": html = Views.interchange(); break;
        case "ownership":   html = Views.ownership(params); break;
        case "search":      html = Views.searchResults(decodeURIComponent(seg.slice(1).join("/") || params.get("q") || "")); nav = ""; break;
        default:            html = Views.dashboard(); nav = "dashboard";
      }
    } catch (err) {
      console.error(err);
      html = `<div class="empty" style="padding:60px">Something went wrong rendering this view.<br><span class="mono">${esc(err.message)}</span><br><br><a href="#/dashboard">Back to dashboard</a></div>`;
    }

    // Re-rendering the same route (a save, a status click) keeps filters and scroll position;
    // navigating to a new route starts at the top unless an anchor was requested.
    const sameRoute = location.hash === this._lastHash;
    const y = window.scrollY;
    view.innerHTML = scopeBanner() + html;
    this.renderScopeBox();
    const target = this._anchor && document.getElementById(this._anchor);
    this._anchor = null;
    this._lastHash = location.hash;
    if (target) {
      target.scrollIntoView({ block: "center" });
      target.classList.add("flash");
    } else window.scrollTo(0, sameRoute ? y : 0);

    /* bulk selection: persists across re-renders of the cases list, clears elsewhere */
    if (seg[0] === "cases" && !seg[1]) {
      view.querySelectorAll("[data-bulk]").forEach(cb => { cb.checked = this.bulkSel.has(cb.dataset.bulk); });
      this.updateBulkBar();
    } else {
      this.bulkSel.clear();
    }

    document.querySelectorAll("#main-nav a").forEach(a => {
      a.classList.toggle("active", a.dataset.nav === nav);
    });
    this.refreshNavCounts();
  },

  updateBulkBar() {
    const bar = document.getElementById("bulk-bar");
    if (!bar) return;
    const n = this.bulkSel.size;
    bar.classList.toggle("show", n > 0);
    const count = bar.querySelector(".bulk-count");
    if (count) count.textContent = `${n} selected`;
  },

  refreshNavCounts() {
    document.querySelectorAll(".nav-count").forEach(el => {
      const coll = el.dataset.count;
      el.textContent = Scope.list(coll).length;
    });
  },

  /* Sidebar scope switcher; rebuilt each render because systems can be added or renamed. */
  renderScopeBox() {
    const sel = document.getElementById("scope-select"), shared = document.getElementById("scope-shared");
    if (!sel) return;
    Scope.validate();
    sel.innerHTML = `<option value="">◈ Program — all systems</option>` +
      Store.all("systems").slice().sort(Store.byCodeOrder).map(s => `<option value="${s.id}">${esc(s.code)} ${esc(s.name)}</option>`).join("");
    sel.value = Scope.system;
    shared.checked = Scope.shared;
    shared.disabled = !Scope.system;
    document.getElementById("sidebar").classList.toggle("scoped", !!Scope.system);
  },

  bind() {
    window.addEventListener("hashchange", () => this.render());

    /* global action delegation */
    document.body.addEventListener("click", e => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.dataset.act;
      if (act === "toggle-closed" || act === "trace-gaps") return; // handled by change event
      const fn = Actions[act];
      if (fn) { e.preventDefault(); fn(btn.dataset.id || null, btn); }
    });

    document.body.addEventListener("change", e => {
      const t = e.target;
      if (t.id === "scope-select") { Scope.set(t.value); this.render(); return; }
      if (t.id === "scope-shared") { Scope.set(Scope.system, t.checked); this.render(); return; }
      if (t.matches("[data-own-all]")) { document.querySelectorAll("[data-own]").forEach(cb => { cb.checked = t.checked; }); return; }
      if (t.matches("[data-bulk]")) {
        t.checked ? this.bulkSel.add(t.dataset.bulk) : this.bulkSel.delete(t.dataset.bulk);
        this.updateBulkBar();
        return;
      }
      if (t.matches("[data-bulk-all]")) {
        document.querySelectorAll("[data-bulk]").forEach(cb => {
          cb.checked = t.checked;
          t.checked ? this.bulkSel.add(cb.dataset.bulk) : this.bulkSel.delete(cb.dataset.bulk);
        });
        this.updateBulkBar();
        return;
      }
      if (t.matches("[data-exec-step]")) {
        const row = t.closest(".exec-step");
        if (row) row.classList.toggle("done", t.checked);
        const boxes = document.querySelectorAll("[data-exec-step]");
        const done = Array.from(boxes).filter(cb => cb.checked).length;
        const prog = document.getElementById("exec-progress");
        if (prog) prog.textContent = `${done}/${boxes.length} done`;
        return;
      }
      if (t.matches("[data-act='toggle-closed']") || t.matches("[data-act='trace-gaps']")) {
        Actions[t.dataset.act](null, t);
        return;
      }
      if (t.matches("[data-filter]")) {
        const seg = this.route();
        const params = this.params();
        if (t.value) params.set(t.dataset.filter, t.value);
        else params.delete(t.dataset.filter);
        const q = params.toString();
        this.go(`#/${seg.join("/")}${q ? "?" + q : ""}`);
      }
    });

    /* Enter in the external-link inputs adds the link */
    document.body.addEventListener("keydown", e => {
      if (e.key === "Enter" && (e.target.id === "extlink-url" || e.target.id === "extlink-label")) {
        e.preventDefault();
        const btn = document.querySelector("[data-act='add-extlink']");
        if (btn) Actions["add-extlink"](btn.dataset.id, btn);
      }
    });

    /* procedure step drag-reorder */
    let dragStep = null;
    document.body.addEventListener("dragstart", e => {
      const li = e.target.closest("[data-step-idx]");
      if (!li) return;
      dragStep = { proc: li.dataset.proc, idx: Number(li.dataset.stepIdx) };
      e.dataTransfer.effectAllowed = "move";
    });
    document.body.addEventListener("dragover", e => {
      const li = e.target.closest("[data-step-idx]");
      if (!dragStep || !li || li.dataset.proc !== dragStep.proc) return;
      e.preventDefault();
      document.querySelectorAll("[data-step-idx].drag-over").forEach(x => x.classList.remove("drag-over"));
      li.classList.add("drag-over");
    });
    document.body.addEventListener("drop", e => {
      const li = e.target.closest("[data-step-idx]");
      if (!dragStep || !li || li.dataset.proc !== dragStep.proc) { dragStep = null; return; }
      e.preventDefault();
      const from = dragStep.idx, procId = li.dataset.proc, to = Number(li.dataset.stepIdx);
      Commands.run('Reorder procedure steps', () => {
        const p=Store.get('procedures',procId);
        if(p && to!==from) { const [moved]=p.steps.splice(from,1); p.steps.splice(to,0,moved); Store.save(); this.render(); }
      });
      dragStep = null;
    });
    document.body.addEventListener("dragend", () => {
      dragStep = null;
      document.querySelectorAll("[data-step-idx].drag-over").forEach(x => x.classList.remove("drag-over"));
    });

    /* global search */
    const search = document.getElementById("global-search");
    search.addEventListener("keydown", e => {
      if (e.key === "Enter" && search.value.trim()) {
        this.go(`#/search?q=${encodeURIComponent(search.value.trim())}`);
        search.blur();
      }
      if (e.key === "Escape") { search.value = ""; search.blur(); }
    });

    /* document file upload (input lives inside the Documents view) */
    document.body.addEventListener("change", e => {
      const t = e.target;
      if (t.id !== "doc-file") return;
      const file = t.files[0];
      t.value = "";
      if (!file) return;
      if (file.size > DOC_MAX_BYTES) {
        Toast.show(`File is ${fmtBytes(file.size)} — embedded files are capped at ${fmtBytes(DOC_MAX_BYTES)}. Add it as a link instead.`, true);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => openDocModal(null, { name: file.name, size: file.size, type: file.type, dataUrl: reader.result });
      reader.onerror = () => Toast.show('Could not read the selected attachment',true);
      reader.readAsDataURL(file);
    });

    /* CSV imports (inputs live inside the Interchange view) */
    document.body.addEventListener("change", e => {
      const t = e.target;
      if (t.id !== "import-jira-file" && t.id !== "import-zephyr-file") return;
      const file = t.files[0];
      if (!file) return;
      const isJira = t.id === "import-jira-file";
      const reader = new FileReader();
      reader.onload = () => Commands.previewCSV(reader.result,isJira);
      reader.onerror = () => Toast.show('Could not read the selected CSV file',true);
      reader.readAsText(file);
      t.value = "";
    });

    /* import file */
    document.getElementById("import-file").addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => Commands.previewJSON(reader.result);
      reader.onerror = () => Toast.show('Could not read the selected JSON file',true);
      reader.readAsText(file);
      e.target.value = "";
    });
  },

  boot() {
    Commands.install();
    try { Store.load(); } catch (err) { this.recovery(err); return; }
    Scope.load();
    this.bind();
    if (!location.hash) location.hash = "#/dashboard";
    this.render();
    window.addEventListener('storage', e => {
      if(e.key===DB_KEY || e.key===null) Toast.show('Database changed in another tab. Export any unsaved draft and reload before saving.',true);
    });
    Commands.run('Daily snapshot',()=>Store.snapshotToday());
  },
  recovery(err) {
    document.getElementById('sidebar').style.display='none';
    const view=document.getElementById('view');
    view.innerHTML='<div class="panel" style="margin:40px;padding:24px"><h1>Database recovery required</h1><p id="recovery-error"></p><p>No demo data was loaded. Existing storage has not been replaced. Download the original data and recovery copy below. Restore a valid export in an isolated browser profile, keeping these files for recovery.</p><div id="recovery-files"></div><button class="btn" id="recovery-reload">Retry loading</button></div>';
    document.getElementById('recovery-error').textContent=err.message;
    for(const key of [DB_KEY,DB_KEY+'-recovery',...OLD_DB_KEYS]) {
      try {
        const raw=localStorage.getItem(key); if(raw===null)continue;
        const button=document.createElement('button');button.className='btn btn-ghost';button.textContent='Download '+key;
        button.onclick=()=>IO.download(key+'.json',raw,'application/json');document.getElementById('recovery-files').appendChild(button);
      } catch (_) { /* Storage may be disabled by the browser. */ }
    }
    document.getElementById('recovery-reload').onclick=()=>location.reload();
  }
};

App.boot();
