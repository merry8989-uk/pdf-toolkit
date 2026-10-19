import { mountTool } from "../app.js";

const FMT = [["png", "PNG (transparent corners)"], ["jpeg", "JPG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "rounded-corners",
  title: "Rounded corners",
  desc: "Round the corners of a photo or add a circular/oval crop — for profile pictures, cards and thumbnails.",
  accept: "image/*",
  multiple: false,
  action: "Apply",
  options: [
    { name: "shape", label: "Shape", type: "select", value: "rounded", options: [["rounded", "Rounded rectangle"], ["circle", "Circle"], ["ellipse", "Ellipse"]] },
    { name: "radius", label: "Corner radius (% of smaller side)", type: "range", value: 12, min: 1, max: 50, step: 1 },
    { name: "bg", label: "Fill outside with (leave blank for transparent)", type: "text", value: "" },
    { name: "format", label: "Output format", type: "select", value: "png", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.95, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const W = img.naturalWidth, H = img.naturalHeight;
    const o = ctx.options;
    const out = ctx.canvasOf(W, H);
    const g = out.getContext("2d");
    if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, W, H); }
    const r = Math.min(W, H) * (Number(o.radius) || 12) / 100;
    g.save();
    g.beginPath();
    if (o.shape === "circle") g.arc(W / 2, H / 2, Math.min(W, H) / 2, 0, Math.PI * 2);
    else if (o.shape === "ellipse") g.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2);
    else {
      const rr = Math.min(r, W / 2, H / 2);
      g.moveTo(rr, 0);
      g.arcTo(W, 0, W, H, rr);
      g.arcTo(W, H, 0, H, rr);
      g.arcTo(0, H, 0, 0, rr);
      g.arcTo(0, 0, W, 0, rr);
      g.closePath();
    }
    g.clip();
    g.drawImage(img, 0, 0);
    g.restore();
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, o.bg || "#ffffff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.95);
    ctx.download(blob, `rounded.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Applied a ${o.shape} crop${o.bg ? "" : " with transparent corners (PNG)"}.</p>`;
  },
  help: "<p>Transparent corners need PNG or WebP — JPG has no transparency, so the outside is filled instead. Use a radius of 50% on the shorter side for a full pill or circle.</p>",
});
