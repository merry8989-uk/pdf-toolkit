import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["webp", "WebP"], ["png", "PNG"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null;

const enc = async (ctx, canvas, mime, q) => {
  const blob = await ctx.canvasBlob(canvas, mime, q);
  return new Uint8Array(await blob.arrayBuffer());
};

const drawScaled = (ctx, scale, mime) => {
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const c = ctx.canvasOf(w, h);
  const g = c.getContext("2d");
  if (mime !== "image/png") { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); }
  g.imageSmoothingQuality = "high";
  g.drawImage(src, 0, 0, w, h);
  return c;
};

/** Highest quality that fits; falls back to shrinking the pixels. */
async function fitToTarget(ctx, mime, targetBytes) {
  let scale = 1;
  for (let attempt = 0; attempt < 12; attempt++) {
    ctx.checkCancel();
    const canvas = drawScaled(ctx, scale, mime);
    if (mime === "image/png") {
      const data = await enc(ctx, canvas, mime, 1);
      if (data.length <= targetBytes) return { data, scale, q: null, w: canvas.width, h: canvas.height };
    } else {
      const min = await enc(ctx, canvas, mime, 0.1);
      if (min.length <= targetBytes) {
        let lo = 0.1, hi = 0.95, best = min, bestQ = 0.1;
        for (let i = 0; i < 7; i++) {
          const mid = (lo + hi) / 2;
          const d = await enc(ctx, canvas, mime, mid);
          if (d.length <= targetBytes) { best = d; bestQ = mid; lo = mid; } else hi = mid;
        }
        return { data: best, scale, q: bestQ, w: canvas.width, h: canvas.height };
      }
    }
    scale *= 0.85;
    if (Math.round(src.width * scale) < 24 || Math.round(src.height * scale) < 24) break;
  }
  // give up gracefully with the smallest we produced
  const canvas = drawScaled(ctx, scale, mime);
  const data = await enc(ctx, canvas, mime, mime === "image/png" ? 1 : 0.1);
  return { data, scale, q: mime === "png" ? null : 0.1, w: canvas.width, h: canvas.height, missed: true };
}


mountTool({
  id: "compress-image",
  title: "Compress image",
  desc: "Shrink a photo by quality, by print size and DPI, or by hitting an exact target size such as 100 KB or 1 MB.",
  accept: "image/*",
  multiple: false,
  action: "Compress image",
  options: [
    { name: "mode", label: "How to size it", type: "select", value: "target", options: [
      ["target", "Hit a target file size"],
      ["quality", "By quality / max pixels"],
      ["print", "By print size and DPI"],
    ] },
    { name: "target", label: "Target size", type: "number", value: 200, min: 5, max: 20000 },
    { name: "unit", label: "Target unit", type: "select", value: "KB", options: [["KB", "KB"], ["MB", "MB"]] },
    { name: "quality", label: "Quality", type: "range", value: 0.75, min: 0.1, max: 0.95, step: 0.05 },
    { name: "maxw", label: "Max width (px, 0 = keep)", type: "number", value: 2000, min: 0, max: 12000 },
    { name: "widthmm", label: "Print width (mm) — print mode", type: "number", value: 150, min: 10, max: 2000 },
    { name: "dpi", label: "Resolution (DPI, 40–5000)", type: "number", value: 300, min: 40, max: 5000, step: 10 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    ctx.extra.innerHTML = `<p class="hint" id="iinfo"></p>`;
    const paint = () => {
      const o = {
        mode: document.getElementById("opt-mode")?.value || "target",
        maxw: Number(document.getElementById("opt-maxw")?.value || 0),
        widthmm: Number(document.getElementById("opt-widthmm")?.value || 150),
        dpi: ctx.clampDpi(document.getElementById("opt-dpi")?.value),
        target: Number(document.getElementById("opt-target")?.value || 200),
        unit: document.getElementById("opt-unit")?.value || "KB",
      };
      const mm = (px, dpi) => (px / dpi * 25.4).toFixed(0);
      let msg = `Original ${src.width}×${src.height}px, ${ctx.fmtSize(ctx.files[0].size)}. `;
      if (o.mode === "target") {
        const tb = o.target * (o.unit === "MB" ? 1048576 : 1024);
        msg += `Working towards <b>${ctx.fmtSize(tb)}</b> — the tool lowers the quality, then the pixel size, until it fits.`;
      } else {
        let w = src.width, h = src.height;
        if (o.mode === "print") { w = ctx.mmToPx(o.widthmm, o.dpi); h = Math.round(src.height * (w / src.width)); }
        else if (o.maxw && w > o.maxw) { h = Math.round(h * o.maxw / w); w = o.maxw; }
        const err = ctx.checkRaster(w, h);
        msg += `Output will be <b>${w}×${h}px</b>` +
          (err ? ` — <span style="color:var(--danger)">too large for a browser tab.</span> Lower the print width or the DPI.`
               : `, which prints at ${mm(w, o.dpi)}×${mm(h, o.dpi)} mm at ${o.dpi} DPI.`);
      }
      ctx.extra.querySelector("#iinfo").innerHTML = msg;
    };
    ["mode", "maxw", "widthmm", "dpi", "target", "unit"].forEach((n) => {
      const el = document.getElementById("opt-" + n);
      if (el) { el.addEventListener("input", paint); el.addEventListener("change", paint); }
    });
    paint();
  },
  onReset() { src = null; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    const o = ctx.options;
    const dpi = ctx.clampDpi(o.dpi);
    const mime = mimeOf(o.format);
    const before = ctx.files[0].size;
    let u8, note = "";

    if (o.mode === "target") {
      const targetBytes = Math.max(1024, (Number(o.target) || 200) * (o.unit === "MB" ? 1048576 : 1024));
      const r = await fitToTarget(ctx, mime, targetBytes);
      u8 = ctx.withDpi(r.data, mime, dpi);
      const finalSize = u8.length;
      note = r.missed
        ? `The smallest this image could be made was ${ctx.fmtSize(finalSize)}; the ${ctx.fmtSize(targetBytes)} target was not reachable.`
        : `Target of ${ctx.fmtSize(targetBytes)} met at ${r.w}×${r.h}px${r.q != null ? `, quality ${Math.round(r.q * 100)}%` : " (PNG is lossless, so only the size could be reduced)"}.`;
    } else {
      let w = src.width, h = src.height;
      if (o.mode === "print") { w = ctx.mmToPx(o.widthmm, dpi); h = Math.round(src.height * (w / src.width)); }
      else {
        const maxw = Number(o.maxw) || 0;
        if (maxw && w > maxw) { h = Math.round(h * maxw / w); w = maxw; }
      }
      const err = ctx.checkRaster(w, h);
      if (err) throw new Error(err + " Lower the print width or the DPI.");
      const c = ctx.canvasOf(w, h);
      const g = c.getContext("2d");
      if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); }
      g.imageSmoothingQuality = "high";
      g.drawImage(src, 0, 0, w, h);
      const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.75);
      u8 = ctx.withDpi(new Uint8Array(await blob.arrayBuffer()), mime, dpi);
      note = `Now ${w}×${h}px at ${dpi} DPI.`;
    }

    const outBlob = new Blob([u8], { type: mime });
    const pct = before ? Math.round((1 - outBlob.size / before) * 100) : 0;
    ctx.download(outBlob, `compressed.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ ${ctx.fmtSize(before)} → <b>${ctx.fmtSize(outBlob.size)}</b> (${pct >= 0 ? "saved " + pct + "%" : "grew " + Math.abs(pct) + "%"}). ${note}${o.format === "webp" ? " WebP does not store DPI." : ""}</p>`;
  },
  help: "<p><b>Hit a target file size</b> is for upload limits — “under 200 KB” — and it searches for the best quality that fits, shrinking the pixel size only when it must. <b>By quality</b> gives direct control over compression. <b>By print size</b> works backwards from how big you want it on paper. The DPI is written into the JPG or PNG so print software reads the right physical size.</p>",
});
