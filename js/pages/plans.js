/* ============================================================
   Test plans.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
Views.plans = function () {
  const rows = Scope.list("plans").map(p => {
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

function planFields() {
  return [
    { key: "name", label: "Name", required: true },
    ownerField(),
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

Object.assign(Actions, {
  /* ---- plans ---- */
  "add-plan": () => Modal.open("New Test Plan", planFields(), ownerDefault({ status: "Planning", caseIds: [] }), v => {
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

});
