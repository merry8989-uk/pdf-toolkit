import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["webp", "WebP"], ["png", "PNG"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null;

mountTool({
  id: "compress-image",
  title: "Compress image",
  desc: "Shrink a photo by re-encoding it, capping its pixel size, or resizing it to an exact print size at a DPI you choose (40–5000).",
  accept: "image/*",
  multiple: false,
  action: "Compress image",
  options: [
    { name: "mode", label: "How to size it", type: "select", value: "quality", options: [
      ["quality", "By quality / max pixels"],
      ["print", "By print size and DPI"],
    ] },
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
        mode: document.getElementById("opt-mode")?.value || "quality",
        maxw: Number(document.getElementById("opt-maxw")?.value || 0),
        widthmm: Number(document.getElementById("opt-widthmm")?.value || 150),
        dpi: ctx.clampDpi(document.getElementById("opt-dpi")?.value),
      };
      let w = src.width, h = src.height;
      if (o.mode === "print") {
        w = ctx.mmToPx(o.widthmm, o.dpi);
        h = Math.round(src.height * (w / src.width));
      } else if (o.maxw && w > o.maxw) {
        h = Math.round(h * o.maxw / w); w = o.maxw;
      }
      const err = ctx.checkRaster(w, h);
      const mm = (px, dpi) => (px / dpi * 25.4).toFixed(0);
      ctx.extra.querySelector("#iinfo").innerHTML =
        `Original ${src.width}×${src.height}px. Output will be <b>${w}×${h}px</b>` +
        (err ? ` — <span style="color:var(--danger)">too large for a browser tab.</span> Lower the print width or the DPI.`
             : `, which prints at ${mm(w, o.dpi)}×${mm(h, o.dpi)} mm at ${o.dpi} DPI.`);
    };
    ["mode", "maxw", "widthmm", "dpi"].forEach((n) => {
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
    let w = src.width, h = src.height;
    if (o.mode === "print") {
      w = ctx.mmToPx(o.widthmm, dpi);
      h = Math.round(src.height * (w / src.width));
    } else {
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

    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.75);
    const before = ctx.files[0].size;
    const u8 = ctx.withDpi(new Uint8Array(await blob.arrayBuffer()), mime, dpi);
    const outBlob = new Blob([u8], { type: mime });
    const pct = before ? Math.round((1 - outBlob.size / before) * 100) : 0;
    ctx.download(outBlob, `compressed.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ ${ctx.fmtSize(before)} → <b>${ctx.fmtSize(outBlob.size)}</b> (${pct >= 0 ? "saved " + pct + "%" : "grew " + Math.abs(pct) + "%"}), now ${w}×${h}px at ${dpi} DPI.${o.format === "webp" ? " WebP does not store DPI, so the density is not written." : ""}</p>`;
  },
  help: "<p><b>By quality</b> re-encodes at your chosen quality and caps the pixel width — the usual way to make a photo smaller. <b>By print size</b> works backwards from how big you want it on paper: pick the width in millimetres and the DPI (300 is standard print, 600+ for fine detail), and the exact pixel size is calculated. The DPI is written into the JPG or PNG so print software reads the right physical size.</p>",
});
