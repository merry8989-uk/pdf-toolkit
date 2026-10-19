import { mountTool } from "../app.js";

mountTool({
  id: "strip-exif",
  title: "Strip metadata",
  desc: "Remove EXIF metadata from a photo — camera details, timestamps and any location data — by re-encoding the pixels.",
  accept: "image/*",
  multiple: false,
  action: "Strip metadata",
  options: [
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]] },
    { name: "quality", label: "Quality", type: "range", value: 0.95, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const f = ctx.files[0];
    const before = await ctx.readExif(f);
    const n = Object.keys(before).length;
    const img = await ctx.fileToImage(f);
    const out = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    const g = out.getContext("2d");
    if (ctx.options.format !== "png") { g.fillStyle = "#fff"; g.fillRect(0, 0, out.width, out.height); }
    g.drawImage(img, 0, 0);
    const mime = ctx.options.format === "png" ? "image/png" : ctx.options.format === "webp" ? "image/webp" : "image/jpeg";
    const blob = await ctx.canvasBlob(out, mime, Number(ctx.options.quality) || 0.95);
    ctx.download(blob, `clean.${ctx.options.format === "jpeg" ? "jpg" : ctx.options.format}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Re-encoded the photo without metadata. ${n ? `${n} field(s) removed (including any camera and location data).` : "It had no EXIF metadata to begin with."} Output is ${out.width}×${out.height}px.</p>`;
  },
  help: "<p>The image is redrawn onto a fresh canvas and re-encoded, which drops all EXIF, GPS and thumbnail data — the pixels are identical, but the identifying information is gone. Orientation is baked in, so the photo still looks the right way up.</p>",
});
