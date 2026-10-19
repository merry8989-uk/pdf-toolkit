import { mountTool } from "../app.js";

const FMT = [["png", "PNG"], ["jpeg", "JPG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "drop-shadow",
  title: "Drop shadow",
  desc: "Add a soft drop shadow behind a photo, logo or sticker — for mockups, cards and product shots.",
  accept: "image/*",
  multiple: false,
  action: "Add shadow",
  options: [
    { name: "blur", label: "Shadow softness (px)", type: "range", value: 24, min: 2, max: 100, step: 2 },
    { name: "offsetY", label: "Vertical offset (px)", type: "range", value: 12, min: -60, max: 60, step: 2 },
    { name: "offsetX", label: "Horizontal offset (px)", type: "range", value: 0, min: -60, max: 60, step: 2 },
    { name: "opacity", label: "Shadow opacity", type: "range", value: 0.35, min: 0.05, max: 0.9, step: 0.05 },
    { name: "pad", label: "Padding around image (px)", type: "number", value: 60, min: 0, max: 400 },
    { name: "bg", label: "Background (leave blank for transparent)", type: "text", value: "" },
    { name: "format", label: "Output format", type: "select", value: "png", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.95, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const o = ctx.options;
    const pad = Math.max(0, Number(o.pad) || 0);
    const W = img.naturalWidth + pad * 2, H = img.naturalHeight + pad * 2;
    const out = ctx.canvasOf(W, H);
    const g = out.getContext("2d");
    if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, W, H); }
    const blur = Number(o.blur) || 24;
    g.save();
    g.shadowColor = `rgba(0,0,0,${Number(o.opacity) || 0.35})`;
    g.shadowBlur = blur;
    g.shadowOffsetX = Number(o.offsetX) || 0;
    g.shadowOffsetY = Number(o.offsetY) || 0;
    g.drawImage(img, pad, pad);
    g.restore();
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, o.bg || "#ffffff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.95);
    ctx.download(blob, `shadowed.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Added a drop shadow — output is ${W}×${H}px.</p>`;
  },
  help: "<p>Padding makes room for the shadow so nothing is clipped. If your image has transparency (a logo or sticker) the shadow follows its outline; otherwise it falls behind the whole rectangle.</p>",
});
