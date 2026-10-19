import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null, view = null, target = null;

function hex2rgb(h) {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || "");
  if (!m) return { r: 255, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function splash(ctx, canvas, colour, tol, keepHue) {
  const t = tol * tol * 3;
  return ctx.pixelMap(canvas, (r, g, b, a) => {
    const dr = r - colour.r, dg = g - colour.g, db = b - colour.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < t) return null;                       // keep the colour
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    return keepHue ? [r * 0.25 + l * 0.75, g * 0.25 + l * 0.75, b * 0.25 + l * 0.75, a] : [l, l, l, a];
  });
}

mountTool({
  id: "colour-splash",
  title: "Selective colour",
  desc: "Keep one colour and drain the rest to black and white — the classic selective-colour effect. Click the photo to choose which colour survives.",
  accept: "image/*",
  multiple: false,
  action: "Apply selective colour",
  options: [
    { name: "color", label: "Colour to keep", type: "text", value: "#ff0000" },
    { name: "tol", label: "Tolerance", type: "range", value: 0.25, min: 0.05, max: 0.8, step: 0.05 },
    { name: "fade", label: "Fade the rest (instead of full B&W)", type: "checkbox", value: false },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    target = hex2rgb(document.getElementById("opt-color")?.value || "#ff0000");
    ctx.extra.innerHTML = `<p class="hint">Click anywhere on the photo to choose the colour that stays.</p><div id="stage"></div>`;
    const stage = ctx.extra.querySelector("#stage");
    const c = ctx.canvasOf(1, 1);
    c.style.cssText = "display:block;border:1px solid var(--line);border-radius:8px;max-width:100%";
    stage.appendChild(c);
    view = ctx.fitCanvas(src, 520);
    c.width = view.width; c.height = view.height;
    c.getContext("2d").drawImage(view, 0, 0);
    c.addEventListener("click", (e) => {
      const r = c.getBoundingClientRect();
      const x = Math.round((e.clientX - r.left) * view.width / r.width);
      const y = Math.round((e.clientY - r.top) * view.height / r.height);
      const d = view.getContext("2d").getImageData(x, y, 1, 1).data;
      target = { r: d[0], g: d[1], b: d[2] };
      const el = document.getElementById("opt-color");
      if (el) el.value = ctx.rgbToHex(target.r, target.g, target.b);
      ctx.toast(`Keeping ${ctx.rgbToHex(target.r, target.g, target.b)}`);
    });
  },
  onReset() { src = null; target = null; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    const o = ctx.options;
    if (!target) target = hex2rgb(o.color);
    const out = splash(ctx, src, target, Number(o.tol) || 0.25, !!o.fade);
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `selective-colour.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Kept ${ctx.rgbToHex(target.r, target.g, target.b)} and drained the rest.</p>`;
  },
  help: "<p>Pixels close to the chosen colour keep their colour; everything else becomes grey (or faded, if you tick that box). Raise the tolerance to keep a wider range of similar shades.</p>",
});
