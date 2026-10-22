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

const encode = async (ctx, canvas, q) => {
  const blob = await ctx.canvasBlob(canvas, "image/jpeg", q);
  return new Uint8Array(await blob.arrayBuffer());
};

/** Highest JPEG quality whose size still fits `budget`. */
async function fitQuality(ctx, canvas, budget) {
  const min = await encode(ctx, canvas, 0.15);
  if (min.length > budget) return { data: min, q: 0.15, over: true };
  let lo = 0.15, hi = 0.92, best = min, bestQ = 0.15;
  for (let i = 0; i < 6; i++) {
    const mid = (lo + hi) / 2;
    const d = await encode(ctx, canvas, mid);
    if (d.length <= budget) { best = d; bestQ = mid; lo = mid; } else hi = mid;
  }
  return { data: best, q: bestQ, over: false };
}

mountTool({
  id: "compress",
  title: "Compress PDF",
  desc: "Reduce a PDF's file size three ways: a lossless rebuild that keeps text, re-rendering at any DPI from 40 to 5000, or hitting an exact target size such as 500 KB or 2 MB.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Compress PDF",
  options: [
    { name: "mode", label: "Method", type: "select", value: "target", options: [
      ["target", "Hit a target file size"],
      ["dpi", "Re-render pages at a DPI"],
      ["lossless", "Lossless — keep selectable text"],
    ] },
    { name: "target", label: "Target size", type: "number", value: 500, min: 10, max: 5000 },
    { name: "unit", label: "Target unit", type: "select", value: "KB", options: [["KB", "KB"], ["MB", "MB"]] },
    { name: "preset", label: "Resolution preset (DPI modes)", type: "select", value: "150", options: PRESETS },
    { name: "dpi", label: "Resolution / max DPI (40–5000)", type: "number", value: 150, min: 40, max: 5000, step: 10 },
    { name: "quality", label: "JPEG quality (DPI mode)", type: "range", value: 0.7, min: 0.2, max: 0.95, step: 0.05 },
  ],
  async onFiles(ctx) {
    ctx.extra.innerHTML = `<p class="hint" id="cinfo">Reading the document…</p>`;
    try {
      const viewer = await ctx.openDocument(await ctx.files[0].arrayBuffer());
      const vp = (await viewer.getPage(1)).getViewport({ scale: 1 });
      info = { w: vp.width, h: vp.height, pages: viewer.numPages, size: ctx.files[0].size };
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
      const target = Number(document.getElementById("opt-target")?.value || 500);
      const unit = document.getElementById("opt-unit")?.value || "KB";
      const targetBytes = target * (unit === "MB" ? 1048576 : 1024);
      const mode = document.getElementById("opt-mode")?.value;
      let msg = `${info.pages} page(s), ${ctx.fmtSize(info.size)}, page size ${Math.round(info.w)}×${Math.round(info.h)} pt (${mm(info.w)}×${mm(info.h)} mm). `;
      if (mode === "target") {
        msg += `Working towards <b>${ctx.fmtSize(targetBytes)}</b>. The tool searches for the highest image quality that fits, lowering the DPI (starting at ${dpi}) only if it has to.`;
      } else {
        msg += `At <b>${dpi} DPI</b> each page becomes <b>${w}×${h}px</b>` +
          (err ? ` — <span style="color:var(--danger)">too large for a browser tab.</span> The most this page size can do is about <b>${max} DPI</b>.`
               : ` (about ${(w * h * 3 / 1048576).toFixed(0)} MB of raw pixels per page).`);
      }
      ctx.extra.querySelector("#cinfo").innerHTML = msg;
    };
    const preset = document.getElementById("opt-preset");
    const dpiEl = document.getElementById("opt-dpi");
    if (preset && dpiEl) {
      preset.addEventListener("change", () => { if (preset.value !== "custom") dpiEl.value = preset.value; paint(); });
      dpiEl.addEventListener("input", () => { preset.value = "custom"; paint(); });
    }
    ["mode", "target", "unit"].forEach((n) => {
      const el = document.getElementById("opt-" + n);
      if (el) { el.addEventListener("input", paint); el.addEventListener("change", paint); }
    });
    paint();
  },
  async run(ctx) {
    const o = ctx.options;
    const input = await ctx.files[0].arrayBuffer();
    const before = input.byteLength;

    /* ---------- lossless ---------- */
    if (o.mode === "lossless") {
      const { PDFDocument } = await ctx.loadPdfLib();
      const doc = await ctx.loadPdf(input);
      const bytes = await doc.save({ useObjectStreams: true });
      ctx.download(bytes, "compressed.pdf");
      const pct = Math.round(((before - bytes.length) / before) * 100);
      ctx.out.innerHTML = `<p class="hint">✓ ${ctx.fmtSize(before)} → <b>${ctx.fmtSize(bytes.length)}</b> (saved ${pct}%). Structure rebuilt with object streams; text stays selectable.</p>`;
      return;
    }

    const { PDFDocument } = await ctx.loadPdfLib();
    const viewer = await ctx.openDocument(input);
    const pages = viewer.numPages;

    /* ---------- re-render at a chosen DPI ---------- */
    if (o.mode === "dpi") {
      const dpi = ctx.clampDpi(o.dpi);
      const out = await PDFDocument.create();
      for (let i = 1; i <= pages; i++) {
        ctx.progress(i / pages);
        const page = await viewer.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const size = ctx.rasterSize(base.width, base.height, dpi);
        const err = ctx.checkRaster(size.w, size.h);
        if (err) throw new Error(`${err} Page ${i} supports up to about ${ctx.maxDpiFor(base.width, base.height)} DPI.`);
        const vp = page.getViewport({ scale: dpi / 72 });
        const c = ctx.canvasOf(vp.width, vp.height);
        const g = c.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: g, viewport: vp }).promise;
        const img = await out.embedJpg(await encode(ctx, c, Number(o.quality) || 0.7));
        const p = out.addPage([base.width, base.height]);
        p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      }
      const bytes = await out.save();
      ctx.download(bytes, "compressed.pdf");
      const pct = Math.round(((before - bytes.length) / before) * 100);
      ctx.out.innerHTML = `<p class="hint">✓ ${ctx.fmtSize(before)} → <b>${ctx.fmtSize(bytes.length)}</b> (${pct >= 0 ? "saved " + pct + "%" : "grew " + Math.abs(pct) + "%"}) at ${dpi} DPI, quality ${Math.round((Number(o.quality) || 0.7) * 100)}%. Text is now part of the image.</p>`;
      return;
    }

    /* ---------- hit a target size ---------- */
    const targetBytes = Math.max(10 * 1024, (Number(o.target) || 500) * (o.unit === "MB" ? 1048576 : 1024));
    const startDpi = ctx.clampDpi(o.dpi);

    // Render each page at a DPI and squeeze its JPEG until it fits its share
    // of the budget. Returns null if this DPI cannot get there at all.
    // `force` ignores the budget and encodes at the lowest quality — used to
    // produce the smallest possible file when a target simply cannot be met.
    const attempt = async (budgetTotal, dpi, force = false) => {
      const out = await PDFDocument.create();
      const perPage = (budgetTotal / pages) * 0.97;
      for (let i = 1; i <= pages; i++) {
        ctx.progress(i / pages);
        const page = await viewer.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const size = ctx.rasterSize(base.width, base.height, dpi);
        if (ctx.checkRaster(size.w, size.h)) return null;
        const vp = page.getViewport({ scale: dpi / 72 });
        const c = ctx.canvasOf(vp.width, vp.height);
        const g = c.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: g, viewport: vp }).promise;
        const fit = await fitQuality(ctx, c, perPage);
        if (fit.over && !force) return null;           // this page alone is too big at this DPI
        const img = await out.embedJpg(fit.data);
        const p = out.addPage([base.width, base.height]);
        p.drawImage(img, { x: 0, y: 0, width: base.width, height: base.height });
      }
      return await out.save();
    };

    const ladder = [startDpi, 200, 150, 120, 96, 72, 60, 48, 40]
      .filter((d, i, a) => a.indexOf(d) === i && d <= startDpi && d >= 40)
      .sort((a, b) => b - a);

    let best = null, usedDpi = null;
    let budget = targetBytes;
    for (let pass = 0; pass < 3; pass++) {
      let got = null, gotDpi = null;
      for (const dpi of ladder) {
        const bytes = await attempt(budget, dpi);
        if (bytes) { got = bytes; gotDpi = dpi; break; }
      }
      if (!got) break;
      best = got; usedDpi = gotDpi;
      if (got.length <= targetBytes) break;
      // still over: tighten the per-page budget proportionally and try again
      budget = Math.max(10 * 1024, Math.floor(budget * (targetBytes / got.length) * 0.94));
    }

    if (!best) {
      // Nothing fit at any DPI. Produce the SMALLEST we can make (40 DPI at the
      // lowest quality) rather than the largest, and report it honestly.
      const bytes = await attempt(10 * 1024, 40, true);
      if (!bytes) throw new Error("This document could not be re-rendered. Try the lossless method instead.");
      best = bytes; usedDpi = 40;
    }

    ctx.download(best, "compressed.pdf");
    const pct = Math.round(((before - best.length) / before) * 100);
    const hit = best.length <= targetBytes;
    ctx.out.innerHTML = `<p class="hint">✓ ${ctx.fmtSize(before)} → <b>${ctx.fmtSize(best.length)}</b> (${pct >= 0 ? "saved " + pct + "%" : "grew " + Math.abs(pct) + "%"}) at ${usedDpi} DPI. ` +
      (hit
        ? `Target of ${ctx.fmtSize(targetBytes)} met — the highest quality that fits was used.`
        : `The smallest this document could be made was ${ctx.fmtSize(best.length)}; the ${ctx.fmtSize(targetBytes)} target was not reachable without losing too much.`) +
      ` Text is now part of the image.</p>`;
  },
  help: "<p><b>Hit a target file size</b> is the one to use when a portal or email limit says “under 500 KB”: it renders the pages, then searches for the highest JPEG quality that fits your budget, dropping the DPI step by step only if it has to. <b>Re-render at a DPI</b> gives you direct control. <b>Lossless</b> keeps selectable text but saves less.</p>",
});
