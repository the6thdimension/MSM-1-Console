/* ============================================================
   Test cases, case detail, execute mode, runs and bulk case actions.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
/* ---------- shared case table ----------
   Every card on the cases page (and the flat view) uses these columns, so tables line up
   from card to card. The latest result sits right after the title; col-mid / col-lo columns
   drop away on narrower screens so the result never scrolls out of view. */
function caseHead(showOwner) {
  return `<thead><tr><th class="bulk-cell"></th><th class="c-code">Case</th><th class="c-title">Title</th><th class="c-result">Latest result</th>
    <th class="c-hist col-mid">History</th><th class="c-status col-mid">Status</th>${showOwner ? `<th class="c-owner col-lo">Component</th>` : ""}
    <th class="c-plans col-lo">Plans</th><th class="c-proc col-lo">Procedure</th><th class="c-act" title="Record a result">Rec</th></tr></thead>`;
}

/* Latest result with how long ago it was measured and on which build. Older than 30 days reads amber. */
function latestResultCell(run) {
  if (!run) return `<span class="faint small">Not run</span>`;
  const age = Store.daysSince(run.date), tag = buildTag(run);
  return `${runBadge(run)}<div class="case-age${age != null && age > 30 ? " stale" : ""}">${age == null ? "" : age === 0 ? "today" : `${age} d ago`}${tag ? ` · ${tag}` : ""}</div>`;
}

/* Small advisory signals under a case title: removal review, incomplete spec, changed since pass. */
function caseSignals(tc) {
  const out = [];
  if (tc.removalNominated) out.push(badge("Review for Removal"));
  if (tc.status !== "Retired") {
    const s = Store.caseSpec(tc);
    if (s.done < s.total) out.push(`<span class="sig${tc.status === "Ready" ? " warn" : ""}" title="Missing: ${esc(s.missing.join(", "))}${tc.status === "Ready" ? " — marked Ready anyway" : ""}">spec ${s.done}/${s.total}</span>`);
  }
  const ch = Store.caseChangedSincePass(tc);
  if (ch) out.push(`<span class="sig warn" title="Edited after ${esc(ch.run.code)} passed: ${esc(ch.fields.join(", "))}">changed since pass</span>`);
  return out.length ? `<div class="case-sigs">${out.join("")}</div>` : "";
}

function caseRowHtml(tc, showOwner) {
  const proc = tc.procedureId ? Store.get("procedures", tc.procedureId) : null;
  const plans = Store.plansOf(tc.id);
  return `<tr id="case-row-${tc.id}">
    <td class="bulk-cell"><input type="checkbox" data-bulk="${tc.id}"></td>
    <td class="c-code">${codeLink("cases", tc)}${tc.extKey ? `<div class="faint mono" style="font-size:9.5px">${esc(tc.extKey)}</div>` : ""}</td>
    <td class="c-title"><a href="#/cases/${tc.id}">${esc(tc.title)}</a>${caseSignals(tc)}</td>
    <td class="c-result">${latestResultCell(Store.latestRun(tc.id))}</td>
    <td class="c-hist col-mid">${runDots(tc.id)}</td>
    <td class="c-status col-mid"><button class="badge-btn" data-act="cycle-case-status" data-id="${tc.id}" title="Click to cycle status">${badge(tc.status)}</button></td>
    ${showOwner ? `<td class="c-owner col-lo">${caseOwnerChip(tc)}</td>` : ""}
    <td class="c-plans col-lo">${plans.map(p => codeLink("plans", p)).join(" ") || `<span class="faint small">—</span>`}</td>
    <td class="c-proc col-lo">${proc ? codeLink("procedures", proc) : `<span class="faint small">—</span>`}</td>
    <td class="c-act">${tc.status !== "Retired" ? actBtn("●", "record-run-row", tc.id, `title="Record a result for ${esc(tc.code)}"`, true, "btn-xs") : ""}</td>
  </tr>`;
}
/* Compact case row for system and component pages (no bulk select). */
function caseRow(tc) {
  return `<tr>
    <td>${codeLink("cases", tc)}</td>
    <td><a href="#/cases/${tc.id}">${esc(tc.title)}</a>${caseSignals(tc)}</td>
    <td>${badge(tc.priority)}</td>
    <td>${badge(tc.status)}</td>
    <td>${latestResultCell(Store.latestRun(tc.id))}</td>
  </tr>`;
}
const caseTable = (list, showOwner) =>
  `<div class="table-scroll"><table class="data case-table">${caseHead(showOwner)}<tbody>${list.map(tc => caseRowHtml(tc, showOwner)).join("")}</tbody></table></div>`;

/* One component's card on the cases page. `comp` null = the system-level card for `sys`.
   Subcomponent cards are indented and styled differently from top-level ones. A component
   whose cases all sit in its subcomponents renders as a header only. */
function caseCard(comp, depth, direct, inSubtree, sys) {
  const nested = inSubtree - direct.length;
  const kind = comp ? (depth ? `Subcomponent · level ${depth}` : "Top-level component") : "System-level";
  const counts = resultCounts(direct.map(tc => Store.latestRun(tc.id)));
  const title = comp
    ? `${depth ? `<span class="tree-arrow">↳</span>` : ""}<a class="code" href="#/components/${comp.id}">${esc(comp.code)}</a> <a href="#/components/${comp.id}" class="cc-name">${esc(comp.name)}</a>`
    : `<a class="code" href="#/systems/${sys.id}">${esc(sys.code)}</a> <span class="cc-name">System-level cases</span>`;
  const actions = comp
    ? actBtn("+ Case", "add-case", comp.id) + (Store.casesOfBranch(comp.id).some(tc => tc.status !== "Retired") ? actBtn("▶ Test", "comp-test", comp.id) : "")
    : "";
  return `<div class="case-card ${comp ? (depth ? "sub" : "top") : "syslevel"}${direct.length ? "" : " head-only"}" style="--depth:${depth}">
    <div class="case-card-head">
      <div class="cc-title">${title}
        ${badge(kind, comp ? (depth ? "b-purple" : "b-blue") : "b-grey")} ${comp ? badge(Store.componentStatus(comp.id)) : ""}
        ${comp ? componentWhy(comp.id) : ""}</div>
      <div class="cc-meta">
        <span class="mono small">${direct.length} case${direct.length === 1 ? "" : "s"}${nested ? ` <span class="faint">· +${nested} in subcomponents below</span>` : ""}</span>
        ${direct.length ? `<div class="cc-meter">${progressMeter(counts)}</div>` : ""}
        <span class="inline-actions">${actions}</span>
      </div>
    </div>
    ${direct.length ? caseTable(direct, false) : ""}
  </div>`;
}

/* The "Attention" filter: advisory lists a tester works through. */
const CASE_ATTENTION = {
  spec: { label: "Spec incomplete", test: tc => tc.status !== "Retired" && Store.caseSpec(tc).done < Store.caseSpec(tc).total },
  stale: { label: "No result in 30+ days (or never run)", test: tc => { if (tc.status === "Retired") return false; const r = Store.latestRun(tc.id); return !r || Store.daysSince(r.date) > 30; } },
  changed: { label: "Changed since last pass", test: tc => !!Store.caseChangedSincePass(tc) }
};

Views.cases = function (params) {
  const compF = params.get("component") || "";
  const statF = params.get("status") || "";
  const planF = params.get("plan") || "";
  const procF = params.get("procedure") || "";
  const reviewF = params.get("review") || "";
  const attnF = CASE_ATTENTION[params.get("attn")] ? params.get("attn") : "";
  let cases = Scope.list("cases");
  if (compF) { const branch = Store.descendantIds(compF); cases = cases.filter(tc => branch.has(tc.componentId)); }
  if (statF) cases = cases.filter(tc => tc.status === statF);
  if (procF) cases = cases.filter(tc => tc.procedureId === procF);
  if (reviewF) cases = cases.filter(tc => tc.removalNominated);
  if (attnF) cases = cases.filter(CASE_ATTENTION[attnF].test);
  if (planF) {
    const plan = Store.get("plans", planF);
    const ids = new Set(plan ? plan.caseIds : []);
    cases = cases.filter(tc => ids.has(tc.id));
  }

  const tableView = params.get("view") === "table";
  const filtering = !!(compF || statF || planF || procF || reviewF || attnF);
  const nominated = Scope.list("cases").filter(tc => tc.removalNominated).length;

  /* Card view: one card per component in tree order; subcomponent cards nest visually.
     Components with no cases at all collapse into one line per system. */
  let body;
  if (tableView) {
    body = panel("Catalog", cases.length ? caseTable(cases, true) : emptyMsg("No test cases match the filter."), "", true);
  } else {
    const shown = new Set(cases.map(tc => tc.id));
    const out = [];
    for (const s of Scope.list("systems").slice().sort(Store.byCodeOrder)) {
      const cards = [], empties = [];
      for (const { comp, depth } of Store.componentTree(s.id)) {
        const direct = Store.casesOf(comp.id).filter(tc => shown.has(tc.id));
        const inSubtree = Store.casesOfBranch(comp.id).filter(tc => shown.has(tc.id)).length;
        if (!inSubtree) { if (!filtering) empties.push(comp); continue; }
        cards.push(caseCard(comp, depth, direct, inSubtree));
      }
      const sysLevel = Store.systemLevelCases(s.id).filter(tc => shown.has(tc.id));
      if (sysLevel.length) cards.push(caseCard(null, 0, sysLevel, sysLevel.length, s));
      if (!cards.length && !empties.length) continue;
      const count = Store.casesOfSystem(s.id).filter(tc => shown.has(tc.id)).length;
      out.push(`<div class="case-sys-head"><a href="#/systems/${s.id}"><span class="code">${esc(s.code)}</span> ${esc(s.name)}</a>
        <span class="faint mono small">${count} case${count === 1 ? "" : "s"}</span></div>${cards.join("")}
        ${empties.length ? `<div class="cc-empties"><span class="faint small">No cases yet:</span> ${empties.map(c =>
          `<span class="cc-empty-item"><a href="#/components/${c.id}"><span class="code">${esc(c.code)}</span> ${esc(c.name)}</a>${actBtn("+", "add-case", c.id, `title="Add a case to ${esc(c.code)}"`, true, "btn-xs")}</span>`).join("")}</div>` : ""}`);
    }
    const orphans = cases.filter(tc => !Store.caseSystemId(tc));
    if (orphans.length) out.push(`<div class="case-sys-head">Unassigned</div><div class="case-card">${caseTable(orphans, false)}</div>`);
    body = out.join("") || emptyMsg(filtering ? "No test cases match the filter." : "No components yet — add systems and components first.");
  }

  return `
    ${pageHead([{ label: "Test Cases" }], "Test Cases",
      actBtn("+ New Test Case", "add-case", null, "", false),
      "Procedures spawn test cases; test cases roll up into test plans; runs record each execution of a case.")}
    <div class="filter-bar">
      <select data-filter="procedure"><option value="">All procedures</option>${Store.all("procedures").map(p => `<option value="${p.id}" ${procF === p.id ? "selected" : ""}>${esc(p.code)} ${esc(p.title)}</option>`).join("")}</select>
      <select data-filter="component"><option value="">All components</option>${componentOptions().map(o => `<option value="${o.value}" ${compF === o.value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>
      <select data-filter="status"><option value="">All statuses</option>${CASE_STATUSES.map(s => `<option ${statF === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      <select data-filter="plan"><option value="">All plans</option>${Store.all("plans").map(p => `<option value="${p.id}" ${planF === p.id ? "selected" : ""}>${esc(p.code)} ${esc(p.name)}</option>`).join("")}</select>
      <select data-filter="attn"><option value="">Needs attention: any</option>${Object.entries(CASE_ATTENTION).map(([k, a]) => `<option value="${k}" ${attnF === k ? "selected" : ""}>${esc(a.label)} (${Scope.list("cases").filter(a.test).length})</option>`).join("")}</select>
      <select data-filter="review"><option value="">All cases</option><option value="1" ${reviewF ? "selected" : ""}>Review queue — nominated for removal (${nominated})</option></select>
      <select data-filter="view"><option value="">View: component cards</option><option value="table" ${tableView ? "selected" : ""}>View: flat table</option></select>
      <label class="small faint" style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" data-bulk-all style="accent-color:var(--amber)"> select all shown</label>
      <span class="faint mono small">${cases.length} shown</span>
    </div>
    ${body}
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
      <td>${codeLink("runs", r)}${r.extKey ? `<div style="font-size:9.5px;margin-top:1px">${extKeyTag(r.extKey)}</div>` : ""}</td>
      <td class="num">${esc(r.date || "")}</td>
      <td>${badge(r.result)}</td>
      <td class="small">${buildTag(r) || `<span class="faint">—</span>`}</td>
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
  const spec = Store.caseSpec(tc), changed = Store.caseChangedSincePass(tc);
  const health = (tc.status !== "Retired" && spec.done < spec.total
      ? `<div class="ready-strip ${tc.status === "Ready" ? "nogo" : "info"}"><span class="lamp"></span>SPEC ${spec.done}/${spec.total} — MISSING: ${esc(spec.missing.join(", ").toUpperCase())}${tc.status === "Ready" ? " · MARKED READY ANYWAY" : ""}</div>` : "") +
    (changed ? `<div class="ready-strip nogo"><span class="lamp"></span>CHANGED SINCE ${esc(changed.run.code)} PASSED ON ${esc(changed.run.date || "")}: ${esc(changed.fields.join(", "))} — RE-RUN TO CONFIRM</div>` : "");

  return `
    ${pageHead(
      crumbs,
      `<span class="code-inline">${esc(tc.code)}</span>${esc(tc.title)}`,
      actBtn("Edit", "edit-case", tc.id) + actBtn("Delete", "del-case", tc.id) + actBtn("Assign to Plan", "assign-plan", tc.id) + actBtn("⚑ Defect", "add-defect-case", tc.id) + actBtn("● Record Run", "record-run", tc.id) +
      (proc ? `<a class="btn" href="#/execute/${tc.id}">▶ Execute</a>` : ""),
      tc.extKey ? `Issue: ${extKeyTag(tc.extKey)}` : "")}
    ${health}
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
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Run</th><th>Date</th><th>Result</th><th class="col-mid">Build</th><th class="col-lo">Measured</th><th class="col-lo">Operator</th><th class="col-lo">Plan / Test Run</th><th class="col-mid">Notes / Evidence</th><th></th></tr></thead><tbody>${runRows}</tbody></table></div>`
          : emptyMsg("Never executed. Record the first run."), "", true)}
      </div>
    </div>
    ${extLinksPanel("cases", tc)}`;
};

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
  const execBuildId = trun && trun.buildId !== undefined ? trun.buildId : currentBuildId(Store.caseSystemId(tc));
  const execBuild = buildField([Store.caseSystemId(tc)], execBuildId);

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
            ${execBuild ? `<div class="form-field"><label>${esc(execBuild.label)}</label><select id="exec-build"><option value="">—</option>${execBuild.options.map(o => `<option value="${o.value}" ${o.value === execBuildId ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></div>` : ""}
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
/* `sysId` limits the build choices to that system's stream; blank offers every system's builds. */
function runFields(fixedCase, sysId, buildId) {
  const f = [];
  if (!fixedCase) f.push({ key: "caseId", label: "Test Case", type: "select", required: true, options: Store.all("cases").map(tc => ({ value: tc.id, label: `${tc.code} ${tc.title}` })) });
  const build = buildField(sysId ? [sysId] : Store.all("systems").map(s => s.id), buildId);
  f.push(
    { key: "date", label: "Date", type: "date", required: true, half: true, default: new Date().toISOString().slice(0, 10) },
    { key: "result", label: "Result", type: "select", half: true, options: RUN_RESULTS },
    ...(build ? [build] : []),
    { key: "operator", label: "Operator", half: true },
    { key: "planId", label: "Under Plan", type: "select", half: true, allowEmpty: true, options: Store.all("plans").map(p => ({ value: p.id, label: `${p.code} ${p.name}` })) },
    { key: "measured", label: "Measured Value(s) — e.g. “26 ms P99”", half: true },
    { key: "extKey", label: "Jira / Zephyr Key (execution)", half: true },
    { key: "evidence", label: "Evidence Refs (one per line: file, link, log ID)", type: "textarea" },
    { key: "notes", label: "Notes / Observations", type: "textarea" }
  );
  return f;
}
function openRunForm(preset) {
  const fixed = !!preset.caseId;
  const tc = fixed ? Store.get("cases", preset.caseId) : null;
  const trun = preset.testRunId ? Store.get("testRuns", preset.testRunId) : null;
  const title = fixed ? `Record Run — ${tc.code}${trun ? ` in ${trun.code || "test run"}` : ""}` : "Record Test Run";
  // The build defaults to the test run's build, else the case system's current build.
  const sysId = tc ? Store.caseSystemId(tc) : "";
  if (preset.buildId === undefined) preset = Object.assign({}, preset, { buildId: trun && trun.buildId !== undefined ? trun.buildId : currentBuildId(sysId) });
  // Advisory only: an incomplete or changed spec is shown, never blocks recording.
  const notes = [];
  if (tc) {
    const spec = Store.caseSpec(tc), changed = Store.caseChangedSincePass(tc);
    if (spec.done < spec.total) notes.push({ type: "note", tone: "warn", text: `Spec ${spec.done}/${spec.total} — missing: ${spec.missing.join(", ")}. You can still record the result.` });
    if (changed) notes.push({ type: "note", tone: "warn", text: `Changed since ${changed.run.code} passed: ${changed.fields.join(", ")}.` });
  }
  Modal.open(title, notes.concat(runFields(fixed, sysId, preset.buildId)), preset, v => {
    if (fixed) v.caseId = preset.caseId;
    if (preset.planId && !v.planId) v.planId = preset.planId;
    if (preset.testRunId) v.testRunId = preset.testRunId;
    const run = Store.add("runs", v);

    Toast.show(`${run.code} recorded — ${v.result}`);
    // Same route re-renders in place: filters and scroll survive, and the row comes back into view.
    if (preset.anchor) App.anchor(preset.anchor);
    App.render();
    // A failure offers a pre-filled defect, the same as Execute mode.
    if (v.result === "Fail") {
      const rc = Store.get("cases", run.caseId);
      if (rc) openDefectForm({ caseIds: [rc.id], componentId: rc.componentId || "", systemId: Store.caseSystemId(rc), runId: run.id, title: `${rc.code}: ` });
    }
  }, "Record");
}

/* A case owned by a component takes that component's system; blank component = system-level. */
function placeCase(v) {
  const comp = v.componentId ? Store.get("components", v.componentId) : null;
  if (comp) v.systemId = comp.systemId;
  return v;
}

Object.assign(Actions, {
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
  // From a row on the cases page: the page re-renders in place and flashes the row.
  "record-run-row": caseId => openRunForm({ caseId, anchor: `case-row-${caseId}` }),
  "record-run-plan": (caseId, el) => openRunForm({ caseId, planId: el.dataset.plan }),
  "record-run-any": () => openRunForm({}),
  "edit-run": id => {
    const r = Store.get("runs", id);
    Modal.open(`Edit ${r.code}`, runFields(false, Store.ownerOf("runs", r), r.buildId), r, v => {
      Store.update("runs", id, v); Toast.show("Run updated"); App.render();
    });
  },
  "del-run": id => Modal.confirm("Delete this run record?", () => {
    Store.remove("runs", id); toastUndo("Run deleted"); App.render();
  }),

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
    if (document.getElementById("exec-build")) record.buildId = val("exec-build");
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

});
