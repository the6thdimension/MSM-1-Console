/* ============================================================
   Test Runs page (sessions + run log) and the page for one run.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */

/* Run log: newest first, filterable by result, build, session and text, optionally grouped
   by session or build. Lower-priority columns drop away on narrow screens. */
Views.runs = function (params) {
  const resF = params.get("result") || "";
  const buildF = params.get("build") || "";
  const trF = params.get("tr") || "";
  const q = (params.get("q") || "").trim().toLowerCase();
  const groupBy = ["session", "build"].includes(params.get("group")) ? params.get("group") : "";
  let runs = Scope.list("runs").slice().sort((a, b) => Store.compareRuns(a, b));
  if (resF) runs = runs.filter(r => r.result === resF);
  if (buildF) runs = runs.filter(r => (buildF === "none" ? !r.buildId : r.buildId === buildF));
  if (trF) runs = runs.filter(r => (trF === "none" ? !r.testRunId : r.testRunId === trF));
  if (q) runs = runs.filter(r => {
    const tc = Store.get("cases", r.caseId);
    return [r.code, r.operator, r.notes, r.measured, r.evidence, r.extKey, tc && tc.code, tc && tc.title].join(" ").toLowerCase().includes(q);
  });

  const row = r => {
    const tc = Store.get("cases", r.caseId);
    const plan = r.planId ? Store.get("plans", r.planId) : null;
    const trun = r.testRunId ? Store.get("testRuns", r.testRunId) : null;
    return `<tr>
      <td>${codeLink("runs", r)}${r.extKey ? `<div style="font-size:9.5px;margin-top:1px">${extKeyTag(r.extKey)}</div>` : ""}</td>
      <td class="num">${esc(r.date || "")}</td>
      <td>${tc ? `${codeLink("cases", tc)} <span class="small">${esc(tc.title)}</span>` : "—"}</td>
      <td>${badge(r.result)}</td>
      <td class="small col-mid">${buildTag(r) || `<span class="faint">—</span>`}</td>
      <td class="small col-lo">${r.measured ? `<span class="mono">${esc(r.measured)}</span>` : `<span class="faint">—</span>`}</td>
      <td class="col-lo">${esc(r.operator || "")}</td>
      <td class="col-lo">${plan ? codeLink("plans", plan) : "—"}${trun ? `<div>${testRunLink(trun)}</div>` : ""}</td>
      <td class="inline-actions">${actBtn("Edit", "edit-run", r.id)}${actBtn("Del", "del-run", r.id)}</td>
    </tr>`;
  };
  const groupKey = r => groupBy === "session" ? (r.testRunId || "") : (r.buildId || "");
  const groupLabel = key => {
    if (groupBy === "session") { const t = key && Store.get("testRuns", key); return t ? testRunLink(t) : "Not in a test run session"; }
    const b = key && Store.get("builds", key); return b ? `<a class="build-tag" href="#/builds/${b.id}">⎇ ${esc(b.label)}</a> ${badge(b.status)}` : "Build not recorded";
  };
  let body = "";
  if (groupBy) {
    const order = [...new Set(runs.map(groupKey))];
    body = order.map(key => {
      const list = runs.filter(r => groupKey(r) === key);
      const c = resultCounts(list);
      return `<tr class="group-row"><td colspan="9">${groupLabel(key)} <span class="faint mono small">${list.length} run${list.length === 1 ? "" : "s"} · ${c.pass} pass · ${c.fail} fail</span></td></tr>${list.map(row).join("")}`;
    }).join("");
  } else body = runs.map(row).join("");

  const builds = Scope.list("builds").slice().sort((a, b) => Store.byCodeOrder(a, b));
  const sessions = Store.testRunsSorted(t => Scope.includes("testRuns", t));
  return `
    ${pageHead([{ label: "Test Runs" }], "Test Runs",
      actBtn("● Record Run", "record-run-any", null, "", false),
      "Test run sessions group many cases into one campaign pass; the log below records every individual case result, newest first. Open a run code for its full record.")}
    ${testRunsPanel("Test Run Sessions", sessions, "No test run sessions yet — start one from a plan (▶ Start Run) or a system (▶ Full Regression).")}
    <div class="filter-bar">
      <input type="search" data-filter="q" placeholder="Filter by case, operator, notes…" value="${esc(params.get("q") || "")}">
      <select data-filter="result"><option value="">All results</option>${RUN_RESULTS.map(s => `<option ${resF === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      <select data-filter="build"><option value="">All builds</option><option value="none" ${buildF === "none" ? "selected" : ""}>Build not recorded</option>${builds.map(b => `<option value="${b.id}" ${buildF === b.id ? "selected" : ""}>${esc(b.label)} (${esc(b.code)})</option>`).join("")}</select>
      <select data-filter="tr"><option value="">All sessions</option><option value="none" ${trF === "none" ? "selected" : ""}>Not in a session</option>${sessions.map(t => `<option value="${t.id}" ${trF === t.id ? "selected" : ""}>${esc(t.code || "")} ${esc(t.name || "")}</option>`).join("")}</select>
      <select data-filter="group"><option value="">Group: none</option><option value="session" ${groupBy === "session" ? "selected" : ""}>Group by session</option><option value="build" ${groupBy === "build" ? "selected" : ""}>Group by build</option></select>
      <span class="faint mono small">${runs.length} shown</span>
    </div>
    ${panel("Log", body
      ? `<div class="table-scroll"><table class="data runs-log"><thead><tr><th>Run</th><th>Date</th><th>Test Case</th><th>Result</th><th class="col-mid">Build</th><th class="col-lo">Measured</th><th class="col-lo">Operator</th><th class="col-lo">Plan / Session</th><th></th></tr></thead><tbody>${body}</tbody></table></div>`
      : emptyMsg("No runs match the filter."), "", true)}`;
};

/* One run: what was measured, on which build, in which session, against which thresholds,
   and which defects it is tied to. */
Views.runDetail = function (id) {
  const r = Store.get("runs", id);
  if (!r) return notFound("Run");
  const tc = Store.get("cases", r.caseId);
  const comp = tc && tc.componentId ? Store.get("components", tc.componentId) : null;
  const sysId = Store.ownerOf("runs", r);
  const sys = sysId ? Store.get("systems", sysId) : null;
  const plan = r.planId ? Store.get("plans", r.planId) : null;
  const trun = r.testRunId ? Store.get("testRuns", r.testRunId) : null;
  const caseRuns = tc ? Store.runsOf(tc.id) : [r];
  const i = caseRuns.indexOf(r), newer = i > 0 ? caseRuns[i - 1] : null, older = i >= 0 && i < caseRuns.length - 1 ? caseRuns[i + 1] : null;
  const reqs = tc ? (tc.requirementIds || []).map(x => Store.get("requirements", x)).filter(Boolean) : [];
  const measures = reqs.filter(q => q.threshold).map(q => `<div class="run-measure">${chip("requirements", q)}${r.measured ? marginBar(q, r.measured) || `<div class="mb-caption">${esc(r.measured)} vs ${esc(q.threshold)} (not numerically comparable)</div>` : `<div class="mb-caption faint">threshold ${esc(q.threshold)} · no measured value recorded</div>`}</div>`).join("");
  const fromRun = Store.all("defects").filter(d => d.runId === r.id);
  const onCase = tc ? Store.defectsOfCase(tc.id).filter(d => d.runId !== r.id) : [];
  const defRow = d => `<div style="margin-bottom:5px">${chip("defects", d)} ${badge(d.severity)} ${badge(d.status)}</div>`;
  const proc = tc && tc.procedureId ? Store.get("procedures", tc.procedureId) : null;

  return `
    ${pageHead([{ label: "Test Runs", href: "#/runs" }, ...(tc ? [{ label: tc.code, href: `#/cases/${tc.id}` }] : []), { label: r.code }],
      `<span class="code-inline">${esc(r.code)}</span>${tc ? esc(tc.title) : "Run"}`,
      actBtn("Edit", "edit-run", r.id) + actBtn("Delete", "del-run", r.id) +
      (tc ? actBtn("⚑ Defect", "add-defect-run", r.id) + actBtn("● Record Again", "record-run", tc.id) : "") +
      (proc ? `<a class="btn" href="#/execute/${tc.id}">▶ Execute</a>` : ""),
      `${badge(r.result)} <span class="mono faint">${esc(r.date || "")}</span> ${buildTag(r)}
       ${r.operator ? `<span class="faint small">· ${esc(r.operator)}</span>` : ""}
       <span class="faint small">· run ${caseRuns.length - i} of ${caseRuns.length} for this case
       ${older ? ` · <a href="#/runs/${older.id}">‹ older ${esc(older.code)}</a>` : ""}${newer ? ` · <a href="#/runs/${newer.id}">newer ${esc(newer.code)} ›</a>` : ""}</span>`)}
    <div class="grid-2">
      <div>
        ${panel("Run", `<dl class="def-grid">
            <dt>Test case</dt><dd>${tc ? chip("cases", tc) : "—"}</dd>
            <dt>Component</dt><dd>${comp ? chip("components", comp) : `<span class="faint small">${tc ? "System-level case" : "—"}</span>`}</dd>
            <dt>System</dt><dd>${sys ? chip("systems", sys) : "—"}</dd>
            <dt>Build</dt><dd>${buildTag(r) || `<span class="faint small">not recorded</span>`}</dd>
            <dt>Plan</dt><dd>${plan ? chip("plans", plan) : `<span class="faint">—</span>`}</dd>
            <dt>Session</dt><dd>${trun ? testRunLink(trun) : `<span class="faint">—</span>`}</dd>
            <dt>Jira / Zephyr</dt><dd>${r.extKey ? extKeyTag(r.extKey) : `<span class="faint">—</span>`}</dd>
            <dt>Recorded</dt><dd class="mono small">${esc(r.recordedAt ? runTimeLabel(r.recordedAt) : "—")}</dd>
          </dl>`)}
        ${panel("Notes & Evidence", `${r.notes ? `<p style="margin:0 0 8px;white-space:pre-wrap">${esc(r.notes)}</p>` : `<span class="faint small">No notes.</span>`}${r.evidence ? `<div>${evidenceRefs(r.evidence)}</div>` : ""}`)}
      </div>
      <div>
        ${panel("Measured vs Threshold", measures || `<span class="faint small">${reqs.length ? "None of the verified requirements has a threshold." : "This case verifies no requirement."}</span>`)}
        ${panel("Defects", fromRun.length || onCase.length
          ? `${fromRun.length ? `<div class="flow-label">Found by this run</div>${fromRun.map(defRow).join("")}` : ""}${onCase.length ? `<div class="flow-label" style="margin-top:8px">Other defects on this case</div>${onCase.map(defRow).join("")}` : ""}`
          : `<span class="faint small">No defects tied to this run${r.result === "Fail" ? " — use ⚑ Defect to file one" : ""}.</span>`)}
        ${auditPanel(r.id)}
      </div>
    </div>`;
};

Object.assign(Actions, {
  /* ---- defect from a run page ---- */
  "add-defect-run": id => {
    const r = Store.get("runs", id), tc = r && Store.get("cases", r.caseId);
    if (!tc) return;
    openDefectForm({ caseIds: [tc.id], componentId: tc.componentId || "", systemId: Store.caseSystemId(tc), runId: r.id, title: `${tc.code}: ` });
  }
});
