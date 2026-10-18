import { mountTool } from "../app.js";

const FMT = [["png", "PNG"], ["jpeg", "JPG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "crop-image",
  title: "Crop image",
  desc: "Trim the edges of a photo by a percentage of its width and height.",
  accept: "image/*",
  multiple: false,
  action: "Crop image",
  options: [
    { name: "top", label: "Trim from top (%)", type: "number", value: 10, min: 0, max: 45 },
    { name: "bottom", label: "Trim from bottom (%)", type: "number", value: 10, min: 0, max: 45 },
    { name: "left", label: "Trim from left (%)", type: "number", value: 10, min: 0, max: 45 },
    { name: "right", label: "Trim from right (%)", type: "number", value: 10, min: 0, max: 45 },
    { name: "format", label: "Output format", type: "select", value: "png", options: FMT },
    { name: "quality", label: "Quality (JPG / WebP)", type: "range", value: 0.9, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const o = ctx.options;
    const img = await ctx.fileToImage(ctx.files[0]);
    const W = img.naturalWidth, H = img.naturalHeight;
    const t = +o.top / 100, b = +o.bottom / 100, l = +o.left / 100, r = +o.right / 100;
    if (l + r >= 1 || t + b >= 1) throw new Error("Those percentages would leave nothing behind.");
    const sx = W * l, sy = H * t;
    const sw = W * (1 - l - r), sh = H * (1 - t - b);
    const c = ctx.canvasOf(sw, sh);
    const g = c.getContext("2d");
    if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.9);
    ctx.download(blob, `cropped.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ ${W}×${H}px → <b>${c.width}×${c.height}px</b>.</p>`;
  },
  help: "<p>Percentages are measured from each edge, so 10% on all four sides trims a 10% border from the whole image.</p>",
});
