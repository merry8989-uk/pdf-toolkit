import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null, view = null;

const clamp = (v) => v < 0 ? 0 : v > 255 ? 255 : v;

function balance(ctx, canvas, o) {
  const ev = Math.pow(2, Number(o.exposure) || 0);
  const temp = (Number(o.temperature) || 0) / 100;
  const tint = (Number(o.tint) || 0) / 100;
  const gamma = Math.max(0.2, Number(o.gamma) || 1);
  const inv = 1 / gamma;
  return ctx.pixelMap(canvas, (r, g, b, a) => [
    clamp(Math.pow(clamp(r / 255 * ev + temp * 0.28) / 1, inv) * 255),
    clamp(Math.pow(clamp(g / 255 * ev + tint * 0.18) / 1, inv) * 255),
    clamp(Math.pow(clamp(b / 255 * ev - temp * 0.28) / 1, inv) * 255),
    a,
  ]);
}

mountTool({
  id: "colour-balance",
  title: "Colour balance",
  desc: "Correct a photo's colour and light: exposure, temperature (warm/cool), tint (green/magenta) and gamma.",
  accept: "image/*",
  multiple: false,
  action: "Apply correction",
  options: [
    { name: "exposure", label: "Exposure (stops)", type: "range", value: 0, min: -2, max: 2, step: 0.1 },
    { name: "temperature", label: "Temperature (cool → warm)", type: "range", value: 0, min: -100, max: 100, step: 5 },
    { name: "tint", label: "Tint (magenta → green)", type: "range", value: 0, min: -100, max: 100, step: 5 },
    { name: "gamma", label: "Gamma", type: "range", value: 1, min: 0.4, max: 2.2, step: 0.05 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    ctx.extra.innerHTML = `<p class="hint">Live preview — drag a slider to correct the photo.</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
        <div><div class="hint" style="margin:0 0 5px">Original</div><canvas id="pvA" style="max-width:280px;border:1px solid var(--line);border-radius:8px;display:block"></canvas></div>
        <div><div class="hint" style="margin:0 0 5px">Corrected</div><canvas id="pvB" style="max-width:280px;border:1px solid var(--line);border-radius:8px;display:block"></canvas></div>
      </div>
      <div class="row" style="margin-top:10px"><button class="btn ghost sm" id="rst" type="button">Reset</button></div>`;
    view = ctx.fitCanvas(src, 300);
    const a = ctx.extra.querySelector("#pvA");
    a.width = view.width; a.height = view.height;
    a.getContext("2d").drawImage(view, 0, 0);
    const update = () => {
      const v = (n, d) => Number(document.getElementById("opt-" + n)?.value ?? d);
      const out = balance(ctx, view, { exposure: v("exposure", 0), temperature: v("temperature", 0), tint: v("tint", 0), gamma: v("gamma", 1) });
      const b = ctx.extra.querySelector("#pvB");
      b.width = out.width; b.height = out.height;
      b.getContext("2d").drawImage(out, 0, 0);
    };
    ["exposure", "temperature", "tint", "gamma"].forEach((n) => {
      const el = document.getElementById("opt-" + n);
      if (el) el.addEventListener("input", update);
    });
    ctx.extra.querySelector("#rst").addEventListener("click", () => {
      [["exposure", 0], ["temperature", 0], ["tint", 0], ["gamma", 1]].forEach(([n, d]) => {
        const el = document.getElementById("opt-" + n);
        if (el) el.value = d;
      });
      update();
    });
    update();
  },
  onReset() { src = null; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    const o = ctx.options;
    const out = balance(ctx, src, o);
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `balanced.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Applied the colour correction at full resolution.</p>`;
  },
  help: "<p>Exposure works in photographic stops (±2). Temperature shifts red against blue, tint shifts green against magenta, and gamma adjusts midtones without touching the black or white points.</p>",
});
