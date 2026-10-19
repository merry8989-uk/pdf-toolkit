import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null;

function vignette(canvas, amount, softness, colour) {
  const out = ctxCopy(canvas);
  const g = out.getContext("2d");
  const inner = Math.min(out.width, out.height) * softness;
  const outer = Math.max(out.width, out.height) * 0.75;
  const grad = g.createRadialGradient(out.width / 2, out.height / 2, inner, out.width / 2, out.height / 2, outer);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, colour);
  g.fillStyle = grad;
  g.fillRect(0, 0, out.width, out.height);
  return out;
}
function ctxCopy(c) {
  const o = document.createElement("canvas");
  o.width = c.width; o.height = c.height;
  o.getContext("2d").drawImage(c, 0, 0);
  return o;
}

mountTool({
  id: "vignette",
  title: "Vignette",
  desc: "Darken (or lighten) the edges of a photo to draw the eye to the centre.",
  accept: "image/*",
  multiple: false,
  action: "Apply vignette",
  options: [
    { name: "amount", label: "Strength", type: "range", value: 0.55, min: 0.1, max: 1, step: 0.05 },
    { name: "softness", label: "Softness", type: "range", value: 0.35, min: 0.05, max: 0.9, step: 0.05 },
    { name: "mode", label: "Mode", type: "select", value: "dark", options: [["dark", "Darken edges"], ["light", "Lighten edges"]] },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    const o = ctx.options;
    const amt = Number(o.amount) || 0.55;
    const colour = o.mode === "light" ? `rgba(255,255,255,${amt})` : `rgba(0,0,0,${amt})`;
    const out = vignette(src, amt, Number(o.softness) || 0.35, colour);
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `vignette.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Added a ${o.mode} vignette at ${Math.round(amt * 100)}% strength.</p>`;
  },
  help: "<p>Softness controls where the fall-off begins: a low value keeps the centre clear and darkens only the corners.</p>",
});
