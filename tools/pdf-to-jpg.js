import { mountTool } from "../app.js";

const PRESETS = [
  ["custom", "Custom DPI"],
  ["40", "40 DPI"], ["72", "72 DPI — screen"], ["96", "96 DPI — web"],
  ["150", "150 DPI — standard"], ["200", "200 DPI — good"], ["300", "300 DPI — print"],
  ["600", "600 DPI — high"], ["1200", "1200 DPI — very high"], ["2400", "2400 DPI"], ["5000", "5000 DPI — maximum"],
];

mountTool({
  id: "pdf-to-jpg",
  title: "PDF to JPG",
  desc: "Render each PDF page as a JPG or PNG at any resolution from 40 to 5000 DPI. Multi-page results arrive as a ZIP.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Convert to images",
  options: [
    { name: "format", label: "Image format", type: "select", value: "jpeg", options: [["jpeg", "JPG"], ["png", "PNG"]] },
    { name: "preset", label: "Resolution preset", type: "select", value: "150", options: PRESETS },
    { name: "dpi", label: "Resolution (DPI, 40–5000)", type: "number", value: 150, min: 40, max: 5000, step: 10 },
    { name: "quality", label: "JPEG quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    ctx.extra.innerHTML = `<p class="hint" id="jinfo">Reading the document…</p>`;
    let vp;
    try {
      const viewer = await ctx.openDocument(await ctx.files[0].arrayBuffer());
      vp = (await viewer.getPage(1)).getViewport({ scale: 1 });
      ctx._pages = viewer.numPages;
    } catch (e) {
      ctx.extra.innerHTML = `<p class="hint" style="color:var(--danger)">This file could not be read as a PDF.</p>`;
      return;
    }
    const paint = () => {
      const dpi = ctx.clampDpi(document.getElementById("opt-dpi")?.value);
      const { w, h } = ctx.rasterSize(vp.width, vp.height, dpi);
      const err = ctx.checkRaster(w, h);
      const max = ctx.maxDpiFor(vp.width, vp.height);
      ctx.extra.querySelector("#jinfo").innerHTML =
        `${ctx._pages} page(s). At <b>${dpi} DPI</b> each image is <b>${w}×${h}px</b>` +
        (err ? ` — <span style="color:var(--danger)">too large for a browser tab.</span> This page size supports up to about <b>${max} DPI</b>.` : ".");
    };
    const preset = document.getElementById("opt-preset");
    const dpiEl = document.getElementById("opt-dpi");
    if (preset && dpiEl) {
      preset.addEventListener("change", () => { if (preset.value !== "custom") dpiEl.value = preset.value; paint(); });
      dpiEl.addEventListener("input", () => { preset.value = "custom"; paint(); });
    }
    paint();
  },
  async run(ctx) {
    const o = ctx.options;
    const dpi = ctx.clampDpi(o.dpi);
    const doc = await ctx.openDocument(await ctx.files[0].arrayBuffer());
    const mime = o.format === "png" ? "image/png" : "image/jpeg";
    const ext = o.format === "png" ? "png" : "jpg";
    const entries = [];

    for (let i = 1; i <= doc.numPages; i++) {
      ctx.progress(i / doc.numPages);
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const size = ctx.rasterSize(base.width, base.height, dpi);
      const err = ctx.checkRaster(size.w, size.h);
      if (err) throw new Error(`${err} Page ${i} supports up to about ${ctx.maxDpiFor(base.width, base.height)} DPI.`);

      const vp = page.getViewport({ scale: dpi / 72 });
      const canvas = ctx.canvasOf(vp.width, vp.height);
      const c = canvas.getContext("2d");
      c.fillStyle = "#fff";
      c.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: c, viewport: vp }).promise;
      const blob = await new Promise((r) => canvas.toBlob(r, mime, Number(o.quality) || 0.92));
      const u8 = new Uint8Array(await blob.arrayBuffer());
      entries.push({ name: `page-${String(i).padStart(2, "0")}.${ext}`, data: ctx.withDpi(u8, mime, dpi) });
    }

    if (entries.length === 1) ctx.download(new Blob([entries[0].data], { type: mime }), entries[0].name, mime);
    else ctx.downloadZip(entries, "pdf-images.zip");
    const { w, h } = ctx.rasterSize((await doc.getPage(1)).getViewport({ scale: 1 }).width, (await doc.getPage(1)).getViewport({ scale: 1 }).height, dpi);
    ctx.out.innerHTML = `<p class="hint">✓ ${entries.length} image(s) at ${dpi} DPI (${w}×${h}px) ${entries.length === 1 ? "downloaded" : "bundled into pdf-images.zip"}. The DPI is written into each file.</p>`;
  },
  help: "<p>Pages are rendered with pdf.js — the engine behind Firefox's viewer — so text and vector art stay crisp at any resolution. Low DPIs (40–96) give small screen-sized images; 300 is print quality; above that is for archival or OCR work, and the files get large quickly.</p>",
});
