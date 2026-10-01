/* ============================================================
   Risks and mitigations.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
Views.risks = function (params) {
  const selL = params.get("l"), selI = params.get("i");
  const showClosed = params.get("closed") === "1";
  let risks = Scope.list("risks");
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
        ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Risk</th><th class="col-lo">Cat</th><th class="col-mid">L×I</th><th>Score</th><th class="col-lo">Trend</th><th>Status</th><th class="col-lo">Mits</th></tr></thead><tbody>${rows}</tbody></table></div>`
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

function riskFields() {
  return [
    { key: "title", label: "Title", required: true },
    ownerField(),
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

Object.assign(Actions, {
  /* ---- risks ---- */
  "add-risk": () => Modal.open("New Risk", riskFields(), ownerDefault({ likelihood: 3, impact: 3, status: "Open" }), v => {
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

});
