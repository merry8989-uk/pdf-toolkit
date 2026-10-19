import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null, picker = null;

mountTool({
  id: "remove-object",
  title: "Remove object",
  desc: "Draw a box around something you want gone. The area is filled from the pixels around it and softened, so small objects on simple backgrounds disappear.",
  accept: "image/*",
  multiple: false,
  action: "Remove object",
  options: [
    { name: "feather", label: "Softening", type: "range", value: 0.5, min: 0.1, max: 1, step: 0.1 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    ctx.extra.innerHTML = `<p class="hint">Drag a box over the object you want to remove.</p><div id="host"></div>`;
    picker = ctx.regionPicker(ctx, ctx.extra.querySelector("#host"), src);
  },
  onReset() { src = null; picker = null; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    const r = picker && picker.get();
    if (!r) throw new Error("Drag a box over the object you want to remove.");
    const feather = Number(ctx.options.feather) || 0.5;
    const out = ctx.canvasFrom(src);
    const g = out.getContext("2d");
    const pad = Math.max(6, Math.round(Math.max(r.w, r.h) * 0.2));
    const sx = Math.max(0, r.x - pad), sy = Math.max(0, r.y - pad);
    const sw = Math.min(src.width - sx, r.w + pad * 2), sh = Math.min(src.height - sy, r.h + pad * 2);

    // 1) smear the surrounding pixels into the selection from all four sides
    if (r.x >= 1) g.drawImage(src, r.x - 1, r.y, 1, r.h, r.x, r.y, r.w, r.h);
    if (r.x + r.w < src.width - 1) g.drawImage(src, r.x + r.w + 1, r.y, 1, r.h, r.x, r.y, r.w, r.h);
    if (r.y >= 1) g.drawImage(src, r.x, r.y - 1, r.w, 1, r.x, r.y, r.w, r.h);
    if (r.y + r.h < src.height - 1) g.drawImage(src, r.x, r.y + r.h + 1, r.w, 1, r.x, r.y, r.w, r.h);

    // 2) blur the patched area so the smear reads as a soft fill
    const patch = ctx.canvasOf(sw, sh);
    const pg = patch.getContext("2d");
    pg.filter = `blur(${Math.max(3, Math.round(pad * feather))}px)`;
    pg.drawImage(out, sx, sy, sw, sh, 0, 0, sw, sh);
    g.drawImage(patch, sx, sy);

    const o = ctx.options;
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `object-removed.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Filled the selection (${r.w}×${r.h}px) from its surroundings.</p>`;
  },
  help: "<p>This is a model-free approximation, not AI inpainting: it stretches the pixels bordering your selection inward and blurs them. On grass, sky, walls and plain backgrounds the object disappears convincingly; on detailed backgrounds you may need to repeat it in smaller pieces.</p>",
});
