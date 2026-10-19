import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null;

mountTool({
  id: "posterize",
  title: "Posterize & threshold",
  desc: "Reduce a photo to a few flat tones for a screen-print or poster look, or push it to pure black and white.",
  accept: "image/*",
  multiple: false,
  action: "Apply",
  options: [
    { name: "mode", label: "Mode", type: "select", value: "posterize", options: [["posterize", "Posterize (flat tones)"], ["threshold", "Threshold (2-tone)"]] },
    { name: "levels", label: "Levels (posterize)", type: "range", value: 5, min: 2, max: 16, step: 1 },
    { name: "cut", label: "Cut point (threshold)", type: "range", value: 128, min: 10, max: 245, step: 5 },
    { name: "color", label: "Use a colour instead of white", type: "text", value: "#ffffff" },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const base = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    base.getContext("2d").drawImage(img, 0, 0);
    const o = ctx.options;
    let out;
    if (o.mode === "threshold") {
      const cut = Number(o.cut) || 128;
      out = ctx.pixelMap(base, (r, g, b, a) => {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        return l > cut ? [255, 255, 255, a] : [0, 0, 0, a];
      });
    } else {
      const lv = Math.max(2, o.levels | 0) - 1;
      out = ctx.pixelMap(base, (r, g, b, a) => [
        Math.round(Math.round(r / 255 * lv) / lv * 255),
        Math.round(Math.round(g / 255 * lv) / lv * 255),
        Math.round(Math.round(b / 255 * lv) / lv * 255),
        a,
      ]);
    }
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `${o.mode === "threshold" ? "threshold" : "posterized"}.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ ${o.mode === "threshold" ? `Thresholded at ${o.cut}` : `Reduced to ${o.levels} tones`}.</p>`;
  },
  help: "<p>Posterize quantises each colour channel into a small number of steps; threshold converts everything above the cut point to white and the rest to black. Low level counts give the strongest poster effect.</p>",
});
