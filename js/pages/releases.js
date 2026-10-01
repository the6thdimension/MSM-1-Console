/* ============================================================
   Releases and builds. Each system has its own build stream and
   its own releases. A run records the build it was measured on
   (runs.buildId); an older pass still counts and is labeled with
   how many builds old it is.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */

const RELEASE_STATUSES = ["Planning", "In Test", "Release Candidate", "Released", "Cancelled"];
const BUILD_STATUSES = ["Received", "Smoke Passed", "Under Test", "Accepted", "Rejected", "Shipped"];

/* "⎇ 0.9.1 · 2 builds old" for a run. Empty when the run's system has no builds yet, so
   programs that do not track builds see nothing new. */
function buildTag(run) {
  if (!run) return "";
  const b = run.buildId ? Store.get("builds", run.buildId) : null;
  if (!b) {
    const sys = Store.ownerOf("runs", run);
    return sys && Store.buildsOf(sys).length ? `<span class="build-tag none" title="This result was recorded without a build">build not recorded</span>` : "";
  }
  const behind = Store.buildsBehind(run);
  const age = behind
    ? `<span class="build-age${behind >= 2 ? " stale" : ""}" title="${behind} newer build${behind === 1 ? "" : "s"} of this system received since">${behind} build${behind === 1 ? "" : "s"} old</span>`
    : `<span class="build-age current" title="No newer build of this system has been received">latest build</span>`;
  return `<a class="build-tag" href="#/builds/${b.id}" title="${esc(b.code)} · ${esc(b.status)} · received ${esc(b.received || "—")}">⎇ ${esc(b.label)}</a> ${age}`;
}

/* The "Build" field for run and test-run forms: builds of the given systems, newest first.
   null when there is nothing to choose, so the field (and buildId) only appear once builds exist. */
function buildField(sysIds, value) {
  const builds = Store.all("builds").filter(b => sysIds.includes(b.systemId)).sort((a, b) => Store.buildOrder(b, a));
  const cur = value ? Store.get("builds", value) : null;
  if (cur && !builds.includes(cur)) builds.unshift(cur);
  if (!builds.length) return null;
  const multi = new Set(builds.map(b => b.systemId)).size > 1;
  return { key: "buildId", label: "Build tested (software version)", type: "select", half: true, allowEmpty: true,
    options: builds.map(b => {
      const s = multi ? Store.get("systems", b.systemId) : null;
      return { value: b.id, label: `${s ? s.code + " · " : ""}${b.label} (${b.code})${b.status === "Rejected" ? " — rejected" : ""}` };
    }) };
}
const currentBuildId = sysId => (sysId && Store.currentBuild(sysId) || {}).id || "";

function releaseFields() {
  return [
    { key: "name", label: "Release name (e.g. Sim Core R1.0)", required: true },
    { key: "systemId", label: "System", type: "select", required: true, half: true, options: Store.all("systems").map(s => ({ value: s.id, label: `${s.code} ${s.name}` })) },
    { key: "status", label: "Status", type: "select", half: true, options: RELEASE_STATUSES },
    { key: "targetDate", label: "Target date", type: "date", half: true },
    { key: "releasedDate", label: "Released on", type: "date", half: true },
    { key: "decisionId", label: "Supports decision (IDSK)", type: "select", half: true, allowEmpty: true, options: Store.all("decisions").map(d => ({ value: d.id, label: `${d.code} ${d.title}` })) },
    { key: "fixVersion", label: "Jira Fix Version (optional)", half: true },
    { key: "description", label: "Scope / description", type: "textarea" }
  ];
}
function buildFields(sysId) {
  const rels = Store.all("releases").filter(r => !sysId || r.systemId === sysId);
  return [
    { key: "label", label: "Version label (e.g. 0.9.2 or 0.9.2+a1b2c3)", required: true, half: true },
    { key: "systemId", label: "System", type: "select", required: true, half: true, options: Store.all("systems").map(s => ({ value: s.id, label: `${s.code} ${s.name}` })) },
    { key: "releaseId", label: "Release (blank = not part of a release)", type: "select", half: true, allowEmpty: true,
      options: rels.map(r => ({ value: r.id, label: `${r.code} ${r.name}` })) },
    { key: "status", label: "Status", type: "select", half: true, options: BUILD_STATUSES },
    { key: "received", label: "Received", type: "date", half: true, default: todayISO() },
    { key: "cycle", label: "Zephyr test cycle (optional)", half: true },
    { key: "url", label: "Artifact / CI link (optional, https://…)" },
    { key: "description", label: "Change notes", type: "textarea" }
  ];
}
function checkBuild(v) {
  if (v.url && !safeHttp(v.url)) throw new Error("Enter a full HTTP(S) link for the artifact, or leave it blank.");
  const rel = v.releaseId ? Store.get("releases", v.releaseId) : null;
  if (rel && rel.systemId && rel.systemId !== v.systemId) throw new Error(`${rel.code} belongs to another system; pick one of this system's releases.`);
  return v;
}

/* Results recorded on one build: counts across the system's active cases. */
function buildCoverage(b) {
  const scope = b.systemId ? Store.regressionScope(b.systemId) : [];
  const results = Store.buildResults(b.id);
  return { scope, results, counts: resultCounts(scope.map(tc => results.get(tc.id) || null)), run: scope.filter(tc => results.has(tc.id)).length };
}

function buildRows(list, showRelease) {
  return list.map(b => {
    const rel = b.releaseId ? Store.get("releases", b.releaseId) : null;
    const cov = buildCoverage(b);
    const cur = b.systemId && Store.currentBuild(b.systemId) === b;
    return `<tr>
      <td>${codeLink("builds", b)}</td>
      <td><a href="#/builds/${b.id}" class="mono">⎇ ${esc(b.label)}</a>${cur ? ` <span class="build-age current">current</span>` : ""}</td>
      ${showRelease ? `<td>${rel ? codeLink("releases", rel) : `<span class="faint small">—</span>`}</td>` : ""}
      <td class="num">${esc(b.received || "—")}</td>
      <td>${badge(b.status)}</td>
      <td class="num">${cov.run}/${cov.scope.length}</td>
      <td style="min-width:120px">${cov.run ? progressMeter(cov.counts) : `<span class="faint small">no results yet</span>`}</td>
    </tr>`;
  }).join("");
}
const buildHead = showRelease => `<thead><tr><th>Build</th><th>Version</th>${showRelease ? `<th class="col-lo">Release</th>` : ""}<th class="col-mid">Received</th><th>Status</th><th class="col-lo" title="Active cases of the system with a result on this build">Cases run</th><th>Results on this build</th></tr></thead>`;

function releaseRows(list) {
  return list.map(r => {
    const builds = Store.buildsOfRelease(r.id);
    const latest = builds.find(b => b.status !== "Rejected");
    const dec = r.decisionId ? Store.get("decisions", r.decisionId) : null;
    return `<tr>
      <td>${codeLink("releases", r)}</td>
      <td><a href="#/releases/${r.id}">${esc(r.name)}</a>${r.fixVersion ? `<div class="faint mono small">Fix Version ${esc(r.fixVersion)}</div>` : ""}</td>
      <td>${badge(r.status)}</td>
      <td class="num">${esc(r.targetDate || "—")}</td>
      <td>${latest ? `<a class="build-tag" href="#/builds/${latest.id}">⎇ ${esc(latest.label)}</a>` : `<span class="faint small">no builds</span>`} <span class="faint small">${builds.length} build${builds.length === 1 ? "" : "s"}</span></td>
      <td>${dec ? codeLink("decisions", dec) : `<span class="faint small">—</span>`}</td>
    </tr>`;
  }).join("");
}

Views.releases = function () {
  const rels = Scope.list("releases"), builds = Scope.list("builds");
  const owners = Scope.list("systems").slice().sort(Store.byCodeOrder).map(s => s.id).concat(Scope.system && !Scope.shared ? [] : [""]);
  const sections = owners.map(sysId => {
    const s = sysId ? Store.get("systems", sysId) : null;
    const myRels = rels.filter(r => (r.systemId || "") === sysId).sort((a, b) => (a.targetDate || "9999").localeCompare(b.targetDate || "9999"));
    const myBuilds = builds.filter(b => (b.systemId || "") === sysId).sort((a, b) => Store.buildOrder(b, a));
    if (!s && !myRels.length && !myBuilds.length) return "";
    const cur = s ? Store.currentBuild(s.id) : null;
    const shown = myBuilds.slice(0, 8);
    return `<div class="rel-sys">
      <div class="rel-sys-head">
        <div>${s ? `<a href="#/systems/${s.id}"><span class="code">${esc(s.code)}</span> ${esc(s.name)}</a>` : "Program-level / unassigned"}</div>
        <div class="rel-current">${s ? (cur ? `Current build ${buildChip(cur)}` : `<span class="faint">No builds yet</span>`) : ""}</div>
        <span class="inline-actions">${s ? actBtn("+ Build", "add-build", null, `data-sys="${s.id}"`) + actBtn("+ Release", "add-release", null, `data-sys="${s.id}"`) : ""}</span>
      </div>
      ${myRels.length ? `<div class="table-scroll"><table class="data"><thead><tr><th>Release</th><th>Name</th><th>Status</th><th class="col-mid">Target</th><th class="col-lo">Latest build</th><th class="col-lo">Decision</th></tr></thead><tbody>${releaseRows(myRels)}</tbody></table></div>` : `<div class="cc-empty">No releases defined for this system.</div>`}
      ${shown.length ? `<div class="table-scroll"><table class="data">${buildHead(true)}<tbody>${buildRows(shown, true)}</tbody></table></div>` : ""}
      ${myBuilds.length > shown.length ? `<div class="cc-empty">${myBuilds.length - shown.length} older build(s) — open a release to see all of its builds.</div>` : ""}
    </div>`;
  }).join("");
  return `
    ${pageHead([{ label: "Releases" }], "Releases & Builds",
      actBtn("+ Release", "add-release", null, "", false) + actBtn("+ Build", "add-build", null, "", false),
      "Each system tracks its own releases and the software builds delivered toward them. Results record the build they were measured on; an older pass still counts and is labeled with how many builds old it is.")}
    ${sections || emptyMsg("No systems yet — add a system, then its releases and builds.")}`;
};

/* System page panel: current build, open releases and the latest builds of this system's stream. */
function systemReleasePanel(s) {
  const cur = Store.currentBuild(s.id);
  const rels = Store.releasesOf(s.id).filter(r => !["Released", "Cancelled"].includes(r.status));
  const builds = Store.buildsOf(s.id).slice(0, 4);
  const head = actBtn("+ Build", "add-build", null, `data-sys="${s.id}"`) + actBtn("+ Release", "add-release", null, `data-sys="${s.id}"`) + `<a class="btn btn-ghost btn-sm" href="#/releases">All releases</a>`;
  if (!cur && !rels.length) return panel("Releases & Builds", `<span class="faint small">No builds recorded for this system yet. Add a build to record which software version each result was measured on.</span>`, head);
  return panel("Releases & Builds", `
    <div class="rel-current" style="margin-bottom:10px">${cur ? `Current build ${buildChip(cur)}` : `<span class="faint">No build under test</span>`}
      ${rels.length ? ` &nbsp; ${rels.map(r => `${chip("releases", r)} ${badge(r.status)}`).join(" ")}` : ""}</div>
    ${builds.length ? `<div class="table-scroll"><table class="data">${buildHead(true)}<tbody>${buildRows(builds, true)}</tbody></table></div>` : ""}`, head, true);
}

function buildChip(b) {
  return `<a class="build-tag" href="#/builds/${b.id}">⎇ ${esc(b.label)}</a> ${badge(b.status)}`;
}

/* Release readiness: how the system's active cases stand against the release candidate
   (the release's newest build that was not rejected), plus requirements, exit criteria and
   open defects. Results from older builds still count; they are shown as carried forward. */
Views.releaseDetail = function (id) {
  const R = Store.releaseReadiness(id);
  if (!R) return notFound("Release");
  const { rel: r, cand, rows, reqs, olderOnly, defects, exit, decision: dec } = R;
  const sys = r.systemId ? Store.get("systems", r.systemId) : null;
  const builds = Store.buildsOfRelease(id);
  const counts = resultCounts(rows.map(x => x.here));
  const onCand = rows.filter(x => x.here).length;
  const carried = rows.filter(x => !x.here && x.latest).length, never = rows.filter(x => !x.latest).length;
  const exitMet = exit.filter(c => c.status !== "open").length;
  const blocking = defects.filter(d => d.severity === "Critical" || d.severity === "Major").length;
  const margin = dec && dec.date && r.targetDate ? Math.round((Date.parse(dec.date) - Date.parse(r.targetDate)) / 86400000) : null;
  const marginTxt = margin == null ? "" : margin >= 0
    ? ` · ${margin} day${margin === 1 ? "" : "s"} before ${esc(dec.code)} (${esc(dec.date)})`
    : ` · <span class="bad">target is ${-margin} day${margin === -1 ? "" : "s"} after ${esc(dec.code)} (${esc(dec.date)})</span>`;

  // Failing on the candidate first, then carried forward, never run, other, passing.
  const rank = x => !x.here ? (x.latest ? 1 : 2) : x.here.result === "Fail" ? 0 : ["Pass", "Waived"].includes(x.here.result) ? 4 : 3;
  const caseRows = rows.slice().sort((a, b) => rank(a) - rank(b) || Store.byCodeOrder(a.tc, b.tc)).map(x => `<tr>
      <td>${codeLink("cases", x.tc)}</td>
      <td><a href="#/cases/${x.tc.id}">${esc(x.tc.title)}</a></td>
      <td>${x.here ? badge(x.here.result) : `<span class="faint small">${cand ? `not run on ${esc(cand.label)}` : "—"}</span>`}</td>
      <td>${x.latest ? `${runBadge(x.latest)} <span class="small">${buildTag(x.latest)}</span>` : `<span class="faint small">never run</span>`}</td>
    </tr>`).join("");
  const defRows = defects.map(d => `<tr>
      <td>${codeLink("defects", d)}</td>
      <td><a href="#/defects/${d.id}">${esc(d.title)}</a></td>
      <td>${badge(d.severity)}</td><td>${badge(d.status)}</td>
      <td class="small">${defectBuildsCell(d)}</td>
    </tr>`).join("");

  return `
    ${pageHead([{ label: "Releases", href: "#/releases" }, { label: r.code }],
      `<span class="code-inline">${esc(r.code)}</span>${esc(r.name)}`,
      actBtn("Edit", "edit-release", r.id) + actBtn("Delete", "del-release", r.id) + actBtn("+ Build", "add-build", null, `data-sys="${r.systemId || ""}" data-rel="${r.id}"`, false),
      `${badge(r.status)} ${sys ? chip("systems", sys) : ""} ${dec ? chip("decisions", dec) : ""}
       <span class="faint mono small">target ${esc(r.targetDate || "—")}${marginTxt}${r.releasedDate ? ` · released ${esc(r.releasedDate)}` : ""}${r.fixVersion ? ` · Jira Fix Version ${esc(r.fixVersion)}` : ""}</span>`)}
    <div class="kpi-row">
      <div class="kpi" style="--kpi-accent:var(--purple)"><div class="kpi-label">Release Candidate</div><div class="kpi-value" style="font-size:22px">${cand ? `<a class="build-tag" style="font-size:20px" href="#/builds/${cand.id}">⎇ ${esc(cand.label)}</a>` : "—"}</div><div class="kpi-foot">${cand ? `${badge(cand.status)} newest non-rejected build in ${esc(r.code)}` : "add a build to this release"}</div></div>
      <div class="kpi" style="--kpi-accent:var(--amber)"><div class="kpi-label">Run On Candidate</div><div class="kpi-value">${onCand}<small>/${rows.length}</small></div><div class="kpi-foot">${counts.pass} pass · ${counts.fail} fail · ${counts.waived} waived</div></div>
      <div class="kpi" style="--kpi-accent:var(--blue)"><div class="kpi-label">Carried Forward</div><div class="kpi-value">${carried}</div><div class="kpi-foot">latest result from an older build · ${never} never run</div></div>
      <div class="kpi" style="--kpi-accent:var(--green)"><div class="kpi-label">Exit Criteria</div><div class="kpi-value">${exitMet}<small>/${exit.length}</small></div><div class="kpi-foot">${blocking} open Critical/Major defect${blocking === 1 ? "" : "s"}</div></div>
    </div>
    ${cand ? `<div style="margin-bottom:14px" title="Results measured on ${esc(cand.label)}; grey = not yet run on it">${progressMeter(counts)}</div>` : ""}
    ${panel(`Cases Against ${cand ? `⎇ ${esc(cand.label)}` : "the Release Candidate"}`, caseRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Case</th><th>Title</th><th>On the candidate</th><th>Latest result (any build)</th></tr></thead><tbody>${caseRows}</tbody></table></div>`
      : emptyMsg(sys ? "This system has no active test cases." : "Assign this release to a system to see its scope."), `<span class="faint small">scope: active cases of ${sys ? esc(sys.code) : "the system"}</span>`, true)}
    <div class="grid-2">
      <div>
        ${panel("Requirements", reqs.length ? `${reqStatusBar(reqs)}${olderOnly.length
          ? `<div class="small" style="margin-top:10px">Verified, but by results not measured on ${cand ? esc(cand.label) : "the candidate"} — re-run to confirm on the candidate:</div><div style="margin-top:6px">${chips("requirements", olderOnly)}</div>` : ""}`
          : `<span class="faint small">No requirements traced to this system.</span>`)}
        ${panel("Exit Criteria", renderCritList(exit), actBtn("+ Add", "add-crit-exit", r.id, `data-parent="release"`), true)}
      </div>
      <div>
        ${panel(`Open Defects — ${sys ? esc(sys.code) : "system"}`, defRows
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Defect</th><th>Title</th><th>Severity</th><th>Status</th><th>Builds</th></tr></thead><tbody>${defRows}</tbody></table></div>`
          : emptyMsg("No open defects against this system."), "", true)}
        ${r.description ? panel("Scope", `<p style="margin:0;white-space:pre-wrap">${esc(r.description)}</p>`) : ""}
      </div>
    </div>
    ${panel(`Builds in ${r.code}`, builds.length
      ? `<div class="table-scroll"><table class="data">${buildHead(false)}<tbody>${buildRows(builds, false)}</tbody></table></div>`
      : emptyMsg("No builds in this release yet — add the first one."), "", true)}
    ${auditPanel(r.id)}`;
};

/* Per-case comparison of one build against another build of the same system. */
function buildComparePanel(b, params) {
  const stream = Store.buildsOf(b.systemId).filter(x => x.id !== b.id && x.status !== "Rejected");
  if (!stream.length) return "";
  const vsId = params && params.get("vs");
  const other = (vsId && stream.find(x => x.id === vsId)) || Store.previousBuild(b) || stream[0];
  const c = Store.compareBuilds(b.id, other.id);
  const item = x => `<span class="cmp-item">${codeLink("cases", x.tc)} <span class="faint">${x.a ? esc(x.a.result) : "—"} → ${x.b ? esc(x.b.result) : "not run"}</span></span>`;
  const group = (title, cls, list, note) => list.length ? `<div class="cmp-group ${cls}"><div class="cmp-title">${title} <span class="mono">${list.length}</span>${note ? ` <span class="faint small">${note}</span>` : ""}</div>${list.map(item).join("")}</div>` : "";
  const picks = stream.map(x => `<a class="${x.id === other.id ? "active" : ""}" href="#/builds/${b.id}?vs=${x.id}">${esc(x.label)}</a>`).join("");
  const body = group("Regressed", "bad", c.regressed, "passed before, fails here") + group("Fixed", "ok", c.fixed, "failed before, passes here") +
    group("Still failing", "bad", c.stillFailing) + group("Not re-run on this build", "", c.notRerun, `had a result on ${esc(other.label)}`) +
    group("New on this build", "", c.newOnB, `no result on ${esc(other.label)}`) + group("Other changes", "", c.other);
  return panel(`Compared With ⎇ ${esc(other.label)}`,
    `${body || `<span class="faint small">No differences in results between these builds.</span>`}
     <div class="faint small" style="margin-top:8px">${c.stillPassing.length} case${c.stillPassing.length === 1 ? "" : "s"} passing on both. Latest result per case on each build.</div>`,
    `<span class="gantt-zoom cmp-picks">${picks}</span>`);
}

Views.buildDetail = function (id, params) {
  const b = Store.get("builds", id);
  if (!b) return notFound("Build");
  const sys = b.systemId ? Store.get("systems", b.systemId) : null;
  const rel = b.releaseId ? Store.get("releases", b.releaseId) : null;
  const stream = b.systemId ? Store.buildsOf(b.systemId) : [b];
  const i = stream.indexOf(b), newer = i > 0 ? stream[i - 1] : null, older = i >= 0 && i < stream.length - 1 ? stream[i + 1] : null;
  const { scope, results, counts, run } = buildCoverage(b);
  const order = new Map(Store.componentTree(b.systemId).map(({ comp }, k) => [comp.id, k]));
  const ran = scope.filter(tc => results.has(tc.id)).sort((x, y) => (order.get(x.componentId) ?? 1e9) - (order.get(y.componentId) ?? 1e9) || Store.byCodeOrder(x, y));
  const notRun = scope.filter(tc => !results.has(tc.id));
  const rows = ran.map(tc => {
    const r = results.get(tc.id), comp = Store.get("components", tc.componentId);
    return `<tr>
      <td>${codeLink("cases", tc)}</td>
      <td><a href="#/cases/${tc.id}">${esc(tc.title)}</a></td>
      <td>${comp ? codeLink("components", comp) : `<span class="faint small">system level</span>`}</td>
      <td>${badge(r.result)}</td>
      <td class="num">${esc(r.date || "")}</td>
      <td>${esc(r.operator || "")}</td>
      <td class="small">${r.measured ? `<span class="mono">${esc(r.measured)}</span>` : `<span class="faint">—</span>`}</td>
    </tr>`;
  }).join("");
  const sessions = Store.all("testRuns").filter(t => t.buildId === id);
  const fixedHere = Store.all("defects").filter(d => d.fixedInBuildId === id);
  return `
    ${pageHead([{ label: "Releases", href: "#/releases" }, ...(rel ? [{ label: rel.code, href: `#/releases/${rel.id}` }] : []), { label: b.code }],
      `<span class="code-inline">${esc(b.code)}</span>⎇ ${esc(b.label)}`,
      actBtn("Edit", "edit-build", b.id) + actBtn("Delete", "del-build", b.id),
      `${badge(b.status)} ${sys ? chip("systems", sys) : ""} ${rel ? chip("releases", rel) : `<span class="faint small">not part of a release</span>`}
       <span class="faint mono small">received ${esc(b.received || "—")}${b.cycle ? ` · Zephyr cycle ${esc(b.cycle)}` : ""}</span>
       ${b.url ? externalLink(b.url, "↗ artifact") : ""}`)}
    <div class="kpi-row">
      <div class="kpi" style="--kpi-accent:var(--amber)"><div class="kpi-label">Cases Run On This Build</div><div class="kpi-value">${run}<small>/${scope.length}</small></div><div class="kpi-foot">active cases of ${sys ? esc(sys.code) : "the system"}</div></div>
      <div class="kpi" style="--kpi-accent:var(--green)"><div class="kpi-label">Passed</div><div class="kpi-value">${counts.pass}</div><div class="kpi-foot">${counts.waived} waived · ${counts.removal} for review</div></div>
      <div class="kpi" style="--kpi-accent:var(--red)"><div class="kpi-label">Failed</div><div class="kpi-value">${counts.fail}</div><div class="kpi-foot">${counts.blocked} blocked / in progress</div></div>
      <div class="kpi" style="--kpi-accent:var(--purple)"><div class="kpi-label">Not Yet Run</div><div class="kpi-value">${notRun.length}</div><div class="kpi-foot">${newer ? `newer: <a href="#/builds/${newer.id}">${esc(newer.label)}</a>` : "no newer build"}${older ? ` · older: <a href="#/builds/${older.id}">${esc(older.label)}</a>` : ""}</div></div>
    </div>
    ${run ? `<div style="margin-bottom:14px">${progressMeter(counts)}</div>` : ""}
    ${b.description ? panel("Change Notes", `<p style="margin:0;white-space:pre-wrap">${esc(b.description)}</p>`) : ""}
    ${buildComparePanel(b, params)}
    ${fixedHere.length ? panel("Defects Fixed In This Build", fixedHere.map(d => `<div style="margin-bottom:5px">${chip("defects", d)} ${badge(d.severity)} ${badge(d.status)}</div>`).join("")) : ""}
    ${panel("Results On This Build", rows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Case</th><th>Title</th><th class="col-mid">Component</th><th>Latest result here</th><th class="col-lo">Date</th><th class="col-lo">Operator</th><th class="col-lo">Measured</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No results recorded on this build yet."), "", true)}
    ${notRun.length ? panel(`Not Yet Run On ${b.label}`, chips("cases", notRun)) : ""}
    ${sessions.length ? testRunsPanel("Test Run Sessions On This Build", sessions, "") : ""}
    ${auditPanel(b.id)}`;
};

Object.assign(Actions, {
  /* ---- releases ---- */
  "add-release": (id, el) => {
    const sysId = (el && el.dataset && el.dataset.sys) || Scope.system || "";
    Modal.open("New Release", releaseFields(), { systemId: sysId, status: "Planning" }, v => {
      const r = Store.add("releases", v);
      Toast.show(`${r.code} created`); App.go(`#/releases/${r.id}`);
    });
  },
  "edit-release": id => Modal.open("Edit Release", releaseFields(), Store.get("releases", id), v => {
    Store.update("releases", id, v); Toast.show("Saved"); App.render();
  }),
  "del-release": id => {
    const r = Store.get("releases", id);
    Modal.confirm(`Delete ${r.code} “${r.name}”? Its builds are kept and become not part of a release.`, () => {
      Store.remove("releases", id); toastUndo("Release deleted"); App.go("#/releases");
    });
  },

  /* ---- builds ---- */
  "add-build": (id, el) => {
    const d = (el && el.dataset) || {};
    const sysId = d.sys || Scope.system || "";
    Modal.open("New Build", buildFields(sysId), { systemId: sysId, releaseId: d.rel || "", status: "Received", received: todayISO() }, v => {
      const b = Store.add("builds", checkBuild(v));
      Toast.show(`${b.code} ⎇ ${b.label} added`); App.go(`#/builds/${b.id}`);
    });
  },
  "edit-build": id => {
    const b = Store.get("builds", id);
    Modal.open(`Edit ${b.code}`, buildFields(b.systemId), b, v => {
      Store.update("builds", id, checkBuild(v)); Toast.show("Saved"); App.render();
    });
  },
  "del-build": id => {
    const b = Store.get("builds", id);
    const n = Store.runsOfBuild(id).length;
    Modal.confirm(`Delete ${b.code} ⎇ ${b.label}?${n ? ` ${n} result(s) recorded on it are kept but will no longer say which build they were measured on.` : ""}`, () => {
      Store.remove("builds", id); toastUndo("Build deleted"); App.go("#/releases");
    });
  }
});
