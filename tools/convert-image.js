import { mountTool } from "../app.js";

mountTool({
  id: "convert-image",
  title: "Convert image",
  desc: "Convert a photo between JPG, PNG and WebP.",
  accept: "image/*",
  multiple: false,
  action: "Convert",
  options: [
    { name: "format", label: "Output format", type: "select", value: "png", options: [["png", "PNG (lossless, transparency)"], ["jpeg", "JPG (smaller, no transparency)"], ["webp", "WebP (modern, small)"]] },
    { name: "quality", label: "Quality (JPG / WebP)", type: "range", value: 0.9, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const o = ctx.options;
    const img = await ctx.fileToImage(ctx.files[0]);
    const c = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    const g = c.getContext("2d");
    if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(img, 0, 0);
    const mime = o.format === "png" ? "image/png" : o.format === "webp" ? "image/webp" : "image/jpeg";
    const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.9);
    if (!blob) throw new Error("This browser could not produce that format. Try JPG or PNG.");
    const ext = o.format === "jpeg" ? "jpg" : o.format;
    ctx.download(blob, `converted.${ext}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Converted to ${o.format.toUpperCase()} — ${ctx.fmtSize(blob.size)} (from ${ctx.fmtSize(ctx.files[0].size)}).</p>`;
  },
  help: "<p>PNG keeps transparency; JPG and WebP do not, so a white background is added when converting to those. WebP support depends on your browser.</p>",
});
