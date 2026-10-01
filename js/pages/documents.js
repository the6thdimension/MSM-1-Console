/* ============================================================
   Document library.
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
    const attach = d.dataUrl
      ? `${actBtn("⇓ " + esc(d.fileName || "file"), "doc-download", d.id, "", true)} <span class="faint mono small">${fmtBytes(d.fileSize)}</span>`
      : d.url
        ? (/^https?:\/\//i.test(d.url)
            ? `<a class="ev-ref" href="${esc(d.url)}" target="_blank" rel="noopener">↗ ${esc(d.url.replace(/^https?:\/\//i, "").slice(0, 44))}</a>`
            : `<span class="ev-ref" title="${esc(d.url)}">${esc(d.url.slice(0, 44))}</span>`)
        : `<span class="faint small">no attachment</span>`;
    return `<tr>
      <td><span class="code">${esc(d.code)}</span></td>
      <td><b>${esc(d.title)}</b>${d.description ? `<div class="faint small">${esc(d.description)}</div>` : ""}</td>
      <td>${badge(d.docType, "b-purple")}</td>
      <td>${attach}</td>
      <td>${relatedChips(d.relatedCodes)}</td>
      <td class="num">${esc(d.added || "")}</td>
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
      ? `<div class="table-scroll"><table class="data"><thead><tr><th>Code</th><th>Document</th><th>Type</th><th>Attachment</th><th>Related</th><th>Added</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : emptyMsg("No documents yet — link one or upload a file."), "", true)}
    <input type="file" id="doc-file" hidden>`;
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
      Store.remove("documents", id); toastUndo("Document deleted"); App.render();
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
