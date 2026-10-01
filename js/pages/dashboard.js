/* ============================================================
   Dashboard and weekly SITREP.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
Views.dashboard = function () {
  const reqs = Scope.list("requirements");
  const cases = Scope.list("cases");
  const runs = Scope.list("runs");
  const risks = Scope.list("risks").filter(r => r.status !== "Closed");

  const reqRoll = { verified: 0, failing: 0, covered: 0, uncovered: 0 };
  reqs.forEach(r => reqRoll[Store.reqStatus(r.id)]++);

  const runCounts = { pass: 0, fail: 0, blocked: 0, open: 0 };
  cases.forEach(tc => {
    const run = Store.latestRun(tc.id);
    if (!run) runCounts.open++;
    else if (run.result === "Pass") runCounts.pass++;
    else if (run.result === "Fail") runCounts.fail++;
    else runCounts.blocked++;
  });

  const highRisks = risks.filter(r => Store.riskScore(r) >= 10);
  const coveragePct = reqs.length ? Math.round(((reqRoll.verified + reqRoll.covered + reqRoll.failing) / reqs.length) * 100) : 0;
  const verifiedPct = reqs.length ? Math.round((reqRoll.verified / reqs.length) * 100) : 0;

  const recentRuns = runs.slice().sort((a, b) => Store.compareRuns(a, b)).slice(0, 6);

  const planRows = Scope.list("plans").map(p => {
    const c = planCounts(p);
    const total = p.caseIds.length;
    return `<tr>
      <td>${codeLink("plans", p)}</td>
      <td><a href="#/plans/${p.id}">${esc(p.name)}</a></td>
      <td>${badge(p.status)}</td>
      <td style="min-width:160px">${progressMeter(c)}</td>
      <td class="num">${c.pass}/${total} pass</td>
    </tr>`;
  }).join("");

  const riskRows = risks
    .slice().sort((a, b) => Store.riskScore(b) - Store.riskScore(a)).slice(0, 5)
    .map(r => {
      const s = Store.riskScore(r), band = Store.riskBand(s);
      return `<tr>
        <td>${codeLink("risks", r)}</td>
        <td><a href="#/risks/${r.id}">${esc(r.title)}</a></td>
        <td><span class="score-pill band-${band}" style="font-size:13px;padding:2px 9px">${s}</span></td>
        <td>${badge(r.status)}</td>
      </tr>`;
    }).join("");

  return `
    ${pageHead([{ label: "Dashboard" }], esc(Store.db.meta.program || "T&E Program"),
      `<a class="btn btn-ghost btn-sm" href="#/sitrep">⎙ Weekly SITREP</a>`,
      "Program-level status: requirement verification, execution progress, and top risks.")}
    <div class="kpi-row">
      <div class="kpi" style="--kpi-accent:var(--blue)">
        <div class="kpi-label">Requirements Verified</div>
        <div class="kpi-value">${verifiedPct}<small>%</small></div>
        <div class="kpi-foot">${reqRoll.verified} of ${reqs.length} · ${coveragePct}% have coverage</div>
      </div>
      <div class="kpi" style="--kpi-accent:var(--green)">
        <div class="kpi-label">Test Case Pass</div>
        <div class="kpi-value">${runCounts.pass}<small>/${cases.length}</small></div>
        <div class="kpi-foot">${runCounts.fail} failing · ${runCounts.open} not yet run</div>
      </div>
      <div class="kpi" style="--kpi-accent:var(--amber)">
        <div class="kpi-label">Test Runs Logged</div>
        <div class="kpi-value">${runs.length}</div>
        <div class="kpi-foot">latest ${esc(recentRuns[0] ? recentRuns[0].date : "—")}</div>
      </div>
      <div class="kpi" style="--kpi-accent:var(--red)">
        <div class="kpi-label">High / Critical Risks</div>
        <div class="kpi-value">${highRisks.length}<small>/${risks.length} open</small></div>
        <div class="kpi-foot"><a href="#/risks">view risk matrix →</a></div>
      </div>
    </div>
    <div class="countdown-row">
      ${Scope.list("decisions").filter(d => d.status !== "Complete" && d.date)
        .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3).map(d => {
          const days = Math.ceil((new Date(d.date + "T12:00") - new Date(todayISO() + "T12:00")) / 86400000);
          const ready = Store.decisionReadiness(d);
          return `<a class="cd-tile" href="#/decisions/${d.id}">
            <div class="cd-days">${days >= 0 ? days : 0}<small> days</small></div>
            <div class="cd-title"><span class="code">${esc(d.code)}</span> ${esc(d.title)}</div>
            <div class="cd-meta">${esc(d.date)} ${badge(d.status)} ${ready ? `<span>${ready.verified}/${ready.total} measures verified</span>` : ""}</div>
          </a>`;
        }).join("")}
      ${(() => {
        const open = Scope.list("defects").filter(d => Store.defectIsOpen(d));
        const crit = open.filter(d => d.severity === "Critical" || d.severity === "Major").length;
        return `<a class="cd-tile" href="#/defects" style="border-left:3px solid ${crit ? "var(--red)" : "var(--line)"}">
          <div class="cd-days">${open.length}<small> open defects</small></div>
          <div class="cd-title">Defect backlog</div>
          <div class="cd-meta">${crit} critical/major · ${Scope.list("defects").length - open.length} closed</div>
        </a>`;
      })()}
    </div>
    <div class="grid-2">
      <div>
        ${panel("Test Plans", planRows
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Plan</th><th>Status</th><th>Progress</th><th></th></tr></thead><tbody>${planRows}</tbody></table></div>`
          : emptyMsg("No test plans yet"), "", true)}
        ${panel("Upcoming Events", (() => {
          const today = todayISO();
          const upcoming = Scope.list("events")
            .filter(ev => ev.status !== "Complete" && ev.status !== "Cancelled" && (ev.end || ev.start || "") >= today)
            .sort((a, b) => (a.start || "").localeCompare(b.start || "")).slice(0, 4);
          if (!upcoming.length) return `<span class="faint small">Nothing on the schedule — add events under Schedule.</span>`;
          return upcoming.map(ev => `<div style="margin-bottom:6px"><span class="mono faint">${esc(ev.start)}</span> ${chip("events", ev, ev.title)} ${badge(ev.type)}</div>`).join("");
        })(), `<a class="btn btn-ghost btn-sm" href="#/schedule">All</a>`)}
        ${panel("Recent Test Runs", recentRuns.length
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Run</th><th>Test Case</th><th>Result</th><th>Date</th></tr></thead><tbody>${
              recentRuns.map(r => {
                const tc = Store.get("cases", r.caseId);
                return `<tr><td><span class="code">${esc(r.code)}</span>${r.extKey ? `<div style="font-size:9.5px;margin-top:1px">${extKeyTag(r.extKey)}</div>` : ""}</td><td>${tc ? chip("cases", tc) : "—"}</td><td>${badge(r.result)}</td><td class="num">${esc(r.date || "")}</td></tr>`;
              }).join("")
            }</tbody></table></div>`
          : emptyMsg("No runs recorded"), "", true)}
      </div>
      <div>
        ${panel("Top Open Risks", riskRows
          ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Risk</th><th>Score</th><th>Status</th></tr></thead><tbody>${riskRows}</tbody></table></div>`
          : emptyMsg("No open risks"), `<a class="btn btn-ghost btn-sm" href="#/risks">Matrix</a>`, true)}
        ${panel(Scope.system ? "Progress Trend — Program-Wide" : "Progress Trend", (() => {
          const snaps = (Store.db.snapshots || []).slice(-30);
          if (snaps.length < 2) return `<span class="faint small">Trend appears after a couple of days of use — a snapshot of pass counts and verified requirements is taken once per day.</span>`;
          const last = snaps[snaps.length - 1];
          return `<div class="spark-wrap">
            <div>${sparkline(snaps.map(s => s.pass), "#4cc38a")}${sparkline(snaps.map(s => s.verified), "#52a9ff")}${sparkline(snaps.map(s => s.defOpen || 0), "#ff6369")}</div>
            <div class="spark-legend">
              <span><span class="sw" style="background:#4cc38a"></span>cases passing (now ${last.pass})</span>
              <span><span class="sw" style="background:#52a9ff"></span>reqs verified (now ${last.verified}/${last.reqTotal})</span>
              <span><span class="sw" style="background:#ff6369"></span>open defects (now ${last.defOpen != null ? last.defOpen : "—"})</span>
              <span class="faint">${snaps.length} daily snapshots</span>
            </div>
          </div>`;
        })())}
        ${panel("M&S VV&A Status", (() => {
          const assets = Scope.list("resources").filter(r => r.vvaRequired);
          if (!assets.length) return `<span class="faint small">No M&S assets registered — add them under M&S / VV&A.</span>`;
          return `<div class="table-scroll"><table class="data"><thead><tr><th>Asset</th><th>Ver</th><th>Val</th><th>Accreditation</th></tr></thead><tbody>${
            assets.map(r => `<tr><td>${chip("resources", r)}</td><td>${badge(r.verification)}</td><td>${badge(r.validation)}</td><td>${badge(r.accreditation)}</td></tr>`).join("")
          }</tbody></table></div>`;
        })(), `<a class="btn btn-ghost btn-sm" href="#/resources">All</a>`, true)}
        ${panel("Requirement Verification Rollup", `
          <div class="def-grid">
            <dt>Verified</dt><dd>${badge("verified")} <b class="mono">${reqRoll.verified}</b> — every linked test case's latest run passed</dd>
            <dt>Failing</dt><dd>${badge("failing")} <b class="mono">${reqRoll.failing}</b> — at least one linked case failing</dd>
            <dt>Covered</dt><dd>${badge("covered")} <b class="mono">${reqRoll.covered}</b> — cases linked, runs pending</dd>
            <dt>No coverage</dt><dd>${badge("uncovered")} <b class="mono">${reqRoll.uncovered}</b> — no test case traces to it</dd>
          </div>`)}
      </div>
    </div>`;
};

Views.sitrep = function () {
  const today = todayISO();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

  /* snapshot deltas vs ~a week ago */
  const snaps = Store.db.snapshots || [];
  const latest = snaps[snaps.length - 1];
  const baseline = snaps.slice().reverse().find(s => s.date <= weekAgo) || snaps[0];
  const delta = (a, b) => { const d = a - b; return d > 0 ? `+${d}` : String(d); };
  const deltaHtml = latest && baseline && latest.date !== baseline.date ? `
    <dl class="def-grid">
      <dt>Cases Passing</dt><dd><b class="mono">${latest.pass}</b> <span class="faint mono">(${delta(latest.pass, baseline.pass)} since ${esc(baseline.date)})</span></dd>
      <dt>Reqs Verified</dt><dd><b class="mono">${latest.verified}/${latest.reqTotal}</b> <span class="faint mono">(${delta(latest.verified, baseline.verified)})</span></dd>
      <dt>Open Defects</dt><dd><b class="mono">${latest.defOpen != null ? latest.defOpen : "—"}</b> <span class="faint mono">(${latest.defOpen != null && baseline.defOpen != null ? delta(latest.defOpen, baseline.defOpen) : "n/a"})</span></dd>
    </dl>` : `<span class="faint small">Deltas appear once snapshots span more than one day.</span>`;

  const weekRuns = Scope.list("runs").filter(r => (r.date || "") >= weekAgo)
    .sort((a, b) => Store.compareRuns(a, b));
  const runRows = weekRuns.map(r => {
    const tc = Store.get("cases", r.caseId);
    return `<tr><td class="num">${esc(r.code)}</td><td class="num">${esc(r.date || "")}</td>
      <td>${tc ? `${esc(tc.code)} ${esc(tc.title)}` : "—"}</td><td>${badge(r.result)}</td>
      <td class="mono small">${esc(r.measured || "")}</td><td class="small">${esc(r.notes || "").slice(0, 120)}</td></tr>`;
  }).join("");

  const defOpened = Scope.list("defects").filter(d => (d.opened || "") >= weekAgo);
  const defClosed = Scope.list("defects").filter(d => (d.closed || "") >= weekAgo);
  const defRow = d => `<tr><td class="num">${esc(d.code)}</td><td>${esc(d.title)}</td><td>${badge(d.severity)}</td><td>${badge(d.status)}</td><td>${esc(d.owner || "")}</td></tr>`;

  const upcoming = Scope.list("events")
    .filter(ev => ev.status !== "Complete" && ev.status !== "Cancelled" && ev.start >= today && ev.start <= in14)
    .sort((a, b) => a.start.localeCompare(b.start));
  const upRows = upcoming.map(ev => `<tr><td class="num">${esc(ev.start)}</td><td>${esc(ev.code)} ${esc(ev.title)}</td><td>${badge(ev.type)}</td><td>${esc(ev.location || "")}</td></tr>`).join("");

  const hotRisks = Scope.list("risks").filter(r => r.status !== "Closed" && Store.riskScore(r) >= 10)
    .sort((a, b) => Store.riskScore(b) - Store.riskScore(a));
  const riskRows = hotRisks.map(r => `<tr><td class="num">${esc(r.code)}</td><td>${esc(r.title)}</td>
    <td><span class="score-pill band-${Store.riskBand(Store.riskScore(r))}" style="font-size:12px;padding:2px 8px">${Store.riskScore(r)}</span> ${riskTrend(r)}</td>
    <td>${badge(r.status)}</td><td>${esc(r.owner || "")}</td></tr>`).join("");

  const decRows = Scope.list("decisions").filter(d => d.status !== "Complete").map(d => {
    const ready = Store.decisionReadiness(d);
    const days = d.date ? Math.ceil((new Date(d.date + "T12:00") - new Date(today + "T12:00")) / 86400000) : null;
    return `<tr><td class="num">${esc(d.code)}</td><td>${esc(d.title)}</td><td class="num">${esc(d.date || "TBD")}${days != null ? ` (${days}d)` : ""}</td>
      <td>${badge(d.status)}</td><td class="num">${ready ? `${ready.verified}/${ready.total} verified` : "—"}</td></tr>`;
  }).join("");

  return `
    ${pageHead(
      [{ label: "Dashboard", href: "#/dashboard" }, { label: "SITREP" }],
      `Weekly SITREP`,
      actBtn("⎙ Print", "print-page", null, "", false),
      `${esc(Store.db.meta.program || "")} · Reporting period ${esc(weekAgo)} → ${esc(today)} · Generated ${esc(today)}`)}
    ${panel(Scope.system ? "1 · Week Over Week (program-wide snapshots)" : "1 · Week Over Week", deltaHtml)}
    ${panel(`2 · Test Runs This Week (${weekRuns.length})`, runRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Run</th><th>Date</th><th>Test Case</th><th>Result</th><th>Measured</th><th>Notes</th></tr></thead><tbody>${runRows}</tbody></table></div>`
      : emptyMsg("No runs recorded this week."), "", true)}
    ${panel(`3 · Defects — ${defOpened.length} opened, ${defClosed.length} closed this week`, (defOpened.length || defClosed.length)
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Defect</th><th>Severity</th><th>Status</th><th>Owner</th></tr></thead><tbody>${defOpened.map(defRow).join("")}${defClosed.filter(d => !defOpened.includes(d)).map(defRow).join("")}</tbody></table></div>`
      : emptyMsg("No defect activity this week."), "", true)}
    ${panel("4 · Next 14 Days", upRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Date</th><th>Event</th><th>Type</th><th>Location</th></tr></thead><tbody>${upRows}</tbody></table></div>`
      : emptyMsg("Nothing scheduled in the next two weeks."), "", true)}
    ${panel("5 · Decision Readiness", decRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Decision</th><th>Date</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${decRows}</tbody></table></div>`
      : emptyMsg("No open decisions."), "", true)}
    ${panel("6 · High / Critical Risks", riskRows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Risk</th><th>Score / Trend</th><th>Status</th><th>Owner</th></tr></thead><tbody>${riskRows}</tbody></table></div>`
      : emptyMsg("No high or critical risks open."), "", true)}`;
};

