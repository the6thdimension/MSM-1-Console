/* ============================================================
   Program schedule, campaign overview and events.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
Views.schedule = function (params) {
  const typeF = params.get("type") || "";
  const statF = params.get("status") || "";
  let events = Scope.list("events");
  if (typeF) events = events.filter(ev => ev.type === typeF);
  if (statF) events = events.filter(ev => ev.status === statF);

  // Past = its last day (end, else start) is before today. Everything else — including
  // events in progress and undated ones — is upcoming.
  const today = todayISO();
  const lastDay = ev => ev.end && ev.end > (ev.start || "") ? ev.end : ev.start;
  const isPast = ev => !!ev.start && lastDay(ev) < today;
  const upcoming = events.filter(ev => !isPast(ev)).sort((a, b) => (a.start || "9999").localeCompare(b.start || "9999") || Store.byCodeOrder(a, b));
  const past = events.filter(isPast).sort((a, b) => lastDay(b).localeCompare(lastDay(a)) || Store.byCodeOrder(a, b));
  const gantt = campaignGantt(params);

  return `
    ${pageHead([{ label: "Schedule" }], "Program Schedule",
      actBtn("+ New Event", "add-event", null, "", false),
      "Test events, reviews, range windows, and decision points on one timeline. Open an event to track it and add dated notes.")}
    ${gantt}
    <div class="filter-bar">
      <select data-filter="type"><option value="">All types</option>${EVENT_TYPES.map(t => `<option ${typeF === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      <select data-filter="status"><option value="">All statuses</option>${EVENT_STATUSES.map(s => `<option ${statF === s ? "selected" : ""}>${s}</option>`).join("")}</select>
      <span class="faint mono small">${events.length} shown · ${upcoming.length} upcoming · ${past.length} past</span>
    </div>
    ${events.length ? `
      <h2 class="tl-section">Upcoming <span class="faint mono small">${upcoming.length} · from today ${esc(today)}, soonest first</span></h2>
      ${upcoming.length ? timelineList(upcoming, false, today) : emptyMsg("Nothing upcoming in this filter.")}
      <h2 class="tl-section past">Past <span class="faint mono small">${past.length} · most recent first</span></h2>
      ${past.length ? timelineList(past, true, today) : emptyMsg("No past events in this filter.")}`
      : emptyMsg("No events match the filter — add the first one.")}`;
};

/* Event cards grouped under month headings, in the order given. A past event still marked
   Planned or In Progress is flagged so its status gets updated. */
function timelineList(list, pastSection, today) {
  const monthName = iso => new Date(iso + "T12:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
  let html = "", curMonth = null;
  for (const ev of list) {
    const m = (ev.start || "").slice(0, 7);
    if (m !== curMonth) {
      curMonth = m;
      html += `<div class="tl-month">${ev.start ? esc(monthName(ev.start)) : "Unscheduled"}</div>`;
    }
    const plan = ev.planId ? Store.get("plans", ev.planId) : null;
    const dec = ev.decisionId ? Store.get("decisions", ev.decisionId) : null;
    const noteCount = (ev.notes || []).length;
    const pastDue = pastSection && ["Planned", "In Progress"].includes(ev.status);
    const now = !pastSection && ev.start && ev.start <= today;
    html += `<div class="tl-event${pastSection ? " past" : ""}${pastDue ? " past-due" : ""}">
      <div class="tl-date">
        <span class="tl-dow">${ev.start ? esc(new Date(ev.start + "T12:00:00").toLocaleDateString(undefined, { weekday: "short" })) : ""}</span>
        <span class="tl-day">${ev.start ? esc(ev.start.slice(8, 10)) : "—"}</span>
        ${ev.end ? `<span class="tl-thru">→ ${esc(ev.end.slice(5))}</span>` : ""}
      </div>
      <div class="tl-body">
        <div class="tl-title"><a href="#/events/${ev.id}"><span class="code">${esc(ev.code)}</span> ${esc(ev.title)}</a></div>
        <div class="tl-meta">${badge(ev.type)} ${badge(ev.status)}
          ${pastDue ? `<span class="tl-flag" title="This event's dates have passed but its status is still ${esc(ev.status)}">past due — update status</span>` : ""}
          ${now ? `<span class="tl-flag now" title="Started on or before today and not yet over">happening now</span>` : ""}
          ${ev.location ? `<span class="faint mono small">📍 ${esc(ev.location)}</span>` : ""}
          ${noteCount ? `<span class="tl-notecount">✎ ${noteCount} note${noteCount === 1 ? "" : "s"}</span>` : ""}
        </div>
        ${ev.description ? `<div class="tl-desc">${esc(ev.description)}</div>` : ""}
        ${(plan || dec) ? `<div class="tl-links">${plan ? chip("plans", plan) : ""}${dec ? chip("decisions", dec) : ""}</div>` : ""}
      </div>
      <div class="tl-actions">${actBtn("✎", "edit-event", ev.id, "", true, "btn-xs")}${actBtn("+ Note", "add-note", ev.id, "", true, "btn-xs")}</div>
    </div>`;
  }
  return html;
}

/* ---------- campaign overview ----------
   Every position on the chart comes from ganttScale: whole UTC days mapped onto 0–100% of the
   track. Lanes, gridlines, the today line and the axis all share that one mapping, and the
   label column width lives only in CSS (--gl). */
const GANTT_DAY = 86400000;
const GANTT_ZOOMS = [
  { key: "program", label: "Whole program" },
  { key: "90", label: "±90 days" },
  { key: "quarter", label: "This quarter" }
];
const ganttDay = iso => Date.parse(String(iso).slice(0, 10) + "T00:00:00Z");
const ganttISO = ms => new Date(ms).toISOString().slice(0, 10);

function ganttScale(loISO, hiISO) {
  const lo = ganttDay(loISO), hi = ganttDay(hiISO) + GANTT_DAY;   // the last day is included
  const range = Math.max(hi - lo, GANTT_DAY);
  const ticks = [];
  const first = new Date(lo);
  for (let y = first.getUTCFullYear(), m = first.getUTCMonth() + (first.getUTCDate() === 1 ? 0 : 1); ; m++) {
    const t = Date.UTC(y, m, 1);
    if (t >= hi) break;
    ticks.push(ganttISO(t));
  }
  return {
    lo: loISO, hi: hiISO, ticks,
    x: iso => (ganttDay(iso) - lo) / range * 100,                  // start of that day
    xEnd: iso => (ganttDay(iso) + GANTT_DAY - lo) / range * 100,    // end of that day
    inView: (start, end) => ganttDay(end || start) >= lo && ganttDay(start) < hi
  };
}

/* The visible window for a zoom level. "program" spans every dated plan and event plus today. */
function ganttWindow(zoom, dates, today) {
  const shift = (iso, days) => ganttISO(ganttDay(iso) + days * GANTT_DAY);
  if (zoom === "90") return [shift(today, -90), shift(today, 90)];
  if (zoom === "quarter") {
    const y = Number(today.slice(0, 4)), q = Math.floor((Number(today.slice(5, 7)) - 1) / 3);
    return [ganttISO(Date.UTC(y, q * 3, 1)), ganttISO(Date.UTC(y, q * 3 + 3, 0))];
  }
  const all = dates.concat(today).filter(Boolean).sort();
  const span = Math.round((ganttDay(all[all.length - 1]) - ganttDay(all[0])) / GANTT_DAY);
  const pad = Math.max(2, Math.round(span * 0.03));
  return [shift(all[0], -pad), shift(all[all.length - 1], pad)];
}

function campaignGantt(params) {
  const today = todayISO();
  const zoom = GANTT_ZOOMS.some(z => z.key === params.get("zoom")) ? params.get("zoom") : "program";
  const events = Scope.list("events").filter(ev => ev.start);
  const plans = Scope.list("plans").slice().sort((a, b) => (a.start || "9999").localeCompare(b.start || "9999") || Store.byCodeOrder(a, b));
  const dates = plans.flatMap(p => [p.start, p.end]).concat(events.flatMap(ev => [ev.start, ev.end])).filter(Boolean);
  if (!dates.length) return "";
  const g = ganttScale(...ganttWindow(zoom, dates, today));
  const clamp = v => Math.min(100, Math.max(0, v));
  const fx = v => v.toFixed(2);
  let outside = 0;

  const kind = ev => ev.type === "Decision Point" ? "gk-decision" : ev.type === "Milestone" ? "gk-milestone" : "gk-event";
  const state = s => s === "Complete" ? " done" : s === "Cancelled" ? " cancelled" : "";
  const lane = list => {
    const out = [];
    let lastTag = -Infinity, low = false;
    for (const ev of list.slice().sort((a, b) => a.start.localeCompare(b.start))) {
      if (!g.inView(ev.start, ev.end)) { outside++; continue; }
      const k = kind(ev);
      const tip = esc(`${ev.code} ${ev.title} · ${ev.type} · ${ev.status} · ${ev.start}${ev.end && ev.end !== ev.start ? " → " + ev.end : ""}`);
      if (k === "gk-event" && ev.end && ev.end > ev.start) {
        const l = clamp(g.x(ev.start)), r = clamp(g.xEnd(ev.end));
        out.push(`<a class="gantt-span${state(ev.status)}" href="#/events/${ev.id}" style="left:${fx(l)}%;width:${fx(Math.max(r - l, 0.4))}%" title="${tip}" aria-label="${tip}"></a>`);
        continue;
      }
      const px = clamp(g.x(ev.start) + (g.xEnd(ev.start) - g.x(ev.start)) / 2);
      let tag = "";
      if (k !== "gk-event") {
        // Decisions and milestones are labeled on the chart; close neighbours alternate above/below.
        const dec = ev.decisionId ? Store.get("decisions", ev.decisionId) : null;
        low = px - lastTag < 9 ? !low : false;
        lastTag = px;
        tag = `<span class="gantt-tag ${low ? "low" : "high"}${px > 86 ? " flip" : ""}${k === "gk-decision" ? " dec" : ""}">${esc(k === "gk-decision" && dec ? dec.code : ev.code)}</span>`;
      }
      out.push(`<a class="gantt-pt" href="#/events/${ev.id}" style="left:${fx(px)}%" title="${tip}" aria-label="${tip}"><i class="gantt-glyph ${k}${state(ev.status)}"></i>${tag}</a>`);
    }
    return out.join("");
  };
  const barCls = p => p.status === "Active" ? "gb-active" : p.status === "Planning" ? "gb-planning" : p.status === "Complete" ? "gb-complete" : "gb-other";
  const bar = p => {
    if (!p.start) return "";
    const end = p.end && p.end >= p.start ? p.end : p.start;
    if (!g.inView(p.start, end)) { outside++; return ""; }
    const l0 = g.x(p.start), r0 = g.xEnd(end), l = clamp(l0), r = clamp(r0);
    const cut = (l0 < 0 ? " cut-l" : "") + (r0 > 100 ? " cut-r" : "");
    return `<a class="gantt-bar ${barCls(p)}${cut}" href="#/plans/${p.id}" style="left:${fx(l)}%;width:${fx(Math.max(r - l, 0.6))}%" title="${esc(`${p.code} ${p.name} · ${p.status} · ${p.start} → ${p.end || "no end date"}`)}">${esc(p.code)} · ${esc(p.name)}</a>`;
  };
  const row = (label, sub, href, body) => `<div class="gantt-row">
      <div class="gantt-label">${href ? `<a class="gl-name" href="${href}">${label}</a>` : `<span class="gl-name">${label}</span>`}${sub ? `<span class="gl-sub">${sub}</span>` : ""}</div>
      <div class="gantt-lane">${body}</div>
    </div>`;

  const rows = plans.map(p => row(
    `<span class="code">${esc(p.code)}</span> <span class="gl-title">${esc(p.name)}</span>`,
    `${esc(p.status || "")}${p.start ? "" : " · no dates"}`,
    `#/plans/${p.id}`,
    bar(p) + lane(events.filter(ev => ev.planId === p.id)))).join("");
  const loose = events.filter(ev => !ev.planId || !plans.some(p => p.id === ev.planId));
  const programRow = loose.length ? row(`<span class="code">Program</span>`, "no plan", "", lane(loose)) : "";

  const todayIn = g.inView(today);
  const tickLabel = (iso, i) => new Date(ganttDay(iso)).toLocaleDateString(undefined,
    { month: "short", timeZone: "UTC", ...(i === 0 || iso.slice(5, 7) === "01" ? { year: "numeric" } : {}) });
  const overlay = g.ticks.map(t => `<i class="gantt-grid" style="left:${fx(g.x(t))}%"></i>`).join("") +
    (todayIn ? `<i class="gantt-now" style="left:${fx(g.x(today) + (g.xEnd(today) - g.x(today)) / 2)}%" title="Today ${esc(today)}"></i>` : "");
  const axis = g.ticks.map((t, i) => `<span style="left:${fx(g.x(t))}%">${esc(tickLabel(t, i))}</span>`).join("");

  const zoomLinks = GANTT_ZOOMS.map(z => {
    const q = new URLSearchParams(params);
    z.key === "program" ? q.delete("zoom") : q.set("zoom", z.key);
    const qs = q.toString();
    return `<a class="${z.key === zoom ? "active" : ""}" href="#/schedule${qs ? "?" + qs : ""}">${z.label}</a>`;
  }).join("");
  const head = `<div class="gantt-zoom">${zoomLinks}<span class="gantt-window">${esc(g.lo)} → ${esc(g.hi)}${todayIn ? "" : " · today is outside this window"}${outside ? ` · ${outside} item${outside === 1 ? "" : "s"} outside` : ""}</span></div>`;

  const legend = `<div class="gantt-legend">
      <span><i class="gantt-glyph gk-event"></i> event</span>
      <span><i class="gantt-span-key"></i> multi-day window</span>
      <span><i class="gantt-glyph gk-milestone"></i> milestone</span>
      <span><i class="gantt-glyph gk-decision"></i> decision point</span>
      <span><i class="gantt-glyph gk-event done"></i> complete (filled green)</span>
      <span><i class="gantt-glyph gk-event cancelled"></i> cancelled (faded)</span>
      <span><i class="gantt-now-key"></i> today</span>
      <span>bar = plan window; color = plan status (named on the left)</span>
      <span>dashed bar edge = continues outside the window</span>
    </div>`;

  return panel("Campaign Overview", `<div class="gantt">
      <div class="gantt-rows">
        ${programRow}${rows}
        <div class="gantt-overlay" aria-hidden="true">${overlay}</div>
      </div>
      <div class="gantt-axis">${axis}</div>
    </div>${legend}`, head);
}

Views.eventDetail = function (id) {
  const ev = Store.get("events", id);
  if (!ev) return notFound("Event");
  const plan = ev.planId ? Store.get("plans", ev.planId) : null;
  const dec = ev.decisionId ? Store.get("decisions", ev.decisionId) : null;
  const notes = (ev.notes || []).slice().sort((a, b) => Store.compareRuns(a, b));

  const notesHtml = notes.length ? notes.map(n => `
    <div class="note-item">
      <span class="note-date">${esc(n.date || "")}</span>
      <span class="note-text">${esc(n.text)}</span>
      <span class="inline-actions">${actBtn("✎", "edit-note", n.id, `data-event="${ev.id}"`, true, "btn-xs")}${actBtn("✕", "del-note", n.id, `data-event="${ev.id}"`, true, "btn-xs")}</span>
    </div>`).join("") : emptyMsg("No notes yet — use “+ Note” to log status, observations, or changes.");

  return `
    ${pageHead(
      [{ label: "Schedule", href: "#/schedule" }, { label: ev.code }],
      `<span class="code-inline">${esc(ev.code)}</span>${esc(ev.title)}`,
      actBtn("Edit", "edit-event", ev.id) + actBtn("Delete", "del-event", ev.id) + actBtn("+ Note", "add-note", ev.id, "", false),
      esc(ev.description || ""))}
    <div class="grid-2">
      <div>
        ${panel("Event", `
          <dl class="def-grid">
            <dt>Type</dt><dd>${badge(ev.type)}</dd>
            <dt>Status</dt><dd>${badge(ev.status)}</dd>
            <dt>Date</dt><dd class="mono">${esc(ev.start || "—")}${ev.end ? ` → ${esc(ev.end)}` : ""}</dd>
            <dt>Location</dt><dd>${esc(ev.location || "—")}</dd>
            <dt>Test Plan</dt><dd>${plan ? chip("plans", plan) : `<span class="faint">—</span>`}</dd>
            <dt>Decision</dt><dd>${dec ? chip("decisions", dec) : `<span class="faint">—</span>`}</dd>
          </dl>`)}
      </div>
      <div>
        <div class="panel">
          <div class="panel-head"><h2>Notes Log</h2><div class="spacer"></div>${actBtn("+ Note", "add-note", ev.id)}</div>
          <div class="panel-body tight">${notesHtml}</div>
        </div>
      </div>
    </div>`;
};

function eventFields() {
  return [
    { key: "title", label: "Title", required: true },
    ownerField(),
    { key: "type", label: "Type", type: "select", half: true, options: EVENT_TYPES },
    { key: "status", label: "Status", type: "select", half: true, options: EVENT_STATUSES },
    { key: "start", label: "Start Date", type: "date", required: true, half: true },
    { key: "end", label: "End Date (optional)", type: "date", half: true },
    { key: "location", label: "Location", half: true },
    { key: "planId", label: "Test Plan", type: "select", half: true, allowEmpty: true, options: Store.all("plans").map(p => ({ value: p.id, label: `${p.code} ${p.name}` })) },
    { key: "decisionId", label: "Related Decision", type: "select", half: true, allowEmpty: true, options: Store.all("decisions").map(d => ({ value: d.id, label: `${d.code} ${d.title}` })) },
    { key: "description", label: "Description", type: "textarea" }
  ];
}

Object.assign(Actions, {
  /* ---- schedule events & notes ---- */
  "add-event": () => Modal.open("New Schedule Event", eventFields(), ownerDefault({ status: "Planned", start: todayISO(), notes: [] }), v => {
    v.notes = [];
    const ev = Store.add("events", v);
    Toast.show(`${ev.code} created`); App.go(`#/events/${ev.id}`);
  }),
  "edit-event": id => {
    const ev = Store.get("events", id);
    Modal.open(`Edit ${ev.code}`, eventFields(), ev, v => {
      Store.update("events", id, v); Toast.show("Saved"); App.render();
    });
  },
  "del-event": id => {
    const ev = Store.get("events", id);
    Modal.confirm(`Delete ${ev.code} “${ev.title}” and its notes?`, () => {
      Store.remove("events", id); toastUndo("Event deleted"); App.go("#/schedule");
    });
  },
  "add-note": id => Modal.open("Add Note", [
    { key: "date", label: "Date", type: "date", required: true, half: true, default: todayISO() },
    { key: "text", label: "Note", type: "textarea", required: true }
  ], {}, v => {
    const ev = Store.get("events", id);
    ev.notes = ev.notes || [];
    ev.notes.push({ id: Store.nextId("notes"), date: v.date, text: v.text });
    Store.save(); Toast.show("Note added"); App.render();
  }),
  "edit-note": (id, el) => {
    const ev = Store.get("events", el.dataset.event);
    const n = (ev.notes || []).find(x => x.id === id);
    Modal.open("Edit Note", [
      { key: "date", label: "Date", type: "date", required: true, half: true },
      { key: "text", label: "Note", type: "textarea", required: true }
    ], n, v => { Object.assign(n, v); Store.save(); Toast.show("Note updated"); App.render(); });
  },
  "del-note": (id, el) => Modal.confirm("Delete this note?", () => {
    Store.checkpoint();
    const ev = Store.get("events", el.dataset.event);
    ev.notes = (ev.notes || []).filter(x => x.id !== id);
    Store.save(); toastUndo("Note deleted"); App.render();
  }),

});
