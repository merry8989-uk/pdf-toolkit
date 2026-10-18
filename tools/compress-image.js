import { mountTool } from "../app.js";

mountTool({
  id: "compress-image",
  title: "Compress image",
  desc: "Shrink a photo by re-encoding it and optionally capping its dimensions.",
  accept: "image/*",
  multiple: false,
  action: "Compress image",
  options: [
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: [["jpeg", "JPG"], ["webp", "WebP"], ["png", "PNG"]] },
    { name: "quality", label: "Quality", type: "range", value: 0.75, min: 0.2, max: 0.95, step: 0.05 },
    { name: "maxw", label: "Max width (px, 0 = keep)", type: "number", value: 2000, min: 0, max: 12000 },
  ],
  async run(ctx) {
    const o = ctx.options;
    const img = await ctx.fileToImage(ctx.files[0]);
    let w = img.naturalWidth, h = img.naturalHeight;
    const maxw = Number(o.maxw) || 0;
    if (maxw && w > maxw) { h = Math.round(h * maxw / w); w = maxw; }
    const c = ctx.canvasOf(w, h);
    const g = c.getContext("2d");
    if (o.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); }
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, w, h);
    const mime = o.format === "png" ? "image/png" : o.format === "webp" ? "image/webp" : "image/jpeg";
    const blob = await ctx.canvasBlob(c, mime, Number(o.quality) || 0.75);
    const before = ctx.files[0].size;
    const pct = before ? Math.round((1 - blob.size / before) * 100) : 0;
    ctx.download(blob, `compressed.${o.format === "jpeg" ? "jpg" : o.format}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ ${ctx.fmtSize(before)} → <b>${ctx.fmtSize(blob.size)}</b> (${pct >= 0 ? "saved " + pct + "%" : "grew " + Math.abs(pct) + "%"}), now ${w}×${h}px.</p>`;
  },
  help: "<p>Photos are re-encoded at your chosen quality, and downscaled if they are wider than the cap. Very large photos are often already compressed, so savings vary.</p>",
});
