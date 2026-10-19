import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

function sobel(ctx, canvas, strength, invert) {
  const w = canvas.width, h = canvas.height;
  const src = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  const out = ctx.canvasOf(w, h);
  const g = out.getContext("2d");
  const img = g.createImageData(w, h);
  const lum = (i) => 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const gx = -lum(i - 4 - w * 4) - 2 * lum(i - 4) - lum(i - 4 + w * 4) + lum(i + 4 - w * 4) + 2 * lum(i + 4) + lum(i + 4 + w * 4);
      const gy = -lum(i - w * 4 - 4) - 2 * lum(i - w * 4) - lum(i - w * 4 + 4) + lum(i + w * 4 - 4) + 2 * lum(i + w * 4) + lum(i + w * 4 + 4);
      const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy) * strength);
      const v = invert ? 255 - mag : mag;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return out;
}

mountTool({
  id: "sketch",
  title: "Pencil sketch",
  desc: "Turn a photo into a pencil or ink sketch using edge detection.",
  accept: "image/*",
  multiple: false,
  action: "Make sketch",
  options: [
    { name: "style", label: "Style", type: "select", value: "pencil", options: [["pencil", "Pencil (light on white)"], ["ink", "Ink (dark lines on white)"], ["edges", "Edge map (lines on black)"]] },
    { name: "strength", label: "Line strength", type: "range", value: 1.6, min: 0.4, max: 4, step: 0.2 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const base = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    base.getContext("2d").drawImage(img, 0, 0);
    const o = ctx.options;
    const invert = o.style !== "edges";
    let out = sobel(ctx, base, Number(o.strength) || 1.6, invert);
    if (o.style === "ink") {
      out = ctx.pixelMap(out, (r, g, b, a) => {
        const v = r < 190 ? 0 : 255;
        return [v, v, v, a];
      });
    }
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `sketch.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Made a ${o.style} sketch.</p>`;
  },
  help: "<p>Edges are found with a Sobel operator. Increase the line strength for bolder lines; the ink style thresholds the result for a two-tone drawing.</p>",
});
