import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

/** Read the density already stored in a JPEG (JFIF) or PNG (pHYs). */
function readDpi(u8) {
  // JPEG / JFIF
  if (u8[0] === 0xff && u8[1] === 0xd8) {
    let off = 2;
    while (off + 4 < u8.length) {
      if (u8[off] !== 0xff) { off++; continue; }
      const marker = u8[off + 1];
      if (marker === 0xe0 && u8[off + 4] === 0x4a && u8[off + 5] === 0x46 && u8[off + 6] === 0x49 && u8[off + 7] === 0x46) {
        const units = u8[off + 11];
        const x = (u8[off + 12] << 8) | u8[off + 13];
        if (units === 1) return x;                    // already DPI
        if (units === 2) return Math.round(x * 2.54); // dots per cm
        return null;
      }
      if (marker === 0xda || marker === 0xd9) break;
      off += 2 + ((u8[off + 2] << 8) | u8[off + 3]);
    }
  }
  // PNG / pHYs
  if (u8[0] === 0x89 && u8[1] === 0x50) {
    let off = 8;
    while (off + 8 <= u8.length) {
      const len = ((u8[off] << 24) | (u8[off + 1] << 16) | (u8[off + 2] << 8) | u8[off + 3]) >>> 0;
      const type = String.fromCharCode(u8[off + 4], u8[off + 5], u8[off + 6], u8[off + 7]);
      if (type === "pHYs") {
        const ppm = ((u8[off + 8] << 24) | (u8[off + 9] << 16) | (u8[off + 10] << 8) | u8[off + 11]) >>> 0;
        const unit = u8[off + 16];
        return unit === 1 ? Math.round(ppm * 0.0254) : null;
      }
      if (type === "IDAT" || type === "IEND") break;
      off += 12 + len;
    }
  }
  return null;
}

let src = null, originalDpi = null;

mountTool({
  id: "image-dpi",
  title: "Image DPI",
  desc: "Set or change the print resolution stored in an image, from 40 to 5000 DPI — and optionally resample it so it prints at an exact physical size.",
  accept: "image/*",
  multiple: false,
  action: "Set DPI",
  options: [
    { name: "dpi", label: "Resolution (DPI, 40–5000)", type: "number", value: 300, min: 40, max: 5000, step: 10 },
    { name: "mode", label: "Mode", type: "select", value: "tag", options: [
      ["tag", "Tag only — keep the pixels, change the DPI"],
      ["resample", "Resample — resize to a print width at this DPI"],
    ] },
    { name: "widthmm", label: "Print width (mm) — resample mode", type: "number", value: 150, min: 10, max: 3000 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.95, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    const head = new Uint8Array(await ctx.files[0].slice(0, 4096).arrayBuffer());
    originalDpi = readDpi(head);
    if (originalDpi) {
      const el = document.getElementById("opt-dpi");
      if (el && originalDpi >= 40 && originalDpi <= 5000) el.value = originalDpi;
    }
    ctx.extra.innerHTML = `<p class="hint" id="dinfo"></p>`;
    const paint = () => {
      const dpi = ctx.clampDpi(document.getElementById("opt-dpi")?.value);
      const mode = document.getElementById("opt-mode")?.value || "tag";
      const widthmm = Number(document.getElementById("opt-widthmm")?.value || 150);
      let w = src.width, h = src.height;
      if (mode === "resample") {
        w = ctx.mmToPx(widthmm, dpi);
        h = Math.round(src.height * (w / src.width));
      }
      const err = ctx.checkRaster(w, h);
      const mm = (px, d) => (px / d * 25.4).toFixed(1);
      ctx.extra.querySelector("#dinfo").innerHTML =
        `Image is ${src.width}×${src.height}px. Stored DPI: <b>${originalDpi ? originalDpi + " DPI" : "none (unknown)"}</b>. ` +
        (mode === "tag"
          ? `Keeping the pixels; the file will report <b>${dpi} DPI</b>, i.e. a print size of ${mm(w, dpi)}×${mm(h, dpi)} mm.`
          : (err ? `<span style="color:var(--danger)">Resampling to ${w}×${h}px is too large for a browser tab.</span>`
                 : `Resampling to <b>${w}×${h}px</b> so it prints ${widthmm} mm wide at ${dpi} DPI.`));
    };
    ["dpi", "mode", "widthmm"].forEach((n) => {
      const el = document.getElementById("opt-" + n);
      if (el) { el.addEventListener("input", paint); el.addEventListener("change", paint); }
    });
    paint();
  },
  onReset() { src = null; originalDpi = null; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    const o = ctx.options;
    const dpi = ctx.clampDpi(o.dpi);
    const mime = mimeOf(o.format);
    let out = src;
    if (o.mode === "resample") {
      const w = ctx.mmToPx(o.widthmm, dpi);
      const h = Math.round(src.height * (w / src.width));
      const err = ctx.checkRaster(w, h);
      if (err) throw new Error(err + " Reduce the print width or the DPI.");
      out = ctx.canvasOf(w, h);
      const g = out.getContext("2d");
      if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); }
      g.imageSmoothingQuality = "high";
      g.drawImage(src, 0, 0, w, h);
    } else if (o.format !== "png") {
      out = ctx.canvasFrom(src, "#fff");
    }
    const blob = await ctx.canvasBlob(out, mime, Number(o.quality) || 0.95);
    const u8 = ctx.withDpi(new Uint8Array(await blob.arrayBuffer()), mime, dpi);
    ctx.download(new Blob([u8], { type: mime }), `dpi-${dpi}.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Saved ${out.width}×${out.height}px tagged at <b>${dpi} DPI</b> — a print size of ${(out.width / dpi * 25.4).toFixed(1)}×${(out.height / dpi * 25.4).toFixed(1)} mm.${o.format === "webp" ? " WebP has no standard DPI field, so nothing was written." : ""}</p>`;
  },
  help: "<p>DPI is a number stored in the file that tells a printer how large to make the image — it does not change the pixels. <b>Tag only</b> just rewrites that number, which is what you want when a print shop asks for a 300 DPI file. <b>Resample</b> goes further and changes the actual pixel count so the image really does have that resolution at the size you want.</p>",
});
