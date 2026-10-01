/* ============================================================
   Procedures, steps and entry/exit criteria.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
Views.procedures = function () {
  const rows = Scope.list("procedures").map(p => {
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

function procedureFields() {
  return [
    { key: "title", label: "Title", required: true },
    ownerField(),
    { key: "description", label: "Description", type: "textarea" },
    { key: "stepsText", label: "Steps (one per line)", type: "textarea" }
  ];
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

Object.assign(Actions, {
  /* ---- procedures ---- */
  "add-procedure": () => Modal.open("New Procedure", procedureFields(), ownerDefault(), v => {
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

});
