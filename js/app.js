/* ============================================================
   App — hash router, event delegation, boot
   ============================================================ */

const App = {
  bulkSel: new Set(),

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
        case "risks":       html = seg[1] ? Views.riskDetail(seg[1]) : Views.risks(params); break;
        case "resources":   html = seg[1] ? Views.resourceDetail(seg[1]) : Views.resources(); break;
        case "idsk":        html = Views.idsk(); break;
        case "decisions":
          html = seg[1] ? (seg[2] === "report" ? Views.decisionReport(seg[1]) : Views.decisionDetail(seg[1])) : Views.idsk();
          nav = "idsk"; break;
        case "defects":     html = seg[1] ? Views.defectDetail(seg[1]) : Views.defects(params); break;
        case "execute":     html = Views.execute(seg[1]); nav = "cases"; break;
        case "sitrep":      html = Views.sitrep(); nav = "dashboard"; break;
        case "documents":   html = Views.documents(params); break;
        case "schedule":    html = Views.schedule(params); break;
        case "events":      html = seg[1] ? Views.eventDetail(seg[1]) : Views.schedule(params); nav = "schedule"; break;
        case "interchange": html = Views.interchange(); break;
        case "search":      html = Views.searchResults(decodeURIComponent(seg.slice(1).join("/") || params.get("q") || "")); nav = ""; break;
        default:            html = Views.dashboard(); nav = "dashboard";
      }
    } catch (err) {
      console.error(err);
      html = `<div class="empty" style="padding:60px">Something went wrong rendering this view.<br><span class="mono">${esc(err.message)}</span><br><br><a href="#/dashboard">Back to dashboard</a></div>`;
    }

    view.innerHTML = html;
    view.scrollTop = 0;
    window.scrollTo(0, 0);

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
      el.textContent = Store.all(coll).length;
    });
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
      const p = Store.get("procedures", li.dataset.proc);
      const to = Number(li.dataset.stepIdx);
      if (p && to !== dragStep.idx) {
        const [moved] = p.steps.splice(dragStep.idx, 1);
        p.steps.splice(to, 0, moved);
        Store.logAudit("procedures", p, "updated", `step reordered ${dragStep.idx + 1} → ${to + 1}`);
        Store.save();
        this.render();
      }
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
      reader.onload = () => {
        try {
          const res = isJira ? IO.importJiraRequirements(reader.result) : IO.importZephyrCases(reader.result);
          Toast.show(`${isJira ? "Jira" : "Zephyr"} import: ${res.added} added, ${res.updated} updated`);
          this.render();
        } catch (err) {
          Toast.show(`Import failed: ${err.message}`, true);
        }
      };
      reader.readAsText(file);
      t.value = "";
    });

    /* import file */
    document.getElementById("import-file").addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          Store.importJSON(reader.result);
          Toast.show("Database imported");
          this.render();
        } catch (err) {
          Toast.show(`Import failed: ${err.message}`, true);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    });
  },

  boot() {
    Store.load();
    try { Store.snapshotToday(); } catch (e) { /* non-fatal */ }
    this.bind();
    if (!location.hash) location.hash = "#/dashboard";
    this.render();
  }
};

App.boot();
