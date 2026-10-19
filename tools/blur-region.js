import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null, picker = null;

function regionEffect(ctx, canvas, r, mode, strength) {
  const out = ctx.canvasFrom(canvas);
  const g = out.getContext("2d");
  const patch = ctx.canvasOf(r.w, r.h);
  const pg = patch.getContext("2d");
  if (mode === "blur") {
    pg.filter = `blur(${Math.max(2, Math.round(Math.max(r.w, r.h) * strength / 12))}px)`;
    pg.drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  } else {
    const block = Math.max(4, Math.round(Math.max(2, (r.w + r.h) / 2 * strength / 40)));
    const small = ctx.canvasOf(Math.max(1, Math.round(r.w / block)), Math.max(1, Math.round(r.h / block)));
    small.getContext("2d").drawImage(canvas, r.x, r.y, r.w, r.h, 0, 0, small.width, small.height);
    pg.imageSmoothingEnabled = false;
    pg.drawImage(small, 0, 0, small.width, small.height, 0, 0, r.w, r.h);
  }
  g.drawImage(patch, r.x, r.y);
  return out;
}

mountTool({
  id: "blur-region",
  title: "Blur or pixelate",
  desc: "Hide part of a photo — a face, a number plate, an address — by blurring or pixelating just that area.",
  accept: "image/*",
  multiple: false,
  action: "Apply",
  options: [
    { name: "mode", label: "Effect", type: "select", value: "blur", options: [["blur", "Blur"], ["pixelate", "Pixelate"]] },
    { name: "strength", label: "Strength", type: "range", value: 6, min: 2, max: 20, step: 1 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    ctx.extra.innerHTML = `<p class="hint">Drag a box over the part you want to hide. Drag again to change it.</p><div id="host"></div>`;
    picker = ctx.regionPicker(ctx, ctx.extra.querySelector("#host"), src);
  },
  onReset() { src = null; picker = null; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    const r = picker && picker.get();
    if (!r) throw new Error("Drag a box over the area to hide.");
    const o = ctx.options;
    const out = regionEffect(ctx, src, r, o.mode, Number(o.strength) || 6);
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `hidden.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ ${o.mode === "blur" ? "Blurred" : "Pixelated"} a ${r.w}×${r.h}px area.</p>`;
  },
  help: "<p>The effect is baked into the exported pixels, so the hidden area cannot be recovered by anyone you send the image to.</p>",
});
