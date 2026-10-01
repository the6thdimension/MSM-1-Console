/* ============================================================
   Defects.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
Views.defects = function (params) {
  const sevF = params.get("severity") || "";
  const statF = params.get("status") || "";
  const compF = params.get("component") || "";
  let defects = Scope.list("defects").slice().sort((a, b) => (b.opened || "").localeCompare(a.opened || ""));
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
      <td class="small">${defectBuildsCell(d)}</td>
      <td>${cases.map(tc => codeLink("cases", tc)).join(" ") || `<span class="faint small">—</span>`}</td>
      <td class="num">${esc(d.opened || "")}</td>
      <td>${esc(d.owner || "")}</td>
    </tr>`;
  }).join("");

  const open = Scope.list("defects").filter(d => Store.defectIsOpen(d)).length;
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
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Defect</th><th>Severity</th><th>Status</th><th>Age</th><th>Component</th><th>Builds</th><th>Cases</th><th>Opened</th><th>Owner</th></tr></thead><tbody>${rows}</tbody></table></div>`
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
    ${retestStrip(d)}
    <div class="grid-2">
      <div>
        ${panel("Description", `<p style="margin:0 0 10px">${esc(d.description || "")}</p>
          <dl class="def-grid">
            <dt>Severity</dt><dd>${badge(d.severity)}</dd>
            <dt>Status</dt><dd>${badge(d.status)}</dd>
            <dt>Owner</dt><dd>${esc(d.owner || "—")}</dd>
            <dt>Opened</dt><dd class="mono">${esc(d.opened || "—")}</dd>
            ${d.closed ? `<dt>Closed</dt><dd class="mono">${esc(d.closed)}</dd>` : ""}
            ${d.foundInBuildId || d.fixedInBuildId || d.verifiedInBuildId || Store.all("builds").length ? `<dt>Builds</dt><dd>${defectBuildsCell(d)}</dd>` : ""}
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
    </div>
    ${extLinksPanel("defects", d)}`;
};

/* "found ⎇ 0.9.1 → fixed ⎇ 0.9.2" plus a retest marker when Store.defectRetest proposes one. */
function defectBuildsCell(d) {
  const tag = (key, word) => { const b = d[key] ? Store.get("builds", d[key]) : null; return b ? `${word} <a class="build-tag" href="#/builds/${b.id}">⎇ ${esc(b.label)}</a>` : ""; };
  const parts = [tag("foundInBuildId", "found"), tag("fixedInBuildId", "fixed"), tag("verifiedInBuildId", "verified")].filter(Boolean);
  const rt = Store.defectRetest(d);
  const flag = rt ? ` <span class="retest-flag" title="${rt.passedOn ? "A linked case has passed on a build with the fix — verify and close" : "The build with the fix is now under test — ready to retest"}">↻ ${rt.passedOn ? "verify" : "retest"}</span>` : "";
  return (parts.join(" → ") || `<span class="faint">—</span>`) + flag;
}

/* Proposals from Store.defectRetest, each with an explicit confirm-first action. */
function retestStrip(d) {
  const rt = Store.defectRetest(d);
  if (!rt) return "";
  const out = [];
  if (rt.passedOn) out.push(`<div class="ready-strip go"><span class="lamp"></span>
    <span>${esc(rt.passedOn.tc.code)} passed on ${rt.passedOn.build ? `⎇ ${esc(rt.passedOn.build.label)}` : esc(rt.passedOn.run.date || "")}${rt.fix ? `, which includes the fix (${esc(rt.fix.label)})` : rt.found ? `, later than ⎇ ${esc(rt.found.label)} where it was found` : ", after the defect was opened"} — verify and close?</span>
    <span class="spacer" style="flex:1"></span>${actBtn("✓ Close as verified", "defect-verify", d.id, `data-run="${rt.passedOn.run.id}"`, false, "btn-xs")}</div>`);
  if (rt.fixReady) out.push(`<div class="ready-strip info"><span class="lamp"></span>
    <span>The fix (⎇ ${esc(rt.fix.label)}) is in the current build ⎇ ${esc(rt.fixReady.label)} — ready to retest?</span>
    <span class="spacer" style="flex:1"></span>${actBtn("→ Ready for Retest", "defect-ready-retest", d.id, "", false, "btn-xs")}</div>`);
  return out.join("");
}

function defectBuildFields(d) {
  const base = buildField(Store.all("systems").map(s => s.id), d && (d.foundInBuildId || d.fixedInBuildId || d.verifiedInBuildId));
  if (!base) return [];
  return [["foundInBuildId", "Found in build"], ["fixedInBuildId", "Fix delivered in build"], ["verifiedInBuildId", "Verified in build"]]
    .map(([key, label]) => Object.assign({}, base, { key, label }));
}

function defectFields(d) {
  return [
    { key: "title", label: "Title", required: true },
    ownerField(),
    { key: "description", label: "Description (symptom, suspected cause, impact)", type: "textarea", required: true },
    { key: "severity", label: "Severity", type: "select", half: true, options: DEFECT_SEVERITIES },
    { key: "status", label: "Status", type: "select", half: true, options: DEFECT_STATUSES },
    { key: "componentId", label: "Component", type: "select", half: true, allowEmpty: true, options: Store.all("components").map(c => ({ value: c.id, label: `${c.code} ${c.name}` })) },
    { key: "runId", label: "Found By Run", type: "select", half: true, allowEmpty: true, options: Store.all("runs").map(r => { const tc = Store.get("cases", r.caseId); return { value: r.id, label: `${r.code} · ${tc ? tc.code : "?"} · ${r.date || ""}` }; }) },
    { key: "owner", label: "Owner", half: true },
    { key: "opened", label: "Opened", type: "date", half: true },
    ...defectBuildFields(d),
    { key: "caseIds", label: "Affected Test Cases", type: "multicheck", options: Store.all("cases").map(tc => ({ value: tc.id, code: tc.code, label: tc.title })) }
  ];
}

function openDefectForm(preset) {
  // A defect filed from a run was found in the build that run measured.
  const run = preset.runId ? Store.get("runs", preset.runId) : null;
  if (run && run.buildId && preset.foundInBuildId === undefined) preset = Object.assign({}, preset, { foundInBuildId: run.buildId });
  Modal.open("New Defect", defectFields(preset),
    ownerDefault(Object.assign({ severity: "Major", status: "Open", opened: todayISO(), caseIds: [] }, preset)), v => {
      // A defect on a component belongs to that component's system.
      const comp = v.componentId ? Store.get("components", v.componentId) : null;
      if (comp) v.systemId = comp.systemId;
      const d = Store.add("defects", v);
      Toast.show(`${d.code} filed`); App.go(`#/defects/${d.id}`);
    }, "File Defect");
}

Object.assign(Actions, {
  /* ---- defects ---- */
  "add-defect": () => openDefectForm({}),
  "add-defect-case": id => {
    const tc = Store.get("cases", id);
    openDefectForm({ caseIds: [id], componentId: tc ? tc.componentId : "" });
  },
  "add-defect-comp": id => openDefectForm({ componentId: id }),
  "edit-defect": id => Modal.open("Edit Defect", defectFields(Store.get("defects", id)), Store.get("defects", id), v => {
    if (v.status === "Closed" && !Store.get("defects", id).closed) v.closed = todayISO();
    const comp = v.componentId ? Store.get("components", v.componentId) : null;
    if (comp) v.systemId = comp.systemId;
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
  "defect-ready-retest": id => {
    const d = Store.get("defects", id);
    Store.update("defects", id, { status: "Ready for Retest" });
    Toast.show(`${d.code} → Ready for Retest`); App.render();
  },
  "defect-verify": (id, el) => {
    const d = Store.get("defects", id), run = Store.get("runs", el.dataset.run);
    if (!run) return;
    const b = run.buildId ? Store.get("builds", run.buildId) : null;
    Modal.confirm(`Close ${d.code} as verified by ${run.code} (Pass${b ? ` on ${b.label}` : ""}, ${run.date})?`, () => {
      Store.update("defects", id, { status: "Closed", closed: todayISO(), ...(b ? { verifiedInBuildId: b.id } : {}) });
      Toast.show(`${d.code} closed — verified${b ? ` in ${b.label}` : ""}`); App.render();
    }, "Close as verified", true);
  },

});
