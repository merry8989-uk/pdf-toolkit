import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "glitch",
  title: "Glitch effect",
  desc: "Add an RGB-split, datamosh style glitch for a broken-signal aesthetic.",
  accept: "image/*",
  multiple: false,
  action: "Apply glitch",
  options: [
    { name: "shift", label: "Channel shift (px)", type: "number", value: 12, min: 1, max: 120 },
    { name: "slices", label: "Slice displacement", type: "range", value: 0.4, min: 0, max: 1, step: 0.05 },
    { name: "scanlines", label: "Add scanlines", type: "checkbox", value: true },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const base = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    base.getContext("2d").drawImage(img, 0, 0);
    const o = ctx.options;
    const w = base.width, h = base.height;
    const src = base.getContext("2d").getImageData(0, 0, w, h).data;
    const shift = Math.max(1, Math.round(Number(o.shift) || 12));
    const sliceAmt = Number(o.slices) || 0;

    // random row displacements
    const rowOff = new Int32Array(h);
    let band = -1, off = 0;
    for (let y = 0; y < h; y++) {
      if (band < 0 && Math.random() < sliceAmt * 0.08) { band = 4 + Math.floor(Math.random() * 24); off = Math.round((Math.random() - 0.5) * w * 0.06); }
      if (band > 0) { rowOff[y] = off; band--; }
    }

    const out = ctx.canvasOf(w, h);
    const g = out.getContext("2d");
    const d = g.createImageData(w, h);
    const a = d.data;
    for (let y = 0; y < h; y++) {
      const ro = rowOff[y];
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const xr = Math.min(w - 1, Math.max(0, x + shift + ro));
        const xb = Math.min(w - 1, Math.max(0, x - shift + ro));
        const ir = (y * w + xr) * 4, ib = (y * w + xb) * 4;
        a[i] = src[ir];
        a[i + 1] = src[i + 1];
        a[i + 2] = src[ib + 2];
        a[i + 3] = 255;
      }
    }
    g.putImageData(d, 0, 0);

    if (o.scanlines) {
      g.globalAlpha = 0.16;
      g.fillStyle = "#000";
      for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
      g.globalAlpha = 1;
    }

    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `glitch.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Applied the glitch effect (shift ${shift}px${o.scanlines ? ", scanlines" : ""}).</p>`;
  },
  help: "<p>The red channel is pushed right and the blue channel left to create the colour fringing; random row bands shift sideways for the datamosh look. Each run is slightly different.</p>",
});
