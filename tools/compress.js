import { mountTool } from "../app.js";

const PRESETS = [
  ["custom", "Custom DPI"],
  ["40", "40 DPI — tiny thumbnail"],
  ["72", "72 DPI — screen"],
  ["96", "96 DPI — web"],
  ["150", "150 DPI — standard"],
  ["200", "200 DPI — good"],
  ["300", "300 DPI — print quality"],
  ["600", "600 DPI — high"],
  ["1200", "1200 DPI — very high"],
  ["2400", "2400 DPI — ultra"],
  ["5000", "5000 DPI — maximum"],
];

let info = null;

mountTool({
  id: "compress",
  title: "Compress PDF",
  desc: "Reduce a PDF's file size. Keep the text with a lossless rebuild, or re-render the pages as images at any resolution from 40 to 5000 DPI.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Compress PDF",
  options: [
    { name: "mode", label: "Method", type: "select", value: "dpi", options: [
      ["lossless", "Lossless — keep selectable text"],
      ["dpi", "Re-render pages at a DPI"],
    ] },
    { name: "preset", label: "Resolution preset", type: "select", value: "150", options: PRESETS },
    { name: "dpi", label: "Resolution (DPI, 40–5000)", type: "number", value: 150, min: 40, max: 5000, step: 10 },
    { name: "quality", label: "JPEG quality", type: "range", value: 0.7, min: 0.2, max: 0.95, step: 0.05 },
  ],
  async onFiles(ctx) {
    ctx.extra.innerHTML = `<p class="hint" id="cinfo">Reading the document…</p>`;
    try {
      const viewer = await ctx.openDocument(await ctx.files[0].arrayBuffer());
      const vp = (await viewer.getPage(1)).getViewport({ scale: 1 });
      info = { w: vp.width, h: vp.height, pages: viewer.numPages };
    } catch (e) {
      info = null;
      ctx.extra.innerHTML = `<p class="hint" style="color:var(--danger)">This file could not be read as a PDF.</p>`;
      return;
    }
    const paint = () => {
      const dpi = ctx.clampDpi(document.getElementById("opt-dpi")?.value);
      const { w, h } = ctx.rasterSize(info.w, info.h, dpi);
      const err = ctx.checkRaster(w, h);
      const max = ctx.maxDpiFor(info.w, info.h);
      const mm = (pt) => (pt / 72 * 25.4).toFixed(0);
      ctx.extra.querySelector("#cinfo").innerHTML =
        `${info.pages} page(s), page size ${Math.round(info.w)}×${Math.round(info.h)} pt (${mm(info.w)}×${mm(info.h)} mm). ` +
        `At <b>${dpi} DPI</b> each page becomes <b>${w}×${h}px</b>` +
        (err ? ` — <span style="color:var(--danger)">too large for a browser tab.</span> The most this page size can do is about <b>${max} DPI</b>.`
             : ` (about ${(w * h * 3 / 1048576).toFixed(0)} MB of raw pixels per page).`);
    };
    const preset = document.getElementById("opt-preset");
    const dpiEl = document.getElementById("opt-dpi");
    if (preset && dpiEl) {
      preset.addEventListener("change", () => {
        if (preset.value !== "custom") { dpiEl.value = preset.value; }
        paint();
      });
      dpiEl.addEventListener("input", () => { preset.value = "custom"; paint(); });
    }
    paint();
  },
  async run(ctx) {
    const o = ctx.options;
    const input = await ctx.files[0].arrayBuffer();
    const before = input.byteLength;
    let bytes, note;

    if (o.mode === "lossless") {
      const { PDFDocument } = await ctx.loadPdfLib();
      const doc = await PDFDocument.load(input, { ignoreEncryption: true });
      bytes = await doc.save({ useObjectStreams: true });
      note = "Structure rebuilt with object streams. Text stays selectable.";
    } else {
      const dpi = ctx.clampDpi(o.dpi);
      const viewer = await ctx.openDocument(input);
      const { PDFDocument } = await ctx.loadPdfLib();
      const out = await PDFDocument.create();
      for (let i = 1; i <= viewer.numPages; i++) {
        ctx.progress(i / viewer.numPages);
        const page = await viewer.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const size = ctx.rasterSize(base.width, base.height, dpi);
        const err = ctx.checkRaster(size.w, size.h);
        if (err) {
          throw new Error(`${err} Page ${i} is ${Math.round(base.width)}×${Math.round(base.height)} pt — try ${ctx.maxDpiFor(base.width, base.height)} DPI or less.`);
        }
        const vp = page.getViewport({ scale: dpi / 72 });
        const c = ctx.canvasOf(vp.width, vp.height);
        const g = c.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: g, viewport: vp }).promise;
        const blob = await ctx.canvasBlob(c, "image/jpeg", Number(o.quality) || 0.7);
        const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
        const p = out.addPage([base.width, base.height]);
        p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      }
      bytes = await out.save();
      note = `Pages re-rendered at ${dpi} DPI JPEG (quality ${Math.round((Number(o.quality) || 0.7) * 100)}%). Text becomes part of the image, so it is no longer selectable.`;
    }

    const saved = before - bytes.length;
    const pct = before ? Math.round((saved / before) * 100) : 0;
    ctx.download(bytes, "compressed.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ ${ctx.fmtSize(before)} → <b>${ctx.fmtSize(bytes.length)}</b> (${pct >= 0 ? "saved " + pct + "%" : "grew " + Math.abs(pct) + "%"}). ${note}</p>`;
  },
  help: "<p><b>Lossless</b> rebuilds the file structure and keeps your text — safe, but the savings are modest. <b>Re-render at a DPI</b> turns each page into a JPEG at the resolution you choose: 72–96 DPI for screen reading, 150–200 for everyday use, 300+ for print, and up to 5000 for archival-quality rasters. Higher DPI means a bigger file and slower processing.</p>",
});
