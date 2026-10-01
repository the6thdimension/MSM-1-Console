/* ============================================================
   Requirements register, requirement detail and trace matrix.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
/* Verification spread for a set of requirements, as a compact bar plus counts. */
function reqStatusBar(reqs) {
  const c = { verified: 0, failing: 0, covered: 0, uncovered: 0 };
  for (const r of reqs) c[Store.reqStatus(r.id)]++;
  const total = reqs.length || 1;
  const seg = (n, cls) => n ? `<span class="${cls}" style="width:${(n / total * 100).toFixed(1)}%"></span>` : "";
  return `<div class="req-bar"><div class="meter">${seg(c.verified, "m-pass")}${seg(c.failing, "m-fail")}${seg(c.covered, "m-covered")}${seg(c.uncovered, "m-open")}</div>
    <span class="mono small"><b class="ok">${c.verified}</b> verified · <b class="bad">${c.failing}</b> failing · <b class="cov">${c.covered}</b> covered · <b>${c.uncovered}</b> no coverage</span></div>`;
}

Views.requirements = function (params) {
  const typeF = params.get("type") || "";
  const covF = params.get("cov") || "";
  const clsF = params.get("class") || "";
  const q = (params.get("q") || "").trim().toLowerCase();
  let reqs = Scope.list("requirements");
  if (typeF) reqs = reqs.filter(r => r.type === typeF);
  if (covF) reqs = reqs.filter(r => Store.reqStatus(r.id) === covF);
  if (q) reqs = reqs.filter(r => [r.code, r.title, r.text, r.extKey].join(" ").toLowerCase().includes(q));
  const filtering = !!(typeF || covF || q);

  const row = r => {
    const cases = Store.casesOfRequirement(r.id).filter(tc => tc.status !== "Retired");
    const parents = Store.derivedParents(r), kids = Store.derivedChildren(r.id).length;
    return `<tr>
      <td>${codeLink("requirements", r)}${r.extKey ? `<div class="faint mono" style="font-size:9.5px">${esc(r.extKey)}</div>` : ""}</td>
      <td class="req-main">
        <a class="req-name" href="#/requirements/${r.id}">${esc(r.title)}</a> ${badge(r.priority)}
        <div class="req-text">${esc(r.text)}</div>
        ${parents.length || kids ? `<div class="req-flow">${parents.map(p => `<a class="flow-chip up" href="#/requirements/${p.id}" title="Derived from ${esc(p.title)}">↑ ${esc(p.code)}</a>`).join("")}${kids ? `<span class="flow-chip down" title="Requirements derived from this one">↓ ${kids} derived</span>` : ""}</div>` : ""}
      </td>
      <td class="col-type">${badge(r.type)}<div style="margin-top:4px">${badge(r.method, "b-grey")}</div></td>
      <td class="col-measure">${r.measure && r.measure !== "None" ? badge(r.measure) : `<span class="faint small">—</span>`}${r.threshold ? `<div class="mono small" style="margin-top:4px">${esc(r.threshold)}</div>` : ""}</td>
      <td class="num">${cases.length ? cases.length : `<span class="bad">0</span>`}</td>
      <td>${badge(Store.reqStatus(r.id))}</td>
    </tr>`;
  };
  const table = body => `<div class="table-scroll"><table class="data req-table"><thead><tr><th>Code</th><th>Requirement</th><th class="col-type">Type / Method</th><th class="col-measure">Measure / Threshold</th><th>Cases</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>`;

  /* Within a class: group rows by owning system when viewing the whole program. One table
     per class keeps the columns aligned across groups. */
  const grouped = list => {
    const owners = [...new Set(list.map(r => Store.ownerOf("requirements", r)))];
    if (Scope.system || owners.length < 2) return table(list.map(row).join(""));
    const order = Store.all("systems").slice().sort(Store.byCodeOrder).map(s => s.id).concat([""]);
    return table(order.filter(o => owners.includes(o)).map(o => {
      const s = o ? Store.get("systems", o) : null;
      const part = list.filter(r => Store.ownerOf("requirements", r) === o);
      return `<tr class="req-group"><td colspan="6">${s ? `<a href="#/systems/${s.id}"><span class="code">${esc(s.code)}</span> ${esc(s.name)}</a>` : "Program-level / shared"} <span class="faint mono small">${part.length}</span></td></tr>${part.map(row).join("")}`;
    }).join(""));
  };

  const classes = clsF ? Store.REQ_CLASSES.filter(c => c.key === clsF) : Store.REQ_CLASSES;
  const sections = classes.map(c => {
    const list = reqs.filter(r => Store.reqClass(r) === c.key);
    if (filtering && !list.length && !clsF) return "";
    return `<div class="req-section cls-${c.key.toLowerCase()}">
      <div class="req-section-head">
        <div><h2>${esc(c.label)}</h2><span class="faint mono small">${c.prefix}-### · ${list.length} shown</span></div>
        ${list.length ? reqStatusBar(list) : ""}
        ${actBtn(`+ ${esc(c.one)}`, "add-requirement", null, `data-cls="${c.key}"`, false)}
      </div>
      ${list.length ? grouped(list) : emptyMsg(filtering ? "No matches in this class." : `No ${c.label} yet.`)}
    </div>`;
  }).join("");

  const all = Scope.list("requirements");
  const tab = (key, label) => {
    const n = key ? all.filter(r => Store.reqClass(r) === key).length : all.length;
    const p = new URLSearchParams(params); key ? p.set("class", key) : p.delete("class");
    const qs = p.toString();
    return `<a class="req-tab${clsF === key ? " active" : ""}" href="#/requirements${qs ? "?" + qs : ""}">${esc(label)} <span class="mono">${n}</span></a>`;
  };

  return `
    ${pageHead([{ label: "Requirements" }], "Requirements", "",
      "System requirements, PSPECs and SW requirements — each traced to components, verified by test cases, and optionally derived from a higher-level requirement. Status reflects the latest run of each verifying case.")}
    <div class="req-tabs">${tab("", "All")}${Store.REQ_CLASSES.map(c => tab(c.key, c.label)).join("")}</div>
    <div class="filter-bar">
      <input type="search" data-filter="q" placeholder="Filter by code, title, text…" value="${esc(params.get("q") || "")}">
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
    ${sections || emptyMsg("No requirements match the filter.")}`;
};

Views.requirementDetail = function (id) {
  const r = Store.get("requirements", id);
  if (!r) return notFound("Requirement");
  const comps = (r.componentIds || []).map(cid => Store.get("components", cid)).filter(Boolean);
  const cases = Store.casesOfRequirement(id);
  const risks = Store.risksOfRequirement(id);
  const st = Store.reqStatus(id);
  const cls = Store.reqClassInfo(Store.reqClass(r));
  const parents = Store.derivedParents(r), children = Store.derivedChildren(id);
  const flowList = list => list.map(x => `<div style="margin-bottom:5px">${chip("requirements", x)} ${badge(Store.reqClassInfo(Store.reqClass(x)).one, "b-purple")} ${badge(Store.reqStatus(x.id))}</div>`).join("");

  return `
    ${pageHead(
      [{ label: "Requirements", href: "#/requirements" }, { label: cls.label, href: `#/requirements?class=${cls.key}` }, { label: r.code }],
      `<span class="code-inline">${esc(r.code)}</span>${esc(r.title)}`,
      actBtn("Edit", "edit-requirement", r.id) + actBtn("Delete", "del-requirement", r.id) +
      actBtn("+ Derived PSPEC", "add-requirement", null, `data-cls="PSPEC" data-parent="${r.id}"`) +
      actBtn("+ Derived SW Req", "add-requirement", null, `data-cls="SW" data-parent="${r.id}"`),
      badge(cls.one, "b-purple"))}
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
        ${parents.length || children.length ? panel("Requirement Flow-Down", `
          ${parents.length ? `<div class="flow-label">↑ Derived from</div>${flowList(parents)}` : ""}
          ${children.length ? `<div class="flow-label" ${parents.length ? `style="margin-top:10px"` : ""}>↓ Flows down to</div>${flowList(children)}` : ""}`) : ""}
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

Views.trace = function (params) {
  const sysF = params.get("system") || "";
  const gapsOnly = params.get("gaps") === "1";

  // columns: cases grouped by system → component order
  const systems = sysF ? Scope.list("systems").filter(s => s.id === sysF) : Scope.list("systems");
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
  let reqs = Scope.list("requirements");
  if (sysF) {
    const compIds = new Set(Store.componentsOf(sysF).map(c => c.id));
    reqs = reqs.filter(r =>
      (r.componentIds || []).some(cid => compIds.has(cid)) ||
      Store.casesOfRequirement(r.id).some(tc => shownCaseIds.has(tc.id)));
  }
  if (gapsOnly) reqs = reqs.filter(r => Store.reqStatus(r.id) === "uncovered");
  const clsF = params.get("class") || "";
  const classes = clsF ? Store.REQ_CLASSES.filter(c => c.key === clsF) : Store.REQ_CLASSES;
  const covered = reqs.filter(r => Store.reqStatus(r.id) !== "uncovered").length;

  const grids = classes.map(c => {
    const rows = reqs.filter(r => Store.reqClass(r) === c.key);
    if (!rows.length && !clsF) return "";
    const grid = traceGrid(rows, groups);
    const cov = rows.filter(r => Store.reqStatus(r.id) !== "uncovered").length;
    return `<div class="trace-grid-wrap cls-${c.key.toLowerCase()}">
      ${panel(`${c.label} × Test Cases`, grid, `<span class="faint mono small">${cov}/${rows.length} covered</span>`, true)}
    </div>`;
  }).join("");

  return `
    ${pageHead([{ label: "Trace Matrix" }], "Traceability Matrix", "",
      "One grid per requirement class — System Requirements, PSPECs, SW Requirements. A mark means the case verifies the requirement, colored by its latest run result. Each grid shows only the test cases that verify its rows; rows flagged red on the left edge have no coverage.")}
    <div class="filter-bar">
      <select data-filter="class"><option value="">All classes — one grid each</option>${Store.REQ_CLASSES.map(c => `<option value="${c.key}" ${clsF === c.key ? "selected" : ""}>${esc(c.label)}</option>`).join("")}</select>
      <select data-filter="system"><option value="">All systems</option>${Scope.list("systems").map(s => `<option value="${s.id}" ${sysF === s.id ? "selected" : ""}>${esc(s.code)} ${esc(s.name)}</option>`).join("")}</select>
      <label class="small faint" style="display:flex;gap:5px;align-items:center;cursor:pointer">
        <input type="checkbox" data-act="trace-gaps" ${gapsOnly ? "checked" : ""} style="accent-color:var(--amber)"> gaps only
      </label>
      <span class="faint mono small">${covered}/${reqs.length} shown requirements covered</span>
      <div class="spacer" style="flex:1"></div>
      <div class="trace-legend">
        <span><span class="tmark t-pass"></span> pass</span>
        <span><span class="tmark t-fail"></span> fail</span>
        <span><span class="tmark t-blocked"></span> blocked / in progress / waived</span>
        <span><span class="tmark t-none"></span> linked, not run</span>
      </div>
    </div>
    ${grids || emptyMsg(gapsOnly ? "No coverage gaps in this scope — every requirement has at least one test case." : "Nothing to display for this scope.")}`;
};

/* One requirements × test-cases grid. Columns are the cases (grouped by system) that verify
   at least one of these rows, so each class's grid stays focused. */
function traceGrid(rows, groups) {
  if (!rows.length) return emptyMsg("No requirements of this class in scope.");
  const linkedAny = new Set(rows.flatMap(r => Store.casesOfRequirement(r.id).map(tc => tc.id)));
  const cols = groups.map(g => ({ system: g.system, cases: g.cases.filter(tc => linkedAny.has(tc.id)) })).filter(g => g.cases.length);
  const allCols = cols.flatMap(g => g.cases);
  const grpRow = cols.map(g => {
    const compSet = new Set(Store.componentsOf(g.system.id).map(c => c.id));
    const sysRows = rows.filter(r => (r.componentIds || []).some(c => compSet.has(c)));
    const cov = sysRows.filter(r => Store.reqStatus(r.id) !== "uncovered").length;
    const covTxt = sysRows.length ? ` · ${Math.round((cov / sysRows.length) * 100)}% cov` : "";
    // A group only a few columns wide shows just the system code so it never widens its columns.
    const label = g.cases.length >= 4 ? `${esc(g.system.code)} ${esc(g.system.name)}${covTxt}` : esc(g.system.code);
    return `<th class="grp" colspan="${g.cases.length}"><a href="#/systems/${g.system.id}" style="color:inherit" title="${esc(g.system.code)} ${esc(g.system.name)} — ${cov}/${sysRows.length} of these requirements traced to this system have test coverage">${label}</a></th>`;
  }).join("");
  const caseRow = allCols.map(tc => `<th class="tc-col"><a href="#/cases/${tc.id}" title="${esc(tc.code)} — ${esc(tc.title)}">${esc(tc.code)}</a></th>`).join("");
  const body = rows.map(r => {
    const st = Store.reqStatus(r.id);
    const linked = new Set(Store.casesOfRequirement(r.id).map(tc => tc.id));
    const parents = Store.derivedParents(r);
    const cells = allCols.map(tc => {
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
      <td class="req-col">${codeLink("requirements", r)}<span class="req-title">${esc(r.title)}</span>${parents.length ? `<span class="req-parent">↑ ${parents.map(p => esc(p.code)).join(", ")}</span>` : ""}</td>
      ${allCols.length ? cells : `<td class="cell empty-cols"><span class="faint small">no verifying test cases</span></td>`}
      <td class="stat-col">${badge(st)}<div class="faint mono" style="margin-top:2px">${linked.size} case${linked.size === 1 ? "" : "s"}</div></td>
    </tr>`;
  }).join("");
  return `<div class="trace-scroll"><table class="trace">
    <thead>
      <tr><th class="req-col" rowspan="2">Requirement</th>${allCols.length ? grpRow : `<th class="grp" rowspan="2">Test cases</th>`}<th class="stat-col" rowspan="2">Rollup</th></tr>
      <tr>${caseRow}</tr>
    </thead>
    <tbody>${body}</tbody>
  </table></div>`;
}

function requirementFields(selfId) {
  return [
    { key: "title", label: "Short Title", required: true },
    { key: "reqClass", label: "Class", type: "select", half: true, options: Store.REQ_CLASSES.map(c => ({ value: c.key, label: c.one })) },
    ownerField(),
    { key: "text", label: "Requirement Text (“shall …”)", type: "textarea", required: true },
    { key: "type", label: "Type", type: "select", half: true, options: REQ_TYPES },
    { key: "priority", label: "Priority", type: "select", half: true, options: PRIORITIES },
    { key: "method", label: "Verification Method", type: "select", half: true, options: VERIF_METHODS },
    { key: "measure", label: "Measure (DEF)", type: "select", half: true, options: MEASURES },
    { key: "threshold", label: "Threshold", half: true },
    { key: "objective", label: "Objective", half: true },
    { key: "extKey", label: "Jira Issue Key (sync)", half: true },
    { key: "componentIds", label: "Traced Components", type: "multicheck", options: Store.all("components").map(c => ({ value: c.id, code: c.code, label: c.name })) },
    { key: "derivedFromIds", label: "Derived From (parent requirements — flow-down)", type: "multicheck",
      options: Store.all("requirements").filter(r => r.id !== selfId).map(r => ({ value: r.id, code: r.code, label: `${r.title} · ${Store.reqClassInfo(Store.reqClass(r)).one}` })) }
  ];
}

Object.assign(Actions, {
  /* ---- requirements ---- */
  "add-requirement": (id, el) => {
    const cls = (el && el.dataset && el.dataset.cls) || "System";
    const parent = el && el.dataset && el.dataset.parent ? Store.get("requirements", el.dataset.parent) : null;
    // A derived requirement inherits its parent's owner and components as a starting point.
    const preset = parent
      ? { reqClass: cls, derivedFromIds: [parent.id], systemId: parent.systemId || Scope.system, componentIds: (parent.componentIds || []).slice(), type: parent.type, method: parent.method }
      : ownerDefault({ reqClass: cls });
    Modal.open(`New ${Store.reqClassInfo(cls).one}${parent ? ` derived from ${parent.code}` : ""}`, requirementFields(), preset, v => {
      v.code = Store.nextReqCode(v.reqClass);
      const r = Store.add("requirements", v);
      Toast.show(`${r.code} created`); App.go(`#/requirements/${r.id}`);
    });
  },
  // Reclassifying keeps the existing code so references and external keys never break.
  "edit-requirement": id => Modal.open("Edit Requirement", requirementFields(id), Object.assign({ reqClass: Store.reqClass(Store.get("requirements", id)) }, Store.get("requirements", id)), v => {
    Store.update("requirements", id, v); Toast.show("Saved"); App.render();
  }),
  "del-requirement": id => {
    const r = Store.get("requirements", id);
    Modal.confirm(`Delete ${r.code} “${r.title}”? Trace links from test cases and risks will be removed.`, () => {
      Store.remove("requirements", id); toastUndo("Requirement deleted"); App.go("#/requirements");
    });
  },

});
