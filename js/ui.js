/* ============================================================
   UI helpers — escaping, chips/badges, modal forms, toasts
   ============================================================ */

function safeHttp(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020\u007f]/.test(value) || !/^https?:\/\//i.test(value)) return '';
  try { const url=new URL(value); return ['http:','https:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch (_) { return ''; }
}
function externalLink(url, label) {
  const safe=safeHttp(url);
  return safe ? '<a class="ev-ref" href="'+esc(safe)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+'</a>' : '<span class="ev-ref" title="Link disabled; use a valid HTTP(S) address">'+esc(label)+'</span>';
}
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/* ---------- entity links ---------- */
const ROUTE_OF = {
  systems: id => `#/systems/${id}`,
  components: id => `#/components/${id}`,
  requirements: id => `#/requirements/${id}`,
  cases: id => `#/cases/${id}`,
  procedures: id => `#/procedures/${id}`,
  plans: id => `#/plans/${id}`,
  risks: id => `#/risks/${id}`,
  resources: id => `#/resources/${id}`,
  decisions: id => `#/decisions/${id}`,
  events: id => `#/events/${id}`,
  defects: id => `#/defects/${id}`,
  documents: () => "#/documents",
  testRuns: id => `#/testruns/${id}`,
  runs: () => "#/runs"
};

/* ---------- system scope ----------
   Which system the viewer is working in ("" = whole program). A per-browser view
   preference, kept out of the program database: it filters what lists and counts
   show, never what computed statuses mean. */
const Scope = {
  KEY: "msm1-te-scope",
  system: "",
  shared: true,
  load() {
    try { const v = JSON.parse(localStorage.getItem(this.KEY) || "{}"); this.system = v.system || ""; this.shared = v.shared !== false; }
    catch (e) { this.system = ""; this.shared = true; }
    this.validate();
  },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify({ system: this.system, shared: this.shared })); } catch (e) { /* preference only */ } },
  set(system, shared) { this.system = system || ""; if (shared !== undefined) this.shared = !!shared; this.validate(); this.save(); },
  validate() { if (this.system && !Store.get("systems", this.system)) this.system = ""; },
  current() { return this.system ? Store.get("systems", this.system) : null; },
  includes(coll, r) {
    if (!this.system) return true;
    const owner = Store.ownerOf(coll, r);
    return owner === this.system || (this.shared && owner === "");
  },
  list(coll) { this.validate(); return this.system ? Store.all(coll).filter(r => this.includes(coll, r)) : Store.all(coll); }
};

/* Marks a linked record owned by a different system than the one in scope. */
function crossSystemTag(coll, entity) {
  if (!Scope.system || coll === "systems" || !entity) return "";
  const owner = Store.ownerOf(coll, entity);
  if (!owner || owner === Scope.system) return "";
  const s = Store.get("systems", owner);
  return `<span class="xsys" title="Owned by ${esc(s ? s.name : "another system")}">↗ ${esc(s ? s.code : "other")}</span>`;
}

function codeLink(coll, entity) {
  if (!entity) return `<span class="faint">—</span>`;
  return `<a class="code" href="${ROUTE_OF[coll](entity.id)}">${esc(entity.code)}</a>`;
}

function chip(coll, entity, label) {
  if (!entity) return "";
  const name = label || entity.name || entity.title;
  return `<a class="chip" href="${ROUTE_OF[coll](entity.id)}"><span class="code">${esc(entity.code)}</span>${esc(name)}${crossSystemTag(coll, entity)}</a>`;
}

function chips(coll, entities, emptyText) {
  if (!entities || !entities.length) return `<span class="faint small">${esc(emptyText || "None")}</span>`;
  return entities.map(e => chip(coll, e)).join("");
}

/* ---------- badges ---------- */
const BADGE_COLOR = {
  // test case / plan status
  "Draft": "b-grey", "Ready": "b-blue", "In Progress": "b-amber", "Complete": "b-green", "Blocked": "b-orange",
  "Planning": "b-grey", "Active": "b-amber", "Closed": "b-grey", "On Hold": "b-orange",
  // run results
  "Pass": "b-green", "Fail": "b-red", "Waived": "b-amber", "Review for Removal": "b-purple",
  "Retired": "b-grey", "Aborted": "b-grey",
  // requirement rollup
  "verified": "b-green", "failing": "b-red", "covered": "b-blue", "uncovered": "b-grey",
  // priorities
  "Critical": "b-red", "High": "b-orange", "Medium": "b-amber", "Low": "b-grey",
  // risk status
  "Open": "b-red", "Mitigating": "b-amber", "Monitoring": "b-blue",
  // mitigation status
  "Proposed": "b-grey", "Approved": "b-blue", "Verified": "b-green",
  // criteria
  "met": "b-green", "open": "b-grey", "waived": "b-amber",
  // requirement types
  "Performance": "b-blue", "Functional": "b-purple", "Safety": "b-red", "Environmental": "b-green", "Operational": "b-amber", "Interface": "b-grey",
  // measures (DEF-style)
  "KPP": "b-red", "KSA": "b-orange", "CTP": "b-amber", "TPM": "b-blue", "MOP": "b-purple", "MOE": "b-purple", "Spec": "b-grey", "None": "b-grey",
  // VV&A tracks
  "Not Started": "b-grey", "Planned": "b-blue",
  "Plan Approved": "b-blue", "Evidence In Review": "b-amber", "Conditionally Accredited": "b-amber", "Accredited": "b-green", "Not Accredited": "b-red",
  // venues / test types
  "Live": "b-green", "Virtual": "b-blue", "Constructive": "b-purple", "HWIL": "b-amber", "Hybrid": "b-orange",
  "CT": "b-grey", "DT&E": "b-blue", "Integration": "b-purple", "Regression": "b-grey", "V&V – Verification": "b-amber", "V&V – Validation": "b-amber",
  // decisions & schedule
  "Pending": "b-grey", "On Track": "b-green", "At Risk": "b-orange", "Slipped": "b-red", "Cancelled": "b-grey",
  "Test Event": "b-blue", "Review": "b-purple", "Milestone": "b-amber", "Decision Point": "b-red", "Delivery": "b-green", "Range Window": "b-orange",
  // component derived status
  "Passing": "b-green", "Failing": "b-red", "In Test": "b-amber", "Untested": "b-grey",
  // defects
  "Major": "b-orange", "Minor": "b-amber", "Cosmetic": "b-grey",
  "In Analysis": "b-amber", "Fix In Work": "b-blue", "Ready for Retest": "b-purple", "Deferred": "b-grey"
};

function badge(text, cls) {
  if (text == null || text === "") return "";
  const c = cls || BADGE_COLOR[text] || "b-grey";
  const label = { verified: "Verified", failing: "Failing", covered: "Covered", uncovered: "No Coverage", met: "Met", open: "Open", waived: "Waived" }[text] || text;
  return `<span class="badge ${c}">${esc(label)}</span>`;
}

const RUN_DOT = { "Pass": "pass", "Fail": "fail", "Blocked": "blocked", "In Progress": "inprogress", "Waived": "waived", "Review for Removal": "removal" };

function runBadge(run) {
  if (!run) return `<span class="faint small">Not run</span>`;
  const dot = RUN_DOT[run.result] || "blocked";
  return `<span class="run-dot ${dot}"></span>${badge(run.result)} <span class="faint mono">${esc(run.date || "")}</span>`;
}

/* ---------- toasts ---------- */
const Toast = {
  show(msg, isErr, action) {
    const el = document.createElement("div");
    el.className = "toast" + (isErr ? " err" : "");
    el.textContent = msg;
    if (action) {
      const btn = document.createElement("button");
      btn.className = "toast-act";
      btn.textContent = action.label;
      btn.addEventListener("click", () => { el.remove(); action.fn(); });
      el.appendChild(btn);
    }
    document.getElementById("toast-root").appendChild(el);
    const life = action ? 10000 : 3000;
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = "opacity .3s"; }, life - 400);
    setTimeout(() => el.remove(), life);
  }
};

/* Delete toast with a working Undo (restores the pre-delete snapshot). */
function toastUndo(msg) {
  Toast.show(msg, false, {
    label: "Undo",
    fn() {
      Commands.run('Undo',()=>{
        if (Store.undo()) { Toast.show("Restored"); App.render(); App.refreshNavCounts(); }
      });
    }
  });
}

/* ---------- modal form engine ----------
   fields: [{ key, label, type: text|textarea|number|date|select|multicheck,
              options: [{value,label}] | [str], required, min, max, half }]
*/
const Modal = {
  close() { document.getElementById("modal-root").innerHTML = ""; },

  open(title, fields, values, onSubmit, submitLabel) {
    values = values || {};
    const root = document.getElementById("modal-root");
    const fieldHtml = fields.map(f => {
      const v = values[f.key] != null ? values[f.key] : (f.default != null ? f.default : "");
      const full = f.half ? "" : " full";
      let control = "";
      if (f.type === "textarea") {
        control = `<textarea name="${f.key}" ${f.required ? "required" : ""}>${esc(v)}</textarea>`;
      } else if (f.type === "select") {
        const opts = (f.options || []).map(o => {
          const val = o.value !== undefined ? o.value : o;
          const lab = o.label !== undefined ? o.label : o;
          return `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`;
        }).join("");
        control = `<select name="${f.key}" ${f.required ? "required" : ""}>${f.allowEmpty ? `<option value="">—</option>` : ""}${opts}</select>`;
      } else if (f.type === "multicheck") {
        const selected = new Set(Array.isArray(v) ? v : []);
        const opts = (f.options || []).map(o =>
          `<label><input type="checkbox" name="${f.key}" value="${esc(o.value)}" ${selected.has(o.value) ? "checked" : ""}> <span class="code">${esc(o.code || "")}</span> ${esc(o.label)}</label>`
        ).join("");
        control = `<div class="check-list">${opts || '<span class="faint small">Nothing available yet</span>'}</div>`;
      } else if (f.type === "number") {
        control = `<input type="number" name="${f.key}" value="${esc(v)}" ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} ${f.required ? "required" : ""}>`;
      } else if (f.type === "date") {
        control = `<input type="date" name="${f.key}" value="${esc(v)}" ${f.required ? "required" : ""}>`;
      } else {
        control = `<input type="text" name="${f.key}" value="${esc(v)}" ${f.required ? "required" : ""} autocomplete="off">`;
      }
      return `<div class="form-field${full}"><label>${esc(f.label)}${f.required ? " *" : ""}</label>${control}</div>`;
    }).join("");

    root.innerHTML = `
      <div class="modal-scrim" data-scrim>
        <div class="modal" role="dialog" aria-modal="true">
          <div class="modal-head">
            <h2>${esc(title)}</h2>
            <button class="modal-close" data-close title="Close (Esc)">✕</button>
          </div>
          <form id="modal-form">
            <div class="modal-body"><div class="form-grid">${fieldHtml}</div></div>
            <div class="modal-foot">
              <button type="button" class="btn btn-ghost" data-close>Cancel</button>
              <button type="submit" class="btn">${esc(submitLabel || "Save")}</button>
            </div>
          </form>
        </div>
      </div>`;

    const scrim = root.querySelector("[data-scrim]");
    scrim.addEventListener("mousedown", e => { if (e.target === scrim) Modal.close(); });
    root.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", Modal.close));

    const form = root.querySelector("#modal-form");
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const out = {};
      for (const f of fields) {
        if (f.type === "multicheck") {
          out[f.key] = Array.from(form.querySelectorAll(`input[name="${f.key}"]:checked`)).map(i => i.value);
        } else if (f.type === "number") {
          const raw = form.elements[f.key].value;
          out[f.key] = raw === "" ? null : Number(raw);
        } else {
          out[f.key] = form.elements[f.key].value.trim();
        }
      }
      const submit = form.querySelector('[type="submit"]');
      if (submit.disabled) return;
      submit.disabled = true;
      const ok = await Commands.run(title, () => {
        onSubmit(out);
        Store.effect(() => { if (root.querySelector('#modal-form') === form) Modal.close(); });
      });
      if (!ok) submit.disabled = false;
    });

    const first = form.querySelector("input, textarea, select");
    if (first) first.focus();
  },

  confirm(message, onYes, label = "Delete", safe = false) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
      <div class="modal-scrim" data-scrim>
        <div class="modal" role="alertdialog" style="width:min(440px,100%)">
          <div class="modal-head"><h2>Confirm</h2><button class="modal-close" data-close>✕</button></div>
          <div class="modal-body"><p style="margin:4px 0 0">${esc(message)}</p></div>
          <div class="modal-foot">
            <button type="button" class="btn btn-ghost" data-close>Cancel</button>
            <button type="button" class="btn" id="confirm-yes"${safe ? "" : ` style="background:var(--red);color:#fff"`}>${esc(label)}</button>
          </div>
        </div>
      </div>`;
    const scrim = root.querySelector("[data-scrim]");
    scrim.addEventListener("mousedown", e => { if (e.target === scrim) Modal.close(); });
    root.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", Modal.close));
    root.querySelector("#confirm-yes").addEventListener("click", async e => {
      const button=e.currentTarget; if(button.disabled)return; button.disabled=true;
      const ok=await Commands.run(label,()=>{ onYes(); Store.effect(()=>{if(root.contains(button))Modal.close();}); });
      if(!ok)button.disabled=false;
    });
  }
};

/* ---------- command palette (Ctrl/Cmd+K) ---------- */
const Palette = {
  idx: 0,

  staticCommands() {
    return [
      { type: "Go", label: "Dashboard", hash: "#/dashboard" },
      { type: "Go", label: "Schedule", hash: "#/schedule" },
      { type: "Go", label: "Systems", hash: "#/systems" },
      { type: "Go", label: "Requirements", hash: "#/requirements" },
      { type: "Go", label: "Test Cases", hash: "#/cases" },
      { type: "Go", label: "Trace Matrix", hash: "#/trace" },
      { type: "Go", label: "IDSK", hash: "#/idsk" },
      { type: "Go", label: "Procedures", hash: "#/procedures" },
      { type: "Go", label: "Test Plans", hash: "#/plans" },
      { type: "Go", label: "Test Runs", hash: "#/runs" },
      { type: "Go", label: "Defects", hash: "#/defects" },
      { type: "Go", label: "Risks", hash: "#/risks" },
      { type: "Go", label: "M&S / VV&A", hash: "#/resources" },
      { type: "Go", label: "Interchange", hash: "#/interchange" },
      { type: "Go", label: "Weekly SITREP", hash: "#/sitrep" },
      { type: "Go", label: "Ownership — assign records to systems", hash: "#/ownership" },
      { type: "Go", label: "Documents", hash: "#/documents" },
      { type: "New", label: "Link Document", act: "add-doc-link" },
      { type: "New", label: "New Test Case", act: "add-case" },
      { type: "New", label: "New Requirement", act: "add-requirement" },
      { type: "New", label: "New Risk", act: "add-risk" },
      { type: "New", label: "New Defect", act: "add-defect" },
      { type: "New", label: "New Event", act: "add-event" },
      { type: "New", label: "New Decision", act: "add-decision" },
      { type: "New", label: "New Procedure", act: "add-procedure" },
      { type: "New", label: "Record Test Run", act: "record-run-any" }
    ];
  },

  results(q) {
    q = q.trim().toLowerCase();
    const cmds = this.staticCommands().filter(c => !q || c.label.toLowerCase().includes(q));
    const hits = q ? Store.search(q).slice(0, 8).map(h => ({
      type: h.label, label: `${h.entity.code} — ${h.entity.name || h.entity.title || h.entity.code}`, hash: h.route
    })) : [];
    return [...hits, ...cmds].slice(0, 12);
  },

  open() {
    const root = document.getElementById("palette-root");
    root.innerHTML = `
      <div class="palette-scrim" data-pscrim>
        <div class="palette">
          <input id="palette-input" type="text" placeholder="Jump to anything, or create…" autocomplete="off" spellcheck="false">
          <div id="palette-list"></div>
        </div>
      </div>`;
    const input = root.querySelector("#palette-input");
    this.idx = 0;
    const renderList = () => {
      const items = this.results(input.value);
      this._items = items;
      if (this.idx >= items.length) this.idx = Math.max(0, items.length - 1);
      root.querySelector("#palette-list").innerHTML = items.map((it, i) => `
        <div class="p-item${i === this.idx ? " sel" : ""}" data-pi="${i}">
          <span class="p-type">${esc(it.type)}</span><span>${esc(it.label)}</span>
        </div>`).join("") || `<div class="p-item faint">No matches</div>`;
    };
    renderList();
    input.focus();
    input.addEventListener("input", () => { this.idx = 0; renderList(); });
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown") { e.preventDefault(); this.idx = Math.min(this.idx + 1, this._items.length - 1); renderList(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); this.idx = Math.max(this.idx - 1, 0); renderList(); }
      else if (e.key === "Enter") { e.preventDefault(); this.exec(this._items[this.idx]); }
      else if (e.key === "Escape") this.close();
    });
    root.querySelector("[data-pscrim]").addEventListener("mousedown", e => {
      if (e.target.dataset.pscrim !== undefined) this.close();
    });
    root.querySelector("#palette-list").addEventListener("click", e => {
      const item = e.target.closest("[data-pi]");
      if (item) this.exec(this._items[Number(item.dataset.pi)]);
    });
  },

  exec(item) {
    if (!item) return;
    this.close();
    if (item.hash) App.go(item.hash);
    else if (item.act && typeof Actions !== "undefined" && Actions[item.act]) Actions[item.act](null, { dataset: {} });
  },

  close() { document.getElementById("palette-root").innerHTML = ""; },

  isOpen() { return !!document.getElementById("palette-root").firstChild; }
};

document.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    Palette.isOpen() ? Palette.close() : Palette.open();
    return;
  }
  if (e.key === "Escape") { Modal.close(); Palette.close(); }
  if (e.key === "/" && document.activeElement.tagName !== "INPUT" && document.activeElement.tagName !== "TEXTAREA") {
    e.preventDefault();
    document.getElementById("global-search").focus();
  }
});

/* ---------- shared page fragments ---------- */
function pageHead(crumbs, titleHtml, actionsHtml, subHtml) {
  const crumbHtml = crumbs.map((c, i) => {
    const seg = c.href ? `<a href="${c.href}">${esc(c.label)}</a>` : `<span>${esc(c.label)}</span>`;
    return i ? `<span class="sep">/</span>${seg}` : seg;
  }).join("");
  return `
    <div class="page-head">
      <div class="crumbs">${crumbHtml}</div>
      <div class="page-title-row">
        <h1 class="page-title">${titleHtml}</h1>
        <div class="page-actions">${actionsHtml || ""}</div>
      </div>
      ${subHtml ? `<div class="page-sub">${subHtml}</div>` : ""}
    </div>`;
}

function panel(title, bodyHtml, headExtra, tight) {
  return `
    <div class="panel">
      <div class="panel-head"><h2>${esc(title)}</h2><div class="spacer"></div>${headExtra || ""}</div>
      <div class="panel-body${tight ? " tight" : ""}">${bodyHtml}</div>
    </div>`;
}

function emptyMsg(text) { return `<div class="empty">${esc(text)}</div>`; }

function actBtn(label, act, id, extra, ghost = true, cls = "btn-sm") {
  return `<button class="btn ${ghost ? "btn-ghost " : ""}${cls}" data-act="${act}" ${id ? `data-id="${id}"` : ""} ${extra || ""}>${label}</button>`;
}

function progressMeter(counts) {
  // counts: {pass, fail, blocked, open, waived?, removal?} — proportional segments
  const waived = counts.waived || 0, removal = counts.removal || 0;
  const total = counts.pass + counts.fail + counts.blocked + counts.open + waived + removal;
  if (!total) return `<div class="meter"><span class="m-open" style="width:100%"></span></div>`;
  const seg = (n, cls) => n ? `<span class="${cls}" style="width:${(n / total * 100).toFixed(1)}%"></span>` : "";
  return `<div class="meter">${seg(counts.pass, "m-pass")}${seg(waived, "m-waived")}${seg(removal, "m-removal")}${seg(counts.fail, "m-fail")}${seg(counts.blocked, "m-blocked")}${seg(counts.open, "m-open")}</div>`;
}
