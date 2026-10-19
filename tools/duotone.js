import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null;

function hex2rgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || "");
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

mountTool({
  id: "duotone",
  title: "Duotone",
  desc: "Map a photo's tones onto two colours — the bold two-tone poster look used in design and print.",
  accept: "image/*",
  multiple: false,
  action: "Apply duotone",
  options: [
    { name: "shadow", label: "Shadow colour", type: "text", value: "#1b2a6b" },
    { name: "light", label: "Highlight colour", type: "text", value: "#f2b544" },
    { name: "contrast", label: "Contrast", type: "range", value: 1, min: 0.5, max: 2, step: 0.05 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const base = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    base.getContext("2d").drawImage(img, 0, 0);
    const o = ctx.options;
    const A = hex2rgb(o.shadow), B = hex2rgb(o.light);
    const con = Number(o.contrast) || 1;
    const out = ctx.pixelMap(base, (r, g, b, a) => {
      let l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      l = Math.max(0, Math.min(1, (l - 0.5) * con + 0.5));
      return [A.r + (B.r - A.r) * l, A.g + (B.g - A.g) * l, A.b + (B.b - A.b) * l, a];
    });
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `duotone.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Mapped the photo onto ${o.shadow} → ${o.light}.</p>`;
  },
  help: "<p>Each pixel's brightness is used to mix between the shadow and highlight colours. Raise the contrast for a punchier poster effect.</p>",
});
