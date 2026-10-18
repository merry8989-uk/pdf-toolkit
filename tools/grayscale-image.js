import { mountTool } from "../app.js";

const FMT = [["png", "PNG"], ["jpeg", "JPG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "grayscale-image",
  title: "Grayscale image",
  desc: "Turn a colour photo into black and white.",
  accept: "image/*",
  multiple: false,
  action: "Convert to grayscale",
  options: [
    { name: "amount", label: "Strength (%)", type: "range", value: 100, min: 0, max: 100, step: 5 },
    { name: "format", label: "Output format", type: "select", value: "png", options: FMT },
    { name: "quality", label: "Quality (JPG / WebP)", type: "range", value: 0.9, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const o = ctx.options;
    const img = await ctx.fileToImage(ctx.files[0]);
    const c = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    const g = c.getContext("2d");
    if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
    g.filter = `grayscale(${(Number(o.amount) || 100) / 100})`;
    g.drawImage(img, 0, 0);
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.9);
    ctx.download(blob, `grayscale.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Converted at ${o.amount}% strength — ${c.width}×${c.height}px, ${ctx.fmtSize(blob.size)}.</p>`;
  },
  help: "<p>Uses the browser's standard grayscale filter (a weighted mix of red, green and blue). A strength below 100% leaves a partial colour tint.</p>",
});
