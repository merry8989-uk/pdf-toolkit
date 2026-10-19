import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null, small = null;

const readAdjust = () => ({
  brightness: Number(document.getElementById("opt-brightness")?.value ?? 100),
  contrast: Number(document.getElementById("opt-contrast")?.value ?? 100),
  saturation: Number(document.getElementById("opt-saturation")?.value ?? 100),
  hue: Number(document.getElementById("opt-hue")?.value ?? 0),
  blur: Number(document.getElementById("opt-blur")?.value ?? 0),
  sepia: Number(document.getElementById("opt-sepia")?.value ?? 0),
});

mountTool({
  id: "adjust-image",
  title: "Adjust image",
  desc: "Fine-tune a photo with brightness, contrast, saturation, hue, blur and sepia sliders, with a live preview.",
  accept: "image/*",
  multiple: false,
  action: "Save adjusted image",
  options: [
    { name: "brightness", label: "Brightness", type: "range", value: 100, min: 20, max: 200, step: 5 },
    { name: "contrast", label: "Contrast", type: "range", value: 100, min: 20, max: 220, step: 5 },
    { name: "saturation", label: "Saturation", type: "range", value: 100, min: 0, max: 250, step: 5 },
    { name: "hue", label: "Hue shift (°)", type: "range", value: 0, min: -180, max: 180, step: 5 },
    { name: "blur", label: "Blur (px)", type: "range", value: 0, min: 0, max: 12, step: 0.5 },
    { name: "sepia", label: "Sepia", type: "range", value: 0, min: 0, max: 100, step: 5 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    small = ctx.fitCanvas(src, 340);
    ctx.extra.innerHTML = `
      <p class="hint">Live preview — drag any slider to see the effect.</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
        <div><div class="hint" style="margin:0 0 5px">Original</div><canvas id="pvA" style="max-width:280px;border:1px solid var(--line);border-radius:8px;display:block"></canvas></div>
        <div><div class="hint" style="margin:0 0 5px">Adjusted</div><canvas id="pvB" style="max-width:280px;border:1px solid var(--line);border-radius:8px;display:block"></canvas></div>
      </div>
      <div class="row" style="margin-top:10px"><button class="btn ghost sm" id="resetAdj" type="button">Reset sliders</button></div>`;
    const a = ctx.extra.querySelector("#pvA");
    a.width = small.width; a.height = small.height;
    a.getContext("2d").drawImage(small, 0, 0);

    const update = () => {
      const out = ctx.adjustCanvas(small, readAdjust());
      const b = ctx.extra.querySelector("#pvB");
      b.width = out.width; b.height = out.height;
      b.getContext("2d").drawImage(out, 0, 0);
    };
    ["brightness", "contrast", "saturation", "hue", "blur", "sepia"].forEach((n) => {
      const el = document.getElementById("opt-" + n);
      if (el) el.addEventListener("input", update);
    });
    ctx.extra.querySelector("#resetAdj").addEventListener("click", () => {
      const def = { brightness: 100, contrast: 100, saturation: 100, hue: 0, blur: 0, sepia: 0 };
      Object.entries(def).forEach(([k, v]) => { const el = document.getElementById("opt-" + k); if (el) el.value = v; });
      update();
    });
    update();
  },
  onReset() { src = null; small = null; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    const o = ctx.options;
    const out = ctx.adjustCanvas(src, {
      brightness: Number(o.brightness), contrast: Number(o.contrast), saturation: Number(o.saturation),
      hue: Number(o.hue), blur: Number(o.blur), sepia: Number(o.sepia),
    });
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(out, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `adjusted.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Saved the adjusted image — ${out.width}×${out.height}px, ${ctx.fmtSize(blob.size)}.</p>`;
  },
  help: "<p>100 is the neutral value for brightness, contrast and saturation; 0 is neutral for hue, blur and sepia. All adjustments are applied in a single pass at full resolution.</p>",
});
