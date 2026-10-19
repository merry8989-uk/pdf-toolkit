import { mountTool } from "../app.js";

const FMT = [["png", "PNG"], ["jpeg", "JPG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "upscale-image",
  title: "Upscale image",
  desc: "Enlarge a photo or graphic with high-quality smoothing. Good for small images that need to be bigger; it adds no detail that was not there.",
  accept: "image/*",
  multiple: false,
  action: "Upscale",
  options: [
    { name: "factor", label: "Scale factor", type: "select", value: "2", options: [["1.5", "1.5×"], ["2", "2×"], ["3", "3×"], ["4", "4×"]] },
    { name: "maxdim", label: "Max output size (px, safety cap)", type: "number", value: 8000, min: 1000, max: 12000 },
    { name: "smooth", label: "Extra smoothing pass", type: "checkbox", value: false },
    { name: "format", label: "Output format", type: "select", value: "png", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.95, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const o = ctx.options;
    const f = parseFloat(o.factor) || 2;
    const cap = Number(o.maxdim) || 8000;
    let W = Math.round(img.naturalWidth * f), H = Math.round(img.naturalHeight * f);
    if (Math.max(W, H) > cap) {
      const k = cap / Math.max(W, H);
      W = Math.round(W * k); H = Math.round(H * k);
    }
    if (W * H > 120_000_000) throw new Error("That would create an image too large to process. Reduce the factor or the cap.");

    const out = ctx.canvasOf(W, H);
    const g = out.getContext("2d");
    if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, W, H); }
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, W, H);
    let final = out;
    if (o.smooth) final = ctx.adjustCanvas(out, { blur: 0.4 });
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(o.format === "png" ? final : ctx.canvasFrom(final, "#fff"), mime, Number(o.quality) || 0.95);
    ctx.download(blob, `upscaled-${f}x.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ ${img.naturalWidth}×${img.naturalHeight}px → <b>${W}×${H}px</b> (${ctx.fmtSize(blob.size)}).</p>`;
  },
  help: "<p>This is high-quality resampling, not AI super-resolution — it enlarges smoothly and keeps edges clean, but it cannot invent detail. For photos that need real detail recovery, a dedicated AI upscaler is the right tool.</p>",
});
