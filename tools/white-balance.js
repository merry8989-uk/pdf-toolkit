import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null, view = null;

const clamp = (v) => v < 0 ? 0 : v > 255 ? 255 : v;

function greyWorld(canvas, strength) {
  const d = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 40) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  r /= n; g /= n; b /= n;
  const avg = (r + g + b) / 3;
  const kr = 1 + (avg / (r || 1) - 1) * strength;
  const kg = 1 + (avg / (g || 1) - 1) * strength;
  const kb = 1 + (avg / (b || 1) - 1) * strength;
  return { kr, kg, kb };
}

mountTool({
  id: "white-balance",
  title: "Auto white balance",
  desc: "Fix a colour cast automatically — indoor yellow, shade blue, or fluorescent green. One click, with a strength control.",
  accept: "image/*",
  multiple: false,
  action: "Correct white balance",
  options: [
    { name: "strength", label: "Correction strength", type: "range", value: 0.7, min: 0.1, max: 1, step: 0.05 },
    { name: "warm", label: "Fine tune (cool → warm)", type: "range", value: 0, min: -50, max: 50, step: 5 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    ctx.extra.innerHTML = `<p class="hint">Live preview of the automatic correction.</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
        <div><div class="hint" style="margin:0 0 5px">Before</div><canvas id="pvA" style="max-width:280px;border:1px solid var(--line);border-radius:8px;display:block"></canvas></div>
        <div><div class="hint" style="margin:0 0 5px">After</div><canvas id="pvB" style="max-width:280px;border:1px solid var(--line);border-radius:8px;display:block"></canvas></div>
      </div>`;
    view = ctx.fitCanvas(src, 300);
    const a = ctx.extra.querySelector("#pvA");
    a.width = view.width; a.height = view.height;
    a.getContext("2d").drawImage(view, 0, 0);
    const update = () => {
      const strength = Number(document.getElementById("opt-strength")?.value ?? 0.7);
      const warm = Number(document.getElementById("opt-warm")?.value ?? 0);
      const { kr, kg, kb } = greyWorld(view, strength);
      const out = ctx.pixelMap(view, (r, g, b, al) => [
        clamp(r * kr + warm * 0.5), clamp(g * kg), clamp(b * kb - warm * 0.5), al,
      ]);
      const b2 = ctx.extra.querySelector("#pvB");
      b2.width = out.width; b2.height = out.height;
      b2.getContext("2d").drawImage(out, 0, 0);
    };
    ["strength", "warm"].forEach((n) => {
      const el = document.getElementById("opt-" + n);
      if (el) el.addEventListener("input", update);
    });
    update();
  },
  onReset() { src = null; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    const o = ctx.options;
    const strength = Number(o.strength) || 0.7;
    const warm = Number(o.warm) || 0;
    const { kr, kg, kb } = greyWorld(src, strength);
    const out = ctx.pixelMap(src, (r, g, b, a) => [
      clamp(r * kr + warm * 0.5), clamp(g * kg), clamp(b * kb - warm * 0.5), a,
    ]);
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `white-balanced.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Applied an automatic white balance (red ×${kr.toFixed(2)}, green ×${kg.toFixed(2)}, blue ×${kb.toFixed(2)}).</p>`;
  },
  help: "<p>The grey-world assumption is that, averaged out, a scene should be neutral grey — so any overall colour bias is treated as a cast and removed. It works well on most photos but can over-correct a deliberately warm sunset.</p>",
});
