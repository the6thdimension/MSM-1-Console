/* ============================================================
   Regression testing — test run sessions, full-system regression,
   plan helpers, and the review/removal disposition workflow.
   Test runs group many cases; each case result is an ordinary
   `runs` record carrying `testRunId`, so rollups and history
   are unchanged.
   ============================================================ */

const TEST_RUN_STATUSES = ["Active", "Complete", "Aborted"];

function testRunHref(id, comp) {
  return `#/testruns/${id}${comp ? `?comp=${encodeURIComponent(comp)}` : ""}`;
}

function testRunLink(t) {
  return `<a class="chip" href="${testRunHref(t.id)}"><span class="code">${esc(t.code || t.id)}</span>${esc(t.name || "Test run")}</a>`;
}

function runTimeLabel(iso) {
  const ms = Date.parse(iso || "");
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 16).replace("T", " ") : "—";
}

/* Per-case results within one test run, plus completion counts. */
function testRunStats(t) {
  const cases = (t.caseIds || []).map(id => Store.get("cases", id)).filter(Boolean);
  const results = new Map(cases.map(tc => [tc.id, Store.testRunResult(t.id, tc.id)]));
  const done = cases.filter(tc => { const r = results.get(tc.id); return r && RUN_DONE_RESULTS.includes(r.result); }).length;
  return { cases, results, done, pct: cases.length ? Math.round((done / cases.length) * 100) : 0, counts: resultCounts(cases.map(tc => results.get(tc.id))) };
}

/* Derived status for a set of cases inside a test run, on the component-status scale. */
function branchStatus(cases, results) {
  const rs = cases.map(tc => results.get(tc.id));
  if (rs.some(r => r && r.result === "Fail")) return "Failing";
  if (cases.length && rs.every(r => r && RUN_DONE_RESULTS.includes(r.result))) return "Passing";
  if (rs.some(r => r)) return "In Test";
  return "Untested";
}

function testRunsPanel(title, list, emptyText) {
  const rows = list.map(t => {
    const s = testRunStats(t);
    const plan = t.planId ? Store.get("plans", t.planId) : null;
    const sys = t.systemId ? Store.get("systems", t.systemId) : null;
    const comp = t.componentId ? Store.get("components", t.componentId) : null;
    return `<tr>
      <td><a class="code" href="${testRunHref(t.id)}">${esc(t.code || t.id)}</a></td>
      <td><a href="${testRunHref(t.id)}">${esc(t.name || "Test run")}</a>${t.operator ? `<div class="faint small">${esc(t.operator)}</div>` : ""}</td>
      <td>${badge(t.status || "Active")}</td>
      <td class="col-lo">${comp ? codeLink("components", comp) : sys ? codeLink("systems", sys) : `<span class="faint">—</span>`} ${plan ? codeLink("plans", plan) : ""}</td>
      <td class="num col-mid">${runTimeLabel(t.startedAt || t.createdAt)}</td>
      <td class="num">${s.done}/${s.cases.length}</td>
      <td style="min-width:130px">${progressMeter(s.counts)}</td>
    </tr>`;
  }).join("");
  return panel(title, rows
    ? `<div class="table-scroll"><table class="data"><thead><tr><th>Run</th><th>Name</th><th>Status</th><th class="col-lo">Scope</th><th class="col-mid">Started</th><th>Done</th><th>Progress</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : emptyMsg(emptyText), "", true);
}

/* Regression scope summary shown on system detail. */
function regressionScopePanel(sys) {
  const scope = Store.regressionScope(sys.id);
  const retired = Store.casesOfSystem(sys.id).length - scope.length;
  const nominated = scope.filter(tc => tc.removalNominated).length;
  const plan = Store.regressionPlanFor(sys.id);
  const last = Store.testRunsSorted(t => t.systemId === sys.id)[0];
  const scopeIds = new Set(scope.map(tc => tc.id));
  const branches = Store.componentTree(sys.id).filter(e => e.depth === 0).map(({ comp }) => {
    const ids = Store.descendantIds(comp.id);
    return { comp, n: scope.filter(tc => ids.has(tc.componentId)).length, subs: ids.size - 1 };
  }).filter(b => b.n);
  const sysLevel = Store.systemLevelCases(sys.id).filter(tc => scopeIds.has(tc.id)).length;
  const lastStats = last ? testRunStats(last) : null;
  return panel("Regression Scope", `
    <div class="scope-line">
      <span class="scope-big">${scope.length}</span>
      <span>test case${scope.length === 1 ? "" : "s"} in scope across components, subcomponents${sysLevel ? " and system level" : ""}${retired ? ` · ${retired} retired excluded` : ""}${nominated ? ` · ${nominated} nominated for removal` : ""}</span>
    </div>
    <div class="scope-branches">${branches.map(b => `<span class="chip"><span class="code">${esc(b.comp.code)}</span>${esc(b.comp.name)} <b class="mono">${b.n}</b>${b.subs ? ` <span class="faint small">+${b.subs} sub</span>` : ""}</span>`).join("")}${sysLevel ? `<span class="chip">System-level <b class="mono">${sysLevel}</b></span>` : ""}</div>
    <dl class="def-grid" style="margin-top:10px">
      <dt>Regression plan</dt><dd>${plan ? chip("plans", plan) : `<span class="faint small">None yet — created on first Full Regression</span>`}</dd>
      <dt>Last test run</dt><dd>${last ? `${testRunLink(last)} ${badge(last.status || "Active")} <span class="mono faint">${lastStats.done}/${lastStats.cases.length} done</span>` : `<span class="faint small">Never run</span>`}</dd>
    </dl>`);
}

/* Component test scope and history shown on component detail. */
function componentTestPanel(comp) {
  const branch = Store.casesOfBranch(comp.id);
  const scope = branch.filter(tc => tc.status !== "Retired");
  const own = scope.filter(tc => tc.componentId === comp.id).length;
  const subtree = Store.descendantIds(comp.id);
  const runs = Store.testRunsSorted(t => t.componentId && subtree.has(t.componentId));
  const last = runs[0], lastStats = last ? testRunStats(last) : null;
  const body = `
    <div class="scope-line">
      <span class="scope-big">${scope.length}</span>
      <span>test case${scope.length === 1 ? "" : "s"} in this component's test scope — ${own} on ${esc(comp.code)}${subtree.size > 1 ? `, ${scope.length - own} across ${subtree.size - 1} subcomponent(s)` : ""}${branch.length > scope.length ? ` · ${branch.length - scope.length} retired excluded` : ""}</span>
    </div>
    <dl class="def-grid" style="margin-top:10px">
      <dt>Last component test</dt><dd>${last ? `${testRunLink(last)} ${badge(last.status || "Active")} <span class="mono faint">${lastStats.done}/${lastStats.cases.length} done · ${lastStats.counts.fail} fail</span>` : `<span class="faint small">Never run — use ▶ Component Test</span>`}</dd>
    </dl>`;
  return `<div class="grid-2">
    ${panel("Component Test Scope", body, scope.length ? actBtn("▶ Start", "comp-test", comp.id, "", false) : "")}
    ${testRunsPanel("Component & Subcomponent Test Runs", runs.slice(0, 6), "No component tests yet.")}
  </div>`;
}

/* Review / removal recommendation and disposition state on case detail. */
function removalPanel(tc) {
  const nominatingRun = Store.runsOf(tc.id).find(r => r.result === "Review for Removal");
  const origin = tc.reviewOriginalComponentId ? Store.get("components", tc.reviewOriginalComponentId) : null;
  const provenance = `${origin ? `<dt>Original component</dt><dd>${chip("components", origin)}</dd>` : ""}${tc.reviewMoveReason ? `<dt>Move reason</dt><dd>${esc(tc.reviewMoveReason)}</dd>` : ""}`;
  if (tc.status === "Retired") {
    return panel("Retired Test Case", `
      <div class="ready-strip retired"><span class="lamp"></span>RETIRED — EXCLUDED FROM REGRESSION SCOPE AND REQUIREMENT COVERAGE</div>
      <dl class="def-grid"><dt>Disposition</dt><dd style="white-space:pre-wrap">${esc(tc.reviewDisposition || "—")}</dd>${provenance}</dl>`,
      actBtn("Reinstate", "case-reinstate", tc.id));
  }
  if (tc.removalNominated) {
    return panel("Review / Removal Recommendation", `
      <div class="ready-strip removal"><span class="lamp"></span>NOMINATED FOR REVIEW / REMOVAL</div>
      <dl class="def-grid">
        <dt>Disposition</dt><dd style="white-space:pre-wrap">${esc(tc.reviewDisposition || "Awaiting review")}</dd>
        ${nominatingRun ? `<dt>Nominated by</dt><dd><span class="code">${esc(nominatingRun.code)}</span> <span class="mono faint">${esc(nominatingRun.date || "")}</span>${nominatingRun.operator ? ` · ${esc(nominatingRun.operator)}` : ""}</dd>` : ""}
        ${provenance}
      </dl>
      <div style="display:flex;gap:8px;margin-top:12px">
        ${actBtn("✓ Keep Case", "removal-keep", tc.id, "", false)}
        ${actBtn("Retire Case…", "removal-retire", tc.id)}
      </div>`);
  }
  if (tc.reviewDisposition || provenance) {
    return panel("Last Review Disposition", `<dl class="def-grid"><dt>Disposition</dt><dd style="white-space:pre-wrap">${esc(tc.reviewDisposition || "—")}</dd>${provenance}</dl>`);
  }
  return "";
}

/* ================= TEST RUN SESSION PAGE ================= */
Views.testRun = function (id, params = new URLSearchParams()) {
  const t = Store.get("testRuns", id);
  if (!t) return notFound("Test run");
  const { cases, results, done, pct, counts } = testRunStats(t);
  const plan = t.planId ? Store.get("plans", t.planId) : null;
  const sys = t.systemId ? Store.get("systems", t.systemId) : null;
  const scopeComp = t.componentId ? Store.get("components", t.componentId) : null;
  const prev = Store.previousTestRun(t);
  const prevRes = prev ? new Map(cases.map(tc => [tc.id, Store.testRunResult(prev.id, tc.id)])) : null;
  const delta = tc => {
    if (!prevRes) return "";
    const a = prevRes.get(tc.id), b = results.get(tc.id);
    if (a && b && a.result === "Pass" && b.result === "Fail") return `<span class="delta down" title="Passed in ${esc(prev.code || "")}">▼ Regressed</span>`;
    if (a && b && a.result === "Fail" && b.result === "Pass") return `<span class="delta up" title="Failed in ${esc(prev.code || "")}">▲ Fixed</span>`;
    return a ? `<span class="faint small">was ${esc(a.result)}</span>` : "";
  };
  const regressed = prevRes ? cases.filter(tc => prevRes.get(tc.id)?.result === "Pass" && results.get(tc.id)?.result === "Fail").length : 0;
  const fixed = prevRes ? cases.filter(tc => prevRes.get(tc.id)?.result === "Fail" && results.get(tc.id)?.result === "Pass").length : 0;

  /* ----- grouping in true tree order, per system ----- */
  const caseComp = new Set(cases.map(tc => tc.componentId).filter(Boolean));
  const sysIds = [...new Set(cases.map(tc => Store.caseSystemId(tc)))];
  const systems = sysIds.map(s => Store.get("systems", s)).filter(Boolean).sort(Store.byCodeOrder);
  const multi = systems.length > 1;
  const casesUnder = compId => { const ids = Store.descendantIds(compId); return cases.filter(tc => ids.has(tc.componentId)); };
  const branchHasCases = compId => [...Store.descendantIds(compId)].some(d => caseComp.has(d));

  const sel = params.get("comp") || "";
  const selComp = sel && !sel.startsWith("sys:") ? Store.get("components", sel) : null;
  const visible = selComp ? Store.descendantIds(selComp.id) : null;
  const selAncestors = selComp ? Store.ancestorIds(selComp.id) : [];
  const rootId = selComp ? (selAncestors[0] || selComp.id) : "";

  const pill = (key, label, st, extra = "") => {
    const cls = key === sel ? " active" : (selAncestors.includes(key) ? " branch" : "");
    return `<a class="comp-pill filter-pill st-${COMP_ST_SLUG[st]}${cls}" href="${testRunHref(t.id, key)}"${extra}>${label}</a>`;
  };
  const topPills = [];
  for (const s of systems) {
    for (const { comp, depth } of Store.componentTree(s.id)) {
      if (depth || !branchHasCases(comp.id)) continue;
      topPills.push(pill(comp.id, `${multi ? `${esc(s.code)} › ` : ""}${esc(comp.name)}`, branchStatus(casesUnder(comp.id), results), ` title="${esc(comp.code)} — top-level component"`));
    }
    const sl = cases.filter(tc => !tc.componentId && Store.caseSystemId(tc) === s.id);
    if (sl.length) topPills.push(pill(`sys:${s.id}`, `${multi ? `${esc(s.code)} › ` : ""}System-level`, branchStatus(sl, results)));
  }
  let subPills = "";
  if (selComp) {
    const root = Store.get("components", rootId);
    const rootDepth = Store.componentDepth(rootId);
    const subs = Store.componentTree(root.systemId).filter(e => e.comp.id !== rootId && Store.descendantIds(rootId).has(e.comp.id) && branchHasCases(e.comp.id));
    if (subs.length) subPills = `
      <div class="pill-box sub">
        <div class="pill-head">Subcomponents in selected branch — ${esc(root.name)}</div>
        <div class="pill-row">${subs.map(({ comp, depth }) => `<span class="pill-indent" style="--depth:${depth - rootDepth - 1}">${pill(comp.id, `↳ ${esc(comp.name)}`, branchStatus(casesUnder(comp.id), results), ` title="${esc(comp.code)} — subcomponent level ${depth}"`)}</span>`).join("")}</div>
      </div>`;
  }

  const row = tc => {
    const r = results.get(tc.id);
    const proc = tc.procedureId ? Store.get("procedures", tc.procedureId) : null;
    return `<tr id="trc-${tc.id}" class="tr-row">
      <td><a class="code" href="#/cases/${tc.id}">${esc(tc.code)}</a>${tc.extKey ? `<div class="faint mono" style="font-size:9.5px">${esc(tc.extKey)}</div>` : ""}</td>
      <td><a href="#/cases/${tc.id}">${esc(tc.title)}</a>${tc.removalNominated ? ` ${badge("Review for Removal")}` : ""}${tc.status === "Retired" ? ` ${badge("Retired")}` : ""}</td>
      <td class="col-lo">${proc ? codeLink("procedures", proc) : `<span class="faint small">—</span>`}</td>
      <td>${r ? `${runBadge(r)}<div class="faint small">${codeLink("runs", r)}${r.operator ? ` · ${esc(r.operator)}` : ""}</div>` : `<span class="faint small">Not run</span>`}</td>
      <td class="col-mid">${delta(tc)}</td>
      <td class="col-lo">${runDots(tc.id)}</td>
      <td class="inline-actions">${actBtn("● Record", "record-run-tr", tc.id, `data-tr="${t.id}"`, false, "btn-xs")}${proc ? `<a class="btn btn-ghost btn-xs" href="#/execute/${tc.id}?tr=${t.id}${sel ? `&comp=${encodeURIComponent(sel)}` : ""}">▶ Execute</a>` : ""}</td>
    </tr>`;
  };
  const group = (title, label, depth, list, key) => {
    const c = resultCounts(list.map(tc => results.get(tc.id)));
    const gDone = list.filter(tc => { const r = results.get(tc.id); return r && RUN_DONE_RESULTS.includes(r.result); }).length;
    return `<div class="tr-group${depth ? " nested" : ""}" style="--depth:${depth}" data-group="${esc(key)}">
      <div class="tr-group-head">
        <div><div class="tr-group-title">${depth ? `<span class="tree-arrow">↳</span>` : ""}${title}</div>
          <div class="tr-group-label">${label}</div></div>
        <div class="tr-group-stats"><span class="mono"><b>${list.length ? Math.round(gDone / list.length * 100) : 0}%</b> complete</span>
          <span class="faint mono small">${c.pass} pass · ${c.fail} fail${c.waived ? ` · ${c.waived} waived` : ""}${c.removal ? ` · ${c.removal} review` : ""}${c.blocked ? ` · ${c.blocked} blocked/ip` : ""} · ${c.open} not run</span>
          <div style="min-width:160px">${progressMeter(c)}</div></div>
      </div>
      <div class="table-scroll"><table class="data"><thead><tr><th>Case</th><th>Title</th><th class="col-lo">Procedure</th><th>Result in This Run</th><th class="col-mid">vs Previous</th><th class="col-lo">History</th><th></th></tr></thead><tbody>${list.map(row).join("")}</tbody></table></div>
    </div>`;
  };
  const groups = [];
  for (const s of systems) {
    if (multi && !visible && sel === "") groups.push(`<div class="tr-sys-head">${esc(s.code)} ${esc(s.name)}</div>`);
    for (const { comp, depth } of Store.componentTree(s.id)) {
      const list = cases.filter(tc => tc.componentId === comp.id);
      if (!list.length || (visible && !visible.has(comp.id)) || (sel.startsWith("sys:"))) continue;
      groups.push(group(`<a href="#/components/${comp.id}">${esc(comp.code)} ${esc(comp.name)}</a>`, depth ? `Subcomponent · level ${depth}` : "Top-level component", depth, list, comp.id));
    }
    const sl = cases.filter(tc => !tc.componentId && Store.caseSystemId(tc) === s.id);
    if (sl.length && !visible && (!sel || sel === `sys:${s.id}`)) groups.push(group(`<a href="#/systems/${s.id}">${esc(s.code)} ${esc(s.name)}</a>`, "System-level", 0, sl, `sys:${s.id}`));
  }
  const orphan = cases.filter(tc => !Store.caseSystemId(tc));
  if (orphan.length && !sel) groups.push(group("Unassigned", "No component or system", 0, orphan, "none"));

  const toRerun = cases.filter(tc => { const r = results.get(tc.id); return !r || ["Fail", "Blocked", "In Progress"].includes(r.result); }).length;
  const open = Store.testRunIsOpen(t);
  return `
    ${pageHead(
      [{ label: "Test Runs", href: "#/runs" }, { label: t.code || t.id }],
      `<span class="code-inline">${esc(t.code || "")}</span>${esc(t.name || "Test run")}`,
      actBtn("Edit", "edit-testrun", t.id) + actBtn("Delete", "del-testrun", t.id) + actBtn("⎙ Print", "print-page", null) +
      (toRerun ? actBtn(`↻ Rerun ${toRerun} Open/Failed`, "tr-rerun", t.id) : "") +
      (open ? actBtn("✓ Complete Run", "tr-complete", t.id, "", false) : actBtn("Reopen", "tr-reopen", t.id)),
      `${badge(t.status || "Active")} &nbsp; ${sys ? chip("systems", sys) : ""} ${plan ? chip("plans", plan) : ""} ${scopeComp ? chip("components", scopeComp) : ""}
       ${t.buildId && Store.get("builds", t.buildId) ? `<span class="small">testing ${buildChip(Store.get("builds", t.buildId))}</span>` : ""}
       <span class="faint mono small">started ${runTimeLabel(t.startedAt || t.createdAt)}${t.completedAt ? ` · completed ${runTimeLabel(t.completedAt)}` : ""}${t.operator ? ` · ${esc(t.operator)}` : ""}</span>`)}
    <div class="kpi-row">
      <div class="kpi" style="--kpi-accent:var(--amber)"><div class="kpi-label">Completion</div><div class="kpi-value">${pct}<small>%</small></div><div class="kpi-foot">${done} of ${cases.length} cases have a final result</div></div>
      <div class="kpi" style="--kpi-accent:var(--green)"><div class="kpi-label">Passed</div><div class="kpi-value">${counts.pass}<small>/${cases.length}</small></div><div class="kpi-foot">${counts.waived} waived · ${counts.removal} for review</div></div>
      <div class="kpi" style="--kpi-accent:var(--red)"><div class="kpi-label">Failed</div><div class="kpi-value">${counts.fail}</div><div class="kpi-foot">${counts.blocked} blocked/ip · ${counts.open} not run</div></div>
      <div class="kpi" style="--kpi-accent:var(--purple)"><div class="kpi-label">vs Previous Run</div><div class="kpi-value">${prev ? regressed : "—"}<small>${prev ? " regressed" : ""}</small></div>
        <div class="kpi-foot">${prev ? `${fixed} fixed · compared with <a href="${testRunHref(prev.id)}">${esc(prev.code || prev.id)}</a>` : "No earlier run of this plan/system"}</div></div>
    </div>
    <div style="margin-bottom:14px">${progressMeter(counts)}</div>
    <div class="pill-box">
      <div class="pill-head">Top-level components ${sel ? `<a class="small" href="${testRunHref(t.id)}" style="margin-left:8px">clear filter ✕</a>` : ""}</div>
      <div class="pill-row">${pill("", "All", branchStatus(cases, results))}${topPills.join("")}</div>
    </div>
    ${subPills}
    <h2 class="section-title">Components in Scope${selComp ? ` — ${esc(selComp.name)} branch` : sel.startsWith("sys:") ? " — system level" : ""}</h2>
    ${groups.join("") || emptyMsg(cases.length ? "No cases in the selected branch." : "This test run has no cases in scope.")}
    ${t.notes ? panel("Notes", `<div style="white-space:pre-wrap">${esc(t.notes)}</div>`) : ""}
    ${auditPanel(t.id)}`;
};

/* ================= ACTIONS ================= */
function startTestRun(fields) {
  const now = new Date().toISOString();
  const t = Object.assign({ name: "Test run", operator: "", status: "Active", notes: "", planId: "", systemId: "", componentId: "", createdAt: now, startedAt: now, completedAt: "", caseIds: [] }, fields);
  // A session tests one build: the system's current build unless one was chosen.
  if (t.buildId === undefined && currentBuildId(t.systemId)) t.buildId = currentBuildId(t.systemId);
  return Store.add("testRuns", t);
}
const buildNote = sysId => { const b = sysId && Store.currentBuild(sysId); return b ? ` Results are recorded against build ${b.label}.` : ""; };

/* Add missing in-scope cases to a plan; returns how many were added. */
function fillPlan(plan, scope) {
  const have = new Set(plan.caseIds || []);
  const missing = scope.filter(tc => !have.has(tc.id)).map(tc => tc.id);
  if (missing.length) Store.update("plans", plan.id, { caseIds: (plan.caseIds || []).concat(missing) });
  return missing.length;
}

/* The single system most of a plan's cases belong to, if any. */
function inferPlanSystem(plan) {
  const tally = new Map();
  for (const id of plan.caseIds || []) { const tc = Store.get("cases", id); const s = tc && Store.caseSystemId(tc); if (s) tally.set(s, (tally.get(s) || 0) + 1); }
  const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  return ranked.length && (ranked.length === 1 || ranked[0][1] > ranked[1][1]) ? ranked[0][0] : "";
}

Object.assign(Actions, {
  "full-regression": sysId => {
    const sys = Store.get("systems", sysId);
    const scope = Store.regressionScope(sysId);
    if (!scope.length) { Toast.show("No active test cases in this system to regress.", true); return; }
    const plan = Store.regressionPlanFor(sysId);
    const missing = plan ? scope.filter(tc => !(plan.caseIds || []).includes(tc.id)).length : scope.length;
    const retired = Store.casesOfSystem(sysId).length - scope.length;
    const where = ["components", Store.all("components").some(c => c.systemId === sysId && Store.parentOf(c)) && "subcomponents",
      scope.some(tc => !tc.componentId) && "system level"].filter(Boolean).join(", ").replace(/, ([^,]*)$/, " and $1");
    Modal.confirm(`Start a full regression of ${sys.code} ${sys.name}? ${scope.length} test case(s) are in scope across ${where}${retired ? `; ${retired} retired case(s) excluded` : ""}. ` +
      (plan ? `Uses regression plan ${plan.code}${missing ? ` and adds ${missing} missing case(s) to it` : ""}.` : "A regression plan will be created for this system.") +
      " A new test run session opens with the scope frozen." + buildNote(sysId), () => {
        const p = plan || Store.add("plans", {
          name: `${sys.name} Full Regression`, phase: "Regression", status: "Active", start: todayISO(), end: "", extKey: "", decisionId: "",
          description: `Full regression of ${sys.code} ${sys.name}: every active test case across its components, subcomponents and system level.`,
          regressionSystemId: sysId, systemId: sysId, caseIds: [], extLinks: []
        });
        fillPlan(p, scope);
        Store.update("plans", p.id, { status: "Active", regressionSystemId: p.regressionSystemId || sysId });
        const t = startTestRun({ name: `${sys.name} full regression`, planId: p.id, systemId: sysId, caseIds: scope.map(tc => tc.id),
          notes: `Scope frozen at start: ${scope.length} case(s) in ${sys.code}${retired ? `; ${retired} retired excluded` : ""}.` });
        Toast.show(`${t.code} started — ${scope.length} cases`);
        App.go(`#/testruns/${t.id}`);
      }, "Start Regression", true);
  },

  /* A test run scoped to one component and all of its subcomponents. */
  "comp-test": compId => {
    const comp = Store.get("components", compId);
    const all = Store.casesOfBranch(compId);
    const scope = all.filter(tc => tc.status !== "Retired");
    if (!scope.length) { Toast.show(`${comp.code} has no active test cases to run.`, true); return; }
    const own = scope.filter(tc => tc.componentId === compId).length;
    const subs = Store.descendantIds(compId).size - 1;
    const retired = all.length - scope.length;
    Modal.confirm(`Start a component test of ${comp.code} ${comp.name}? ${scope.length} test case(s) in scope: ${own} on the component` +
      (subs ? ` and ${scope.length - own} across its ${subs} subcomponent(s)` : "") + (retired ? `; ${retired} retired excluded` : "") +
      ". A new test run session opens with the scope frozen." + buildNote(comp.systemId), () => {
        const n = Store.all("testRuns").filter(t => t.componentId === compId).length + 1;
        const t = startTestRun({ name: `${comp.name} component test${n > 1 ? ` ${n}` : ""}`, systemId: comp.systemId, componentId: compId,
          caseIds: scope.map(tc => tc.id), notes: `Component test of ${comp.code}${subs ? " including its subcomponents" : ""}: ${scope.length} case(s) frozen at start.` });
        Toast.show(`${t.code} started — ${scope.length} cases`);
        App.go(`#/testruns/${t.id}`);
      }, "Start Component Test", true);
  },

  "plan-autofill": planId => {
    const p = Store.get("plans", planId);
    const apply = sysId => {
      const sys = Store.get("systems", sysId);
      const scope = Store.regressionScope(sysId);
      const added = fillPlan(Store.get("plans", planId), scope);
      // Claim the system's regression slot only if no other plan already holds it.
      if (!p.regressionSystemId && !Store.all("plans").some(x => x.regressionSystemId === sysId)) Store.update("plans", planId, { regressionSystemId: sysId });
      Toast.show(added ? `Added ${added} case(s) from ${sys.code} regression scope` : `${p.code} already contains all ${scope.length} in-scope case(s)`);
      App.render();
    };
    const sysId = p.regressionSystemId || inferPlanSystem(p);
    if (sysId) {
      const sys = Store.get("systems", sysId);
      const missing = Store.regressionScope(sysId).filter(tc => !(p.caseIds || []).includes(tc.id)).length;
      Modal.confirm(`Auto-fill ${p.code} with the regression scope of ${sys.code} ${sys.name}? ${missing} missing case(s) will be added; existing assignments are kept.`, () => apply(sysId), "Auto-Fill", true);
    } else {
      Modal.open(`Auto-Fill ${p.code}`, [{ key: "systemId", label: "System to regress", type: "select", required: true, options: Store.all("systems").map(s => ({ value: s.id, label: `${s.code} ${s.name}` })) }],
        {}, v => apply(v.systemId), "Auto-Fill");
    }
  },

  "plan-start-run": planId => {
    const p = Store.get("plans", planId);
    const cases = (p.caseIds || []).map(id => Store.get("cases", id)).filter(tc => tc && tc.status !== "Retired");
    if (!cases.length) { Toast.show(`${p.code} has no active cases — assign cases or Auto-Fill Regression first.`, true); return; }
    const sysIds = [...new Set(cases.map(tc => Store.caseSystemId(tc)).filter(Boolean))];
    const n = Store.all("testRuns").filter(t => t.planId === planId).length + 1;
    const t = startTestRun({ name: `${p.name} — run ${n}`, planId, systemId: sysIds.length === 1 ? sysIds[0] : (p.regressionSystemId || ""), caseIds: cases.map(tc => tc.id) });
    Toast.show(`${t.code} started — ${cases.length} cases`);
    App.go(`#/testruns/${t.id}`);
  },

  "record-run-tr": (caseId, el) => {
    const t = Store.get("testRuns", el.dataset.tr);
    openRunForm({ caseId, planId: t.planId || "", testRunId: t.id, operator: t.operator || "", anchor: `trc-${caseId}`, ...(t.buildId !== undefined ? { buildId: t.buildId } : {}) });
  },

  "edit-testrun": id => {
    const t = Store.get("testRuns", id);
    const statuses = TEST_RUN_STATUSES.includes(t.status) || !t.status ? TEST_RUN_STATUSES : [t.status, ...TEST_RUN_STATUSES];
    const build = buildField(t.systemId ? [t.systemId] : Store.all("systems").map(s => s.id), t.buildId);
    Modal.open(`Edit ${t.code || "Test Run"}`, [
      { key: "name", label: "Name", required: true },
      { key: "operator", label: "Operator / Test Conductor", half: true },
      { key: "status", label: "Status", type: "select", half: true, options: statuses },
      ...(build ? [Object.assign(build, { label: "Build under test (new results default to it)" })] : []),
      { key: "notes", label: "Notes", type: "textarea" }
    ], t, v => { Store.update("testRuns", id, v); Toast.show("Saved"); App.render(); });
  },

  "tr-complete": id => {
    const t = Store.get("testRuns", id);
    const s = testRunStats(t);
    const finish = () => { Store.update("testRuns", id, { status: "Complete", completedAt: new Date().toISOString() }); Toast.show(`${t.code} completed`); App.render(); };
    if (s.done < s.cases.length) Modal.confirm(`${s.cases.length - s.done} case(s) have no final result. Complete ${t.code} anyway? You can reopen it later.`, finish, "Complete", true);
    else finish();
  },
  "tr-reopen": id => { Store.update("testRuns", id, { status: "Active", completedAt: "" }); Toast.show("Reopened"); App.render(); },

  "tr-rerun": id => {
    const t = Store.get("testRuns", id);
    const s = testRunStats(t);
    const ids = s.cases.filter(tc => { const r = s.results.get(tc.id); return !r || ["Fail", "Blocked", "In Progress"].includes(r.result); }).map(tc => tc.id);
    if (!ids.length) { Toast.show("Nothing to rerun."); return; }
    const n = startTestRun({ name: `${t.name || "Test run"} — rerun`, planId: t.planId || "", systemId: t.systemId || "", componentId: t.componentId || "", caseIds: ids,
      operator: t.operator || "", notes: `Rerun of ${t.code}: ${ids.length} failed, blocked, in-progress or not-run case(s).` });
    Toast.show(`${n.code} started — ${ids.length} cases`);
    App.go(`#/testruns/${n.id}`);
  },

  "del-testrun": id => {
    const t = Store.get("testRuns", id);
    const kept = Store.all("runs").filter(r => r.testRunId === id).length;
    Modal.confirm(`Delete test run ${t.code || ""} “${t.name || ""}”? The ${kept} case result(s) recorded during it stay in the run log, unlinked from the session.`, () => {
      Store.remove("testRuns", id); toastUndo("Test run deleted"); App.go("#/runs");
    });
  },

  /* ---- review / removal disposition ---- */
  "removal-keep": id => Modal.open("Keep Test Case", [{ key: "note", label: "Why is this case being kept?", type: "textarea", required: true }], {}, v => {
    const tc = Store.get("cases", id);
    Store.update("cases", id, { removalNominated: false, reviewDisposition: `Kept ${todayISO()}: ${v.note}`, status: tc.status === "Draft" ? "Ready" : tc.status });
    Toast.show(`${tc.code} kept`); App.render();
  }, "Keep Case"),

  "removal-retire": id => Modal.open("Retire Test Case", [
    { key: "note", label: "Reason for retirement", type: "textarea", required: true },
    { key: "fromPlans", label: "Test plans", type: "select", options: [{ value: "yes", label: "Also remove from all test plans" }, { value: "no", label: "Leave plan assignments as they are" }] }
  ], { fromPlans: "yes" }, v => {
    const tc = Store.get("cases", id);
    Store.update("cases", id, { status: "Retired", removalNominated: false, reviewDisposition: `Retired ${todayISO()}: ${v.note}` });
    if (v.fromPlans === "yes") for (const p of Store.plansOf(id)) Store.update("plans", p.id, { caseIds: p.caseIds.filter(x => x !== id) });
    Toast.show(`${tc.code} retired`); App.render();
  }, "Retire"),

  "case-reinstate": id => {
    const tc = Store.get("cases", id);
    Store.update("cases", id, { status: "Draft", reviewDisposition: `${tc.reviewDisposition ? tc.reviewDisposition + "\n" : ""}Reinstated ${todayISO()}` });
    Toast.show(`${tc.code} reinstated`); App.render();
  }
});
