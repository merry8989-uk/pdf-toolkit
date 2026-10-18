import { mountTool } from "../app.js";

const FMT = [["png", "PNG"], ["jpeg", "JPG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "resize-image",
  title: "Resize image",
  desc: "Change an image's dimensions by percentage or to an exact width.",
  accept: "image/*",
  multiple: false,
  action: "Resize image",
  options: [
    { name: "mode", label: "Resize by", type: "select", value: "percent", options: [["percent", "Percentage"], ["width", "Exact width"]] },
    { name: "percent", label: "Percentage (%)", type: "number", value: 50, min: 1, max: 400 },
    { name: "width", label: "Width (px)", type: "number", value: 1200, min: 1, max: 12000 },
    { name: "format", label: "Output format", type: "select", value: "png", options: FMT },
    { name: "quality", label: "Quality (JPG / WebP)", type: "range", value: 0.9, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const o = ctx.options;
    const img = await ctx.fileToImage(ctx.files[0]);
    const sw = img.naturalWidth, sh = img.naturalHeight;
    let w, h;
    if (o.mode === "percent") { const p = (Number(o.percent) || 100) / 100; w = Math.round(sw * p); h = Math.round(sh * p); }
    else { w = Number(o.width) || sw; h = Math.round(sh * (w / sw)); }
    if (w < 1 || h < 1) throw new Error("That size is too small.");
    const c = ctx.canvasOf(w, h);
    const g = c.getContext("2d");
    if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); }
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, w, h);
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.9);
    ctx.download(blob, `resized.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ ${sw}×${sh}px → <b>${w}×${h}px</b> (${ctx.fmtSize(blob.size)}). Aspect ratio preserved.</p>`;
  },
  help: "<p>The aspect ratio is always kept, so you only need to give one dimension. Resizing up does not add detail — it just enlarges the pixels.</p>",
});
