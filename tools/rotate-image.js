import { mountTool } from "../app.js";

const FMT = [["png", "PNG"], ["jpeg", "JPG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "rotate-image",
  title: "Rotate & flip",
  desc: "Rotate a photo by 90°, 180° or 270°, and mirror it horizontally or vertically.",
  accept: "image/*",
  multiple: false,
  action: "Apply",
  options: [
    { name: "angle", label: "Rotation", type: "select", value: "90", options: [["0", "None"], ["90", "90° clockwise"], ["180", "180°"], ["270", "270° (90° anti-clockwise)"]] },
    { name: "flipH", label: "Mirror horizontally", type: "checkbox", value: false },
    { name: "flipV", label: "Mirror vertically", type: "checkbox", value: false },
    { name: "format", label: "Output format", type: "select", value: "png", options: FMT },
    { name: "quality", label: "Quality (JPG / WebP)", type: "range", value: 0.9, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const o = ctx.options;
    const img = await ctx.fileToImage(ctx.files[0]);
    const W = img.naturalWidth, H = img.naturalHeight;
    const a = parseInt(o.angle, 10) || 0;
    const swap = a === 90 || a === 270;
    const cw = swap ? H : W, ch = swap ? W : H;
    const c = ctx.canvasOf(cw, ch);
    const g = c.getContext("2d");
    if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, cw, ch); }
    g.translate(cw / 2, ch / 2);
    g.rotate(a * Math.PI / 180);
    g.scale(o.flipH ? -1 : 1, o.flipV ? -1 : 1);
    g.drawImage(img, -W / 2, -H / 2);
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.9);
    ctx.download(blob, `rotated.${extOf(o.format)}`, mime);
    const flips = [o.flipH ? "mirrored horizontally" : "", o.flipV ? "mirrored vertically" : ""].filter(Boolean).join(" and ");
    ctx.out.innerHTML = `<p class="hint">✓ Rotated ${a}°${flips ? ", " + flips : ""}. New size: ${cw}×${ch}px.</p>`;
  },
  help: "<p>Rotation and mirroring are combined in one pass. The output canvas is resized automatically for 90° and 270° rotations.</p>",
});
