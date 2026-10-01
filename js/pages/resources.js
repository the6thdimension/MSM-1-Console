/* ============================================================
   M&S / VV&A resources.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
Views.resources = function () {
  const rows = Scope.list("resources").map(r => {
    const cases = Store.casesOfResource(r.id);
    return `<tr>
      <td>${codeLink("resources", r)}</td>
      <td><a href="#/resources/${r.id}">${esc(r.name)}</a><div class="faint small">${esc(r.description)}</div></td>
      <td>${badge(r.type, "b-purple")}</td>
      <td>${r.vvaRequired ? badge(r.verification) : `<span class="faint small">n/a</span>`}</td>
      <td>${r.vvaRequired ? badge(r.validation) : `<span class="faint small">n/a</span>`}</td>
      <td>${r.vvaRequired ? badge(r.accreditation) : `<span class="faint small">n/a</span>`}</td>
      <td class="num">${cases.length}</td>
    </tr>`;
  }).join("");
  return `
    ${pageHead([{ label: "M&S / VV&A" }], "Resources & M&S Assets",
      actBtn("+ New Resource", "add-resource", null, "", false),
      "Models, simulations, HWIL rigs, referent datasets, and instrumentation. M&S assets carry Verification, Validation, and Accreditation state (DoDI 5000.61 / MIL-STD-3022); test cases that use unaccredited assets are flagged with a data-credibility caveat.")}
    ${panel("Register", rows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Asset / Resource</th><th>Type</th><th>Verification</th><th>Validation</th><th>Accreditation</th><th>Cases</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No resources registered."), "", true)}`;
};

Views.resourceDetail = function (id) {
  const r = Store.get("resources", id);
  if (!r) return notFound("Resource");
  const cases = Store.casesOfResource(id);
  const art = r.artifacts || {};

  const track = (label, key, statuses) => {
    const cur = r[key] || statuses[0];
    const idx = statuses.indexOf(cur);
    const next = idx >= 0 && idx < statuses.length - 1 ? statuses[idx + 1] : null;
    // "Not Accredited" is an off-ramp, never the auto-advance target
    const nextOk = next && next !== "Not Accredited" ? next : null;
    return `<div class="mit-item s-${cur === "Complete" || cur === "Accredited" ? "complete" : cur === "Not Started" ? "" : "inprogress"}">
      <div class="mit-flow"><div class="mit-dot"></div></div>
      <div class="mit-body">
        <div class="mit-text"><b>${esc(label)}</b></div>
        <div class="mit-meta">${badge(cur)}</div>
      </div>
      <div class="mit-actions">
        ${nextOk ? actBtn(`→ ${nextOk}`, "advance-vva", r.id, `data-track="${key}"`, false, "btn-xs") : ""}
      </div>
    </div>`;
  };

  const artHtml = Object.keys(ARTIFACT_LABELS).map(k => `
    <div class="crit ${art[k] ? "met" : ""}">
      <button class="crit-toggle ${art[k] ? "met" : "open"}" data-act="toggle-artifact" data-id="${r.id}" data-key="${k}">${art[k] ? "✓ Done" : "○ Open"}</button>
      <span class="crit-text">${esc(ARTIFACT_LABELS[k])}</span>
    </div>`).join("");

  return `
    ${pageHead(
      [{ label: "M&S / VV&A", href: "#/resources" }, { label: r.code }],
      `<span class="code-inline">${esc(r.code)}</span>${esc(r.name)}`,
      actBtn("Edit", "edit-resource", r.id) + actBtn("Delete", "del-resource", r.id),
      esc(r.description))}
    <div class="grid-2">
      <div>
        ${panel("Profile", `
          <dl class="def-grid">
            <dt>Type</dt><dd>${badge(r.type, "b-purple")}</dd>
            <dt>VV&A Required</dt><dd>${r.vvaRequired ? badge("Yes", "b-amber") : badge("No", "b-grey")}</dd>
            <dt>Owner</dt><dd>${esc(r.owner || "—")}</dd>
            <dt>Accred. Authority</dt><dd>${esc(r.authority || "—")}</dd>
            ${r.accDate ? `<dt>Accredited On</dt><dd class="mono">${esc(r.accDate)}</dd>` : ""}
          </dl>`)}
        ${panel("Intended Use", `<p style="margin:0">${esc(r.intendedUse || "Not stated — accreditation is always for a specific intended use.")}</p>
          ${r.accScope ? `<div class="section-gap"></div><dl class="def-grid"><dt>Accred. Scope</dt><dd>${esc(r.accScope)}</dd></dl>` : ""}`)}
        ${panel("Used By Test Cases", chips("cases", cases, "No test cases reference this resource"))}
      </div>
      <div>
        ${r.vvaRequired ? `
        <div class="panel">
          <div class="panel-head"><h2>VV&A Progress</h2></div>
          <div class="flow-strip"><span class="fstep">Verify</span><span class="farrow">→</span><span class="fstep">Validate</span><span class="farrow">→</span><span class="fstep">Accredit for intended use</span></div>
          <div class="panel-body tight">
            ${track("Verification — model built right (vs conceptual model / spec)", "verification", VV_STATUSES)}
            ${track("Validation — model is right (vs referent / real-world data)", "validation", VV_STATUSES)}
            ${track("Accreditation — official determination for intended use", "accreditation", ACC_STATUSES)}
          </div>
        </div>
        ${panel("VV&A Artifacts (MIL-STD-3022)", `<div class="crit-list">${artHtml}</div>`, "", true)}`
        : panel("VV&A", `<span class="faint">Marked as a conventional test resource — no accreditation tracking. Edit the resource to enable VV&A.</span>`)}
      </div>
    </div>`;
};

function resourceFields() {
  return [
    { key: "name", label: "Name", required: true },
    ownerField(),
    { key: "type", label: "Type", type: "select", half: true, options: RES_TYPES },
    { key: "vvaRequired", label: "VV&A Required", type: "select", half: true, options: [{ value: "yes", label: "Yes — M&S asset needing accreditation" }, { value: "no", label: "No — conventional test resource" }] },
    { key: "description", label: "Description", type: "textarea" },
    { key: "intendedUse", label: "Intended Use Statement (drives accreditation scope)", type: "textarea" },
    { key: "owner", label: "Owner / Proponent", half: true },
    { key: "authority", label: "Accreditation Authority", half: true },
    { key: "verification", label: "Verification Status", type: "select", half: true, options: VV_STATUSES },
    { key: "validation", label: "Validation Status", type: "select", half: true, options: VV_STATUSES },
    { key: "accreditation", label: "Accreditation Status", type: "select", half: true, options: ACC_STATUSES },
    { key: "accDate", label: "Accreditation Date", type: "date", half: true },
    { key: "accScope", label: "Accreditation Scope / Caveats", type: "textarea" }
  ];
}

Object.assign(Actions, {
  /* ---- resources / VV&A ---- */
  "add-resource": () => Modal.open("New Resource / M&S Asset", resourceFields(),
    ownerDefault({ vvaRequired: "yes", verification: "Not Started", validation: "Not Started", accreditation: "Not Started" }), v => {
      v.vvaRequired = v.vvaRequired === "yes";
      v.artifacts = { accPlan: false, vvPlan: false, vvReport: false, accReport: false };
      const r = Store.add("resources", v);
      Toast.show(`${r.code} created`); App.go(`#/resources/${r.id}`);
    }),
  "edit-resource": id => {
    const r = Store.get("resources", id);
    Modal.open("Edit Resource", resourceFields(), Object.assign({}, r, { vvaRequired: r.vvaRequired ? "yes" : "no" }), v => {
      v.vvaRequired = v.vvaRequired === "yes";
      Store.update("resources", id, v); Toast.show("Saved"); App.render();
    });
  },
  "del-resource": id => {
    const r = Store.get("resources", id);
    Modal.confirm(`Delete ${r.code} “${r.name}”? Links from test cases will be removed.`, () => {
      Store.remove("resources", id); toastUndo("Resource deleted"); App.go("#/resources");
    });
  },
  "advance-vva": (id, el) => {
    const r = Store.get("resources", id);
    const track = el.dataset.track;
    const statuses = track === "accreditation" ? ACC_STATUSES : VV_STATUSES;
    const idx = statuses.indexOf(r[track] || statuses[0]);
    if (idx >= 0 && idx < statuses.length - 1 && statuses[idx + 1] !== "Not Accredited") {
      const patch = {}; patch[track] = statuses[idx + 1];
      if (track === "accreditation" && patch[track] === "Accredited" && !r.accDate) {
        patch.accDate = new Date().toISOString().slice(0, 10);
      }
      Store.update("resources", id, patch);
      Toast.show(`${track} → ${patch[track]}`); App.render();
    }
  },
  "toggle-artifact": (id, el) => {
    const r = Store.get("resources", id);
    r.artifacts = r.artifacts || {};
    r.artifacts[el.dataset.key] = !r.artifacts[el.dataset.key];
    Store.save(); App.render();
  },

});
