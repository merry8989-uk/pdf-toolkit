import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "film-grain",
  title: "Film grain",
  desc: "Add analogue film grain or digital noise for a textured, less clinical look.",
  accept: "image/*",
  multiple: false,
  action: "Add grain",
  options: [
    { name: "amount", label: "Grain amount", type: "range", value: 0.14, min: 0.02, max: 0.6, step: 0.02 },
    { name: "mono", label: "Monochrome grain", type: "checkbox", value: true },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const base = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    base.getContext("2d").drawImage(img, 0, 0);
    const o = ctx.options;
    const amt = Number(o.amount) || 0.14;
    const out = ctx.pixelMap(base, (r, g, b, a) => {
      if (o.mono) {
        const n = (Math.random() - 0.5) * 255 * amt;
        return [r + n, g + n, b + n, a];
      }
      return [r + (Math.random() - 0.5) * 255 * amt, g + (Math.random() - 0.5) * 255 * amt, b + (Math.random() - 0.5) * 255 * amt, a];
    });
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `grain.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Added ${o.mono ? "monochrome" : "colour"} grain at ${Math.round(amt * 100)}%.</p>`;
  },
  help: "<p>Monochrome grain looks like classic film; colour grain looks more like digital sensor noise. Grain is random, so each run produces a slightly different result.</p>",
});
