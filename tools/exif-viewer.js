import { mountTool } from "../app.js";

mountTool({
  id: "exif-viewer",
  title: "EXIF viewer",
  desc: "See the hidden metadata inside a photo — camera, lens, exposure, ISO, date, and whether it carries GPS or orientation data.",
  accept: "image/*",
  multiple: false,
  action: "Read metadata",
  async run(ctx) {
    const f = ctx.files[0];
    const exif = await ctx.readExif(f);
    const keys = Object.keys(exif);
    const esc = (s) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const hasGps = Object.prototype.hasOwnProperty.call(exif, "GPSIFD");

    let rows = `<tr><td>File name</td><td>${esc(f.name)}</td></tr>
      <tr><td>File size</td><td>${ctx.fmtSize(f.size)}</td></tr>
      <tr><td>Type</td><td>${esc(f.type || "unknown")}</td></tr>`;
    for (const k of keys) rows += `<tr><td>${esc(k)}</td><td>${esc(exif[k])}</td></tr>`;

    ctx.out.innerHTML = `
      <div class="table-wrap" style="margin-top:14px"><table>${rows}</table></div>
      <p class="hint">${keys.length ? `${keys.length} metadata field(s) found.${hasGps ? " This file appears to contain location data." : ""}` : "No EXIF metadata was found in this file (it may have been stripped already, or it is a PNG/WebP)."}</p>
      <p class="hint">Want it gone? Use <b>Strip metadata</b> to produce a clean copy.</p>`;
  },
  help: "<p>EXIF is written by cameras and phones. It can include the exact time and place a photo was taken, which is why social platforms strip it on upload but email and messaging apps often do not. Everything is read locally — the file is never uploaded.</p>",
});
