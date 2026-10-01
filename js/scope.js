/* ============================================================
   System scope — the banner shown while working in one system,
   and the ownership page that assigns program-level records to
   systems. Assignment is always explicit: suggestions are shown
   for review and applied only when the user confirms.
   ============================================================ */

const OWNED_LABELS = {
  requirements: "Requirements", procedures: "Procedures", plans: "Test Plans", testRuns: "Test Run Sessions",
  risks: "Risks", defects: "Defects", decisions: "Decisions (IDSK)", events: "Schedule Events",
  documents: "Documents", resources: "Resources / M&S Assets"
};

function recordLabel(r) { return r.title || r.name || r.code || r.id; }

/* Strip at the top of every page while a single system is in scope. */
function scopeBanner() {
  const s = Scope.current();
  if (!s) return "";
  const unowned = Store.OWNED.reduce((n, c) => n + Store.all(c).filter(r => !Store.ownerOf(c, r)).length, 0);
  return `<div class="scope-banner">
    <span class="scope-dot"></span>
    <span>Working in <a href="#/systems/${s.id}"><b>${esc(s.code)} ${esc(s.name)}</b></a>${s.team ? ` · ${esc(s.team)}` : ""}${s.lead ? ` · lead ${esc(s.lead)}` : ""}</span>
    <span class="faint">${Scope.shared ? `program-level items shown${unowned ? ` (${unowned} unassigned — <a href="#/ownership">assign</a>)` : ""}` : "program-level items hidden"}</span>
    <span class="spacer"></span>
    <button class="btn btn-ghost btn-xs" data-act="scope-shared-toggle">${Scope.shared ? "Hide" : "Show"} program-level</button>
    <button class="btn btn-ghost btn-xs" data-act="scope-to" data-id="">◈ Program view</button>
  </div>`;
}

/* ================= OWNERSHIP PAGE ================= */
Views.ownership = function (params) {
  const systems = Store.all("systems").slice().sort(Store.byCodeOrder);
  const sysOpts = systems.map(s => `<option value="${s.id}" ${Scope.system === s.id ? "selected" : ""}>${esc(s.code)} ${esc(s.name)}</option>`).join("");
  let suggested = 0, unownedTotal = 0;

  const sections = Store.OWNED.map(coll => {
    const unowned = Store.all(coll).filter(r => !Store.ownerOf(coll, r));
    unownedTotal += unowned.length;
    if (!unowned.length) return "";
    const rows = unowned.map(r => {
      const sug = Store.suggestOwner(coll, r);
      if (sug) suggested++;
      const sys = sug ? Store.get("systems", sug.systemId) : null;
      return `<tr>
        <td class="bulk-cell"><input type="checkbox" data-own="${coll}|${r.id}"></td>
        <td class="mono small">${esc(r.code || r.id)}</td>
        <td>${esc(recordLabel(r))}</td>
        <td>${sys ? `${chip("systems", sys)} <span class="faint small">from ${esc(sug.why)}</span>` : `<span class="faint small">No single system — links span systems or none exist</span>`}</td>
      </tr>`;
    }).join("");
    return panel(`${OWNED_LABELS[coll]} — ${unowned.length} program-level`,
      `<div class="table-scroll"><table class="data"><thead><tr><th class="bulk-cell"></th><th>Code</th><th>Record</th><th>Suggested Owner</th></tr></thead><tbody>${rows}</tbody></table></div>`, "", true);
  }).join("");

  const overview = systems.map(s => `<tr><td>${chip("systems", s)}</td>${Store.OWNED.map(c => `<td class="num">${Store.all(c).filter(r => Store.ownerOf(c, r) === s.id).length || `<span class="faint">0</span>`}</td>`).join("")}</tr>`).join("")
    + `<tr><td><span class="faint">Program-level / shared</span></td>${Store.OWNED.map(c => `<td class="num">${Store.all(c).filter(r => !Store.ownerOf(c, r)).length || `<span class="faint">0</span>`}</td>`).join("")}</tr>`;

  return `
    ${pageHead([{ label: "Ownership" }], "Assign to Systems", "",
      "Every record belongs to a system or is program-level (shared). Structural records — components, cases, runs, criteria — follow their parents automatically. Here you assign the rest. Suggestions come from a record's links and are applied only when you confirm.")}
    ${panel("Ownership by System", `<div class="table-scroll"><table class="data"><thead><tr><th>System</th>${Store.OWNED.map(c => `<th>${esc(OWNED_LABELS[c].replace(/ \(.*\)| \/.*/, ""))}</th>`).join("")}</tr></thead><tbody>${overview}</tbody></table></div>`, "", true)}
    ${unownedTotal ? `
    <div class="filter-bar own-bar">
      <label class="small faint" style="display:flex;gap:5px;align-items:center;cursor:pointer"><input type="checkbox" data-own-all style="accent-color:var(--amber)"> select all</label>
      <select id="own-system"><option value="">Assign selected to…</option>${sysOpts}</select>
      ${actBtn("Assign Selected", "own-assign", null, "", false)}
      ${suggested ? actBtn(`Accept ${suggested} Suggestion${suggested === 1 ? "" : "s"}`, "own-accept", null) : ""}
      <span class="faint mono small">${unownedTotal} program-level record${unownedTotal === 1 ? "" : "s"}</span>
    </div>
    ${sections}` : emptyMsg("Every record is assigned to a system. Records you create while working in a system are assigned to it automatically.")}`;
};

Object.assign(Actions, {
  "scope-to": id => { Scope.set(id || ""); App.render(); },
  "scope-shared-toggle": () => { Scope.set(Scope.system, !Scope.shared); App.render(); },

  "own-assign": () => {
    const sel = document.getElementById("own-system");
    const sysId = sel ? sel.value : "";
    const picked = [...document.querySelectorAll("[data-own]:checked")].map(cb => cb.dataset.own.split("|"));
    if (!sysId) { Toast.show("Choose a system to assign to.", true); return; }
    if (!picked.length) { Toast.show("Select at least one record.", true); return; }
    for (const [coll, id] of picked) Store.update(coll, id, { systemId: sysId });
    Toast.show(`${picked.length} record${picked.length === 1 ? "" : "s"} assigned to ${Store.get("systems", sysId).code}`);
    App.render();
  },

  "own-accept": () => {
    // Suggestions are recomputed when applied, so a stale preview can never assign stale data.
    const suggestions = () => {
      const out = [];
      for (const coll of Store.OWNED) for (const r of Store.all(coll)) {
        if (Store.ownerOf(coll, r)) continue;
        const sug = Store.suggestOwner(coll, r);
        if (sug) out.push([coll, r.id, sug.systemId]);
      }
      return out;
    };
    const count = suggestions().length;
    if (!count) { Toast.show("No suggestions to apply."); return; }
    Modal.confirm(`Assign ${count} program-level record(s) to their suggested systems? Each suggestion comes from the record's links pointing to exactly one system. Records without a clear owner stay program-level.`, () => {
      const plan = suggestions();
      for (const [coll, id, sysId] of plan) Store.update(coll, id, { systemId: sysId });
      Toast.show(`${plan.length} record(s) assigned`); App.render();
    }, "Accept Suggestions", true);
  }
});
