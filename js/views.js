/* ============================================================
   Views core — shared vocabularies, rendering helpers, the Views and
   Actions objects, shared actions and owner fields. Each page area lives
   in js/pages/<area>.js and adds to Views and Actions; index.html loads
   this file first, then the pages, then regression, scope and commands.
   ============================================================ */

const CASE_STATUSES = ["Draft", "Ready", "In Progress", "Complete", "Blocked", "Retired"];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const REQ_TYPES = ["Performance", "Functional", "Safety", "Environmental", "Operational", "Interface"];
const VERIF_METHODS = ["Test", "Analysis", "Inspection", "Demonstration"];
const PLAN_STATUSES = ["Planning", "Active", "Complete", "On Hold", "Closed"];
const RUN_RESULTS = ["Pass", "Fail", "Blocked", "In Progress", "Waived", "Review for Removal"];
const RISK_STATUSES = ["Open", "Mitigating", "Monitoring", "Closed"];
const MIT_FLOW = ["Proposed", "Approved", "In Progress", "Complete", "Verified"];
const RISK_CATEGORIES = ["Technical", "Schedule", "Cost", "Safety", "Programmatic"];
const MEASURES = ["None", "KPP", "KSA", "CTP", "TPM", "MOP", "MOE", "Spec"];
const VENUES = ["Live", "Virtual", "Constructive", "HWIL", "Hybrid"];
const TEST_TYPES = ["CT", "DT&E", "Integration", "Regression", "V&V – Verification", "V&V – Validation"];
const RES_TYPES = ["Model", "Simulation", "Federation", "HWIL Rig", "Test Facility", "Instrumentation", "Reference Dataset"];
const VV_STATUSES = ["Not Started", "Planned", "In Progress", "Complete"];
const ACC_STATUSES = ["Not Started", "Plan Approved", "Evidence In Review", "Conditionally Accredited", "Accredited", "Not Accredited"];
const ARTIFACT_LABELS = { accPlan: "Accreditation Plan", vvPlan: "V&V Plan", vvReport: "V&V Report", accReport: "Accreditation Report" };
const DECISION_STATUSES = ["Pending", "On Track", "At Risk", "Complete"];
const EVENT_TYPES = ["Test Event", "Review", "Milestone", "Decision Point", "Delivery", "Range Window"];
const EVENT_STATUSES = ["Planned", "In Progress", "Complete", "Slipped", "Cancelled"];
const todayISO = () => new Date().toISOString().slice(0, 10);
const DEFECT_SEVERITIES = ["Critical", "Major", "Minor", "Cosmetic"];
const DEFECT_STATUSES = ["Open", "In Analysis", "Fix In Work", "Ready for Retest", "Closed", "Deferred"];

/* Last-5 run history as a dot strip (newest last). */
function runDots(caseId) {
  const runs = Store.runsOf(caseId).slice(0, 5).reverse();
  if (!runs.length) return `<span class="faint small">—</span>`;
  return `<span class="dot-strip" title="${runs.map(r => `${r.date || ""} ${r.result}`).join(" · ")}">${
    runs.map(r => `<span class="run-dot ${RUN_DOT[r.result] || "blocked"}"></span>`).join("")}</span>`;
}

/* Owning component chip, or the system for a system-level case. */
function caseOwnerChip(tc) {
  const comp = tc.componentId ? Store.get("components", tc.componentId) : null;
  if (comp) return chip("components", comp);
  const sys = tc.systemId ? Store.get("systems", tc.systemId) : null;
  return sys ? `${chip("systems", sys)} <span class="faint small">system-level</span>` : `<span class="faint">—</span>`;
}

/* Every component as a select option, in system → tree order with ↳ for nesting. */
function componentOptions(filter) {
  const out = [];
  for (const s of Store.all("systems")) {
    for (const { comp, depth } of Store.componentTree(s.id)) {
      if (filter && !filter(comp)) continue;
      out.push({ value: comp.id, code: comp.code, label: `${s.code} › ${"  ".repeat(depth)}${depth ? "↳ " : ""}${comp.code} ${comp.name}` });
    }
  }
  return out;
}

/* Evidence refs: one per line; http(s) refs become links. */
function evidenceRefs(text) {
  const refs = String(text || "").split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (!refs.length) return "";
  // A reference that is a record code (e.g. DEF-006) links to that record.
  return refs.map(r => {
    if (/^https?:\/\//i.test(r)) return `<a class="ev-ref" href="${esc(r)}" target="_blank" rel="noopener noreferrer">${esc(r.replace(/^https?:\/\//i, "").slice(0, 40))}</a>`;
    const hit = /^[A-Z]+-\d+$/.test(r) ? Store.byCode(r) : null;
    return hit && ROUTE_OF[hit.coll] ? `<a class="ev-ref" href="${ROUTE_OF[hit.coll](hit.entity.id)}">${esc(r)}</a>` : `<span class="ev-ref">${esc(r)}</span>`;
  }).join("");
}

function parseNum(s) {
  const m = String(s || "").replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

/* Measured-vs-threshold margin bar. Renders nothing when unparseable. */
function marginBar(req, measured) {
  const thr = parseNum(req.threshold), mv = parseNum(measured);
  if (thr == null || mv == null) return "";
  const obj = parseNum(req.objective);
  const lessBetter = /≤|<=|<|±/.test(req.threshold || "");
  const ok = lessBetter ? mv <= thr : mv >= thr;
  const max = Math.max(thr, mv, obj || 0) * 1.15 || 1;
  const pct = v => Math.min(100, (v / max) * 100).toFixed(1);
  return `<div class="margin-bar" title="measured ${esc(measured)} · threshold ${esc(req.threshold)}${req.objective ? ` · objective ${esc(req.objective)}` : ""}">
      <span class="mb-fill ${ok ? "ok" : "bad"}" style="width:${pct(mv)}%"></span>
      <span class="mb-thr" style="left:${pct(thr)}%"></span>
      ${obj != null ? `<span class="mb-obj" style="left:${pct(obj)}%"></span>` : ""}
    </div>
    <div class="mb-caption">${esc(measured)} vs ${esc(req.threshold)}</div>`;
}

/* Risk score movement since creation. */
function riskTrend(r) {
  const cur = Store.riskScore(r);
  const init = (r.initialLikelihood || r.likelihood) * (r.initialImpact || r.impact);
  if (cur > init) return `<span class="trend-up" title="worsened from ${init}">▲ +${cur - init}</span>`;
  if (cur < init) return `<span class="trend-down" title="improved from ${init}">▼ −${init - cur}</span>`;
  return `<span class="trend-flat" title="unchanged since opened">—</span>`;
}

/* External (Jira/Zephyr) issue-key tag; links out when a Jira base URL is set. */
function extKeyTag(key) {
  if (!key) return `<span class="faint">—</span>`;
  const base = safeHttp((Store.db.meta.jiraBaseUrl || '').trim());
  return externalLink(base ? base.replace(/\/+$/, '') + '/browse/' + encodeURIComponent(key) : '', key);
}

/* Bottom-of-page external links: paste a full Jira/Zephyr/share URL to jump out. */
function extLinksPanel(coll, entity) {
  const links = entity.extLinks || [];
  const shortLabel = l => {
    if (l.label) return l.label;
    try {
      const u = new URL(l.url);
      const tail = u.pathname.split("/").filter(Boolean).pop() || "";
      return `${u.host}${tail ? " / " + tail : ""}`.slice(0, 48);
    } catch (e) { return l.url.slice(0, 48); }
  };
  const chipsHtml = links.map((l, i) => `
    <span style="display:inline-flex;align-items:center;gap:4px;margin:2px 6px 2px 0">
      ${externalLink(l.url, "↗ " + shortLabel(l))}
      ${actBtn("✕", "del-extlink", String(i), `data-coll="${coll}" data-entity="${entity.id}"`, true, "btn-xs")}
    </span>`).join("");
  return `
    <div class="panel">
      <div class="panel-head"><h2>External Links — Jira / Zephyr / Share</h2></div>
      <div class="panel-body">
        <div style="margin-bottom:${links.length ? "10px" : "0"}">${chipsHtml || ""}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input type="text" id="extlink-url" placeholder="Paste the link address here (https://…)" autocomplete="off"
            style="flex:2;min-width:260px;background:var(--bg-0);border:1px solid var(--line);border-radius:4px;color:var(--ink);padding:8px 10px;font-family:var(--mono);font-size:12px;outline:none">
          <input type="text" id="extlink-label" placeholder="Label (optional)" autocomplete="off"
            style="flex:1;min-width:140px;background:var(--bg-0);border:1px solid var(--line);border-radius:4px;color:var(--ink);padding:8px 10px;font-size:12px;outline:none">
          ${actBtn("+ Add Link", "add-extlink", entity.id, `data-coll="${coll}"`, false)}
        </div>
      </div>
    </div>`;
}

/* Change-log panel for an entity's detail page. */
function auditPanel(entityId) {
  const entries = Store.auditOf(entityId).slice(-10).reverse();
  if (!entries.length) return "";
  return panel("Change Log", `<div class="crit-list">${entries.map(a => `
    <div class="note-item">
      <span class="note-date">${esc(a.ts)}</span>
      <span class="note-text small">${esc(a.action)}${a.summary ? ` — ${esc(a.summary)}` : ""}</span>
    </div>`).join("")}</div>`, "", true);
}

/* Honest pace projection for a plan window. */
function planPaceStrip(p) {
  const total = (p.caseIds || []).length;
  if (!total || !p.start || ["Complete", "Closed"].includes(p.status)) return "";
  const c = planCounts(p);
  const today = todayISO();
  if (today < p.start) return "";
  if (!c.pass) return `<div class="pace-strip na">PACE — no passing cases yet; cannot project completion</div>`;
  const weeks = Math.max((new Date(today) - new Date(p.start)) / (7 * 86400000), 0.15);
  const pace = c.pass / weeks;
  const remaining = total - c.pass;
  if (!remaining) return `<div class="pace-strip ok">PACE — all ${total} cases passing</div>`;
  const daysNeeded = Math.ceil((remaining / pace) * 7);
  const projected = new Date(new Date(today).getTime() + daysNeeded * 86400000).toISOString().slice(0, 10);
  const delta = p.end ? Math.round((new Date(projected) - new Date(p.end)) / 86400000) : null;
  const verdict = delta == null ? "" : delta <= 0 ? ` — ${-delta} days of margin vs window end` : ` — ${delta} DAYS LATE vs window end ${p.end}`;
  return `<div class="pace-strip ${delta != null && delta > 0 ? "late" : "ok"}">
    PACE — ${pace.toFixed(1)} passes/week over ${weeks.toFixed(1)} wks · ${remaining} of ${total} remaining · projected complete ${projected}${verdict}
  </div>`;
}

/* Measured-value history chart for one case against a requirement. */
function measuredTrendChart(req, tc) {
  const runs = Store.runsOf(tc.id).slice().reverse(); // oldest → newest
  const pts = runs.map(r => ({ v: parseNum(r.measured), r })).filter(p => p.v != null);
  if (pts.length < 2) return "";
  const thr = parseNum(req.threshold), obj = parseNum(req.objective);
  const w = 280, h = 84, padL = 6, padR = 6, padT = 8, padB = 16;
  const all = pts.map(p => p.v).concat(thr != null ? [thr] : [], obj != null ? [obj] : []);
  const min = Math.min(...all), max = Math.max(...all);
  const span = (max - min) || 1;
  const x = i => padL + (i / (pts.length - 1)) * (w - padL - padR);
  const y = v => padT + (1 - (v - min) / span) * (h - padT - padB);
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const dots = pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5" fill="${p.r.result === "Pass" ? "#4cc38a" : p.r.result === "Fail" ? "#ff6369" : "#ff8b3e"}"><title>${esc(p.r.code)} ${esc(p.r.date || "")}: ${esc(p.r.measured)}</title></circle>`).join("");
  const hline = (v, color, label) => v == null ? "" :
    `<line x1="${padL}" y1="${y(v).toFixed(1)}" x2="${w - padR}" y2="${y(v).toFixed(1)}" stroke="${color}" stroke-width="1.5" stroke-dasharray="4 3"/>
     <text x="${w - padR}" y="${(y(v) - 3).toFixed(1)}" fill="${color}" font-size="8" text-anchor="end" font-family="monospace">${esc(label)}</text>`;
  return `<div class="mt-chart">
    <div class="mt-title">${esc(tc.code)} — measured trend (${pts.length} runs)</div>
    <svg width="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display:block">
      ${hline(thr, "#ffb224", "threshold")}${hline(obj, "#52a9ff", "objective")}
      <polyline points="${line}" fill="none" stroke="#8b98a5" stroke-width="1.5"/>
      ${dots}
    </svg>
  </div>`;
}

/* Tiny sparkline SVG for snapshot series. */
function sparkline(values, color, w = 180, h = 34) {
  if (values.length < 2) return "";
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) =>
    `${((i / (values.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`).join(" ");
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

const Views = {};

/* Result buckets for a set of runs (null = not run). `blocked` covers Blocked and In Progress. */
function resultCounts(runs) {
  const counts = { pass: 0, fail: 0, blocked: 0, open: 0, waived: 0, removal: 0 };
  for (const run of runs) {
    if (!run) counts.open++;
    else if (run.result === "Pass") counts.pass++;
    else if (run.result === "Fail") counts.fail++;
    else if (run.result === "Waived") counts.waived++;
    else if (run.result === "Review for Removal") counts.removal++;
    else counts.blocked++;
  }
  return counts;
}

function planCounts(plan) {
  return resultCounts((plan.caseIds || []).map(id => Store.latestRun(id)));
}

const COMP_ST_SLUG = { "Passing": "passing", "Failing": "failing", "In Test": "intest", "Untested": "untested" };

function renderCritList(list) {
  return list.length ? `<div class="crit-list">${list.map(c => `
    <div class="crit ${c.status === "met" ? "met" : ""}">
      <button class="crit-toggle ${c.status}" data-act="cycle-crit" data-id="${c.id}" title="Click to cycle: Open → Met → Waived">${{ open: "○ Open", met: "✓ Met", waived: "◐ Waived" }[c.status]}</button>
      <span class="crit-text">${esc(c.text)}</span>
      <span class="inline-actions">${actBtn("✎", "edit-crit", c.id, "", true, "btn-xs")}${actBtn("✕", "del-crit", c.id, "", true, "btn-xs")}</span>
    </div>`).join("")}</div>` : emptyMsg("None defined");
}

function notFound(kind) {
  return `<div class="empty" style="padding:60px">${esc(kind)} not found — it may have been deleted.<br><br><a href="#/dashboard">Back to dashboard</a></div>`;
}

/* ============================================================
   Actions — CRUD wiring
   ============================================================ */

const Actions = {
  /* ---- external links ---- */
  "add-extlink": (id, el) => {
    const coll = el.dataset.coll;
    const urlEl = document.getElementById("extlink-url");
    const labelEl = document.getElementById("extlink-label");
    const url = urlEl ? urlEl.value.trim() : "";
    if (!url) { Toast.show("Paste a link address first", true); if (urlEl) urlEl.focus(); return; }
    const entity = Store.get(coll, id);
    if (!safeHttp(url)) throw new Error('Enter a full HTTP(S) URL. File paths belong in Documents and remain text references.');
    const links = (entity.extLinks || []).concat([{ url, label: labelEl ? labelEl.value.trim() : "" }]);
    Store.update(coll, id, { extLinks: links });
    Toast.show("Link added");
    App.render();
  },
  "del-extlink": (idx, el) => {
    const entity = Store.get(el.dataset.coll, el.dataset.entity);
    const links = (entity.extLinks || []).slice();
    links.splice(Number(idx), 1);
    Store.update(el.dataset.coll, el.dataset.entity, { extLinks: links });
    Toast.show("Link removed");
    App.render();
  },

};

/* ---------- form field definitions ---------- */
/* Owning system of a record; no default here, so editing never silently assigns one. */
function ownerField() {
  return { key: "systemId", label: "Owning System (blank = program-level / shared)", type: "select", half: true, allowEmpty: true,
    options: Store.all("systems").map(s => ({ value: s.id, label: `${s.code} ${s.name}` })) };
}
/* New records default to the system currently in scope. */
function ownerDefault(values) { return Object.assign({ systemId: Scope.system }, values || {}); }

