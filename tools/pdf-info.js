import { mountTool } from "../app.js";

mountTool({
  id: "pdf-info",
  title: "PDF info",
  desc: "Inspect a PDF: page count, page sizes, orientation, metadata and file size — all read locally.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Inspect PDF",
  async run(ctx) {
    const file = ctx.files[0];
    const doc = await ctx.openDocument(await file.arrayBuffer());
    const meta = await doc.getMetadata().catch(() => ({ info: {} }));
    const info = meta.info || {};

    const first = (await doc.getPage(1)).getViewport({ scale: 1 });
    let uniform = true, landscape = first.width > first.height;
    const sizes = new Set();
    for (let i = 1; i <= doc.numPages; i++) {
      const v = (await doc.getPage(i)).getViewport({ scale: 1 });
      sizes.add(`${Math.round(v.width)}x${Math.round(v.height)}`);
      if (Math.abs(v.width - first.width) > 1 || Math.abs(v.height - first.height) > 1) uniform = false;
      if (i === 1) landscape = v.width > v.height;
    }

    const mm = (pt) => (pt / 72 * 25.4).toFixed(0);
    const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

    let rows = `
      <tr><td>File name</td><td>${esc(file.name)}</td></tr>
      <tr><td>File size</td><td>${ctx.fmtSize(file.size)}</td></tr>
      <tr><td>Pages</td><td>${doc.numPages}</td></tr>
      <tr><td>Page size</td><td>${Math.round(first.width)} × ${Math.round(first.height)} pt · ${mm(first.width)} × ${mm(first.height)} mm</td></tr>
      <tr><td>Orientation</td><td>${landscape ? "Landscape" : "Portrait"}</td></tr>
      <tr><td>Uniform page sizes</td><td>${uniform ? "Yes" : "No — " + sizes.size + " different sizes"}</td></tr>`;

    for (const k of ["Title", "Author", "Subject", "Keywords", "Creator", "Producer", "CreationDate", "ModDate"]) {
      if (info[k]) rows += `<tr><td>${k}</td><td>${esc(info[k])}</td></tr>`;
    }
    if (doc.fingerprints?.[0]) rows += `<tr><td>Fingerprint</td><td class="mono">${esc(doc.fingerprints[0])}</td></tr>`;

    ctx.out.innerHTML = `<div class="table-wrap" style="margin-top:14px"><table>${rows}</table></div>
      <p class="hint">Everything here is read from the file on your device.</p>`;
  },
  help: "<p>Metadata is only shown if the document actually contains it. Use <b>Remove metadata</b> to strip those fields, or <b>Edit metadata</b> to change them.</p>",
});
