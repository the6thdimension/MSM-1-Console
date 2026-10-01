/* ============================================================
   Document library and document pages.
   Page module: adds to Views and Actions; loaded after js/views.js.
   ============================================================ */
const DOC_TYPES = ["Test Plan", "Report", "V&V Artifact", "Evidence", "Reference", "Memo", "Other"];
const DOC_MAX_BYTES = 2 * 1024 * 1024; // per-file cap; everything lives in localStorage

function fmtBytes(n) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/* "TP-01, RSK-001" → chips for codes that resolve, plain tags otherwise. */
function relatedChips(codesText) {
  const codes = String(codesText || "").split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  if (!codes.length) return `<span class="faint small">—</span>`;
  return codes.map(c => {
    const hit = Store.byCode(c.toUpperCase());
    return hit ? chip(hit.coll, hit.entity) : `<span class="ev-ref">${esc(c)}</span>`;
  }).join("");
}

Views.documents = function (params) {
  const typeF = params.get("type") || "";
  let docs = Scope.list("documents").slice().sort((a, b) => (b.added || "").localeCompare(a.added || ""));
  if (typeF) docs = docs.filter(d => d.docType === typeF);

  const rows = docs.map(d => {
    return `<tr>
      <td>${codeLink("documents", d)}</td>
      <td><a href="#/documents/${d.id}"><b>${esc(d.title)}</b></a>${d.description ? `<div class="faint small">${esc(d.description)}</div>` : ""}</td>
      <td class="col-mid">${badge(d.docType, "b-purple")}</td>
      <td>${attachmentCell(d)}</td>
      <td class="col-lo">${relatedChips(d.relatedCodes)}</td>
      <td class="num col-lo">${esc(d.added || "")}</td>
      <td class="inline-actions">${actBtn("Edit", "edit-doc", d.id)}${actBtn("Del", "del-doc", d.id)}</td>
    </tr>`;
  }).join("");

  const bytes = Store.storageBytes();
  return `
    ${pageHead([{ label: "Documents" }], "Documents",
      actBtn("⇪ Upload File", "add-doc-upload", null) + actBtn("+ Link Document", "add-doc-link", null, "", false),
      "Program documentation: link out to files on your share/wiki, or embed small files directly (stored in this browser's local database). Related codes auto-link to any entity in the console.")}
    <div class="filter-bar">
      <select data-filter="type"><option value="">All types</option>${DOC_TYPES.map(t => `<option ${typeF === t ? "selected" : ""}>${t}</option>`).join("")}</select>
      <span class="faint mono small">${docs.length} shown · active database ≈ ${fmtBytes(bytes)} characters; recovery copy also uses browser storage</span>
    </div>
    ${panel("Library", rows
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Document</th><th class="col-mid">Type</th><th>Attachment</th><th class="col-lo">Related</th><th class="col-lo">Added</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No documents yet — link one or upload a file."), "", true)}
    <input type="file" id="doc-file" hidden>`;
};

/* Download button for an embedded file, a link for a web address, or the share path as text. */
function attachmentCell(d) {
  if (d.dataUrl) return `${actBtn("⇓ " + esc(d.fileName || "file"), "doc-download", d.id, "", true)} <span class="faint mono small">${fmtBytes(d.fileSize)}</span>`;
  if (d.url) return safeHttp(d.url)
    ? externalLink(d.url, "↗ " + d.url.replace(/^https?:\/\//i, "").slice(0, 44))
    : `<span class="ev-ref" title="${esc(d.url)}">${esc(d.url.slice(0, 44))}</span>`;
  return `<span class="faint small">no attachment</span>`;
}

/* The text of an embedded plain-text file, for a preview. null for other types. */
function embeddedText(d) {
  if (!d.dataUrl || !/^text\//.test(d.fileType || "")) return null;
  const m = d.dataUrl.match(/^data:[^,]*;base64,([A-Za-z0-9+/]*={0,2})$/);
  if (!m) return null;
  try { return new TextDecoder().decode(Uint8Array.from(atob(m[1]), c => c.charCodeAt(0))); } catch (_) { return null; }
}

Views.documentDetail = function (id) {
  const d = Store.get("documents", id);
  if (!d) return notFound("Document");
  const sysId = Store.ownerOf("documents", d), sys = sysId ? Store.get("systems", sysId) : null;
  const text = embeddedText(d);
  const pathNote = d.url && !safeHttp(d.url) ? `<div class="faint small" style="margin-top:6px">A file path on your share — open it from your own file browser; the console does not reach outside this browser.</div>` : "";
  return `
    ${pageHead([{ label: "Documents", href: "#/documents" }, { label: d.code }],
      `<span class="code-inline">${esc(d.code)}</span>${esc(d.title)}`,
      actBtn("Edit", "edit-doc", d.id) + actBtn("Delete", "del-doc", d.id) + (d.dataUrl ? actBtn("⇓ Download", "doc-download", d.id, "", false) : ""),
      `${badge(d.docType, "b-purple")} ${sys ? chip("systems", sys) : `<span class="faint small">program-level</span>`} <span class="faint mono small">added ${esc(d.added || "—")}</span>`)}
    <div class="grid-2">
      <div>
        ${panel("Attachment", `${attachmentCell(d)}${d.dataUrl ? `<div class="faint small" style="margin-top:6px">Embedded in this browser's database · ${esc(d.fileType || "unknown type")}</div>` : ""}${pathNote}`)}
        ${d.description ? panel("Description", `<p style="margin:0;white-space:pre-wrap">${esc(d.description)}</p>`) : ""}
        ${panel("Related Records", relatedChips(d.relatedCodes))}
      </div>
      <div>
        ${text != null ? panel(`Preview — ${d.fileName || "file"}`, `<pre class="doc-preview">${esc(text.slice(0, 8000))}${text.length > 8000 ? "\n…" : ""}</pre>`) : ""}
        ${auditPanel(d.id)}
      </div>
    </div>`;
};

function docFields(fileNote) {
  const f = [
    { key: "title", label: "Title", required: true },
    ownerField(),
    { key: "docType", label: "Type", type: "select", half: true, options: DOC_TYPES },
    { key: "added", label: "Date", type: "date", half: true, default: todayISO() },
    { key: "url", label: "Link (URL or file path on your share)" },
    { key: "relatedCodes", label: "Related Codes (e.g. TP-01, RSK-001, DP-01)", half: false },
    { key: "description", label: "Description", type: "textarea" }
  ];
  return f;
}

/* Holds a just-picked file's data between the file input and the modal submit. */
let pendingDocFile = null;

function openDocModal(existing, fileData) {
  const isEdit = !!existing;
  pendingDocFile = fileData || null;
  const values = existing ? Object.assign({}, existing) : ownerDefault(fileData ? { title: fileData.name.replace(/\.[^.]+$/, "") } : {});
  Modal.open(
    isEdit ? `Edit ${existing.code}` : fileData ? `Upload — ${fileData.name} (${fmtBytes(fileData.size)})` : "Link Document",
    docFields(), values, v => {
      if (pendingDocFile) {
        v.fileName = pendingDocFile.name;
        v.fileSize = pendingDocFile.size;
        v.fileType = pendingDocFile.type;
        v.dataUrl = pendingDocFile.dataUrl;
        Store.effect(() => { pendingDocFile = null; });
      }
      if (isEdit) { Store.update("documents", existing.id, v); Toast.show("Saved"); }
      else {
        const d = Store.add("documents", Object.assign({ fileName: "", fileSize: 0, fileType: "", dataUrl: "" }, v));
        Toast.show(`${d.code} added`);
      }
      App.render();
    }, isEdit ? "Save" : "Add");
}

Object.assign(Actions, {
  /* ---- documents ---- */
  "add-doc-link": () => openDocModal(null, null),
  "add-doc-upload": () => {
    const input = document.getElementById("doc-file");
    if (input) input.click();
    else App.go("#/documents"); // input lives on the documents page
  },
  "edit-doc": id => openDocModal(Store.get("documents", id), null),
  "del-doc": id => {
    const d = Store.get("documents", id);
    Modal.confirm(`Delete ${d.code} “${d.title}”${d.dataUrl ? " and its embedded file" : ""}?`, () => {
      Store.remove("documents", id); toastUndo("Document deleted"); App.go("#/documents");
    });
  },
  "doc-download": id => {
    const d = Store.get("documents", id);
    if (!d || !d.dataUrl) return;
    try {
      const match=d.dataUrl.match(/^data:[^,]*;base64,([A-Za-z0-9+/]*={0,2})$/);
      if(!match)throw new Error('Invalid attachment');
      const bytes=Uint8Array.from(atob(match[1]),c=>c.charCodeAt(0));
      IO.download(d.fileName || 'document',bytes,'application/octet-stream');
    } catch (_) { Toast.show('Could not decode the embedded file',true); }
  },

});
