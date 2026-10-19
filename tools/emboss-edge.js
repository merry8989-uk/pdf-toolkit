import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

function convolve(ctx, canvas, kernel, bias, gray) {
  const w = canvas.width, h = canvas.height;
  const src = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  const out = ctx.canvasOf(w, h);
  const g = out.getContext("2d");
  const d = g.createImageData(w, h);
  const a = d.data;
  const cl = (v) => v < 0 ? 0 : v > 255 ? 255 : v;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      let r = 0, gg = 0, b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const j = ((y + ky) * w + (x + kx)) * 4;
          const k = kernel[(ky + 1) * 3 + (kx + 1)];
          r += src[j] * k; gg += src[j + 1] * k; b += src[j + 2] * k;
        }
      }
      r = cl(r + bias); gg = cl(gg + bias); b = cl(b + bias);
      if (gray) { const l = 0.299 * r + 0.587 * gg + 0.114 * b; r = gg = b = l; }
      a[i] = r; a[i + 1] = gg; a[i + 2] = b; a[i + 3] = 255;
    }
  }
  g.putImageData(d, 0, 0);
  return out;
}

mountTool({
  id: "emboss-edge",
  title: "Emboss & edge detect",
  desc: "Turn a photo into a relief emboss or a clean edge map — useful for textures, overlays and stencils.",
  accept: "image/*",
  multiple: false,
  action: "Apply",
  options: [
    { name: "mode", label: "Effect", type: "select", value: "emboss", options: [["emboss", "Emboss"], ["edge", "Edge detect"], ["outline", "Thin outline"]] },
    { name: "strength", label: "Strength", type: "range", value: 1, min: 0.4, max: 2, step: 0.1 },
    { name: "gray", label: "Greyscale result", type: "checkbox", value: true },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const base = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    base.getContext("2d").drawImage(img, 0, 0);
    const o = ctx.options;
    const k = Number(o.strength) || 1;
    let kernel, bias = 0;
    if (o.mode === "emboss") { kernel = [-2 * k, -k, 0, -k, 1, k, 0, k, 2 * k]; bias = 128; }
    else if (o.mode === "edge") { kernel = [0, -k, 0, -k, 4 * k, -k, 0, -k, 0]; }
    else { kernel = [-k, -k, -k, -k, 8 * k, -k, -k, -k, -k]; }
    const out = convolve(ctx, base, kernel, bias, !!o.gray);
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `${o.mode}.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Applied the ${o.mode} effect at strength ${k}.</p>`;
  },
  help: "<p>All three effects are 3×3 convolutions: emboss highlights directional relief, edge detect finds boundaries, and the thin outline gives a fine stencil-style line drawing.</p>",
});
