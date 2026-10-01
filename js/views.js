/* ============================================================
   Views — page renderers + user actions
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
  return refs.map(r => /^https?:\/\//i.test(r)
    ? `<a class="ev-ref" href="${esc(r)}" target="_blank" rel="noopener noreferrer">${esc(r.replace(/^https?:\/\//i, "").slice(0, 40))}</a>`
    : `<span class="ev-ref">${esc(r)}</span>`).join("");
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

/* ================= DASHBOARD ================= */
Views.dashboard = function () {
  const reqs = Store.all("requirements");
  const cases = Store.all("cases");
  const runs = Store.all("runs");
  const risks = Store.all("risks").filter(r => r.status !== "Closed");

  const reqRoll = { verified: 0, failing: 0, covered: 0, uncovered: 0 };
  reqs.forEach(r => reqRoll[Store.reqStatus(r.id)]++);

  const runCounts = { pass: 0, fail: 0, blocked: 0, open: 0 };
  cases.forEach(tc => {
    const run = Store.latestRun(tc.id);
    if (!run) runCounts.open++;
    else if (run.result === "Pass") runCounts.pass++;
    else if (run.result === "Fail") runCounts.fail++;
    else runCounts.blocked++;
  });

  const highRisks = risks.filter(r => Store.riskScore(r) >= 10);
  const coveragePct = reqs.length ? Math.round(((reqRoll.verified + reqRoll.covered + reqRoll.failing) / reqs.length) * 100) : 0;
  const verifiedPct = reqs.length ? Math.round((reqRoll.verified / reqs.length) * 100) : 0;

  const recentRuns = runs.slice().sort((a, b) => Store.compareRuns(a, b)).slice(0, 6);

  const planRows = Store.all("plans").map(p => {
    const c = planCounts(p);
    const total = p.caseIds.length;
    return `<tr>
      <td>${codeLink("plans", p)}</td>
      <td><a href="#/plans/${p.id}">${esc(p.name)}</a></td>
      <td>${badge(p.status)}</td>
      <td style="min-width:160px">${progressMeter(c)}</td>
      <td class="num">${c.pass}/${total} pass</td>
    </tr>`;
  }).join("");

  const riskRows = risks
    .slice().sort((a, b) => Store.riskScore(b) - Store.riskScore(a)).slice(0, 5)
    .map(r => {
      const s = Store.riskScore(r), band = Store.riskBand(s);
      return `<tr>
        <td>${codeLink("risks", r)}</td>
        <td><a href="#/risks/${r.id}">${esc(r.title)}</a></td>
        <td><span class="score-pill band-${band}" style="font-size:13px;padding:2px 9px">${s}</span></td>
        <td>${badge(r.status)}</td>
      </tr>`;
    }).join("");

  return `
    ${pageHead([{ label: "Dashboard" }], esc(Store.db.meta.program || "T&E Program"),
      `<a class="btn btn-ghost btn-sm" href="#/sitrep">⎙ Weekly SITREP</a>`,
      "Program-level status: requirement verification, execution progress, and top risks.")}
    <div class="kpi-row">
      <div class="kpi" style="--kpi-accent:var(--blue)">
        <div class="kpi-label">Requirements Verified</div>
        <div class="kpi-value">${verifiedPct}<small>%</small></div>
        <div class="kpi-foot">${reqRoll.verified} of ${reqs.length} · ${coveragePct}% have coverage</div>
      </div>
      <div class="kpi" style="--kpi-accent:var(--green)">
        <div class="kpi-label">Test Case Pass</div>
        <div class="kpi-value">${runCounts.pass}<small>/${cases.length}</small></div>
        <div class="kpi-foot">${runCounts.fail} failing · ${runCounts.open} not yet run</div>
      </div>
      <div class="kpi" style="--kpi-accent:var(--amber)">
        <div class="kpi-label">Test Runs Logged</div>
        <div class="kpi-value">${runs.length}</div>
        <div class="kpi-foot">latest ${esc(recentRuns[0] ? recentRuns[0].date : "—")}</div>
      </div>
      <div class="kpi" style="--kpi-accent:var(--red)">
        <div class="kpi-label">High / Critical Risks</div>
        <div class="kpi-value">${highRisks.length}<small>/${risks.length} open</small></div>
        <div class="kpi-foot"><a href="#/risks">view risk matrix →</a></div>
      </div>
    </div>
    <div class="countdown-row">
      ${Store.all("decisions").filter(d => d.status !== "Complete" && d.date)
        .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3).map(d => {
          const days = Math.ceil((new Date(d.date + "T12:00") - new Date(todayISO() + "T12:00")) / 86400000);
          const ready = Store.decisionReadiness(d);
          return `<a class="cd-tile" href="#/decisions/${d.id}">
            <div class="cd-days">${days >= 0 ? days : 0}<small> days</small></div>
            <div class="cd-title"><span class="code">${esc(d.code)}</span> ${esc(d.title)}</div>
            <div class="cd-meta">${esc(d.date)} ${badge(d.status)} ${ready ? `<span>${ready.verified}/${ready.total} measures verified</span>` : ""}</div>
          </a>`;
        }).join("")}
      ${(() => {
        const open = Store.openDefects();
        const crit = open.filter(d => d.severity === "Critical" || d.severity === "Major").length;
        return `<a class="cd-tile" href="#/defects" style="border-left:3px solid ${crit ? "var(--red)" : "var(--line)"}">
          <div class="cd-days">${open.length}<small> open defects</small></div>
          <div class="cd-title">Defect backlog</div>
          <div class="cd-meta">${crit} critical/major · ${Store.all("defects").length - open.length} closed</div>
        </a>`;
      })()}
    </div>
    <div class="grid-2">
      <div>
        ${panel("Test Plans", planRows
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Plan</th><th>Status</th><th>Progress</th><th></th></tr></thead><tbody>${planRows}</tbody></table></div>`
          : emptyMsg("No test plans yet"), "", true)}
        ${panel("Upcoming Events", (() => {
          const today = todayISO();
          const upcoming = Store.all("events")
            .filter(ev => ev.status !== "Complete" && ev.status !== "Cancelled" && (ev.end || ev.start || "") >= today)
            .sort((a, b) => (a.start || "").localeCompare(b.start || "")).slice(0, 4);
          if (!upcoming.length) return `<span class="faint small">Nothing on the schedule — add events under Schedule.</span>`;
          return upcoming.map(ev => `<div style="margin-bottom:6px"><span class="mono faint">${esc(ev.start)}</span> ${chip("events", ev, ev.title)} ${badge(ev.type)}</div>`).join("");
        })(), `<a class="btn btn-ghost btn-sm" href="#/schedule">All</a>`)}
        ${panel("Recent Test Runs", recentRuns.length
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Run</th><th>Test Case</th><th>Result</th><th>Date</th></tr></thead><tbody>${
              recentRuns.map(r => {
                const tc = Store.get("cases", r.caseId);
                return `<tr><td><span class="code">${esc(r.code)}</span>${r.extKey ? `<div style="font-size:9.5px;margin-top:1px">${extKeyTag(r.extKey)}</div>` : ""}</td><td>${tc ? chip("cases", tc) : "—"}</td><td>${badge(r.result)}</td><td class="num">${esc(r.date || "")}</td></tr>`;
              }).join("")
            }</tbody></table></div>`
          : emptyMsg("No runs recorded"), "", true)}
      </div>
      <div>
        ${panel("Top Open Risks", riskRows
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Risk</th><th>Score</th><th>Status</th></tr></thead><tbody>${riskRows}</tbody></table></div>`
          : emptyMsg("No open risks"), `<a class="btn btn-ghost btn-sm" href="#/risks">Matrix</a>`, true)}
        ${panel("Progress Trend", (() => {
          const snaps = (Store.db.snapshots || []).slice(-30);
          if (snaps.length < 2) return `<span class="faint small">Trend appears after a couple of days of use — a snapshot of pass counts and verified requirements is taken once per day.</span>`;
          const last = snaps[snaps.length - 1];
          return `<div class="spark-wrap">
            <div>${sparkline(snaps.map(s => s.pass), "#4cc38a")}${sparkline(snaps.map(s => s.verified), "#52a9ff")}${sparkline(snaps.map(s => s.defOpen || 0), "#ff6369")}</div>
            <div class="spark-legend">
              <span><span class="sw" style="background:#4cc38a"></span>cases passing (now ${last.pass})</span>
              <span><span class="sw" style="background:#52a9ff"></span>reqs verified (now ${last.verified}/${last.reqTotal})</span>
              <span><span class="sw" style="background:#ff6369"></span>open defects (now ${last.defOpen != null ? last.defOpen : "—"})</span>
              <span class="faint">${snaps.length} daily snapshots</span>
            </div>
          </div>`;
        })())}
        ${panel("M&S VV&A Status", (() => {
          const assets = Store.all("resources").filter(r => r.vvaRequired);
          if (!assets.length) return `<span class="faint small">No M&S assets registered — add them under M&S / VV&A.</span>`;
          return `<div class="table-scroll"><table class="data"><thead><tr><th>Asset</th><th>Ver</th><th>Val</th><th>Accreditation</th></tr></thead><tbody>${
            assets.map(r => `<tr><td>${chip("resources", r)}</td><td>${badge(r.verification)}</td><td>${badge(r.validation)}</td><td>${badge(r.accreditation)}</td></tr>`).join("")
          }</tbody></table></div>`;
        })(), `<a class="btn btn-ghost btn-sm" href="#/resources">All</a>`, true)}
        ${panel("Requirement Verification Rollup", `
          <div class="def-grid">
            <dt>Verified</dt><dd>${badge("verified")} <b class="mono">${reqRoll.verified}</b> — every linked test case's latest run passed</dd>
            <dt>Failing</dt><dd>${badge("failing")} <b class="mono">${reqRoll.failing}</b> — at least one linked case failing</dd>
            <dt>Covered</dt><dd>${badge("covered")} <b class="mono">${reqRoll.covered}</b> — cases linked, runs pending</dd>
            <dt>No coverage</dt><dd>${badge("uncovered")} <b class="mono">${reqRoll.uncovered}</b> — no test case traces to it</dd>
          </div>`)}
      </div>
    </div>`;
};

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

/* ================= SYSTEMS ================= */
const COMP_ST_SLUG = { "Passing": "passing", "Failing": "failing", "In Test": "intest", "Untested": "untested" };

Views.systems = function () {
  const cards = Store.all("systems").map(s => {
    const comps = Store.componentsOf(s.id);
    const cases = Store.casesOfSystem(s.id);
    const sysSt = Store.systemStatus(s.id);
    const pills = Store.componentTree(s.id).map(({ comp: c, depth }) => {
      const st = Store.componentStatus(c.id);
      return `<span class="comp-pill st-${COMP_ST_SLUG[st]}${depth ? " sub" : ""}" title="${esc(c.code)} ${esc(c.name)} — ${st}${depth ? ` · subcomponent level ${depth}` : ""}">${depth ? "↳ " : ""}${esc(c.name)}</span>`;
    }).join("");
    return `<a class="sys-card" href="#/systems/${s.id}">
      <span class="sys-lamp st-${COMP_ST_SLUG[sysSt]}" title="System status: ${sysSt}"></span>
      <span class="code">${esc(s.code)}</span>
      <h3>${esc(s.name)}</h3>
      <p>${esc(s.description)}</p>
      <div class="comp-pills">${pills || `<span class="faint small">no components</span>`}</div>
      <div class="sys-stats"><span><b>${comps.length}</b> components</span><span><b>${cases.length}</b> test cases</span></div>
    </a>`;
  }).join("");
  return `
    ${pageHead([{ label: "Systems" }], "Systems",
      actBtn("+ New System", "add-system", null, "", false),
      "The system breakdown: components are organized under systems; test cases attach to components.")}
    <div class="sys-grid">${cards || emptyMsg("No systems defined")}</div>`;
};

Views.systemDetail = function (id) {
  const s = Store.get("systems", id);
  if (!s) return notFound("System");
  const compRows = Store.componentTree(id).map(({ comp: c, depth }) => {
    const cases = Store.casesOf(c.id);
    const reqs = Store.all("requirements").filter(r => (r.componentIds || []).includes(c.id));
    const openDefs = Store.defectsOfComponent(c.id).filter(d => Store.defectIsOpen(d)).length;
    return `<tr>
      <td>${codeLink("components", c)}</td>
      <td><div class="tree-cell" style="--depth:${depth}">${depth ? `<span class="tree-arrow">↳</span>` : ""}<div><a href="#/components/${c.id}">${esc(c.name)}</a>
        <div class="faint small">${depth ? `Subcomponent · level ${depth} — ` : ""}${esc(c.description)}</div></div></div></td>
      <td>${badge(Store.componentStatus(c.id))}</td>
      <td class="num">${cases.length}</td>
      <td class="num">${reqs.length}</td>
      <td class="num">${openDefs || `<span class="faint">0</span>`}</td>
      <td class="inline-actions">${actBtn("+ Sub", "add-subcomponent", c.id)}${actBtn("Edit", "edit-component", c.id)}${actBtn("Del", "del-component", c.id)}</td>
    </tr>`;
  }).join("");
  const sysCases = Store.systemLevelCases(id);
  const runs = Store.testRunsSorted(t => t.systemId === id);

  return `
    ${pageHead(
      [{ label: "Systems", href: "#/systems" }, { label: s.code }],
      `<span class="code-inline">${esc(s.code)}</span>${esc(s.name)}`,
      actBtn("Edit", "edit-system", s.id) + actBtn("Delete", "del-system", s.id) + actBtn("+ Component", "add-component", s.id) +
      actBtn("▶ Full Regression", "full-regression", s.id, "", false),
      esc(s.description))}
    ${regressionScopePanel(s)}
    ${panel("Components", compRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Component</th><th>Status</th><th>Test Cases</th><th>Reqs</th><th>Open Defects</th><th></th></tr></thead><tbody>${compRows}</tbody></table></div>`
      : emptyMsg("No components under this system yet — add one."), "", true)}
    ${sysCases.length ? panel("System-Level Test Cases", `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Title</th><th>Pri</th><th>Status</th><th>Latest Run</th></tr></thead><tbody>${sysCases.map(caseRow).join("")}</tbody></table></div>`, "", true) : ""}
    ${testRunsPanel("Test Runs for This System", runs, "No test runs yet — start a full regression above.")}`;
};

Views.componentDetail = function (id) {
  const c = Store.get("components", id);
  if (!c) return notFound("Component");
  const sys = Store.get("systems", c.systemId);
  const cases = Store.casesOf(id);
  const reqs = Store.all("requirements").filter(r => (r.componentIds || []).includes(id));
  const defects = Store.defectsOfComponent(id);
  const st = Store.componentStatus(id);

  const caseRows = cases.map(tc => caseRow(tc)).join("");
  const defRows = defects.map(d => `<tr>
    <td>${codeLink("defects", d)}</td>
    <td><a href="#/defects/${d.id}">${esc(d.title)}</a></td>
    <td>${badge(d.severity)}</td>
    <td>${badge(d.status)}</td>
  </tr>`).join("");

  const ancestors = Store.ancestorIds(id).map(a => Store.get("components", a));
  const children = Store.childrenOf(id);
  const depth = ancestors.length;
  const childRows = children.map(ch => `<tr>
    <td>${codeLink("components", ch)}</td>
    <td><a href="#/components/${ch.id}">${esc(ch.name)}</a></td>
    <td>${badge(Store.componentStatus(ch.id))}</td>
    <td class="num">${Store.casesOf(ch.id).length}</td>
    <td class="num">${Store.descendantIds(ch.id).size - 1}</td>
  </tr>`).join("");

  return `
    ${pageHead(
      [{ label: "Systems", href: "#/systems" }, { label: sys ? sys.code : "?", href: sys ? `#/systems/${sys.id}` : "#/systems" },
       ...ancestors.map(a => ({ label: a.code, href: `#/components/${a.id}` })), { label: c.code }],
      `<span class="code-inline">${esc(c.code)}</span>${esc(c.name)}`,
      actBtn("Edit", "edit-component", c.id) + actBtn("Delete", "del-component", c.id) + actBtn("+ Subcomponent", "add-subcomponent", c.id) + actBtn("+ Test Case", "add-case", c.id, "", false),
      `${badge(st)} ${badge(depth ? `Subcomponent · level ${depth}` : "Top-level component", depth ? "b-purple" : "b-blue")} &nbsp; ${esc(c.description)}`)}
    <div class="grid-2">
      <div>
        ${panel("Test Cases", caseRows
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Title</th><th>Pri</th><th>Status</th><th>Latest Run</th></tr></thead><tbody>${caseRows}</tbody></table></div>`
          : emptyMsg("No test cases for this component yet."), "", true)}
        ${panel("Subcomponents", childRows
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Subcomponent</th><th>Status</th><th>Cases</th><th>Nested</th></tr></thead><tbody>${childRows}</tbody></table></div>`
          : emptyMsg("No subcomponents."), actBtn("+ Subcomponent", "add-subcomponent", c.id), true)}
      </div>
      <div>
        ${panel("Defects", defRows
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Defect</th><th>Severity</th><th>Status</th></tr></thead><tbody>${defRows}</tbody></table></div>`
          : emptyMsg("No defects recorded against this component."), actBtn("+ Defect", "add-defect-comp", c.id), true)}
        ${panel("Traced Requirements", chips("requirements", reqs, "No requirements trace to this component"))}
        ${panel("Parent", `${sys ? chip("systems", sys) : "—"}${ancestors.length ? ` › ${ancestors.map(a => chip("components", a)).join(" › ")}` : ""}`)}
      </div>
    </div>`;
};

function caseRow(tc) {
  const run = Store.latestRun(tc.id);
  return `<tr>
    <td>${codeLink("cases", tc)}</td>
    <td><a href="#/cases/${tc.id}">${esc(tc.title)}</a></td>
    <td>${badge(tc.priority)}</td>
    <td>${badge(tc.status)}</td>
    <td>${runBadge(run)}</td>
  </tr>`;
}

/* ================= REQUIREMENTS ================= */
Views.requirements = function (params) {
  const typeF = params.get("type") || "";
  const covF = params.get("cov") || "";
  let reqs = Store.all("requirements");
  if (typeF) reqs = reqs.filter(r => r.type === typeF);
  if (covF) reqs = reqs.filter(r => Store.reqStatus(r.id) === covF);

  const rows = reqs.map(r => {
    const st = Store.reqStatus(r.id);
    const cases = Store.casesOfRequirement(r.id);
    return `<tr>
      <td>${codeLink("requirements", r)}${r.extKey ? `<div class="faint mono" style="font-size:9.5px">${esc(r.extKey)}</div>` : ""}</td>
      <td><a href="#/requirements/${r.id}">${esc(r.title)}</a><div class="faint small">${esc(r.text)}</div></td>
      <td>${badge(r.type)}</td>
      <td>${r.measure && r.measure !== "None" ? badge(r.measure) : `<span class="faint small">—</span>`}</td>
      <td>${badge(r.priority)}</td>
      <td>${badge(r.method, "b-grey")}</td>
      <td class="num">${cases.length}</td>
      <td>${badge(st)}</td>
    </tr>`;
  }).join("");

  return `
    ${pageHead([{ label: "Requirements" }], "Requirements",
      actBtn("+ New Requirement", "add-requirement", null, "", false),
      "Every requirement is traced to components and verified by test cases. Rollup status reflects the latest run of each linked case.")}
    <div class="filter-bar">
      <select data-filter="type"><option value="">All types</option>${REQ_TYPES.map(t => `<option ${typeF === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      <select data-filter="cov">
        <option value="">All statuses</option>
        <option value="verified" ${covF === "verified" ? "selected" : ""}>Verified</option>
        <option value="failing" ${covF === "failing" ? "selected" : ""}>Failing</option>
        <option value="covered" ${covF === "covered" ? "selected" : ""}>Covered</option>
        <option value="uncovered" ${covF === "uncovered" ? "selected" : ""}>No coverage</option>
      </select>
      <span class="faint mono small">${reqs.length} shown</span>
    </div>
    ${panel("Register", rows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Requirement</th><th>Type</th><th>Measure</th><th>Pri</th><th>Method</th><th>Cases</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No requirements match the filter."), "", true)}`;
};

Views.requirementDetail = function (id) {
  const r = Store.get("requirements", id);
  if (!r) return notFound("Requirement");
  const comps = (r.componentIds || []).map(cid => Store.get("components", cid)).filter(Boolean);
  const cases = Store.casesOfRequirement(id);
  const risks = Store.risksOfRequirement(id);
  const st = Store.reqStatus(id);

  return `
    ${pageHead(
      [{ label: "Requirements", href: "#/requirements" }, { label: r.code }],
      `<span class="code-inline">${esc(r.code)}</span>${esc(r.title)}`,
      actBtn("Edit", "edit-requirement", r.id) + actBtn("Delete", "del-requirement", r.id),
      "")}
    <div class="grid-2">
      <div>
        ${panel("Requirement Text", `<p style="margin:0;font-size:14.5px">${esc(r.text)}</p>
          <div class="section-gap"></div>
          <dl class="def-grid">
            <dt>Type</dt><dd>${badge(r.type)}</dd>
            <dt>Measure</dt><dd>${r.measure && r.measure !== "None" ? badge(r.measure) : `<span class="faint">—</span>`}</dd>
            ${r.threshold ? `<dt>Threshold</dt><dd class="mono">${esc(r.threshold)}</dd>` : ""}
            ${r.objective ? `<dt>Objective</dt><dd class="mono">${esc(r.objective)}</dd>` : ""}
            <dt>Priority</dt><dd>${badge(r.priority)}</dd>
            <dt>Verification</dt><dd>${badge(r.method, "b-grey")}</dd>
            <dt>Rollup Status</dt><dd>${badge(st)}</dd>
            <dt>Jira Key</dt><dd>${extKeyTag(r.extKey)}</dd>
          </dl>`)}
        ${panel("Traced Components", chips("components", comps, "Not yet allocated to a component"))}
        ${risks.length ? panel("Related Risks", chips("risks", risks)) : ""}
      </div>
      <div>
        ${panel("Verifying Test Cases & Evidence", cases.length
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Title</th><th>Status</th><th>Latest Run</th><th>Measured vs Threshold</th></tr></thead><tbody>${
              cases.map(tc => {
                const run = Store.latestRun(tc.id);
                const measuredCell = run && run.measured
                  ? (marginBar(r, run.measured) || `<span class="mono small">${esc(run.measured)}</span>`)
                  : `<span class="faint small">no measured value</span>`;
                return `<tr><td>${codeLink("cases", tc)}</td><td><a href="#/cases/${tc.id}">${esc(tc.title)}</a></td><td>${badge(tc.status)}</td><td>${runBadge(run)}</td><td style="min-width:150px">${measuredCell}</td></tr>`;
              }).join("")
            }</tbody></table></div>
            <div style="padding:6px 12px 10px" class="faint small mono">▮ measured &nbsp;|&nbsp; <span style="color:var(--amber)">▏threshold</span> &nbsp;<span style="color:var(--blue)">▏objective</span></div>`
          : emptyMsg("No test case verifies this requirement — coverage gap."), "", true)}
        ${(() => {
          const charts = cases.map(tc => measuredTrendChart(r, tc)).filter(Boolean);
          return charts.length ? panel("Measured History vs Threshold", charts.join("")) : "";
        })()}
        ${auditPanel(r.id)}
      </div>
    </div>`;
};

/* ================= TEST CASES ================= */
Views.cases = function (params) {
  const compF = params.get("component") || "";
  const statF = params.get("status") || "";
  const planF = params.get("plan") || "";
  const procF = params.get("procedure") || "";
  const reviewF = params.get("review") || "";
  let cases = Store.all("cases");
  if (compF) { const branch = Store.descendantIds(compF); cases = cases.filter(tc => branch.has(tc.componentId)); }
  if (statF) cases = cases.filter(tc => tc.status === statF);
  if (procF) cases = cases.filter(tc => tc.procedureId === procF);
  if (reviewF) cases = cases.filter(tc => tc.removalNominated);
  if (planF) {
    const plan = Store.get("plans", planF);
    const ids = new Set(plan ? plan.caseIds : []);
    cases = cases.filter(tc => ids.has(tc.id));
  }

  const rows = cases.map(tc => {
    const comp = Store.get("components", tc.componentId);
    const proc = tc.procedureId ? Store.get("procedures", tc.procedureId) : null;
    const plans = Store.plansOf(tc.id);
    return `<tr>
      <td class="bulk-cell"><input type="checkbox" data-bulk="${tc.id}"></td>
      <td>${codeLink("cases", tc)}${tc.extKey ? `<div class="faint mono" style="font-size:9.5px">${esc(tc.extKey)}</div>` : ""}</td>
      <td><a href="#/cases/${tc.id}">${esc(tc.title)}</a>${tc.removalNominated ? ` ${badge("Review for Removal")}` : ""}</td>
      <td>${proc ? codeLink("procedures", proc) : `<span class="faint small">—</span>`}</td>
      <td>${caseOwnerChip(tc)}</td>
      <td>${plans.map(p => codeLink("plans", p)).join(" ") || `<span class="faint small">—</span>`}</td>
      <td><button class="badge-btn" data-act="cycle-case-status" data-id="${tc.id}" title="Click to cycle status">${badge(tc.status)}</button></td>
      <td>${runDots(tc.id)}</td>
      <td>${runBadge(Store.latestRun(tc.id))}</td>
    </tr>`;
  }).join("");
  const nominated = Store.all("cases").filter(tc => tc.removalNominated).length;

  return `
    ${pageHead([{ label: "Test Cases" }], "Test Cases",
      actBtn("+ New Test Case", "add-case", null, "", false),
      "Procedures spawn test cases; test cases roll up into test plans; runs record each execution of a case.")}
    <div class="filter-bar">
      <select data-filter="procedure"><option value="">All procedures</option>${Store.all("procedures").map(p => `<option value="${p.id}" ${procF === p.id ? "selected" : ""}>${esc(p.code)} ${esc(p.title)}</option>`).join("")}</select>
      <select data-filter="component"><option value="">All components</option>${componentOptions().map(o => `<option value="${o.value}" ${compF === o.value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>
      <select data-filter="status"><option value="">All statuses</option>${CASE_STATUSES.map(s => `<option ${statF === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      <select data-filter="plan"><option value="">All plans</option>${Store.all("plans").map(p => `<option value="${p.id}" ${planF === p.id ? "selected" : ""}>${esc(p.code)} ${esc(p.name)}</option>`).join("")}</select>
      <select data-filter="review"><option value="">All cases</option><option value="1" ${reviewF ? "selected" : ""}>Review queue — nominated for removal (${nominated})</option></select>
      <span class="faint mono small">${cases.length} shown</span>
    </div>
    ${panel("Catalog", rows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th class="bulk-cell"><input type="checkbox" data-bulk-all title="Select all shown"></th><th>Code</th><th>Title</th><th>Procedure</th><th>Component</th><th>Plans</th><th>Status</th><th>History</th><th>Latest Run</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No test cases match the filter."), "", true)}
    <div id="bulk-bar">
      <span class="bulk-count">0 selected</span>
      ${actBtn("Assign to Plan…", "bulk-assign-plan", null, "", false, "btn-sm")}
      ${actBtn("Set Status…", "bulk-status", null, "", true, "btn-sm")}
      ${actBtn("Clear", "bulk-clear", null, "", true, "btn-sm")}
    </div>`;
};

Views.caseDetail = function (id) {
  const tc = Store.get("cases", id);
  if (!tc) return notFound("Test case");
  const comp = Store.get("components", tc.componentId);
  const sys = comp ? Store.get("systems", comp.systemId) : null;
  const proc = tc.procedureId ? Store.get("procedures", tc.procedureId) : null;
  const reqs = (tc.requirementIds || []).map(rid => Store.get("requirements", rid)).filter(Boolean);
  const plans = Store.plansOf(id);
  const risks = Store.risksOfCase(id);
  const runs = Store.runsOf(id);
  const resources = Store.resourcesOf(tc);
  const unaccredited = Store.unaccreditedAssets(tc);

  const defects = Store.defectsOfCase(id);
  const ownerSys = !comp && tc.systemId ? Store.get("systems", tc.systemId) : null;
  const specRows = [["Preconditions", "preconditions"], ["Test Data", "testData"], ["Expected Results", "expectedResults"], ["Pass / Fail Criteria", "passFailCriteria"]]
    .filter(([, k]) => tc[k]).map(([label, k]) => `<dt>${label}</dt><dd style="white-space:pre-wrap">${esc(tc[k])}</dd>`).join("");

  const runRows = runs.map(r => {
    const plan = r.planId ? Store.get("plans", r.planId) : null;
    const trun = r.testRunId ? Store.get("testRuns", r.testRunId) : null;
    return `<tr>
      <td><span class="code">${esc(r.code)}</span>${r.extKey ? `<div style="font-size:9.5px;margin-top:1px">${extKeyTag(r.extKey)}</div>` : ""}</td>
      <td class="num">${esc(r.date || "")}</td>
      <td>${badge(r.result)}</td>
      <td class="small">${r.measured ? `<span class="mono">${esc(r.measured)}</span>` : `<span class="faint">—</span>`}</td>
      <td>${esc(r.operator || "")}</td>
      <td>${plan ? codeLink("plans", plan) : "—"}${trun ? `<div>${testRunLink(trun)}</div>` : ""}</td>
      <td class="small">${esc(r.notes || "")}${r.evidence ? `<div>${evidenceRefs(r.evidence)}</div>` : ""}</td>
      <td class="inline-actions">${actBtn("Edit", "edit-run", r.id)}${actBtn("Del", "del-run", r.id)}</td>
    </tr>`;
  }).join("");

  const crumbs = proc
    ? [{ label: "Procedures", href: "#/procedures" }, { label: proc.code, href: `#/procedures/${proc.id}` }, { label: tc.code }]
    : [{ label: "Test Cases", href: "#/cases" }, { label: tc.code }];

  return `
    ${pageHead(
      crumbs,
      `<span class="code-inline">${esc(tc.code)}</span>${esc(tc.title)}`,
      actBtn("Edit", "edit-case", tc.id) + actBtn("Delete", "del-case", tc.id) + actBtn("Assign to Plan", "assign-plan", tc.id) + actBtn("⚑ Defect", "add-defect-case", tc.id) + actBtn("● Record Run", "record-run", tc.id) +
      (proc ? `<a class="btn" href="#/execute/${tc.id}">▶ Execute</a>` : ""),
      tc.extKey ? `Issue: ${extKeyTag(tc.extKey)}` : "")}
    <div class="grid-2">
      <div>
        ${panel("Objective", `<p style="margin:0">${esc(tc.objective || "")}</p>
          <div class="section-gap"></div>
          <dl class="def-grid">
            <dt>Priority</dt><dd>${badge(tc.priority)}</dd>
            <dt>Status</dt><dd>${badge(tc.status)}</dd>
            <dt>Venue</dt><dd>${tc.venue ? badge(tc.venue) : `<span class="faint">—</span>`}</dd>
            <dt>Test Type</dt><dd>${tc.testType ? badge(tc.testType) : `<span class="faint">—</span>`}</dd>
            <dt>System</dt><dd>${(sys || ownerSys) ? chip("systems", sys || ownerSys) : "—"}</dd>
            <dt>Component</dt><dd>${comp ? chip("components", comp) : `<span class="faint small">System-level case</span>`}</dd>
            <dt>Procedure</dt><dd>${proc ? chip("procedures", proc) : `<span class="faint small">No procedure assigned</span>`}</dd>
          </dl>
          ${specRows ? `<div class="section-gap"></div><dl class="def-grid">${specRows}</dl>` : ""}`)}
        ${unaccredited.length ? `<div class="ready-strip nogo"><span class="lamp"></span>
          DATA CREDIBILITY CAVEAT — USES M&amp;S ASSET${unaccredited.length > 1 ? "S" : ""} NOT YET ACCREDITED: ${unaccredited.map(r => esc(r.code)).join(", ")}
        </div>` : ""}
        ${panel("Resources / M&S Assets", resources.length
          ? resources.map(r => `<div style="margin-bottom:6px">${chip("resources", r)} ${badge(r.accreditation)}${r.vvaRequired ? "" : ` <span class="faint small">VV&A not required</span>`}</div>`).join("")
          : `<span class="faint small">No resources linked</span>`)}
        ${panel("Verifies Requirements", chips("requirements", reqs, "No requirement linked — this case verifies nothing"))}
        ${panel("Assigned Plans", chips("plans", plans, "Not assigned to any test plan"))}
        ${risks.length ? panel("Related Risks", chips("risks", risks)) : ""}
        ${defects.length ? panel("Defects", defects.map(d => `<div style="margin-bottom:5px">${chip("defects", d)} ${badge(d.severity)} ${badge(d.status)}</div>`).join("")) : ""}
        ${auditPanel(tc.id)}
      </div>
      <div>
        ${removalPanel(tc)}
        ${panel("Run History", runRows
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Run</th><th>Date</th><th>Result</th><th>Measured</th><th>Operator</th><th>Plan / Test Run</th><th>Notes / Evidence</th><th></th></tr></thead><tbody>${runRows}</tbody></table></div>`
          : emptyMsg("Never executed. Record the first run."), "", true)}
      </div>
    </div>
    ${extLinksPanel("cases", tc)}`;
};

/* ================= TRACEABILITY MATRIX ================= */
Views.trace = function (params) {
  const sysF = params.get("system") || "";
  const gapsOnly = params.get("gaps") === "1";

  // columns: cases grouped by system → component order
  const systems = sysF ? Store.all("systems").filter(s => s.id === sysF) : Store.all("systems");
  const groups = [];
  for (const s of systems) {
    const cases = [];
    for (const { comp } of Store.componentTree(s.id)) cases.push(...Store.casesOf(comp.id));
    cases.push(...Store.systemLevelCases(s.id));
    if (cases.length) groups.push({ system: s, cases });
  }
  const allCases = groups.flatMap(g => g.cases);
  const shownCaseIds = new Set(allCases.map(tc => tc.id));

  // rows: requirements traced to shown scope (or all, when unfiltered)
  let reqs = Store.all("requirements");
  if (sysF) {
    const compIds = new Set(Store.componentsOf(sysF).map(c => c.id));
    reqs = reqs.filter(r =>
      (r.componentIds || []).some(cid => compIds.has(cid)) ||
      Store.casesOfRequirement(r.id).some(tc => shownCaseIds.has(tc.id)));
  }
  if (gapsOnly) reqs = reqs.filter(r => Store.reqStatus(r.id) === "uncovered");

  const covered = reqs.filter(r => Store.reqStatus(r.id) !== "uncovered").length;

  // header rows (with per-system requirement-coverage %)
  const grpRow = groups.map(g => {
    const compSet = new Set(Store.componentsOf(g.system.id).map(c => c.id));
    const sysReqs = Store.all("requirements").filter(r => (r.componentIds || []).some(c => compSet.has(c)));
    const cov = sysReqs.filter(r => Store.reqStatus(r.id) !== "uncovered").length;
    const covTxt = sysReqs.length ? ` · ${Math.round((cov / sysReqs.length) * 100)}% cov` : "";
    return `<th class="grp" colspan="${g.cases.length}"><a href="#/systems/${g.system.id}" style="color:inherit" title="${cov}/${sysReqs.length} of this system's requirements have test coverage">${esc(g.system.code)} ${esc(g.system.name)}${covTxt}</a></th>`;
  }).join("");
  const caseRow = allCases.map(tc =>
    `<th class="tc-col"><a href="#/cases/${tc.id}" title="${esc(tc.code)} — ${esc(tc.title)}">${esc(tc.code)}</a></th>`
  ).join("");

  // body
  const body = reqs.map(r => {
    const st = Store.reqStatus(r.id);
    const linked = new Set(Store.casesOfRequirement(r.id).map(tc => tc.id));
    const cells = allCases.map(tc => {
      if (!linked.has(tc.id)) return `<td class="cell"></td>`;
      const run = Store.latestRun(tc.id);
      let mark = "t-none", tip = "linked — not yet run";
      if (run) {
        if (run.result === "Pass") { mark = "t-pass"; tip = `Pass · ${run.date || ""}`; }
        else if (run.result === "Fail") { mark = "t-fail"; tip = `Fail · ${run.date || ""}`; }
        else { mark = "t-blocked"; tip = `${run.result} · ${run.date || ""}`; }
      }
      return `<td class="cell"><a href="#/cases/${tc.id}" title="${esc(tc.code)} ⇄ ${esc(r.code)} — ${esc(tip)}"><span class="tmark ${mark}"></span></a></td>`;
    }).join("");
    return `<tr class="${st === "uncovered" ? "uncovered" : ""}">
      <td class="req-col">${codeLink("requirements", r)}<span class="req-title">${esc(r.title)}</span></td>
      ${cells}
      <td class="stat-col">${badge(st)}<div class="faint mono" style="margin-top:2px">${linked.size} case${linked.size === 1 ? "" : "s"}</div></td>
    </tr>`;
  }).join("");

  const table = reqs.length && allCases.length ? `
    <div class="trace-scroll">
      <table class="trace">
        <thead>
          <tr><th class="req-col" rowspan="2">Requirement</th>${grpRow}<th class="stat-col" rowspan="2">Rollup</th></tr>
          <tr>${caseRow}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>` : emptyMsg(gapsOnly ? "No coverage gaps in this scope — every requirement has at least one test case." : "Nothing to display for this scope.");

  return `
    ${pageHead([{ label: "Trace Matrix" }], "Traceability Matrix", "",
      "Requirements × test cases. A mark means the case verifies the requirement, colored by its latest run result. Rows flagged red on the left edge have no coverage.")}
    <div class="filter-bar">
      <select data-filter="system"><option value="">All systems</option>${Store.all("systems").map(s => `<option value="${s.id}" ${sysF === s.id ? "selected" : ""}>${esc(s.code)} ${esc(s.name)}</option>`).join("")}</select>
      <label class="small faint" style="display:flex;gap:5px;align-items:center;cursor:pointer">
        <input type="checkbox" data-act="trace-gaps" ${gapsOnly ? "checked" : ""} style="accent-color:var(--amber)"> gaps only
      </label>
      <span class="faint mono small">${covered}/${reqs.length} shown requirements covered</span>
      <div class="spacer" style="flex:1"></div>
      <div class="trace-legend">
        <span><span class="tmark t-pass"></span> pass</span>
        <span><span class="tmark t-fail"></span> fail</span>
        <span><span class="tmark t-blocked"></span> blocked / in progress</span>
        <span><span class="tmark t-none"></span> linked, not run</span>
      </div>
    </div>
    ${panel("Requirements × Test Cases", table, "", true)}`;
};

/* ================= PROCEDURES ================= */
Views.procedures = function () {
  const rows = Store.all("procedures").map(p => {
    const entry = Store.criteriaOf(p.id, "entry");
    const exit = Store.criteriaOf(p.id, "exit");
    const cases = Store.casesOfProcedure(p.id);
    const entryMet = entry.filter(c => c.status !== "open").length;
    const exitMet = exit.filter(c => c.status !== "open").length;
    const ready = entry.length && entryMet === entry.length;
    return `<tr>
      <td>${codeLink("procedures", p)}</td>
      <td><a href="#/procedures/${p.id}">${esc(p.title)}</a><div class="faint small">${esc(p.description)}</div></td>
      <td class="num">${(p.steps || []).length}</td>
      <td class="num">${entryMet}/${entry.length}</td>
      <td class="num">${exitMet}/${exit.length}</td>
      <td class="num">${cases.length}</td>
      <td>${ready ? badge("Entry Met", "b-green") : badge("Not Ready", "b-orange")}</td>
    </tr>`;
  }).join("");

  return `
    ${pageHead([{ label: "Procedures" }], "Test Procedures",
      actBtn("+ New Procedure", "add-procedure", null, "", false),
      "Procedures own their execution steps and entry/exit criteria, and are the parent of the test cases that execute them.")}
    ${panel("Library", rows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Procedure</th><th>Steps</th><th>Entry</th><th>Exit</th><th>Cases</th><th>Readiness</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No procedures defined."), "", true)}`;
};

Views.procedureDetail = function (id) {
  const p = Store.get("procedures", id);
  if (!p) return notFound("Procedure");
  const entry = Store.criteriaOf(id, "entry");
  const exit = Store.criteriaOf(id, "exit");
  const cases = Store.casesOfProcedure(id);
  const entryOpen = entry.filter(c => c.status === "open");
  const ready = entry.length > 0 && entryOpen.length === 0;

  const critHtml = renderCritList;

  const stepsHtml = (p.steps || []).length
    ? `<ol class="steps">${p.steps.map((s, i) => `
        <li draggable="true" data-step-idx="${i}" data-proc="${p.id}">
          <span class="step-drag" title="Drag to reorder">⋮⋮</span>
          <span class="step-text">${esc(s)}</span>
          <span class="inline-actions">${actBtn("✎", "edit-step", String(i), `data-proc="${p.id}"`, true, "btn-xs")}${actBtn("✕", "del-step", String(i), `data-proc="${p.id}"`, true, "btn-xs")}</span>
        </li>`).join("")}</ol>`
    : emptyMsg("No steps yet — use “+ Step”.");

  return `
    ${pageHead(
      [{ label: "Procedures", href: "#/procedures" }, { label: p.code }],
      `<span class="code-inline">${esc(p.code)}</span>${esc(p.title)}`,
      actBtn("Edit", "edit-procedure", p.id) + actBtn("Delete", "del-procedure", p.id),
      esc(p.description))}
    <div class="ready-strip ${ready ? "go" : "nogo"}">
      <span class="lamp"></span>
      ${ready
        ? "ENTRY CRITERIA SATISFIED — PROCEDURE CLEARED FOR EXECUTION"
        : `HOLD — ${entryOpen.length} ENTRY ${entryOpen.length === 1 ? "CRITERION" : "CRITERIA"} OPEN`}
    </div>
    <div class="grid-2">
      <div>
        ${panel("Execution Steps", stepsHtml, actBtn("+ Step", "add-step", p.id), true)}
        ${panel("Test Cases Under This Procedure", cases.length
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Title</th><th>Component</th><th>Status</th><th>History</th><th>Latest Run</th></tr></thead><tbody>${
              cases.map(tc => {
                const comp = Store.get("components", tc.componentId);
                return `<tr><td>${codeLink("cases", tc)}</td><td><a href="#/cases/${tc.id}">${esc(tc.title)}</a></td><td>${comp ? codeLink("components", comp) : "—"}</td><td>${badge(tc.status)}</td><td>${runDots(tc.id)}</td><td>${runBadge(Store.latestRun(tc.id))}</td></tr>`;
              }).join("")
            }</tbody></table></div>`
          : emptyMsg("No test cases under this procedure yet — add the first."), actBtn("+ Test Case", "add-case-proc", p.id), true)}
      </div>
      <div>
        ${panel("Entry Criteria", critHtml(entry), actBtn("+ Add", "add-crit-entry", p.id), true)}
        ${panel("Exit Criteria", critHtml(exit), actBtn("+ Add", "add-crit-exit", p.id), true)}
      </div>
    </div>`;
};

/* ================= TEST PLANS ================= */
Views.plans = function () {
  const rows = Store.all("plans").map(p => {
    const c = planCounts(p);
    return `<tr>
      <td>${codeLink("plans", p)}</td>
      <td><a href="#/plans/${p.id}">${esc(p.name)}</a><div class="faint small">${esc(p.description)}</div></td>
      <td>${badge(p.phase, "b-purple")}</td>
      <td>${badge(p.status)}</td>
      <td class="num">${esc(p.start || "")} → ${esc(p.end || "")}</td>
      <td class="num">${p.caseIds.length}</td>
      <td style="min-width:140px">${progressMeter(c)}</td>
    </tr>`;
  }).join("");
  return `
    ${pageHead([{ label: "Test Plans" }], "Test Plans",
      actBtn("+ New Plan", "add-plan", null, "", false),
      "Plans bundle test cases into scheduled campaigns. Progress reflects each case's latest run result.")}
    ${panel("Campaigns", rows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Plan</th><th>Phase</th><th>Status</th><th>Window</th><th>Cases</th><th>Progress</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No test plans."), "", true)}`;
};

Views.planDetail = function (id) {
  const p = Store.get("plans", id);
  if (!p) return notFound("Test plan");
  const cases = (p.caseIds || []).map(cid => Store.get("cases", cid)).filter(Boolean);
  const c = planCounts(p);
  const entry = Store.criteriaOf(id, "entry");
  const exit = Store.criteriaOf(id, "exit");
  const entryOpen = entry.filter(x => x.status === "open");

  const rows = cases.map(tc => {
    const comp = Store.get("components", tc.componentId);
    const proc = tc.procedureId ? Store.get("procedures", tc.procedureId) : null;
    return `<tr>
      <td>${codeLink("cases", tc)}</td>
      <td><a href="#/cases/${tc.id}">${esc(tc.title)}</a></td>
      <td>${comp ? chip("components", comp) : "—"}</td>
      <td>${proc ? codeLink("procedures", proc) : "—"}</td>
      <td><button class="badge-btn" data-act="cycle-case-status" data-id="${tc.id}" title="Click to cycle status">${badge(tc.status)}</button></td>
      <td>${runBadge(Store.latestRun(tc.id))}</td>
      <td class="inline-actions">${actBtn("Run", "record-run-plan", tc.id, `data-plan="${p.id}"`)}${actBtn("Remove", "unassign-plan", tc.id, `data-plan="${p.id}"`)}</td>
    </tr>`;
  }).join("");

  return `
    ${pageHead(
      [{ label: "Test Plans", href: "#/plans" }, { label: p.code }],
      `<span class="code-inline">${esc(p.code)}</span>${esc(p.name)}`,
      actBtn("Edit", "edit-plan", p.id) + actBtn("Delete", "del-plan", p.id) + actBtn("+ Assign Cases", "plan-add-cases", p.id) +
      actBtn("Auto-Fill Regression", "plan-autofill", p.id) + actBtn("▶ Start Run", "plan-start-run", p.id, "", false),
      `${p.extKey ? `Issue: ${extKeyTag(p.extKey)} &nbsp;·&nbsp; ` : ""}${p.regressionSystemId && Store.get("systems", p.regressionSystemId) ? `Regression scope: ${chip("systems", Store.get("systems", p.regressionSystemId))} &nbsp;·&nbsp; ` : ""}${esc(p.description)}`)}
    <div class="kpi-row">
      <div class="kpi" style="--kpi-accent:var(--purple)"><div class="kpi-label">Phase</div><div class="kpi-value" style="font-size:26px">${esc(p.phase || "—")}</div><div class="kpi-foot">${badge(p.status)}</div></div>
      <div class="kpi" style="--kpi-accent:var(--blue)"><div class="kpi-label">Window</div><div class="kpi-value" style="font-size:22px">${esc(p.start || "?")}</div><div class="kpi-foot">through ${esc(p.end || "?")}</div></div>
      <div class="kpi" style="--kpi-accent:var(--green)"><div class="kpi-label">Passing</div><div class="kpi-value">${c.pass}<small>/${cases.length}</small></div><div class="kpi-foot">${c.fail} fail · ${c.waived} waived · ${c.removal} for review · ${c.blocked} blocked/ip · ${c.open} not run</div></div>
      <div class="kpi" style="--kpi-accent:var(--amber)"><div class="kpi-label">Progress</div><div style="margin-top:14px">${progressMeter(c)}</div><div class="kpi-foot" style="margin-top:8px">${cases.length ? Math.round((c.pass / cases.length) * 100) : 0}% complete-pass</div></div>
    </div>
    ${(() => {
      const dec = p.decisionId ? Store.get("decisions", p.decisionId) : null;
      if (!dec) return "";
      return `<div class="ready-strip ${entry.length && !entryOpen.length ? "go" : "nogo"}">
        <span class="lamp"></span> SUPPORTS <a href="#/decisions/${dec.id}" style="color:inherit;text-decoration:underline">${esc(dec.code)} ${esc(dec.title).toUpperCase()}</a>
        ${entry.length ? ` — PHASE ENTRY ${entryOpen.length ? `${entryOpen.length} OPEN` : "SATISFIED"}` : ""}
      </div>`;
    })()}
    ${planPaceStrip(p)}
    <div class="grid-2">
      ${panel("Phase Entry Criteria", renderCritList(entry), actBtn("+ Add", "add-crit-entry", p.id, `data-parent="plan"`), true)}
      ${panel("Phase Exit Criteria", renderCritList(exit), actBtn("+ Add", "add-crit-exit", p.id, `data-parent="plan"`), true)}
    </div>
    ${panel("Assigned Test Cases", rows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Title</th><th>Component</th><th>Procedure</th><th>Status</th><th>Latest Run</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No test cases assigned. Use “+ Assign Cases”."), "", true)}
    ${testRunsPanel("Test Runs from This Plan", Store.testRunsSorted(t => t.planId === p.id), "No test runs yet — use ▶ Start Run.")}
    ${auditPanel(p.id)}
    ${extLinksPanel("plans", p)}`;
};

/* ================= TEST RUNS ================= */
Views.runs = function (params) {
  const resF = params.get("result") || "";
  let runs = Store.all("runs").slice().sort((a, b) => Store.compareRuns(a, b));
  if (resF) runs = runs.filter(r => r.result === resF);

  const rows = runs.map(r => {
    const tc = Store.get("cases", r.caseId);
    const plan = r.planId ? Store.get("plans", r.planId) : null;
    const trun = r.testRunId ? Store.get("testRuns", r.testRunId) : null;
    return `<tr>
      <td><span class="code">${esc(r.code)}</span>${r.extKey ? `<div style="font-size:9.5px;margin-top:1px">${extKeyTag(r.extKey)}</div>` : ""}</td>
      <td class="num">${esc(r.date || "")}</td>
      <td>${tc ? chip("cases", tc) : "—"}</td>
      <td>${badge(r.result)}</td>
      <td class="small">${r.measured ? `<span class="mono">${esc(r.measured)}</span>` : `<span class="faint">—</span>`}</td>
      <td>${esc(r.operator || "")}</td>
      <td>${plan ? codeLink("plans", plan) : "—"}${trun ? `<div>${testRunLink(trun)}</div>` : ""}</td>
      <td class="small" style="max-width:300px">${esc(r.notes || "")}${r.evidence ? `<div>${evidenceRefs(r.evidence)}</div>` : ""}</td>
      <td class="inline-actions">${actBtn("Edit", "edit-run", r.id)}${actBtn("Del", "del-run", r.id)}</td>
    </tr>`;
  }).join("");

  return `
    ${pageHead([{ label: "Test Runs" }], "Test Runs",
      actBtn("● Record Run", "record-run-any", null, "", false),
      "Test run sessions group many cases into one campaign pass; the log below records every individual case result, newest first.")}
    ${testRunsPanel("Test Run Sessions", Store.testRunsSorted(), "No test run sessions yet — start one from a plan (▶ Start Run) or a system (▶ Full Regression).")}
    <div class="filter-bar">
      <select data-filter="result"><option value="">All results</option>${RUN_RESULTS.map(s => `<option ${resF === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      <span class="faint mono small">${runs.length} shown</span>
    </div>
    ${panel("Log", rows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Run</th><th>Date</th><th>Test Case</th><th>Result</th><th>Measured</th><th>Operator</th><th>Plan / Test Run</th><th>Notes / Evidence</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No runs recorded."), "", true)}`;
};

/* ================= RISKS ================= */
Views.risks = function (params) {
  const selL = params.get("l"), selI = params.get("i");
  const showClosed = params.get("closed") === "1";
  let risks = Store.all("risks");
  if (!showClosed) risks = risks.filter(r => r.status !== "Closed");

  // matrix counts
  const grid = {};
  risks.forEach(r => {
    const k = `${r.likelihood}-${r.impact}`;
    (grid[k] = grid[k] || []).push(r);
  });

  let cells = "";
  for (let imp = 5; imp >= 1; imp--) {
    cells += `<div class="axis-cell">${imp}</div>`;
    for (let lik = 1; lik <= 5; lik++) {
      const k = `${lik}-${imp}`;
      const n = (grid[k] || []).length;
      const band = Store.riskBand(lik * imp);
      const sel = String(lik) === selL && String(imp) === selI ? " sel" : "";
      cells += `<div class="m-cell band-${band}${n ? "" : " zero"}${sel}" data-act="matrix-cell" data-l="${lik}" data-i="${imp}" title="Likelihood ${lik} × Impact ${imp} = ${lik * imp}">${n || "·"}</div>`;
    }
  }
  cells += `<div class="axis-cell"></div>` + [1, 2, 3, 4, 5].map(l => `<div class="axis-cell">${l}</div>`).join("");

  let listRisks = risks;
  if (selL && selI) listRisks = risks.filter(r => String(r.likelihood) === selL && String(r.impact) === selI);
  listRisks = listRisks.slice().sort((a, b) => Store.riskScore(b) - Store.riskScore(a));

  const rows = listRisks.map(r => {
    const s = Store.riskScore(r), band = Store.riskBand(s);
    const mits = r.mitigations || [];
    const done = mits.filter(m => m.status === "Complete" || m.status === "Verified").length;
    return `<tr>
      <td>${codeLink("risks", r)}</td>
      <td><a href="#/risks/${r.id}">${esc(r.title)}</a></td>
      <td>${badge(r.category, "b-purple")}</td>
      <td class="num">${r.likelihood}×${r.impact}</td>
      <td><span class="score-pill band-${band}" style="font-size:13px;padding:2px 9px">${s}</span></td>
      <td>${riskTrend(r)}</td>
      <td>${badge(r.status)}</td>
      <td class="num">${done}/${mits.length}</td>
    </tr>`;
  }).join("");

  return `
    ${pageHead([{ label: "Risks" }], "Risk Register",
      actBtn("+ New Risk", "add-risk", null, "", false),
      "5×5 likelihood × impact matrix. Click a cell to filter; each risk carries a tracked mitigation workflow.")}
    <div class="risk-layout">
      <div class="panel">
        <div class="panel-head"><h2>Matrix</h2><div class="spacer"></div>
          ${selL ? actBtn("Clear filter", "matrix-clear", null) : ""}
          <label class="small faint" style="display:flex;gap:5px;align-items:center;cursor:pointer">
            <input type="checkbox" data-act="toggle-closed" ${showClosed ? "checked" : ""} style="accent-color:var(--amber)"> closed
          </label>
        </div>
        <div class="matrix-wrap">
          <div style="display:flex;gap:6px">
            <div class="axis-y-label">Impact →</div>
            <div style="flex:1"><div class="matrix">${cells}</div>
              <div class="matrix-caption"><span>Likelihood →</span><span>score = L × I</span></div>
            </div>
          </div>
        </div>
      </div>
      ${panel(selL ? `Risks at L${selL} × I${selI}` : "Register", rows
        ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Risk</th><th>Cat</th><th>L×I</th><th>Score</th><th>Trend</th><th>Status</th><th>Mits</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : emptyMsg(selL ? "No risks in this cell." : "No open risks."), "", true)}
    </div>`;
};

Views.riskDetail = function (id) {
  const r = Store.get("risks", id);
  if (!r) return notFound("Risk");
  const s = Store.riskScore(r), band = Store.riskBand(s);
  const reqs = (r.relatedRequirementIds || []).map(x => Store.get("requirements", x)).filter(Boolean);
  const cases = (r.relatedCaseIds || []).map(x => Store.get("cases", x)).filter(Boolean);
  const mits = r.mitigations || [];

  const mitHtml = mits.length ? mits.map(m => {
    const idx = MIT_FLOW.indexOf(m.status);
    const next = idx >= 0 && idx < MIT_FLOW.length - 1 ? MIT_FLOW[idx + 1] : null;
    const cls = "s-" + m.status.toLowerCase().replace(/\s+/g, "");
    return `<div class="mit-item ${cls}">
      <div class="mit-flow"><div class="mit-dot"></div></div>
      <div class="mit-body">
        <div class="mit-text">${esc(m.text)}</div>
        <div class="mit-meta">
          ${badge(m.status)}
          ${m.owner ? `<span>owner: ${esc(m.owner)}</span>` : ""}
          ${m.due ? `<span>due: ${esc(m.due)}</span>` : ""}
        </div>
      </div>
      <div class="mit-actions">
        ${next ? actBtn(`→ ${next}`, "advance-mit", m.id, `data-risk="${r.id}"`, false, "btn-xs") : ""}
        ${actBtn("✎", "edit-mit", m.id, `data-risk="${r.id}"`, true, "btn-xs")}
        ${actBtn("✕", "del-mit", m.id, `data-risk="${r.id}"`, true, "btn-xs")}
      </div>
    </div>`;
  }).join("") : emptyMsg("No mitigation steps yet — add the first one.");

  return `
    ${pageHead(
      [{ label: "Risks", href: "#/risks" }, { label: r.code }],
      `<span class="code-inline">${esc(r.code)}</span>${esc(r.title)}`,
      actBtn("Edit", "edit-risk", r.id) + actBtn("Delete", "del-risk", r.id) + actBtn("+ Mitigation Step", "add-mit", r.id, "", false),
      "")}
    <div class="grid-2">
      <div>
        ${panel("Assessment", `
          <div style="display:flex;gap:20px;align-items:center;margin-bottom:12px">
            <span class="score-pill band-${band}"><span class="risk-score">${s}</span> ${band}</span>
            <div class="mono faint">Likelihood ${r.likelihood} / 5<br>Impact ${r.impact} / 5 &nbsp;${riskTrend(r)}</div>
          </div>
          ${(() => {
            const iL = r.initialLikelihood || r.likelihood, iI = r.initialImpact || r.impact;
            const iS = iL * iI, iB = Store.riskBand(iS);
            const rL = r.residualLikelihood, rI = r.residualImpact;
            const resHtml = (rL && rI)
              ? `<span class="score-pill band-${Store.riskBand(rL * rI)}" style="font-size:12px;padding:2px 8px">${rL * rI}</span> residual target (${rL}×${rI})`
              : `<span class="faint">no residual target set</span>`;
            return `<div class="risk-path">
              <span><span class="score-pill band-${iB}" style="font-size:12px;padding:2px 8px">${iS}</span> initial (${iL}×${iI})</span>
              <span class="rp-arrow">→</span>
              <span><span class="score-pill band-${band}" style="font-size:12px;padding:2px 8px">${s}</span> current</span>
              <span class="rp-arrow">→</span>
              <span>${resHtml}</span>
            </div>`;
          })()}
          <p style="margin:0 0 10px">${esc(r.description)}</p>
          <dl class="def-grid">
            <dt>Category</dt><dd>${badge(r.category, "b-purple")}</dd>
            <dt>Status</dt><dd>${badge(r.status)}</dd>
            <dt>Owner</dt><dd>${esc(r.owner || "—")}</dd>
          </dl>`)}
        ${panel("Affected Requirements", chips("requirements", reqs, "None linked"))}
        ${panel("Related Test Cases", chips("cases", cases, "None linked"))}
        ${auditPanel(r.id)}
      </div>
      <div>
        <div class="panel">
          <div class="panel-head"><h2>Mitigation Workflow</h2><div class="spacer"></div>${actBtn("+ Step", "add-mit", r.id)}</div>
          <div class="flow-strip">${MIT_FLOW.map((f, i) => `${i ? '<span class="farrow">→</span>' : ""}<span class="fstep">${f}</span>`).join("")}</div>
          <div class="panel-body tight">${mitHtml}</div>
        </div>
      </div>
    </div>`;
};

/* ================= DOCUMENTS ================= */
const DOC_TYPES = ["Test Plan", "Report", "V&V Artifact", "Evidence", "Reference", "Memo", "Other"];
const DOC_MAX_BYTES = 2 * 1024 * 1024; // per-file cap; everything lives in localStorage

function fmtBytes(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* "TP-01, RSK-001" → chips for codes that resolve, plain tags otherwise. */
function relatedChips(codesText) {
  const codes = String(codesText || "").split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  if (!codes.length) return `<span class="faint small">—</span>`;
  return codes.map(c => {
    const hit = Store.byCode(c.toUpperCase());
    return hit ? chip(hit.coll, hit.entity) : `<span class="ev-ref">${esc(c)}</span>`;
  }).join("");
}

Views.documents = function (params) {
  const typeF = params.get("type") || "";
  let docs = Store.all("documents").slice().sort((a, b) => (b.added || "").localeCompare(a.added || ""));
  if (typeF) docs = docs.filter(d => d.docType === typeF);

  const rows = docs.map(d => {
    const attach = d.dataUrl
      ? `${actBtn("⇓ " + esc(d.fileName || "file"), "doc-download", d.id, "", true)} <span class="faint mono small">${fmtBytes(d.fileSize)}</span>`
      : d.url
        ? (/^https?:\/\//i.test(d.url)
            ? `<a class="ev-ref" href="${esc(d.url)}" target="_blank" rel="noopener">↗ ${esc(d.url.replace(/^https?:\/\//i, "").slice(0, 44))}</a>`
            : `<span class="ev-ref" title="${esc(d.url)}">${esc(d.url.slice(0, 44))}</span>`)
        : `<span class="faint small">no attachment</span>`;
    return `<tr>
      <td><span class="code">${esc(d.code)}</span></td>
      <td><b>${esc(d.title)}</b>${d.description ? `<div class="faint small">${esc(d.description)}</div>` : ""}</td>
      <td>${badge(d.docType, "b-purple")}</td>
      <td>${attach}</td>
      <td>${relatedChips(d.relatedCodes)}</td>
      <td class="num">${esc(d.added || "")}</td>
      <td class="inline-actions">${actBtn("Edit", "edit-doc", d.id)}${actBtn("Del", "del-doc", d.id)}</td>
    </tr>`;
  }).join("");

  const bytes = Store.storageBytes();
  return `
    ${pageHead([{ label: "Documents" }], "Documents",
      actBtn("⇪ Upload File", "add-doc-upload", null) + actBtn("+ Link Document", "add-doc-link", null, "", false),
      "Program documentation: link out to files on your share/wiki, or embed small files directly (stored in this browser's local database). Related codes auto-link to any entity in the console.")}
    <div class="filter-bar">
      <select data-filter="type"><option value="">All types</option>${DOC_TYPES.map(t => `<option ${typeF === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      <span class="faint mono small">${docs.length} shown · active database ≈ ${fmtBytes(bytes)} characters; recovery copy also uses browser storage</span>
    </div>
    ${panel("Library", rows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Document</th><th>Type</th><th>Attachment</th><th>Related</th><th>Added</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No documents yet — link one or upload a file."), "", true)}
    <input type="file" id="doc-file" hidden>`;
};

function docFields(fileNote) {
  const f = [
    { key: "title", label: "Title", required: true },
    { key: "docType", label: "Type", type: "select", half: true, options: DOC_TYPES },
    { key: "added", label: "Date", type: "date", half: true, default: todayISO() },
    { key: "url", label: "Link (URL or file path on your share)" },
    { key: "relatedCodes", label: "Related Codes (e.g. TP-01, RSK-001, DP-01)", half: false },
    { key: "description", label: "Description", type: "textarea" }
  ];
  return f;
}

/* Holds a just-picked file's data between the file input and the modal submit. */
let pendingDocFile = null;

function openDocModal(existing, fileData) {
  const isEdit = !!existing;
  pendingDocFile = fileData || null;
  const values = existing ? Object.assign({}, existing) : (fileData ? { title: fileData.name.replace(/\.[^.]+$/, "") } : {});
  Modal.open(
    isEdit ? `Edit ${existing.code}` : fileData ? `Upload — ${fileData.name} (${fmtBytes(fileData.size)})` : "Link Document",
    docFields(), values, v => {
      if (pendingDocFile) {
        v.fileName = pendingDocFile.name;
        v.fileSize = pendingDocFile.size;
        v.fileType = pendingDocFile.type;
        v.dataUrl = pendingDocFile.dataUrl;
        Store.effect(() => { pendingDocFile = null; });
      }
      if (isEdit) { Store.update("documents", existing.id, v); Toast.show("Saved"); }
      else {
        const d = Store.add("documents", Object.assign({ fileName: "", fileSize: 0, fileType: "", dataUrl: "" }, v));
        Toast.show(`${d.code} added`);
      }
      App.render();
    }, isEdit ? "Save" : "Add");
}

/* ================= WEEKLY SITREP (print) ================= */
Views.sitrep = function () {
  const today = todayISO();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  /* snapshot deltas vs ~a week ago */
  const snaps = Store.db.snapshots || [];
  const latest = snaps[snaps.length - 1];
  const baseline = snaps.slice().reverse().find(s => s.date <= weekAgo) || snaps[0];
  const delta = (a, b) => { const d = a - b; return d > 0 ? `+${d}` : String(d); };
  const deltaHtml = latest && baseline && latest.date !== baseline.date ? `
    <dl class="def-grid">
      <dt>Cases Passing</dt><dd><b class="mono">${latest.pass}</b> <span class="faint mono">(${delta(latest.pass, baseline.pass)} since ${esc(baseline.date)})</span></dd>
      <dt>Reqs Verified</dt><dd><b class="mono">${latest.verified}/${latest.reqTotal}</b> <span class="faint mono">(${delta(latest.verified, baseline.verified)})</span></dd>
      <dt>Open Defects</dt><dd><b class="mono">${latest.defOpen != null ? latest.defOpen : "—"}</b> <span class="faint mono">(${latest.defOpen != null && baseline.defOpen != null ? delta(latest.defOpen, baseline.defOpen) : "n/a"})</span></dd>
    </dl>` : `<span class="faint small">Deltas appear once snapshots span more than one day.</span>`;

  const weekRuns = Store.all("runs").filter(r => (r.date || "") >= weekAgo)
    .sort((a, b) => Store.compareRuns(a, b));
  const runRows = weekRuns.map(r => {
    const tc = Store.get("cases", r.caseId);
    return `<tr><td class="num">${esc(r.code)}</td><td class="num">${esc(r.date || "")}</td>
      <td>${tc ? `${esc(tc.code)} ${esc(tc.title)}` : "—"}</td><td>${badge(r.result)}</td>
      <td class="mono small">${esc(r.measured || "")}</td><td class="small">${esc(r.notes || "").slice(0, 120)}</td></tr>`;
  }).join("");

  const defOpened = Store.all("defects").filter(d => (d.opened || "") >= weekAgo);
  const defClosed = Store.all("defects").filter(d => (d.closed || "") >= weekAgo);
  const defRow = d => `<tr><td class="num">${esc(d.code)}</td><td>${esc(d.title)}</td><td>${badge(d.severity)}</td><td>${badge(d.status)}</td><td>${esc(d.owner || "")}</td></tr>`;

  const upcoming = Store.all("events")
    .filter(ev => ev.status !== "Complete" && ev.status !== "Cancelled" && ev.start >= today && ev.start <= in14)
    .sort((a, b) => a.start.localeCompare(b.start));
  const upRows = upcoming.map(ev => `<tr><td class="num">${esc(ev.start)}</td><td>${esc(ev.code)} ${esc(ev.title)}</td><td>${badge(ev.type)}</td><td>${esc(ev.location || "")}</td></tr>`).join("");

  const hotRisks = Store.all("risks").filter(r => r.status !== "Closed" && Store.riskScore(r) >= 10)
    .sort((a, b) => Store.riskScore(b) - Store.riskScore(a));
  const riskRows = hotRisks.map(r => `<tr><td class="num">${esc(r.code)}</td><td>${esc(r.title)}</td>
    <td><span class="score-pill band-${Store.riskBand(Store.riskScore(r))}" style="font-size:12px;padding:2px 8px">${Store.riskScore(r)}</span> ${riskTrend(r)}</td>
    <td>${badge(r.status)}</td><td>${esc(r.owner || "")}</td></tr>`).join("");

  const decRows = Store.all("decisions").filter(d => d.status !== "Complete").map(d => {
    const ready = Store.decisionReadiness(d);
    const days = d.date ? Math.ceil((new Date(d.date + "T12:00") - new Date(today + "T12:00")) / 86400000) : null;
    return `<tr><td class="num">${esc(d.code)}</td><td>${esc(d.title)}</td><td class="num">${esc(d.date || "TBD")}${days != null ? ` (${days}d)` : ""}</td>
      <td>${badge(d.status)}</td><td class="num">${ready ? `${ready.verified}/${ready.total} verified` : "—"}</td></tr>`;
  }).join("");

  return `
    ${pageHead(
      [{ label: "Dashboard", href: "#/dashboard" }, { label: "SITREP" }],
      `Weekly SITREP`,
      actBtn("⎙ Print", "print-page", null, "", false),
      `${esc(Store.db.meta.program || "")} · Reporting period ${esc(weekAgo)} → ${esc(today)} · Generated ${esc(today)}`)}
    ${panel("1 · Week Over Week", deltaHtml)}
    ${panel(`2 · Test Runs This Week (${weekRuns.length})`, runRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Run</th><th>Date</th><th>Test Case</th><th>Result</th><th>Measured</th><th>Notes</th></tr></thead><tbody>${runRows}</tbody></table></div>`
      : emptyMsg("No runs recorded this week."), "", true)}
    ${panel(`3 · Defects — ${defOpened.length} opened, ${defClosed.length} closed this week`, (defOpened.length || defClosed.length)
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Defect</th><th>Severity</th><th>Status</th><th>Owner</th></tr></thead><tbody>${defOpened.map(defRow).join("")}${defClosed.filter(d => !defOpened.includes(d)).map(defRow).join("")}</tbody></table></div>`
      : emptyMsg("No defect activity this week."), "", true)}
    ${panel("4 · Next 14 Days", upRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Date</th><th>Event</th><th>Type</th><th>Location</th></tr></thead><tbody>${upRows}</tbody></table></div>`
      : emptyMsg("Nothing scheduled in the next two weeks."), "", true)}
    ${panel("5 · Decision Readiness", decRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Decision</th><th>Date</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${decRows}</tbody></table></div>`
      : emptyMsg("No open decisions."), "", true)}
    ${panel("6 · High / Critical Risks", riskRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Risk</th><th>Score / Trend</th><th>Status</th><th>Owner</th></tr></thead><tbody>${riskRows}</tbody></table></div>`
      : emptyMsg("No high or critical risks open."), "", true)}`;
};

/* ================= EXECUTE MODE ================= */
Views.execute = function (caseId, params = new URLSearchParams()) {
  const tc = Store.get("cases", caseId);
  if (!tc) return notFound("Test case");
  const proc = tc.procedureId ? Store.get("procedures", tc.procedureId) : null;
  // When launched from a test run, the result is recorded into it and Cancel/Save return there.
  const trun = params.get("tr") ? Store.get("testRuns", params.get("tr")) : null;
  const back = trun ? testRunHref(trun.id, params.get("comp")) : `#/cases/${tc.id}`;
  if (!proc) return `${pageHead([{ label: "Test Cases", href: "#/cases" }, { label: tc.code }], "Execute", "",
    "This case has no procedure — assign one, or use “Record Run” for a quick log.")}
    <div class="empty" style="padding:50px"><a href="${back}">Back</a></div>`;

  const entry = Store.criteriaOf(proc.id, "entry");
  const entryOpen = entry.filter(x => x.status === "open");
  const ready = entry.length > 0 && entryOpen.length === 0;
  const plans = trun && trun.planId ? [Store.get("plans", trun.planId)].filter(Boolean) : Store.plansOf(tc.id);

  const steps = (proc.steps || []).map((s, i) => `
    <label class="exec-step" id="exec-step-row-${i}">
      <span class="es-num">${String(i + 1).padStart(2, "0")}</span>
      <input type="checkbox" data-exec-step="${i}">
      <span class="es-text">${esc(s)}</span>
    </label>`).join("");

  return `
    ${pageHead(
      [{ label: "Procedures", href: "#/procedures" }, { label: proc.code, href: `#/procedures/${proc.id}` }, { label: tc.code, href: `#/cases/${tc.id}` }, { label: "Execute" }],
      `<span class="code-inline">▶</span>Executing ${esc(tc.code)} — ${esc(tc.title)}`,
      `<a class="btn btn-ghost btn-sm" href="${back}">Cancel</a>`,
      `Procedure ${esc(proc.code)} ${esc(proc.title)} · ${tc.venue ? `venue ${esc(tc.venue)} · ` : ""}check off steps as you go, capture results on the right, then complete the run.`)}
    ${trun ? `<div class="ready-strip info"><span class="lamp"></span>RECORDING INTO TEST RUN ${esc(trun.code || "")} — ${esc(trun.name || "")}</div>` : ""}
    <div class="ready-strip ${ready ? "go" : "nogo"}">
      <span class="lamp"></span>
      ${ready ? "ENTRY CRITERIA SATISFIED — CLEARED FOR EXECUTION"
        : entry.length ? `HOLD — ${entryOpen.length} ENTRY ${entryOpen.length === 1 ? "CRITERION" : "CRITERIA"} OPEN (<a href="#/procedures/${proc.id}" style="color:inherit;text-decoration:underline">review</a>)`
        : "NO ENTRY CRITERIA DEFINED FOR THIS PROCEDURE"}
    </div>
    <div class="grid-2">
      <div>
        ${panel("Execution Steps", `${steps || emptyMsg("Procedure has no steps")}`, `<span class="mono faint small" id="exec-progress">0/${(proc.steps || []).length} done</span>`, true)}
      </div>
      <div>
        ${panel("Run Capture", `<div class="exec-form">
          <div class="form-grid">
            <div class="form-field"><label>Date</label><input type="date" id="exec-date" value="${todayISO()}"></div>
            <div class="form-field"><label>Operator</label><input type="text" id="exec-operator" autocomplete="off"></div>
            <div class="form-field"><label>Result</label><select id="exec-result">${RUN_RESULTS.map(r => `<option>${r}</option>`).join("")}</select></div>
            <div class="form-field"><label>Under Plan</label><select id="exec-plan"><option value="">—</option>${Store.all("plans").map(p => `<option value="${p.id}" ${plans[0] && plans[0].id === p.id ? "selected" : ""}>${esc(p.code)} ${esc(p.name)}</option>`).join("")}</select></div>
            <div class="form-field full"><label>Measured Value(s)</label><input type="text" id="exec-measured" placeholder="e.g. 18.2 ms P99" autocomplete="off"></div>
            <div class="form-field full"><label>Evidence Refs (one per line)</label><textarea id="exec-evidence" rows="2"></textarea></div>
            <div class="form-field full"><label>Notes / Observations</label><textarea id="exec-notes" rows="4"></textarea></div>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn" data-act="exec-save" data-id="${tc.id}">✔ Complete &amp; Save Run</button>
          </div>
          <div class="faint small">On a Fail result you'll be offered a pre-filled defect. Unchecked steps are noted on the run automatically.</div>
        </div>`)}
      </div>
    </div>`;
};

/* ================= DEFECTS ================= */
Views.defects = function (params) {
  const sevF = params.get("severity") || "";
  const statF = params.get("status") || "";
  const compF = params.get("component") || "";
  let defects = Store.all("defects").slice().sort((a, b) => (b.opened || "").localeCompare(a.opened || ""));
  if (sevF) defects = defects.filter(d => d.severity === sevF);
  if (statF) defects = defects.filter(d => d.status === statF);
  if (compF) defects = defects.filter(d => d.componentId === compF);

  const rows = defects.map(d => {
    const comp = d.componentId ? Store.get("components", d.componentId) : null;
    const cases = (d.caseIds || []).map(cid => Store.get("cases", cid)).filter(Boolean);
    const ageEnd = d.closed || todayISO();
    const age = d.opened ? Math.max(0, Math.round((new Date(ageEnd) - new Date(d.opened)) / 86400000)) : null;
    const hot = Store.defectIsOpen(d) && age != null && age > 14 && (d.severity === "Critical" || d.severity === "Major");
    return `<tr>
      <td>${codeLink("defects", d)}</td>
      <td><a href="#/defects/${d.id}">${esc(d.title)}</a></td>
      <td>${badge(d.severity)}</td>
      <td><button class="badge-btn" data-act="cycle-defect-status" data-id="${d.id}" title="Click to advance status">${badge(d.status)}</button></td>
      <td class="num ${hot ? "age-hot" : ""}">${age != null ? `${age}d${d.closed ? "" : " open"}` : "—"}</td>
      <td>${comp ? chip("components", comp) : "—"}</td>
      <td>${cases.map(tc => codeLink("cases", tc)).join(" ") || `<span class="faint small">—</span>`}</td>
      <td class="num">${esc(d.opened || "")}</td>
      <td>${esc(d.owner || "")}</td>
    </tr>`;
  }).join("");

  const open = Store.openDefects().length;
  return `
    ${pageHead([{ label: "Defects" }], "Defects",
      actBtn("+ New Defect", "add-defect", null, "", false),
      "Bugs and deficiencies against components, tied to the test cases and runs that found them. Open Critical/Major defects mark their component as Failing.")}
    <div class="filter-bar">
      <select data-filter="severity"><option value="">All severities</option>${DEFECT_SEVERITIES.map(x => `<option ${sevF === x ? "selected" : ""}>${x}</option>`).join("")}</select>
      <select data-filter="status"><option value="">All statuses</option>${DEFECT_STATUSES.map(x => `<option ${statF === x ? "selected" : ""}>${x}</option>`).join("")}</select>
      <select data-filter="component"><option value="">All components</option>${Store.all("components").map(c => `<option value="${c.id}" ${compF === c.id ? "selected" : ""}>${esc(c.code)} ${esc(c.name)}</option>`).join("")}</select>
      <span class="faint mono small">${defects.length} shown · ${open} open</span>
    </div>
    ${panel("Register", rows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Defect</th><th>Severity</th><th>Status</th><th>Age</th><th>Component</th><th>Cases</th><th>Opened</th><th>Owner</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No defects match the filter."), "", true)}`;
};

Views.defectDetail = function (id) {
  const d = Store.get("defects", id);
  if (!d) return notFound("Defect");
  const comp = d.componentId ? Store.get("components", d.componentId) : null;
  const cases = (d.caseIds || []).map(cid => Store.get("cases", cid)).filter(Boolean);
  const run = d.runId ? Store.get("runs", d.runId) : null;
  const runCase = run ? Store.get("cases", run.caseId) : null;
  const idx = DEFECT_STATUSES.indexOf(d.status);
  const next = idx >= 0 && idx < DEFECT_STATUSES.indexOf("Closed") ? DEFECT_STATUSES[idx + 1] : null;

  return `
    ${pageHead(
      [{ label: "Defects", href: "#/defects" }, { label: d.code }],
      `<span class="code-inline">${esc(d.code)}</span>${esc(d.title)}`,
      actBtn("Edit", "edit-defect", d.id) + actBtn("Delete", "del-defect", d.id) +
      (next ? actBtn(`→ ${next}`, "advance-defect", d.id, "", false) : ""),
      "")}
    <div class="grid-2">
      <div>
        ${panel("Description", `<p style="margin:0 0 10px">${esc(d.description || "")}</p>
          <dl class="def-grid">
            <dt>Severity</dt><dd>${badge(d.severity)}</dd>
            <dt>Status</dt><dd>${badge(d.status)}</dd>
            <dt>Owner</dt><dd>${esc(d.owner || "—")}</dd>
            <dt>Opened</dt><dd class="mono">${esc(d.opened || "—")}</dd>
            ${d.closed ? `<dt>Closed</dt><dd class="mono">${esc(d.closed)}</dd>` : ""}
          </dl>`)}
        <div class="panel"><div class="flow-strip">${DEFECT_STATUSES.slice(0, 5).map((f, i) => `${i ? '<span class="farrow">→</span>' : ""}<span class="fstep"${f === d.status ? ' style="color:var(--amber);border-color:var(--amber-dim)"' : ""}>${f}</span>`).join("")}</div></div>
      </div>
      <div>
        ${panel("Component", comp ? `${chip("components", comp)} ${badge(Store.componentStatus(comp.id))}` : `<span class="faint small">Not assigned to a component</span>`)}
        ${panel("Found By", run
          ? `<div><span class="code">${esc(run.code)}</span> ${badge(run.result)} <span class="mono faint">${esc(run.date || "")}</span>${runCase ? ` on ${chip("cases", runCase)}` : ""}
             ${run.measured ? `<div class="mono small" style="margin-top:4px">${esc(run.measured)}</div>` : ""}</div>`
          : `<span class="faint small">No originating run recorded</span>`)}
        ${panel("Affected Test Cases", chips("cases", cases, "None linked"))}
        ${auditPanel(d.id)}
      </div>
    </div>`;
};

function defectFields() {
  return [
    { key: "title", label: "Title", required: true },
    { key: "description", label: "Description (symptom, suspected cause, impact)", type: "textarea", required: true },
    { key: "severity", label: "Severity", type: "select", half: true, options: DEFECT_SEVERITIES },
    { key: "status", label: "Status", type: "select", half: true, options: DEFECT_STATUSES },
    { key: "componentId", label: "Component", type: "select", half: true, allowEmpty: true, options: Store.all("components").map(c => ({ value: c.id, label: `${c.code} ${c.name}` })) },
    { key: "runId", label: "Found By Run", type: "select", half: true, allowEmpty: true, options: Store.all("runs").map(r => { const tc = Store.get("cases", r.caseId); return { value: r.id, label: `${r.code} · ${tc ? tc.code : "?"} · ${r.date || ""}` }; }) },
    { key: "owner", label: "Owner", half: true },
    { key: "opened", label: "Opened", type: "date", half: true },
    { key: "caseIds", label: "Affected Test Cases", type: "multicheck", options: Store.all("cases").map(tc => ({ value: tc.id, code: tc.code, label: tc.title })) }
  ];
}

/* ================= IDSK ================= */
Views.idsk = function () {
  const decisions = Store.all("decisions").slice().sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const measures = Store.all("requirements").filter(r => r.measure && r.measure !== "None");
  const plans = Store.all("plans");

  const reqMark = rid => {
    const st = Store.reqStatus(rid);
    return { verified: ["t-pass", "verified"], failing: ["t-fail", "failing"], covered: ["t-blocked", "covered — runs pending"], uncovered: ["t-none", "no test coverage"] }[st];
  };
  const planMark = p => {
    const c = planCounts(p);
    const total = (p.caseIds || []).length;
    if (total && c.pass === total) return ["t-pass", "all cases passing"];
    if (c.fail) return ["t-fail", `${c.fail} failing`];
    return ["t-blocked", `${c.pass}/${total} passing`];
  };

  const grpRow =
    (measures.length ? `<th class="grp" colspan="${measures.length}">Measures (CTP / TPM / MOP)</th>` : "") +
    (plans.length ? `<th class="grp" colspan="${plans.length}">Test Plans / Events</th>` : "");
  const colRow =
    measures.map(r => `<th class="tc-col"><a href="#/requirements/${r.id}" title="${esc(r.code)} — ${esc(r.title)} [${esc(r.measure)}]">${esc(r.code)}</a></th>`).join("") +
    plans.map(p => `<th class="tc-col"><a href="#/plans/${p.id}" title="${esc(p.code)} — ${esc(p.name)}">${esc(p.code)}</a></th>`).join("");

  const body = decisions.map(d => {
    const linked = new Set(d.requirementIds || []);
    const ready = Store.decisionReadiness(d);
    const mCells = measures.map(r => {
      if (!linked.has(r.id)) return `<td class="cell"></td>`;
      const [cls, tip] = reqMark(r.id);
      return `<td class="cell"><a href="#/requirements/${r.id}" title="${esc(r.code)} informs ${esc(d.code)} — ${esc(tip)}"><span class="tmark ${cls}"></span></a></td>`;
    }).join("");
    const pCells = plans.map(p => {
      if (p.decisionId !== d.id) return `<td class="cell"></td>`;
      const [cls, tip] = planMark(p);
      return `<td class="cell"><a href="#/plans/${p.id}" title="${esc(p.code)} supports ${esc(d.code)} — ${esc(tip)}"><span class="tmark ${cls}"></span></a></td>`;
    }).join("");
    return `<tr>
      <td class="req-col">${codeLink("decisions", d)}<span class="req-title">${esc(d.title)}</span>
        <div class="faint mono" style="font-size:10px;margin-top:2px">${esc(d.date || "no date")} · ${esc(d.authority || "")}</div></td>
      ${mCells}${pCells}
      <td class="stat-col">${badge(d.status)}<div class="faint mono" style="margin-top:2px">${ready ? `${ready.verified}/${ready.total} verified` : "no measures"}</div></td>
    </tr>`;
  }).join("");

  const table = decisions.length ? `
    <div class="trace-scroll">
      <table class="trace">
        <thead>
          <tr><th class="req-col" rowspan="2">Decision</th>${grpRow}<th class="stat-col" rowspan="2">Readiness</th></tr>
          <tr>${colRow}</tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>` : emptyMsg("No decisions defined — add the program's decision points.");

  return `
    ${pageHead([{ label: "IDSK" }], "Integrated Decision Support Key",
      actBtn("+ New Decision", "add-decision", null, "", false),
      "Decisions × the data that informs them (DoDI 5000.89 / T&E Strategy). Each mark ties a measure or test plan to a decision, colored by current evidence state. Readiness = linked measures verified.")}
    <div class="filter-bar">
      <div class="trace-legend">
        <span><span class="tmark t-pass"></span> verified / passing</span>
        <span><span class="tmark t-fail"></span> failing</span>
        <span><span class="tmark t-blocked"></span> evidence pending</span>
        <span><span class="tmark t-none"></span> no test coverage</span>
      </div>
    </div>
    ${panel("Decisions × Data Sources", table, "", true)}`;
};

Views.decisionDetail = function (id) {
  const d = Store.get("decisions", id);
  if (!d) return notFound("Decision");
  const reqs = (d.requirementIds || []).map(rid => Store.get("requirements", rid)).filter(Boolean);
  const plans = Store.plansOfDecision(id);
  const events = Store.eventsOfDecision(id).slice().sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  const ready = Store.decisionReadiness(d);

  const reqRows = reqs.map(r => `<tr>
    <td>${codeLink("requirements", r)}</td>
    <td><a href="#/requirements/${r.id}">${esc(r.title)}</a></td>
    <td>${r.measure && r.measure !== "None" ? badge(r.measure) : "—"}</td>
    <td class="num">${esc(r.threshold || "")}</td>
    <td>${badge(Store.reqStatus(r.id))}</td>
  </tr>`).join("");

  const planRows = plans.map(p => {
    const c = planCounts(p);
    return `<tr><td>${codeLink("plans", p)}</td><td><a href="#/plans/${p.id}">${esc(p.name)}</a></td><td>${badge(p.status)}</td><td style="min-width:140px">${progressMeter(c)}</td></tr>`;
  }).join("");

  return `
    ${pageHead(
      [{ label: "IDSK", href: "#/idsk" }, { label: d.code }],
      `<span class="code-inline">${esc(d.code)}</span>${esc(d.title)}`,
      actBtn("Edit", "edit-decision", d.id) + actBtn("Delete", "del-decision", d.id) + `<a class="btn btn-sm" href="#/decisions/${d.id}/report">⎙ Decision Package</a>`,
      "")}
    <div class="grid-2">
      <div>
        ${panel("Decision", `<p style="margin:0 0 10px">${esc(d.description || "")}</p>
          <dl class="def-grid">
            <dt>Status</dt><dd>${badge(d.status)}</dd>
            <dt>Date</dt><dd class="mono">${esc(d.date || "—")}</dd>
            <dt>Authority</dt><dd>${esc(d.authority || "—")}</dd>
            <dt>Readiness</dt><dd>${ready ? `<b class="mono">${ready.pct}%</b> <span class="faint mono">(${ready.verified}/${ready.total} measures verified)</span>` : `<span class="faint">no measures linked</span>`}</dd>
          </dl>`)}
        ${panel("Supporting Test Plans", planRows
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Plan</th><th>Status</th><th>Progress</th></tr></thead><tbody>${planRows}</tbody></table></div>`
          : emptyMsg("No plan names this decision — set it on the plan."), "", true)}
        ${panel("Related Schedule Events", events.length
          ? events.map(ev => `<div style="margin-bottom:6px"><span class="mono faint">${esc(ev.start)}</span> ${chip("events", ev, ev.title)} ${badge(ev.status)}</div>`).join("")
          : `<span class="faint small">None scheduled</span>`)}
      </div>
      <div>
        ${panel("Informing Measures", reqRows
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Requirement</th><th>Measure</th><th>Threshold</th><th>Evidence</th></tr></thead><tbody>${reqRows}</tbody></table></div>`
          : emptyMsg("No measures linked — edit the decision to select them."), "", true)}
        ${auditPanel(d.id)}
      </div>
    </div>`;
};

/* ================= DECISION REPORT (print package) ================= */
Views.decisionReport = function (id) {
  const d = Store.get("decisions", id);
  if (!d) return notFound("Decision");
  const reqs = (d.requirementIds || []).map(rid => Store.get("requirements", rid)).filter(Boolean);
  const plans = Store.plansOfDecision(id);
  const ready = Store.decisionReadiness(d);
  const planCases = plans.flatMap(p => (p.caseIds || []).map(cid => Store.get("cases", cid)).filter(Boolean));

  const measureRows = reqs.map(r => {
    const cases = Store.casesOfRequirement(r.id);
    const best = cases.map(tc => Store.latestRun(tc.id)).filter(Boolean)
      .sort((a, b) => Store.compareRuns(a, b))[0];
    return `<tr>
      <td class="num">${esc(r.code)}</td>
      <td>${esc(r.title)}<div class="faint small">${esc(r.text)}</div></td>
      <td>${badge(r.measure)}</td>
      <td class="num">${esc(r.threshold || "—")}</td>
      <td class="num">${esc(r.objective || "—")}</td>
      <td>${best ? `${badge(best.result)} <span class="mono small">${esc(best.measured || "")}</span> <span class="faint mono small">${esc(best.date || "")}</span>` : `<span class="faint small">no run</span>`}</td>
      <td>${badge(Store.reqStatus(r.id))}</td>
    </tr>`;
  }).join("");

  const planRows = plans.map(p => {
    const c = planCounts(p);
    const entry = Store.criteriaOf(p.id, "entry"), exit = Store.criteriaOf(p.id, "exit");
    const entryMet = entry.filter(x => x.status !== "open").length, exitMet = exit.filter(x => x.status !== "open").length;
    return `<tr>
      <td class="num">${esc(p.code)}</td>
      <td>${esc(p.name)}</td>
      <td>${badge(p.status)}</td>
      <td class="num">${esc(p.start || "")} → ${esc(p.end || "")}</td>
      <td class="num">${c.pass}/${(p.caseIds || []).length} pass · ${c.fail} fail</td>
      <td class="num">entry ${entryMet}/${entry.length} · exit ${exitMet}/${exit.length}</td>
    </tr>`;
  }).join("");

  const reqIdSet = new Set(d.requirementIds || []);
  const risks = Store.all("risks").filter(r => r.status !== "Closed" &&
    (r.relatedRequirementIds || []).some(x => reqIdSet.has(x)));
  const riskRows = risks.sort((a, b) => Store.riskScore(b) - Store.riskScore(a)).map(r => {
    const mits = r.mitigations || [];
    const done = mits.filter(m => m.status === "Complete" || m.status === "Verified").length;
    return `<tr><td class="num">${esc(r.code)}</td><td>${esc(r.title)}</td>
      <td><span class="score-pill band-${Store.riskBand(Store.riskScore(r))}" style="font-size:12px;padding:2px 8px">${Store.riskScore(r)}</span> ${riskTrend(r)}</td>
      <td>${badge(r.status)}</td><td class="num">${done}/${mits.length} mitigations done</td></tr>`;
  }).join("");

  const assetIds = new Set(planCases.flatMap(tc => tc.resourceIds || []));
  const assets = [...assetIds].map(x => Store.get("resources", x)).filter(r => r && r.vvaRequired);
  const assetRows = assets.map(r => `<tr><td class="num">${esc(r.code)}</td><td>${esc(r.name)}</td>
    <td>${badge(r.verification)}</td><td>${badge(r.validation)}</td><td>${badge(r.accreditation)}</td></tr>`).join("");
  const caveats = assets.filter(r => r.accreditation !== "Accredited" && r.accreditation !== "Conditionally Accredited");

  const caseIdSet = new Set(planCases.map(tc => tc.id));
  const openDefs = Store.openDefects().filter(df =>
    (df.caseIds || []).some(x => caseIdSet.has(x)) ||
    planCases.some(tc => tc.componentId === df.componentId));
  const defRows = openDefs.map(df => `<tr><td class="num">${esc(df.code)}</td><td>${esc(df.title)}</td><td>${badge(df.severity)}</td><td>${badge(df.status)}</td><td>${esc(df.owner || "")}</td></tr>`).join("");

  return `
    ${pageHead(
      [{ label: "IDSK", href: "#/idsk" }, { label: d.code, href: `#/decisions/${d.id}` }, { label: "Report" }],
      `<span class="code-inline">${esc(d.code)}</span>Decision Package — ${esc(d.title)}`,
      actBtn("⎙ Print", "print-page", null, "", false) + `<a class="btn btn-ghost btn-sm" href="#/decisions/${d.id}">Back</a>`,
      `${esc(Store.db.meta.program || "")} · Decision date ${esc(d.date || "TBD")} · Authority: ${esc(d.authority || "—")} · Status: ${esc(d.status)} · Evidence readiness: ${ready ? `${ready.verified}/${ready.total} measures verified (${ready.pct}%)` : "no measures linked"} · Generated ${todayISO()}`)}
    ${panel("1 · Decision", `<p style="margin:0">${esc(d.description || "")}</p>`)}
    ${panel("2 · Measures & Evidence", measureRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Req</th><th>Measure</th><th>Type</th><th>Threshold</th><th>Objective</th><th>Latest Evidence</th><th>Rollup</th></tr></thead><tbody>${measureRows}</tbody></table></div>`
      : emptyMsg("No measures linked to this decision."), "", true)}
    ${panel("3 · Supporting Test Plans", planRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Plan</th><th>Name</th><th>Status</th><th>Window</th><th>Results</th><th>Phase Criteria</th></tr></thead><tbody>${planRows}</tbody></table></div>`
      : emptyMsg("No plans support this decision."), "", true)}
    ${panel("4 · Open Risks Against These Measures", riskRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Risk</th><th>Title</th><th>Score / Trend</th><th>Status</th><th>Mitigation</th></tr></thead><tbody>${riskRows}</tbody></table></div>`
      : emptyMsg("No open risks trace to this decision's measures."), "", true)}
    ${panel("5 · Open Defects In Scope", defRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Defect</th><th>Title</th><th>Severity</th><th>Status</th><th>Owner</th></tr></thead><tbody>${defRows}</tbody></table></div>`
      : emptyMsg("No open defects in the supporting plans' scope."), "", true)}
    ${panel("6 · M&S Credibility (VV&A)", (assetRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Asset</th><th>Name</th><th>Verification</th><th>Validation</th><th>Accreditation</th></tr></thead><tbody>${assetRows}</tbody></table></div>`
      : emptyMsg("No VV&A-tracked assets used by the supporting plans."))
      + (caveats.length ? `<div style="padding:10px 14px" class="small" ><b style="color:var(--orange)">Caveat:</b> evidence in this package was generated using ${caveats.map(r => esc(r.code)).join(", ")} — not yet accredited for the intended use.</div>` : ""), "", true)}`;
};

/* ================= SCHEDULE ================= */
Views.schedule = function (params) {
  const typeF = params.get("type") || "";
  const statF = params.get("status") || "";
  let events = Store.all("events").slice().sort((a, b) => (a.start || "").localeCompare(b.start || ""));
  if (typeF) events = events.filter(ev => ev.type === typeF);
  if (statF) events = events.filter(ev => ev.status === statF);

  const today = todayISO();
  const monthName = iso => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const dayOf = iso => iso.slice(8, 10);
  const dowOf = iso => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" });

  let html = "", curMonth = "", todayPlaced = false;
  for (const ev of events) {
    const m = (ev.start || "").slice(0, 7);
    if (!todayPlaced && ev.start && ev.start > today) {
      html += `<div class="today-marker">Today · ${esc(today)}</div>`;
      todayPlaced = true;
    }
    if (m !== curMonth) {
      curMonth = m;
      html += `<div class="tl-month">${ev.start ? esc(monthName(ev.start)) : "Unscheduled"}</div>`;
    }
    const plan = ev.planId ? Store.get("plans", ev.planId) : null;
    const dec = ev.decisionId ? Store.get("decisions", ev.decisionId) : null;
    const isPast = ev.start && ev.start < today && ev.status !== "In Progress";
    const noteCount = (ev.notes || []).length;
    html += `<div class="tl-event${isPast ? " past" : ""}">
      <div class="tl-date">
        <span class="tl-dow">${esc(dowOf(ev.start))}</span>
        <span class="tl-day">${esc(dayOf(ev.start))}</span>
        ${ev.end ? `<span class="tl-thru">→ ${esc(ev.end.slice(5))}</span>` : ""}
      </div>
      <div class="tl-body">
        <div class="tl-title"><a href="#/events/${ev.id}"><span class="code">${esc(ev.code)}</span> ${esc(ev.title)}</a></div>
        <div class="tl-meta">${badge(ev.type)} ${badge(ev.status)}
          ${ev.location ? `<span class="faint mono small">📍 ${esc(ev.location)}</span>` : ""}
          ${noteCount ? `<span class="tl-notecount">✎ ${noteCount} note${noteCount === 1 ? "" : "s"}</span>` : ""}
        </div>
        ${ev.description ? `<div class="tl-desc">${esc(ev.description)}</div>` : ""}
        ${(plan || dec) ? `<div class="tl-links">${plan ? chip("plans", plan) : ""}${dec ? chip("decisions", dec) : ""}</div>` : ""}
      </div>
      <div class="tl-actions">${actBtn("✎", "edit-event", ev.id, "", true, "btn-xs")}${actBtn("+ Note", "add-note", ev.id, "", true, "btn-xs")}</div>
    </div>`;
  }
  if (!todayPlaced && events.length) html += `<div class="today-marker">Today · ${esc(today)}</div>`;

  /* --- campaign overview gantt --- */
  const allEvents = Store.all("events");
  const plansG = Store.all("plans");
  const dates = [
    ...plansG.flatMap(p => [p.start, p.end]),
    ...allEvents.flatMap(ev => [ev.start, ev.end]),
    today
  ].filter(Boolean).sort();
  let gantt = "";
  if (dates.length >= 2) {
    const t0 = new Date(dates[0]).getTime(), t1 = new Date(dates[dates.length - 1]).getTime();
    const span = (t1 - t0) || 1;
    const pad = span * 0.03;
    const lo = t0 - pad, range = span + pad * 2;
    const pct = iso => (((new Date(iso).getTime()) - lo) / range * 100).toFixed(2);
    const markCls = ev => ev.status === "Complete" ? "gm-complete" : ev.type === "Decision Point" ? "gm-decision" : ev.type === "Milestone" ? "gm-milestone" : "";
    const barCls = p => p.status === "Active" ? "gb-active" : p.status === "Planning" ? "gb-planning" : p.status === "Complete" ? "gb-complete" : "gb-other";
    const rows = plansG.map(p => {
      const bar = p.start ? `<a class="gantt-bar ${barCls(p)}" href="#/plans/${p.id}" style="left:${pct(p.start)}%;width:${Math.max(((new Date(p.end || p.start) - new Date(p.start)) / range) * 100, 1).toFixed(2)}%" title="${esc(p.code)} ${esc(p.name)} · ${esc(p.start)} → ${esc(p.end || "")}">${esc(p.code)}</a>` : "";
      const marks = allEvents.filter(ev => ev.planId === p.id && ev.start).map(ev =>
        `<a class="gantt-mark ${markCls(ev)}" href="#/events/${ev.id}" style="left:${pct(ev.start)}%" title="${esc(ev.code)} ${esc(ev.title)} · ${esc(ev.start)}"></a>`).join("");
      return `<div class="gantt-row"><div class="gantt-label">${esc(p.code)}</div><div class="gantt-lane">${bar}${marks}</div></div>`;
    }).join("");
    const looseMarks = allEvents.filter(ev => !ev.planId && ev.start).map(ev =>
      `<a class="gantt-mark ${markCls(ev)}" href="#/events/${ev.id}" style="left:${pct(ev.start)}%" title="${esc(ev.code)} ${esc(ev.title)} · ${esc(ev.start)}"></a>`).join("");
    const months = [];
    const cur = new Date(lo); cur.setDate(1);
    while (cur.getTime() < lo + range) {
      const iso = cur.toISOString().slice(0, 10);
      if (new Date(iso).getTime() >= lo) months.push(`<span style="left:${pct(iso)}%">${cur.toLocaleDateString(undefined, { month: "short" })}</span>`);
      cur.setMonth(cur.getMonth() + 1);
    }
    gantt = panel("Campaign Overview", `<div class="gantt">
        ${rows}
        <div class="gantt-row"><div class="gantt-label">Program</div><div class="gantt-lane">${looseMarks}</div></div>
        <div class="gantt-today" style="left:calc(128px + (100% - 136px) * ${(((new Date(today).getTime()) - lo) / range).toFixed(4)})" title="Today ${esc(today)}"></div>
        <div class="gantt-axis">${months.join("")}</div>
      </div>
      <div class="faint mono small" style="padding:0 4px 6px">◆ event &nbsp; <span style="color:var(--red)">◆</span> decision point &nbsp; <span style="color:var(--amber)">◆</span> milestone &nbsp; <span style="color:var(--green)">◆</span> complete &nbsp; | today</div>`);
  }

  return `
    ${pageHead([{ label: "Schedule" }], "Program Schedule",
      actBtn("+ New Event", "add-event", null, "", false),
      "Test events, reviews, range windows, and decision points on one timeline. Open an event to track it and add dated notes.")}
    ${gantt}
    <div class="filter-bar">
      <select data-filter="type"><option value="">All types</option>${EVENT_TYPES.map(t => `<option ${typeF === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      <select data-filter="status"><option value="">All statuses</option>${EVENT_STATUSES.map(s => `<option ${statF === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      <span class="faint mono small">${events.length} shown</span>
    </div>
    ${html || emptyMsg("No events match the filter — add the first one.")}`;
};

Views.eventDetail = function (id) {
  const ev = Store.get("events", id);
  if (!ev) return notFound("Event");
  const plan = ev.planId ? Store.get("plans", ev.planId) : null;
  const dec = ev.decisionId ? Store.get("decisions", ev.decisionId) : null;
  const notes = (ev.notes || []).slice().sort((a, b) => Store.compareRuns(a, b));

  const notesHtml = notes.length ? notes.map(n => `
    <div class="note-item">
      <span class="note-date">${esc(n.date || "")}</span>
      <span class="note-text">${esc(n.text)}</span>
      <span class="inline-actions">${actBtn("✎", "edit-note", n.id, `data-event="${ev.id}"`, true, "btn-xs")}${actBtn("✕", "del-note", n.id, `data-event="${ev.id}"`, true, "btn-xs")}</span>
    </div>`).join("") : emptyMsg("No notes yet — use “+ Note” to log status, observations, or changes.");

  return `
    ${pageHead(
      [{ label: "Schedule", href: "#/schedule" }, { label: ev.code }],
      `<span class="code-inline">${esc(ev.code)}</span>${esc(ev.title)}`,
      actBtn("Edit", "edit-event", ev.id) + actBtn("Delete", "del-event", ev.id) + actBtn("+ Note", "add-note", ev.id, "", false),
      esc(ev.description || ""))}
    <div class="grid-2">
      <div>
        ${panel("Event", `
          <dl class="def-grid">
            <dt>Type</dt><dd>${badge(ev.type)}</dd>
            <dt>Status</dt><dd>${badge(ev.status)}</dd>
            <dt>Date</dt><dd class="mono">${esc(ev.start || "—")}${ev.end ? ` → ${esc(ev.end)}` : ""}</dd>
            <dt>Location</dt><dd>${esc(ev.location || "—")}</dd>
            <dt>Test Plan</dt><dd>${plan ? chip("plans", plan) : `<span class="faint">—</span>`}</dd>
            <dt>Decision</dt><dd>${dec ? chip("decisions", dec) : `<span class="faint">—</span>`}</dd>
          </dl>`)}
      </div>
      <div>
        <div class="panel">
          <div class="panel-head"><h2>Notes Log</h2><div class="spacer"></div>${actBtn("+ Note", "add-note", ev.id)}</div>
          <div class="panel-body tight">${notesHtml}</div>
        </div>
      </div>
    </div>`;
};

/* ================= RESOURCES / M&S VV&A ================= */
Views.resources = function () {
  const rows = Store.all("resources").map(r => {
    const cases = Store.casesOfResource(r.id);
    return `<tr>
      <td>${codeLink("resources", r)}</td>
      <td><a href="#/resources/${r.id}">${esc(r.name)}</a><div class="faint small">${esc(r.description)}</div></td>
      <td>${badge(r.type, "b-purple")}</td>
      <td>${r.vvaRequired ? badge(r.verification) : `<span class="faint small">n/a</span>`}</td>
      <td>${r.vvaRequired ? badge(r.validation) : `<span class="faint small">n/a</span>`}</td>
      <td>${r.vvaRequired ? badge(r.accreditation) : `<span class="faint small">n/a</span>`}</td>
      <td class="num">${cases.length}</td>
    </tr>`;
  }).join("");
  return `
    ${pageHead([{ label: "M&S / VV&A" }], "Resources & M&S Assets",
      actBtn("+ New Resource", "add-resource", null, "", false),
      "Models, simulations, HWIL rigs, referent datasets, and instrumentation. M&S assets carry Verification, Validation, and Accreditation state (DoDI 5000.61 / MIL-STD-3022); test cases that use unaccredited assets are flagged with a data-credibility caveat.")}
    ${panel("Register", rows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Asset / Resource</th><th>Type</th><th>Verification</th><th>Validation</th><th>Accreditation</th><th>Cases</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No resources registered."), "", true)}`;
};

Views.resourceDetail = function (id) {
  const r = Store.get("resources", id);
  if (!r) return notFound("Resource");
  const cases = Store.casesOfResource(id);
  const art = r.artifacts || {};

  const track = (label, key, statuses) => {
    const cur = r[key] || statuses[0];
    const idx = statuses.indexOf(cur);
    const next = idx >= 0 && idx < statuses.length - 1 ? statuses[idx + 1] : null;
    // "Not Accredited" is an off-ramp, never the auto-advance target
    const nextOk = next && next !== "Not Accredited" ? next : null;
    return `<div class="mit-item s-${cur === "Complete" || cur === "Accredited" ? "complete" : cur === "Not Started" ? "" : "inprogress"}">
      <div class="mit-flow"><div class="mit-dot"></div></div>
      <div class="mit-body">
        <div class="mit-text"><b>${esc(label)}</b></div>
        <div class="mit-meta">${badge(cur)}</div>
      </div>
      <div class="mit-actions">
        ${nextOk ? actBtn(`→ ${nextOk}`, "advance-vva", r.id, `data-track="${key}"`, false, "btn-xs") : ""}
      </div>
    </div>`;
  };

  const artHtml = Object.keys(ARTIFACT_LABELS).map(k => `
    <div class="crit ${art[k] ? "met" : ""}">
      <button class="crit-toggle ${art[k] ? "met" : "open"}" data-act="toggle-artifact" data-id="${r.id}" data-key="${k}">${art[k] ? "✓ Done" : "○ Open"}</button>
      <span class="crit-text">${esc(ARTIFACT_LABELS[k])}</span>
    </div>`).join("");

  return `
    ${pageHead(
      [{ label: "M&S / VV&A", href: "#/resources" }, { label: r.code }],
      `<span class="code-inline">${esc(r.code)}</span>${esc(r.name)}`,
      actBtn("Edit", "edit-resource", r.id) + actBtn("Delete", "del-resource", r.id),
      esc(r.description))}
    <div class="grid-2">
      <div>
        ${panel("Profile", `
          <dl class="def-grid">
            <dt>Type</dt><dd>${badge(r.type, "b-purple")}</dd>
            <dt>VV&A Required</dt><dd>${r.vvaRequired ? badge("Yes", "b-amber") : badge("No", "b-grey")}</dd>
            <dt>Owner</dt><dd>${esc(r.owner || "—")}</dd>
            <dt>Accred. Authority</dt><dd>${esc(r.authority || "—")}</dd>
            ${r.accDate ? `<dt>Accredited On</dt><dd class="mono">${esc(r.accDate)}</dd>` : ""}
          </dl>`)}
        ${panel("Intended Use", `<p style="margin:0">${esc(r.intendedUse || "Not stated — accreditation is always for a specific intended use.")}</p>
          ${r.accScope ? `<div class="section-gap"></div><dl class="def-grid"><dt>Accred. Scope</dt><dd>${esc(r.accScope)}</dd></dl>` : ""}`)}
        ${panel("Used By Test Cases", chips("cases", cases, "No test cases reference this resource"))}
      </div>
      <div>
        ${r.vvaRequired ? `
        <div class="panel">
          <div class="panel-head"><h2>VV&A Progress</h2></div>
          <div class="flow-strip"><span class="fstep">Verify</span><span class="farrow">→</span><span class="fstep">Validate</span><span class="farrow">→</span><span class="fstep">Accredit for intended use</span></div>
          <div class="panel-body tight">
            ${track("Verification — model built right (vs conceptual model / spec)", "verification", VV_STATUSES)}
            ${track("Validation — model is right (vs referent / real-world data)", "validation", VV_STATUSES)}
            ${track("Accreditation — official determination for intended use", "accreditation", ACC_STATUSES)}
          </div>
        </div>
        ${panel("VV&A Artifacts (MIL-STD-3022)", `<div class="crit-list">${artHtml}</div>`, "", true)}`
        : panel("VV&A", `<span class="faint">Marked as a conventional test resource — no accreditation tracking. Edit the resource to enable VV&A.</span>`)}
      </div>
    </div>`;
};

/* ================= INTERCHANGE ================= */
Views.interchange = function () {
  const nReq = Store.all("requirements").length;
  const nCase = Store.all("cases").length;
  return `
    ${pageHead([{ label: "Interchange" }], "Import / Export", "",
      "Move data between this console and your team's tools. Current targets: Jira RTM (requirements + traceability) and Zephyr (test cases). Full-database JSON backup lives here too.")}
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

/* ================= SEARCH ================= */
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
  /* ---- systems ---- */
  "add-system": () => Modal.open("New System", systemFields(), {}, v => {
    const s = Store.add("systems", v);
    Toast.show(`${s.code} created`); App.go(`#/systems/${s.id}`);
  }),
  "edit-system": id => Modal.open("Edit System", systemFields(), Store.get("systems", id), v => {
    Store.update("systems", id, v); Toast.show("Saved"); App.render();
  }),
  "del-system": id => {
    const s = Store.get("systems", id);
    Modal.confirm(`Delete ${s.code} “${s.name}” and ALL its components and their test cases?`, () => {
      Store.remove("systems", id); toastUndo("System deleted"); App.go("#/systems");
    });
  },

  /* ---- components ---- */
  "add-component": systemId => Modal.open("New Component", componentFields(), { systemId }, v => {
    const c = Store.add("components", placeComponent(v));
    Toast.show(`${c.code} created`); App.go(`#/components/${c.id}`);
  }),
  "add-subcomponent": parentId => {
    const parent = Store.get("components", parentId);
    Modal.open(`New Subcomponent of ${parent.code}`, componentFields(), { systemId: parent.systemId, parentComponentId: parent.id }, v => {
      const c = Store.add("components", placeComponent(v));
      Toast.show(`${c.code} created under ${parent.code}`); App.go(`#/components/${c.id}`);
    });
  },
  "edit-component": id => Modal.open("Edit Component", componentFields(id), Store.get("components", id), v => {
    const before = Store.get("components", id).systemId;
    v = placeComponent(v);
    Store.update("components", id, v);
    // Moving to another system takes the whole subtree along so the hierarchy stays intact.
    if (v.systemId !== before) for (const d of Store.descendantIds(id)) if (d !== id) Store.update("components", d, { systemId: v.systemId });
    Toast.show("Saved"); App.render();
  }),
  "del-component": id => {
    const c = Store.get("components", id);
    Modal.confirm(`Delete ${c.code} “${c.name}” and its test cases?`, () => {
      const sysId = c.systemId;
      Store.remove("components", id); toastUndo("Component deleted"); App.go(`#/systems/${sysId}`);
    });
  },

  /* ---- requirements ---- */
  "add-requirement": () => Modal.open("New Requirement", requirementFields(), {}, v => {
    const r = Store.add("requirements", v);
    Toast.show(`${r.code} created`); App.go(`#/requirements/${r.id}`);
  }),
  "edit-requirement": id => Modal.open("Edit Requirement", requirementFields(), Store.get("requirements", id), v => {
    Store.update("requirements", id, v); Toast.show("Saved"); App.render();
  }),
  "del-requirement": id => {
    const r = Store.get("requirements", id);
    Modal.confirm(`Delete ${r.code} “${r.title}”? Trace links from test cases and risks will be removed.`, () => {
      Store.remove("requirements", id); toastUndo("Requirement deleted"); App.go("#/requirements");
    });
  },

  /* ---- test cases ---- */
  "add-case": componentId => Modal.open("New Test Case", caseFields(componentId), { componentId, status: "Draft", priority: "Medium" }, v => {
    const tc = Store.add("cases", placeCase(v));
    Toast.show(`${tc.code} created`); App.go(`#/cases/${tc.id}`);
  }),
  "edit-case": id => Modal.open("Edit Test Case", caseFields(), Store.get("cases", id), v => {
    Store.update("cases", id, placeCase(v)); Toast.show("Saved"); App.render();
  }),
  "del-case": id => {
    const tc = Store.get("cases", id);
    Modal.confirm(`Delete ${tc.code} “${tc.title}” and its run history?`, () => {
      Store.remove("cases", id); toastUndo("Test case deleted"); App.go("#/cases");
    });
  },

  "assign-plan": id => {
    const tc = Store.get("cases", id);
    const current = Store.plansOf(id).map(p => p.id);
    Modal.open(`Assign ${tc.code} to Plans`, [
      { key: "planIds", label: "Test Plans", type: "multicheck", options: Store.all("plans").map(p => ({ value: p.id, code: p.code, label: p.name })) }
    ], { planIds: current }, v => {
      const want = new Set(v.planIds);
      Store.all("plans").forEach(p => {
        const has = (p.caseIds || []).includes(id);
        if (want.has(p.id) && !has) p.caseIds.push(id);
        if (!want.has(p.id) && has) p.caseIds = p.caseIds.filter(x => x !== id);
      });
      Store.save(); Toast.show("Plan assignment updated"); App.render();
    }, "Assign");
  },

  "unassign-plan": (id, el) => {
    const planId = el.dataset.plan;
    const p = Store.get("plans", planId);
    if (!p) return;
    p.caseIds = p.caseIds.filter(x => x !== id);
    Store.save(); Toast.show("Removed from plan"); App.render();
  },

  "plan-add-cases": planId => {
    const p = Store.get("plans", planId);
    Modal.open(`Assign Cases to ${p.code}`, [
      { key: "caseIds", label: "Test Cases", type: "multicheck", options: Store.all("cases").map(tc => ({ value: tc.id, code: tc.code, label: tc.title })) }
    ], { caseIds: p.caseIds || [] }, v => {
      Store.update("plans", planId, { caseIds: v.caseIds });
      Toast.show("Plan updated"); App.render();
    }, "Assign");
  },

  /* ---- runs ---- */
  "record-run": caseId => openRunForm({ caseId }),
  "record-run-plan": (caseId, el) => openRunForm({ caseId, planId: el.dataset.plan }),
  "record-run-any": () => openRunForm({}),
  "edit-run": id => {
    const r = Store.get("runs", id);
    Modal.open(`Edit ${r.code}`, runFields(), r, v => {
      Store.update("runs", id, v); Toast.show("Run updated"); App.render();
    });
  },
  "del-run": id => Modal.confirm("Delete this run record?", () => {
    Store.remove("runs", id); toastUndo("Run deleted"); App.render();
  }),

  /* ---- procedures ---- */
  "add-procedure": () => Modal.open("New Procedure", procedureFields(), {}, v => {
    v.steps = splitSteps(v.stepsText); delete v.stepsText;
    const p = Store.add("procedures", v);
    Toast.show(`${p.code} created`); App.go(`#/procedures/${p.id}`);
  }),
  "edit-procedure": id => {
    const p = Store.get("procedures", id);
    Modal.open("Edit Procedure", procedureFields(), Object.assign({}, p, { stepsText: (p.steps || []).join("\n") }), v => {
      v.steps = splitSteps(v.stepsText); delete v.stepsText;
      Store.update("procedures", id, v); Toast.show("Saved"); App.render();
    });
  },
  "del-procedure": id => {
    const p = Store.get("procedures", id);
    Modal.confirm(`Delete ${p.code} “${p.title}” and its entry/exit criteria?`, () => {
      Store.remove("procedures", id); toastUndo("Procedure deleted"); App.go("#/procedures");
    });
  },

  /* ---- procedure steps ---- */
  "add-step": procId => Modal.open("Add Step", [
    { key: "text", label: "Step", type: "textarea", required: true }
  ], {}, v => {
    const p = Store.get("procedures", procId);
    p.steps = p.steps || [];
    p.steps.push(v.text);
    Store.logAudit("procedures", p, "updated", `step ${p.steps.length} added`);
    Store.save(); Toast.show("Step added"); App.render();
  }),
  "edit-step": (idx, el) => {
    const p = Store.get("procedures", el.dataset.proc);
    const i = Number(idx);
    Modal.open(`Edit Step ${i + 1}`, [
      { key: "text", label: "Step", type: "textarea", required: true }
    ], { text: p.steps[i] }, v => {
      p.steps[i] = v.text;
      Store.logAudit("procedures", p, "updated", `step ${i + 1} edited`);
      Store.save(); Toast.show("Step updated"); App.render();
    });
  },
  "del-step": (idx, el) => {
    Store.checkpoint();
    const p = Store.get("procedures", el.dataset.proc);
    const i = Number(idx);
    p.steps.splice(i, 1);
    Store.logAudit("procedures", p, "updated", `step ${i + 1} removed`);
    Store.save(); toastUndo("Step removed"); App.render();
  },

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

  /* ---- documents ---- */
  "add-doc-link": () => openDocModal(null, null),
  "add-doc-upload": () => {
    const input = document.getElementById("doc-file");
    if (input) input.click();
    else App.go("#/documents"); // input lives on the documents page
  },
  "edit-doc": id => openDocModal(Store.get("documents", id), null),
  "del-doc": id => {
    const d = Store.get("documents", id);
    Modal.confirm(`Delete ${d.code} “${d.title}”${d.dataUrl ? " and its embedded file" : ""}?`, () => {
      Store.remove("documents", id); toastUndo("Document deleted"); App.render();
    });
  },
  "doc-download": id => {
    const d = Store.get("documents", id);
    if (!d || !d.dataUrl) return;
    try {
      const match=d.dataUrl.match(/^data:[^,]*;base64,([A-Za-z0-9+/]*={0,2})$/);
      if(!match)throw new Error('Invalid attachment');
      const bytes=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));
      IO.download(d.fileName || 'document',bytes,'application/octet-stream');
    } catch (_) { Toast.show('Could not decode the embedded file',true); }
  },

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

  /* ---- criteria ---- */
  "add-crit-entry": (id, el) => openCritForm(id, el.dataset.parent || "procedure", "entry"),
  "add-crit-exit": (id, el) => openCritForm(id, el.dataset.parent || "procedure", "exit"),
  "edit-crit": id => {
    const c = Store.get("criteria", id);
    Modal.open(`Edit ${c.kind === "entry" ? "Entry" : "Exit"} Criterion`, [
      { key: "text", label: "Criterion", type: "textarea", required: true }
    ], c, v => { Store.update("criteria", id, v); Toast.show("Saved"); App.render(); });
  },
  "del-crit": id => Modal.confirm("Delete this criterion?", () => {
    Store.remove("criteria", id); toastUndo("Criterion deleted"); App.render();
  }),
  "cycle-crit": id => {
    const c = Store.get("criteria", id);
    const next = { open: "met", met: "waived", waived: "open" }[c.status] || "met";
    Store.update("criteria", id, { status: next });
    App.render();
  },

  /* ---- plans ---- */
  "add-plan": () => Modal.open("New Test Plan", planFields(), { status: "Planning", caseIds: [] }, v => {
    v.caseIds = v.caseIds || [];
    const p = Store.add("plans", v);
    Toast.show(`${p.code} created`); App.go(`#/plans/${p.id}`);
  }),
  "edit-plan": id => Modal.open("Edit Test Plan", planFields(), Store.get("plans", id), v => {
    Store.update("plans", id, v); Toast.show("Saved"); App.render();
  }),
  "del-plan": id => {
    const p = Store.get("plans", id);
    Modal.confirm(`Delete ${p.code} “${p.name}”? Test cases themselves are kept.`, () => {
      Store.remove("plans", id); toastUndo("Plan deleted"); App.go("#/plans");
    });
  },

  /* ---- risks ---- */
  "add-risk": () => Modal.open("New Risk", riskFields(), { likelihood: 3, impact: 3, status: "Open" }, v => {
    v.mitigations = [];
    v.initialLikelihood = v.likelihood;
    v.initialImpact = v.impact;
    const r = Store.add("risks", v);
    Toast.show(`${r.code} created`); App.go(`#/risks/${r.id}`);
  }),
  "edit-risk": id => Modal.open("Edit Risk", riskFields(), Store.get("risks", id), v => {
    Store.update("risks", id, v); Toast.show("Saved"); App.render();
  }),
  "del-risk": id => {
    const r = Store.get("risks", id);
    Modal.confirm(`Delete ${r.code} “${r.title}” and its mitigation history?`, () => {
      Store.remove("risks", id); toastUndo("Risk deleted"); App.go("#/risks");
    });
  },

  "trace-gaps": (id, el) => {
    const p = App.params();
    if (el.checked) p.set("gaps", "1"); else p.delete("gaps");
    const q = p.toString();
    App.go(`#/trace${q ? "?" + q : ""}`);
  },

  "matrix-cell": (id, el) => {
    App.go(`#/risks?l=${el.dataset.l}&i=${el.dataset.i}${App.params().get("closed") === "1" ? "&closed=1" : ""}`);
  },
  "matrix-clear": () => App.go("#/risks"),
  "toggle-closed": (id, el) => {
    const p = App.params();
    const base = p.get("l") ? `l=${p.get("l")}&i=${p.get("i")}&` : "";
    App.go(`#/risks?${base}${el.checked ? "closed=1" : ""}`);
  },

  /* ---- mitigations ---- */
  "add-mit": riskId => Modal.open("New Mitigation Step", mitFields(), { status: "Proposed" }, v => {
    const r = Store.get("risks", riskId);
    v.id = Store.nextId("mitigations");
    r.mitigations = r.mitigations || [];
    r.mitigations.push(v);
    Store.save(); Toast.show("Mitigation step added"); App.render();
  }),
  "edit-mit": (id, el) => {
    const r = Store.get("risks", el.dataset.risk);
    const m = (r.mitigations || []).find(x => x.id === id);
    Modal.open("Edit Mitigation Step", mitFields(), m, v => {
      Object.assign(m, v); Store.save(); Toast.show("Saved"); App.render();
    });
  },
  "del-mit": (id, el) => Modal.confirm("Delete this mitigation step?", () => {
    Store.checkpoint();
    const r = Store.get("risks", el.dataset.risk);
    r.mitigations = (r.mitigations || []).filter(x => x.id !== id);
    Store.save(); toastUndo("Step deleted"); App.render();
  }),
  "advance-mit": (id, el) => {
    const r = Store.get("risks", el.dataset.risk);
    const m = (r.mitigations || []).find(x => x.id === id);
    const idx = MIT_FLOW.indexOf(m.status);
    if (idx >= 0 && idx < MIT_FLOW.length - 1) {
      m.status = MIT_FLOW[idx + 1];
      Store.save(); Toast.show(`Step advanced to ${m.status}`); App.render();
    }
  },

  /* ---- defects ---- */
  "add-defect": () => openDefectForm({}),
  "add-defect-case": id => {
    const tc = Store.get("cases", id);
    openDefectForm({ caseIds: [id], componentId: tc ? tc.componentId : "" });
  },
  "add-defect-comp": id => openDefectForm({ componentId: id }),
  "edit-defect": id => Modal.open("Edit Defect", defectFields(), Store.get("defects", id), v => {
    if (v.status === "Closed" && !Store.get("defects", id).closed) v.closed = todayISO();
    Store.update("defects", id, v); Toast.show("Saved"); App.render();
  }),
  "del-defect": id => {
    const d = Store.get("defects", id);
    Modal.confirm(`Delete ${d.code} “${d.title}”?`, () => {
      Store.remove("defects", id); toastUndo("Defect deleted"); App.go("#/defects");
    });
  },
  "advance-defect": id => {
    const d = Store.get("defects", id);
    const idx = DEFECT_STATUSES.indexOf(d.status);
    if (idx >= 0 && idx < DEFECT_STATUSES.indexOf("Closed")) {
      const patch = { status: DEFECT_STATUSES[idx + 1] };
      if (patch.status === "Closed") patch.closed = todayISO();
      Store.update("defects", id, patch);
      Toast.show(`${d.code} → ${patch.status}`); App.render();
    }
  },

  /* ---- case under a procedure (reframed hierarchy) ---- */
  "add-case-proc": procId => Modal.open("New Test Case", caseFields(), { procedureId: procId, status: "Draft", priority: "Medium" }, v => {
    const tc = Store.add("cases", placeCase(v));
    Toast.show(`${tc.code} created`); App.go(`#/cases/${tc.id}`);
  }),

  "print-page": () => window.print(),

  /* ---- execute mode ---- */
  "exec-save": id => {
    const tc = Store.get("cases", id);
    if (!tc) return;
    const val = elId => { const el = document.getElementById(elId); return el ? el.value.trim() : ""; };
    const date = val("exec-date");
    if (!date) { Toast.show("Date is required", true); return; }
    const result = val("exec-result") || "Pass";
    const boxes = Array.from(document.querySelectorAll("[data-exec-step]"));
    const unchecked = boxes.filter(cb => !cb.checked).map(cb => Number(cb.dataset.execStep) + 1);
    let notes = val("exec-notes");
    if (boxes.length && unchecked.length) {
      const line = unchecked.length === boxes.length ? "No procedure steps checked off." : `Steps not completed: ${unchecked.join(", ")}.`;
      notes += (notes ? "\n" : "") + line;
    }
    const params = App.params(), trun = params.get("tr") ? Store.get("testRuns", params.get("tr")) : null;
    const record = {
      caseId: id, date, operator: val("exec-operator"), planId: val("exec-plan") || null,
      result, measured: val("exec-measured"), evidence: val("exec-evidence"), notes
    };
    if (trun) record.testRunId = trun.id;
    const run = Store.add("runs", record);

    Toast.show(`${run.code} recorded — ${result}`);
    if (trun) { App.anchor(`trc-${id}`); App.go(testRunHref(trun.id, params.get("comp"))); }
    else App.go(`#/cases/${id}`);
    if (result === "Fail") {
      openDefectForm({ caseIds: [id], componentId: tc.componentId, runId: run.id, title: `${tc.code}: ` });
    }
  },

  /* ---- inline status cycling ---- */
  "cycle-case-status": id => {
    const tc = Store.get("cases", id);
    // Retirement is a disposition (Review / Removal panel), never a click-through state.
    const cycle = CASE_STATUSES.filter(s => s !== "Retired");
    const next = cycle[(cycle.indexOf(tc.status) + 1) % cycle.length];
    Store.update("cases", id, { status: next });
    App.render();
  },
  "cycle-defect-status": id => {
    const d = Store.get("defects", id);
    const next = DEFECT_STATUSES[(DEFECT_STATUSES.indexOf(d.status) + 1) % DEFECT_STATUSES.length];
    const patch = { status: next };
    if (next === "Closed" && !d.closed) patch.closed = todayISO();
    if (next === "Open") patch.closed = "";
    Store.update("defects", id, patch);
    App.render();
  },

  /* ---- bulk actions (cases list) ---- */
  "bulk-assign-plan": () => {
    const sel = [...App.bulkSel];
    if (!sel.length) return;
    Modal.open(`Assign ${sel.length} Case${sel.length === 1 ? "" : "s"} to Plan`, [
      { key: "planId", label: "Test Plan", type: "select", required: true, options: Store.all("plans").map(p => ({ value: p.id, label: `${p.code} ${p.name}` })) }
    ], {}, v => {
      const p = Store.get("plans", v.planId);
      if (!p) return;
      const set = new Set(p.caseIds || []);
      sel.forEach(x => set.add(x));
      Store.update("plans", p.id, { caseIds: [...set] });
      App.bulkSel.clear();
      Toast.show(`${sel.length} case${sel.length === 1 ? "" : "s"} assigned to ${p.code}`);
      App.render();
    }, "Assign");
  },
  "bulk-status": () => {
    const sel = [...App.bulkSel];
    if (!sel.length) return;
    Modal.open(`Set Status on ${sel.length} Case${sel.length === 1 ? "" : "s"}`, [
      { key: "status", label: "Status", type: "select", required: true, options: CASE_STATUSES }
    ], {}, v => {
      sel.forEach(x => Store.update("cases", x, { status: v.status }));
      App.bulkSel.clear();
      Toast.show(`${sel.length} case${sel.length === 1 ? "" : "s"} → ${v.status}`);
      App.render();
    }, "Apply");
  },
  "bulk-clear": () => { App.bulkSel.clear(); App.render(); },

  /* ---- decisions (IDSK) ---- */
  "add-decision": () => Modal.open("New Decision", decisionFields(), { status: "Pending", requirementIds: [] }, v => {
    const d = Store.add("decisions", v);
    Toast.show(`${d.code} created`); App.go(`#/decisions/${d.id}`);
  }),
  "edit-decision": id => Modal.open("Edit Decision", decisionFields(), Store.get("decisions", id), v => {
    Store.update("decisions", id, v); Toast.show("Saved"); App.render();
  }),
  "del-decision": id => {
    const d = Store.get("decisions", id);
    Modal.confirm(`Delete ${d.code} “${d.title}”? Plans and events lose their link to it.`, () => {
      Store.remove("decisions", id); toastUndo("Decision deleted"); App.go("#/idsk");
    });
  },

  /* ---- schedule events & notes ---- */
  "add-event": () => Modal.open("New Schedule Event", eventFields(), { status: "Planned", start: todayISO(), notes: [] }, v => {
    v.notes = [];
    const ev = Store.add("events", v);
    Toast.show(`${ev.code} created`); App.go(`#/events/${ev.id}`);
  }),
  "edit-event": id => {
    const ev = Store.get("events", id);
    Modal.open(`Edit ${ev.code}`, eventFields(), ev, v => {
      Store.update("events", id, v); Toast.show("Saved"); App.render();
    });
  },
  "del-event": id => {
    const ev = Store.get("events", id);
    Modal.confirm(`Delete ${ev.code} “${ev.title}” and its notes?`, () => {
      Store.remove("events", id); toastUndo("Event deleted"); App.go("#/schedule");
    });
  },
  "add-note": id => Modal.open("Add Note", [
    { key: "date", label: "Date", type: "date", required: true, half: true, default: todayISO() },
    { key: "text", label: "Note", type: "textarea", required: true }
  ], {}, v => {
    const ev = Store.get("events", id);
    ev.notes = ev.notes || [];
    ev.notes.push({ id: Store.nextId("notes"), date: v.date, text: v.text });
    Store.save(); Toast.show("Note added"); App.render();
  }),
  "edit-note": (id, el) => {
    const ev = Store.get("events", el.dataset.event);
    const n = (ev.notes || []).find(x => x.id === id);
    Modal.open("Edit Note", [
      { key: "date", label: "Date", type: "date", required: true, half: true },
      { key: "text", label: "Note", type: "textarea", required: true }
    ], n, v => { Object.assign(n, v); Store.save(); Toast.show("Note updated"); App.render(); });
  },
  "del-note": (id, el) => Modal.confirm("Delete this note?", () => {
    Store.checkpoint();
    const ev = Store.get("events", el.dataset.event);
    ev.notes = (ev.notes || []).filter(x => x.id !== id);
    Store.save(); toastUndo("Note deleted"); App.render();
  }),

  /* ---- resources / VV&A ---- */
  "add-resource": () => Modal.open("New Resource / M&S Asset", resourceFields(),
    { vvaRequired: "yes", verification: "Not Started", validation: "Not Started", accreditation: "Not Started" }, v => {
      v.vvaRequired = v.vvaRequired === "yes";
      v.artifacts = { accPlan: false, vvPlan: false, vvReport: false, accReport: false };
      const r = Store.add("resources", v);
      Toast.show(`${r.code} created`); App.go(`#/resources/${r.id}`);
    }),
  "edit-resource": id => {
    const r = Store.get("resources", id);
    Modal.open("Edit Resource", resourceFields(), Object.assign({}, r, { vvaRequired: r.vvaRequired ? "yes" : "no" }), v => {
      v.vvaRequired = v.vvaRequired === "yes";
      Store.update("resources", id, v); Toast.show("Saved"); App.render();
    });
  },
  "del-resource": id => {
    const r = Store.get("resources", id);
    Modal.confirm(`Delete ${r.code} “${r.name}”? Links from test cases will be removed.`, () => {
      Store.remove("resources", id); toastUndo("Resource deleted"); App.go("#/resources");
    });
  },
  "advance-vva": (id, el) => {
    const r = Store.get("resources", id);
    const track = el.dataset.track;
    const statuses = track === "accreditation" ? ACC_STATUSES : VV_STATUSES;
    const idx = statuses.indexOf(r[track] || statuses[0]);
    if (idx >= 0 && idx < statuses.length - 1 && statuses[idx + 1] !== "Not Accredited") {
      const patch = {}; patch[track] = statuses[idx + 1];
      if (track === "accreditation" && patch[track] === "Accredited" && !r.accDate) {
        patch.accDate = new Date().toISOString().slice(0, 10);
      }
      Store.update("resources", id, patch);
      Toast.show(`${track} → ${patch[track]}`); App.render();
    }
  },
  "toggle-artifact": (id, el) => {
    const r = Store.get("resources", id);
    r.artifacts = r.artifacts || {};
    r.artifacts[el.dataset.key] = !r.artifacts[el.dataset.key];
    Store.save(); App.render();
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
};

/* ---------- form field definitions ---------- */
function systemFields() {
  return [
    { key: "name", label: "Name", required: true },
    { key: "description", label: "Description", type: "textarea" }
  ];
}
function componentFields(selfId) {
  // A component cannot be nested under itself or its own descendants.
  const blocked = selfId ? Store.descendantIds(selfId) : new Set();
  return [
    { key: "name", label: "Name", required: true, half: true },
    { key: "systemId", label: "System", type: "select", required: true, half: true, options: Store.all("systems").map(s => ({ value: s.id, label: `${s.code} ${s.name}` })) },
    { key: "parentComponentId", label: "Parent Component (blank = top-level; must be in the same system)", type: "select", allowEmpty: true,
      options: componentOptions(c => !blocked.has(c.id)) },
    { key: "description", label: "Description", type: "textarea" }
  ];
}
function requirementFields() {
  return [
    { key: "title", label: "Short Title", required: true },
    { key: "text", label: "Requirement Text (“shall …”)", type: "textarea", required: true },
    { key: "type", label: "Type", type: "select", half: true, options: REQ_TYPES },
    { key: "priority", label: "Priority", type: "select", half: true, options: PRIORITIES },
    { key: "method", label: "Verification Method", type: "select", half: true, options: VERIF_METHODS },
    { key: "measure", label: "Measure (DEF)", type: "select", half: true, options: MEASURES },
    { key: "threshold", label: "Threshold", half: true },
    { key: "objective", label: "Objective", half: true },
    { key: "extKey", label: "Jira Issue Key (sync)", half: true },
    { key: "componentIds", label: "Traced Components", type: "multicheck", options: Store.all("components").map(c => ({ value: c.id, code: c.code, label: c.name })) }
  ];
}
function caseFields(componentId) {
  return [
    { key: "title", label: "Title", required: true },
    { key: "objective", label: "Objective", type: "textarea" },
    { key: "componentId", label: "Component (blank = system-level case)", type: "select", allowEmpty: true, half: true, default: componentId, options: componentOptions() },
    { key: "systemId", label: "System (required for system-level cases)", type: "select", allowEmpty: true, half: true, options: Store.all("systems").map(s => ({ value: s.id, label: `${s.code} ${s.name}` })) },
    { key: "procedureId", label: "Procedure", type: "select", half: true, allowEmpty: true, options: Store.all("procedures").map(p => ({ value: p.id, label: `${p.code} ${p.title}` })) },
    { key: "priority", label: "Priority", type: "select", half: true, options: PRIORITIES },
    { key: "status", label: "Status", type: "select", half: true, options: CASE_STATUSES },
    { key: "venue", label: "Venue (LVC)", type: "select", half: true, allowEmpty: true, options: VENUES },
    { key: "testType", label: "Test Type", type: "select", half: true, allowEmpty: true, options: TEST_TYPES },
    { key: "extKey", label: "Jira / Zephyr Issue Key (sync)", half: true },
    { key: "preconditions", label: "Preconditions", type: "textarea" },
    { key: "testData", label: "Test Data", type: "textarea" },
    { key: "expectedResults", label: "Expected Results", type: "textarea" },
    { key: "passFailCriteria", label: "Pass / Fail Criteria", type: "textarea" },
    { key: "requirementIds", label: "Verifies Requirements", type: "multicheck", options: Store.all("requirements").map(r => ({ value: r.id, code: r.code, label: r.title })) },
    { key: "resourceIds", label: "Resources / M&S Assets Used", type: "multicheck", options: Store.all("resources").map(r => ({ value: r.id, code: r.code, label: r.name })) }
  ];
}
function procedureFields() {
  return [
    { key: "title", label: "Title", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "stepsText", label: "Steps (one per line)", type: "textarea" }
  ];
}
function planFields() {
  return [
    { key: "name", label: "Name", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "phase", label: "Phase", half: true },
    { key: "status", label: "Status", type: "select", half: true, options: PLAN_STATUSES },
    { key: "start", label: "Start", type: "date", half: true },
    { key: "end", label: "End", type: "date", half: true },
    { key: "extKey", label: "Jira / Zephyr Issue Key (sync)", half: true },
    { key: "decisionId", label: "Supports Decision (IDSK)", type: "select", half: true, allowEmpty: true, options: Store.all("decisions").map(d => ({ value: d.id, label: `${d.code} ${d.title}` })) },
    { key: "regressionSystemId", label: "Regression Scope System (Auto-Fill / Full Regression)", type: "select", half: true, allowEmpty: true, options: Store.all("systems").map(s => ({ value: s.id, label: `${s.code} ${s.name}` })) }
  ];
}

function decisionFields() {
  return [
    { key: "title", label: "Title", required: true },
    { key: "description", label: "Description", type: "textarea" },
    { key: "date", label: "Decision Date", type: "date", half: true },
    { key: "status", label: "Status", type: "select", half: true, options: DECISION_STATUSES },
    { key: "authority", label: "Decision Authority", half: true },
    { key: "requirementIds", label: "Informing Measures (Requirements)", type: "multicheck", options: Store.all("requirements").map(r => ({ value: r.id, code: r.code, label: `${r.title}${r.measure && r.measure !== "None" ? ` [${r.measure}]` : ""}` })) }
  ];
}

function eventFields() {
  return [
    { key: "title", label: "Title", required: true },
    { key: "type", label: "Type", type: "select", half: true, options: EVENT_TYPES },
    { key: "status", label: "Status", type: "select", half: true, options: EVENT_STATUSES },
    { key: "start", label: "Start Date", type: "date", required: true, half: true },
    { key: "end", label: "End Date (optional)", type: "date", half: true },
    { key: "location", label: "Location", half: true },
    { key: "planId", label: "Test Plan", type: "select", half: true, allowEmpty: true, options: Store.all("plans").map(p => ({ value: p.id, label: `${p.code} ${p.name}` })) },
    { key: "decisionId", label: "Related Decision", type: "select", half: true, allowEmpty: true, options: Store.all("decisions").map(d => ({ value: d.id, label: `${d.code} ${d.title}` })) },
    { key: "description", label: "Description", type: "textarea" }
  ];
}

function resourceFields() {
  return [
    { key: "name", label: "Name", required: true },
    { key: "type", label: "Type", type: "select", half: true, options: RES_TYPES },
    { key: "vvaRequired", label: "VV&A Required", type: "select", half: true, options: [{ value: "yes", label: "Yes — M&S asset needing accreditation" }, { value: "no", label: "No — conventional test resource" }] },
    { key: "description", label: "Description", type: "textarea" },
    { key: "intendedUse", label: "Intended Use Statement (drives accreditation scope)", type: "textarea" },
    { key: "owner", label: "Owner / Proponent", half: true },
    { key: "authority", label: "Accreditation Authority", half: true },
    { key: "verification", label: "Verification Status", type: "select", half: true, options: VV_STATUSES },
    { key: "validation", label: "Validation Status", type: "select", half: true, options: VV_STATUSES },
    { key: "accreditation", label: "Accreditation Status", type: "select", half: true, options: ACC_STATUSES },
    { key: "accDate", label: "Accreditation Date", type: "date", half: true },
    { key: "accScope", label: "Accreditation Scope / Caveats", type: "textarea" }
  ];
}
function runFields(fixedCase) {
  const f = [];
  if (!fixedCase) f.push({ key: "caseId", label: "Test Case", type: "select", required: true, options: Store.all("cases").map(tc => ({ value: tc.id, label: `${tc.code} ${tc.title}` })) });
  f.push(
    { key: "date", label: "Date", type: "date", required: true, half: true, default: new Date().toISOString().slice(0, 10) },
    { key: "result", label: "Result", type: "select", half: true, options: RUN_RESULTS },
    { key: "operator", label: "Operator", half: true },
    { key: "planId", label: "Under Plan", type: "select", half: true, allowEmpty: true, options: Store.all("plans").map(p => ({ value: p.id, label: `${p.code} ${p.name}` })) },
    { key: "measured", label: "Measured Value(s) — e.g. “26 ms P99”", half: true },
    { key: "extKey", label: "Jira / Zephyr Key (execution)", half: true },
    { key: "evidence", label: "Evidence Refs (one per line: file, link, log ID)", type: "textarea" },
    { key: "notes", label: "Notes / Observations", type: "textarea" }
  );
  return f;
}
function riskFields() {
  return [
    { key: "title", label: "Title", required: true },
    { key: "description", label: "Description", type: "textarea", required: true },
    { key: "category", label: "Category", type: "select", half: true, options: RISK_CATEGORIES },
    { key: "status", label: "Status", type: "select", half: true, options: RISK_STATUSES },
    { key: "likelihood", label: "Likelihood (1–5)", type: "number", min: 1, max: 5, required: true, half: true },
    { key: "impact", label: "Impact (1–5)", type: "number", min: 1, max: 5, required: true, half: true },
    { key: "residualLikelihood", label: "Residual Target L (1–5)", type: "number", min: 1, max: 5, half: true },
    { key: "residualImpact", label: "Residual Target I (1–5)", type: "number", min: 1, max: 5, half: true },
    { key: "owner", label: "Owner", half: true },
    { key: "relatedRequirementIds", label: "Affected Requirements", type: "multicheck", options: Store.all("requirements").map(r => ({ value: r.id, code: r.code, label: r.title })) },
    { key: "relatedCaseIds", label: "Related Test Cases", type: "multicheck", options: Store.all("cases").map(tc => ({ value: tc.id, code: tc.code, label: tc.title })) }
  ];
}
function mitFields() {
  return [
    { key: "text", label: "Mitigation Action", type: "textarea", required: true },
    { key: "status", label: "Status", type: "select", half: true, options: MIT_FLOW },
    { key: "owner", label: "Owner", half: true },
    { key: "due", label: "Due Date", type: "date", half: true }
  ];
}

function openRunForm(preset) {
  const fixed = !!preset.caseId;
  const tc = fixed ? Store.get("cases", preset.caseId) : null;
  const trun = preset.testRunId ? Store.get("testRuns", preset.testRunId) : null;
  const title = fixed ? `Record Run — ${tc.code}${trun ? ` in ${trun.code || "test run"}` : ""}` : "Record Test Run";
  Modal.open(title, runFields(fixed), preset, v => {
    if (fixed) v.caseId = preset.caseId;
    if (preset.planId && !v.planId) v.planId = preset.planId;
    if (preset.testRunId) v.testRunId = preset.testRunId;
    const run = Store.add("runs", v);

    Toast.show(`${run.code} recorded — ${v.result}`);
    // Same route re-renders in place: filters and scroll survive, and the row comes back into view.
    if (preset.anchor) App.anchor(preset.anchor);
    App.render();
  }, "Record");
}

/* A component's parent must live in the same system; otherwise it becomes top-level. */
function placeComponent(v) {
  const parent = v.parentComponentId ? Store.get("components", v.parentComponentId) : null;
  if (!parent || parent.systemId !== v.systemId) v.parentComponentId = "";
  return v;
}

/* A case owned by a component takes that component's system; blank component = system-level. */
function placeCase(v) {
  const comp = v.componentId ? Store.get("components", v.componentId) : null;
  if (comp) v.systemId = comp.systemId;
  return v;
}

function openDefectForm(preset) {
  Modal.open("New Defect", defectFields(),
    Object.assign({ severity: "Major", status: "Open", opened: todayISO(), caseIds: [] }, preset), v => {
      const d = Store.add("defects", v);
      Toast.show(`${d.code} filed`); App.go(`#/defects/${d.id}`);
    }, "File Defect");
}

function openCritForm(parentId, parentType, kind) {
  Modal.open(`New ${kind === "entry" ? "Entry" : "Exit"} Criterion`, [
    { key: "text", label: "Criterion", type: "textarea", required: true }
  ], {}, v => {
    Store.add("criteria", { parentType, parentId, kind, text: v.text, status: "open" });
    Toast.show("Criterion added"); App.render();
  });
}

function splitSteps(text) {
  return (text || "").split("\n").map(s => s.trim().replace(/^\d+[.)]\s*/, "")).filter(Boolean);
}
