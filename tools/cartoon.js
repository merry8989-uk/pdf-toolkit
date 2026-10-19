import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "cartoon",
  title: "Cartoon effect",
  desc: "Flatten a photo into bold cartoon colours with outlined edges.",
  accept: "image/*",
  multiple: false,
  action: "Cartoonize",
  options: [
    { name: "levels", label: "Colour levels", type: "range", value: 6, min: 3, max: 12, step: 1 },
    { name: "edge", label: "Outline strength", type: "range", value: 0.7, min: 0.1, max: 1, step: 0.1 },
    { name: "smooth", label: "Smooth before outlining", type: "checkbox", value: true },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    let base = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    base.getContext("2d").drawImage(img, 0, 0);
    const o = ctx.options;

    if (o.smooth) {
      const s = ctx.canvasOf(base.width, base.height);
      const sg = s.getContext("2d");
      sg.filter = "blur(2px)";
      sg.drawImage(base, 0, 0);
      base = s;
    }

    const lv = Math.max(2, o.levels | 0) - 1;
    const flat = ctx.pixelMap(base, (r, g, b, a) => [
      Math.round(Math.round(r / 255 * lv) / lv * 255),
      Math.round(Math.round(g / 255 * lv) / lv * 255),
      Math.round(Math.round(b / 255 * lv) / lv * 255),
      a,
    ]);

    // edge map from the smoothed image
    const w = base.width, h = base.height;
    const src = base.getContext("2d").getImageData(0, 0, w, h).data;
    const out = ctx.canvasFrom(flat);
    const g = out.getContext("2d");
    const d = g.getImageData(0, 0, w, h);
    const a = d.data;
    const lum = (i) => 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
    const k = Number(o.edge) || 0.7;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        const gx = -lum(i - 4) + lum(i + 4);
        const gy = -lum(i - w * 4) + lum(i + w * 4);
        const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy) * 1.4);
        const dark = 1 - (mag / 255) * k;
        a[i] = a[i] * dark; a[i + 1] = a[i + 1] * dark; a[i + 2] = a[i + 2] * dark;
      }
    }
    g.putImageData(d, 0, 0);

    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `cartoon.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Cartoonized with ${o.levels} colour levels.</p>`;
  },
  help: "<p>The photo is blurred slightly, reduced to a few flat colour levels, then the edges are darkened on top. Fewer levels and a stronger outline give a bolder comic look.</p>",
});
