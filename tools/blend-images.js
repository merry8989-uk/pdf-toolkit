import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "blend-images",
  title: "Blend images",
  desc: "Blend two photos together with a blend mode — the basis of double exposure, texture overlays and ghostly composites.",
  accept: "image/*",
  multiple: true,
  reorder: true,
  action: "Blend",
  options: [
    { name: "mode", label: "Blend mode", type: "select", value: "overlay", options: [
      ["multiply", "Multiply"], ["screen", "Screen"], ["overlay", "Overlay"], ["soft-light", "Soft light"],
      ["hard-light", "Hard light"], ["difference", "Difference"], ["lighten", "Lighten"], ["darken", "Darken"],
      ["color-dodge", "Colour dodge"], ["color-burn", "Colour burn"], ["exclusion", "Exclusion"],
    ] },
    { name: "opacity", label: "Second image opacity", type: "range", value: 0.7, min: 0.05, max: 1, step: 0.05 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    if (ctx.files.length < 2) throw new Error("Add two images to blend.");
    const o = ctx.options;
    const a = await ctx.fileToImage(ctx.files[0]);
    const b = await ctx.fileToImage(ctx.files[1]);
    const out = ctx.canvasOf(a.naturalWidth, a.naturalHeight);
    const g = out.getContext("2d");
    g.fillStyle = "#fff";
    g.fillRect(0, 0, out.width, out.height);
    g.drawImage(a, 0, 0);
    // cover-fit the second image over the first
    const r = Math.max(out.width / b.naturalWidth, out.height / b.naturalHeight);
    const w = b.naturalWidth * r, h = b.naturalHeight * r;
    g.globalAlpha = Number(o.opacity) || 0.7;
    g.globalCompositeOperation = o.mode || "overlay";
    g.drawImage(b, (out.width - w) / 2, (out.height - h) / 2, w, h);
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";

    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `blended.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Blended the two images with <b>${o.mode}</b> at ${Math.round((Number(o.opacity) || 0.7) * 100)}%.</p>`;
  },
  help: "<p>The second image is scaled to cover the first, then combined using the blend mode. <b>Multiply</b> darkens, <b>Screen</b> lightens, <b>Overlay</b> and <b>Soft light</b> give the classic double-exposure look.</p>",
});
