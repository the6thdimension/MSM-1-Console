/* ============================================================
   IDSK, decisions and decision packages.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
Views.idsk = function () {
  const decisions = Scope.list("decisions").slice().sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const measures = Scope.list("requirements").filter(r => r.measure && r.measure !== "None");
  const plans = Scope.list("plans");

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

function decisionFields() {
  return [
    { key: "title", label: "Title", required: true },
    ownerField(),
    { key: "description", label: "Description", type: "textarea" },
    { key: "date", label: "Decision Date", type: "date", half: true },
    { key: "status", label: "Status", type: "select", half: true, options: DECISION_STATUSES },
    { key: "authority", label: "Decision Authority", half: true },
    { key: "requirementIds", label: "Informing Measures (Requirements)", type: "multicheck", options: Store.all("requirements").map(r => ({ value: r.id, code: r.code, label: `${r.title}${r.measure && r.measure !== "None" ? ` [${r.measure}]` : ""}` })) }
  ];
}

Object.assign(Actions, {
  /* ---- decisions (IDSK) ---- */
  "add-decision": () => Modal.open("New Decision", decisionFields(), ownerDefault({ status: "Pending", requirementIds: [] }), v => {
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

});
