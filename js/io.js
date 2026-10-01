/* ============================================================
   IO — CSV interchange with Jira RTM and Zephyr, JSON backup
   ============================================================ */

const IO = {
  unique(coll, predicate, label) {
    const matches=Store.all(coll).filter(predicate);
    if(matches.length>1)throw new Error(`Ambiguous ${label}; resolve duplicate matches before importing`);
    return matches[0] || null;
  },
  /* ---------- CSV primitives ---------- */
  csvCell(v) {
    v = String(v == null ? "" : v);
    // Prevent spreadsheet formula execution. CSV is partial interchange; preserve this prefix on import.
    if (/^(?:\s*[=+\-@]|[\t\r])/.test(v)) v = "'" + v;
    if (/[",\r\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  },

  toCSV(rows) {
    return rows.map(r => r.map(c => this.csvCell(c)).join(",")).join("\r\n");
  },

  /* Parse CSV (handles quoted cells, embedded commas/newlines, CRLF). */
  parseCSV(text) {
    text=String(text).replace(/^\uFEFF/,'');
    const rows=[]; let row=[],cell='',quoted=false,closed=false;
    const endCell=()=>{row.push(cell);cell='';closed=false;};
    const endRow=()=>{endCell();if(row.some(c=>c!==''))rows.push(row);row=[];};
    for(let i=0;i<text.length;i++) {
      const ch=text[i];
      if(quoted) {
        if(ch==='"') { if(text[i+1]==='"'){cell+='"';i++;} else {quoted=false;closed=true;} }
        else cell+=ch;
      } else if(ch===',')endCell();
      else if(ch==='\r'||ch==='\n') {if(ch==='\r'&&text[i+1]==='\n')i++;endRow();}
      else if(ch==='"') {if(cell||closed)throw new Error('Unexpected quote in CSV');quoted=true;}
      else {if(closed)throw new Error('Unexpected characters after a quoted CSV cell');cell+=ch;}
    }
    if(quoted)throw new Error('Unclosed quoted CSV cell');
    if(cell||row.length||closed)endRow();
    if(rows.length) {
      const header=rows[0].map(h=>h.trim().toLowerCase());
      if(new Set(header).size!==header.length)throw new Error('Duplicate CSV column names');
      rows.forEach((r,i)=>{if(r.length!==header.length)throw new Error('CSV row '+(i+1)+' has the wrong number of columns');});
    }
    return rows;
  },

  download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },

  stamp() { return new Date().toISOString().slice(0, 10); },

  /* ============================================================
     JIRA RTM — requirements
     Export matches Jira's CSV importer (map Summary/Description/
     Priority/Labels; Issue Type = Requirement for RTM projects).
     ============================================================ */
  exportJiraRequirements() {
    const rows = [["Issue Type", "Issue key", "Summary", "Description", "Priority", "Labels"]];
    for (const r of Store.all("requirements")) {
      const cls = Store.reqClass(r) === "System" ? "" : Store.reqClassInfo(Store.reqClass(r)).one;
      const labels = [r.code, r.type, r.measure && r.measure !== "None" ? r.measure : "", cls]
        .filter(Boolean).map(l => l.replace(/\s+/g, "-")).join(" ");
      const desc = r.text +
        (r.threshold ? `\n\nThreshold: ${r.threshold}` : "") +
        (r.objective ? `\nObjective: ${r.objective}` : "") +
        `\nVerification method: ${r.method || ""}`;
      rows.push(["Requirement", r.extKey || "", `${r.code}: ${r.title}`, desc, r.priority || "Medium", labels]);
    }
    this.download(`jira-rtm-requirements-${this.stamp()}.csv`, this.toCSV(rows));
    return rows.length - 1;
  },

  /* RTM-style traceability: one row per requirement↔case link. */
  exportTraceability() {
    // Class and flow-down columns are appended so existing column positions never move.
    const rows = [["Requirement", "Requirement Summary", "Measure", "Test Case", "Test Case Summary", "Case Status", "Latest Result", "Latest Run Date", "Coverage Rollup", "Requirement Class", "Derived From"]];
    for (const r of Store.all("requirements")) {
      const cases = Store.casesOfRequirement(r.id);
      const roll = Store.reqStatus(r.id);
      const tail = [Store.reqClassInfo(Store.reqClass(r)).one, Store.derivedParents(r).map(p => p.code).join(" ")];
      if (!cases.length) {
        rows.push([r.code, r.title, r.measure || "", "", "", "", "", "", "NO COVERAGE", ...tail]);
        continue;
      }
      for (const tc of cases) {
        const run = Store.latestRun(tc.id);
        rows.push([r.code, r.title, r.measure || "", tc.code, tc.title, tc.status, run ? run.result : "Not Run", run ? run.date || "" : "", roll, ...tail]);
      }
    }
    this.download(`traceability-matrix-${this.stamp()}.csv`, this.toCSV(rows));
    return rows.length - 1;
  },

  /* Import a Jira CSV export (or RTM export). Columns matched by
     name, case-insensitive: Summary (required), Description,
     Priority, Issue key. Existing rows matched by Issue key, then
     by embedded "REQ-xxx:" prefix, then by exact title. */
  importJiraRequirements(text) {
    if (!Store._tx) throw new Error("CSV imports must be staged or run inside Store.command()");
    const rows = this.parseCSV(text);
    if (!rows.length) throw new Error("Empty file");
    const head = rows[0].map(h => h.trim().toLowerCase());
    const col = name => head.indexOf(name);
    const iSum = col("summary");
    if (iSum < 0) throw new Error("No 'Summary' column found — expected a Jira CSV export");
    const iDesc = col("description"), iPri = col("priority");
    const iKey = head.findIndex(h => h === "issue key" || h === "key" || h === "issue id");
    let added = 0, updated = 0;
    for (const row of rows.slice(1)) {
      const rawSum = (row[iSum] || "").trim();
      if (!rawSum) continue;
      const key = iKey >= 0 ? (row[iKey] || "").trim() : "";
      // strip a leading "REQ-012:" style prefix back out of the summary
      const m = rawSum.match(/^([A-Z]+-\d+)\s*[:—-]\s*(.+)$/);
      const codeHint = m ? m[1] : null;
      const title = m ? m[2].trim() : rawSum;
      const patch = {
        title,
        text: iDesc >= 0 ? (row[iDesc] || "").split(/\r?\n+(?:Threshold:|Objective:|Verification method:)/)[0].trim() : "",
        priority: iPri >= 0 && row[iPri] ? row[iPri].trim() : "Medium"
      };
      if (key) patch.extKey = key;
      let existing =
        (key && this.unique('requirements',r=>r.extKey===key,'requirement issue key')) ||
        (codeHint && this.unique('requirements',r=>r.code===codeHint,'requirement code')) ||
        this.unique('requirements',r=>r.title===title,'requirement title');
      if (existing) {
        if(iDesc<0)delete patch.text; if(iPri<0)delete patch.priority;
        Store.update('requirements',existing.id,patch);updated++;
      }
      else {
        // A new row whose summary carries a PSPEC-/SWR- code joins that class and keeps the code.
        const cls = codeHint && Store.REQ_CLASSES.find(c => c.key !== "System" && Store.reqCodeNumber(codeHint, c.prefix));
        if (cls) { patch.reqClass = cls.key; if (!DataGuard.collections.some(c => (Store.db[c] || []).some(x => x.code === codeHint))) patch.code = codeHint; }
        Store.add("requirements", Object.assign({ type: "Functional", method: "Test", measure: "None", threshold: "", objective: "", componentIds: [] }, patch));
        added++;
      }
    }
    return { added, updated };
  },

  /* ============================================================
     ZEPHYR — test cases
     Export uses the Zephyr Squad importer layout: repeated step
     rows under one case; case fields only on the first row.
     ============================================================ */
  exportZephyrCases() {
    const rows = [["Name", "Objective", "Precondition", "Priority", "Labels", "Component", "Step", "Test Data", "Expected Result", "Issue Key"]];
    for (const tc of Store.all("cases")) {
      const comp = Store.get("components", tc.componentId);
      const proc = tc.procedureId ? Store.get("procedures", tc.procedureId) : null;
      const pre = proc ? Store.criteriaOf(proc.id, "entry").map(c => c.text).join("; ") : "";
      const labels = [tc.code, tc.venue, tc.testType, ...(tc.requirementIds || []).map(rid => (Store.get("requirements", rid) || {}).code)]
        .filter(Boolean).map(l => String(l).replace(/\s+/g, "-")).join(" ");
      const steps = proc && proc.steps && proc.steps.length ? proc.steps : [""];
      steps.forEach((s, i) => {
        rows.push(i === 0
          ? [tc.title, tc.objective || "", pre, tc.priority || "Medium", labels, comp ? comp.name : "", s, "", "", tc.extKey || ""]
          : ["", "", "", "", "", "", s, "", "", ""]);
      });
    }
    this.download(`zephyr-test-cases-${this.stamp()}.csv`, this.toCSV(rows));
    return Store.all("cases").length;
  },

  /* Import a Zephyr-style CSV. A non-empty Name starts a new case;
     following rows contribute steps. Components matched by name
     (created under an "Imported" system when unknown). A label
     matching an existing TC-xxx code updates that case instead. */
  importZephyrCases(text) {
    const rows = this.parseCSV(text);
    if (!rows.length) throw new Error("Empty file");
    const head = rows[0].map(h => h.trim().toLowerCase());
    const col = name => head.indexOf(name);
    const iName = col("name"), iObj = col("objective"), iPre = col("precondition"),
          iPri = col("priority"), iLab = col("labels"), iComp = col("component"),
          iStep = head.findIndex(h => h === "step" || h.startsWith("test script")),
          iKey = head.findIndex(h => h === "issue key" || h === "key" || h === "issue id");
    if (iName < 0) throw new Error("No 'Name' column found — expected a Zephyr CSV");

    const groups = [];
    let cur = null;
    for (const row of rows.slice(1)) {
      const name = (row[iName] || "").trim();
      if (name) {
        cur = { name, objective: iObj >= 0 ? row[iObj] || "" : "", pre: iPre >= 0 ? row[iPre] || "" : "",
                priority: iPri >= 0 ? row[iPri] || "" : "", labels: iLab >= 0 ? row[iLab] || "" : "",
                component: iComp >= 0 ? row[iComp] || "" : "", key: iKey >= 0 ? (row[iKey] || "").trim() : "", steps: [] };
        groups.push(cur);
      }
      if (!cur && row.some(c=>c.trim())) throw new Error('Zephyr step row has no preceding case name');
      if (cur && iStep >= 0 && (row[iStep] || "").trim()) cur.steps.push(row[iStep].trim());
    }

    const findOrCreateComponent = name => {
      name = (name || "").trim();
      if (name) {
        const hit = this.unique('components',c=>c.name.toLowerCase()===name.toLowerCase(),'component name');
        if (hit) return hit.id;
      }
      let sys = this.unique('systems',s=>s.name==='Imported','Imported system');
      if (!sys) sys = Store.add("systems", { name: "Imported", description: "Container for entities brought in via CSV import — reassign as needed." });
      const comp = Store.add("components", { systemId: sys.id, name: name || "Imported Cases", description: "Created during CSV import." });
      return comp.id;
    };

    let added = 0, updated = 0;
    const validPri = ["Critical", "High", "Medium", "Low"];
    for (const g of groups) {
      const codeHit = (g.labels.match(/TC-\d+/) || [])[0];
      const existing =
        (g.key && this.unique('cases',tc=>tc.extKey===g.key,'test case issue key')) ||
        (codeHit ? this.unique('cases',tc=>tc.code===codeHit,'test case code') : null);
      const patch = {
        title: g.name,
        objective: g.objective,
        priority: g.priority || "Medium"
      };
      if (g.key) patch.extKey = g.key;
      let target;
      if (existing) {
        if(iObj<0)delete patch.objective; if(iPri<0)delete patch.priority;
        target=Store.update('cases',existing.id,patch);updated++;
      }
      else {
        target = Store.add("cases", Object.assign(patch, {
          componentId: findOrCreateComponent(g.component),
          status: "Draft", requirementIds: [], resourceIds: [], venue: "", testType: "", procedureId: null
        }));
        added++;
      }
      if (g.steps.length && !target.procedureId) {
        const proc = Store.add("procedures", {
          title: `${g.name} — imported steps`,
          description: "Steps imported from Zephyr CSV.",
          steps: g.steps
        });
        if (g.pre) Store.add("criteria", { parentType: "procedure", parentId: proc.id, kind: "entry", text: g.pre, status: "open" });
        Store.update("cases", target.id, { procedureId: proc.id });
      }
    }
    return { added, updated };
  }
};
