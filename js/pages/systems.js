/* ============================================================
   Systems, components and component status reasons.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
Views.systems = function () {
  const cards = Scope.list("systems").map(s => {
    const comps = Store.componentsOf(s.id);
    const cases = Store.casesOfSystem(s.id);
    const sysSt = Store.systemStatus(s.id);
    const pills = Store.componentTree(s.id).map(({ comp: c, depth }) => {
      const st = Store.componentStatus(c.id);
      return `<span class="comp-pill st-${COMP_ST_SLUG[st]}${depth ? " sub" : ""}" title="${esc(c.code)} ${esc(c.name)} — ${componentWhy(c.id, false)}${depth ? ` · subcomponent level ${depth}` : ""}">${depth ? "↳ " : ""}${esc(c.name)}</span>`;
    }).join("");
    return `<a class="sys-card" href="#/systems/${s.id}">
      <span class="sys-lamp st-${COMP_ST_SLUG[sysSt]}" title="System status: ${sysSt}"></span>
      <span class="code">${esc(s.code)}</span>
      <h3>${esc(s.name)}</h3>
      ${s.team || s.lead ? `<div class="sys-team">${s.team ? `<span>${esc(s.team)}</span>` : ""}${s.lead ? `<span>Lead: ${esc(s.lead)}</span>` : ""}</div>` : ""}
      <p>${esc(s.description)}</p>
      <div class="comp-pills">${pills || `<span class="faint small">no components</span>`}</div>
      <div class="sys-stats"><span><b>${comps.length}</b> components</span><span><b>${cases.length}</b> test cases</span>${(b => b ? `<span title="Current build: ${esc(b.code)} · ${esc(b.status)}">⎇ <b>${esc(b.label)}</b></span>` : "")(Store.currentBuild(s.id))}</div>
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
      `${s.team ? `Team: <b>${esc(s.team)}</b> &nbsp;·&nbsp; ` : ""}${s.lead ? `Lead: <b>${esc(s.lead)}</b> &nbsp;·&nbsp; ` : ""}${esc(s.description)}
       ${Scope.system !== s.id ? ` &nbsp;<button class="btn btn-ghost btn-xs" data-act="scope-to" data-id="${s.id}">◎ Work in this system</button>` : ""}`)}
    ${regressionScopePanel(s)}
    ${systemReleasePanel(s)}
    ${panel("Components", compRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Component</th><th>Status</th><th class="col-mid">Test Cases</th><th class="col-lo">Reqs</th><th class="col-lo">Open Defects</th><th></th></tr></thead><tbody>${compRows}</tbody></table></div>`
      : emptyMsg("No components under this system yet — add one."), "", true)}
    ${sysCases.length ? panel("System-Level Test Cases", `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Title</th><th class="col-lo">Pri</th><th class="col-mid">Status</th><th>Latest Run</th></tr></thead><tbody>${sysCases.map(caseRow).join("")}</tbody></table></div>`, "", true) : ""}
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
      actBtn("Edit", "edit-component", c.id) + actBtn("Delete", "del-component", c.id) + actBtn("+ Subcomponent", "add-subcomponent", c.id) + actBtn("+ Test Case", "add-case", c.id) +
      actBtn("▶ Component Test", "comp-test", c.id, "", false),
      `${badge(st)} ${badge(depth ? `Subcomponent · level ${depth}` : "Top-level component", depth ? "b-purple" : "b-blue")} &nbsp; ${esc(c.description)}${componentWhy(c.id)}`)}
    ${componentTestPanel(c)}
    <div class="grid-2">
      <div>
        ${panel("Test Cases", caseRows
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Title</th><th class="col-lo">Pri</th><th class="col-mid">Status</th><th>Latest Run</th></tr></thead><tbody>${caseRows}</tbody></table></div>`
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

/* Why a component has its status, from Store.componentStatusDetail. `html` false gives plain
   text for tooltips. Lists stop at three codes and say how many more. */
function componentWhy(compId, html = true) {
  const d = Store.componentStatusDetail(compId);
  const list = (recs, coll = "cases") => {
    const shown = recs.slice(0, 3).map(r => html ? codeLink(coll, r) : esc(r.code)).join(", ");
    return shown + (recs.length > 3 ? ` +${recs.length - 3} more` : "");
  };
  const parts = [];
  if (d.status === "Failing") {
    if (d.failed.length) parts.push(`latest run failed: ${list(d.failed)}`);
    for (const sev of ["Critical", "Major"]) {
      const defs = d.blocking.filter(x => x.severity === sev);
      if (defs.length) parts.push(`open ${sev} defect${defs.length === 1 ? "" : "s"}: ${list(defs, "defects")}`);
    }
  } else if (d.status === "Passing") {
    parts.push(`${d.cases === 1 ? "its only case is" : `all ${d.cases} cases are`} settled (latest Pass, Waived or Review for Removal)`);
  } else if (d.status === "In Test") {
    parts.push(`${d.settled} of ${d.cases} settled`);
    if (d.unrun.length) parts.push(`not run: ${list(d.unrun)}`);
    if (d.open.length) parts.push(`in progress or blocked: ${list(d.open)}`);
  } else {
    parts.push(d.cases ? `none of ${d.cases} case${d.cases === 1 ? "" : "s"} run yet` : "no test cases");
  }
  const text = parts.join(" · ");
  return html ? `<div class="why st-${COMP_ST_SLUG[d.status]}" title="Why this component reads ${d.status}">${text}</div>` : `${d.status} — ${text}`;
}

function systemFields() {
  return [
    { key: "name", label: "Name", required: true },
    { key: "team", label: "Team / IPT", half: true },
    { key: "lead", label: "Lead", half: true },
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
/* A component's parent must live in the same system; otherwise it becomes top-level. */
function placeComponent(v) {
  const parent = v.parentComponentId ? Store.get("components", v.parentComponentId) : null;
  if (!parent || parent.systemId !== v.systemId) v.parentComponentId = "";
  return v;
}

Object.assign(Actions, {
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

});
