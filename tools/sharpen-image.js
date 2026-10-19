import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null, small = null;

function processCanvas(ctx, canvas, mode, amount) {
  if (mode === "sharpen") return ctx.sharpenCanvas(canvas, amount);
  const out = ctx.canvasOf(canvas.width, canvas.height);
  const g = out.getContext("2d");
  g.filter = `blur(${amount * 8}px)`;
  g.drawImage(canvas, 0, 0);
  return out;
}

mountTool({
  id: "sharpen-image",
  title: "Sharpen or blur",
  desc: "Make a photo crisper, or soften it with a blur, using a live preview.",
  accept: "image/*",
  multiple: false,
  action: "Apply",
  options: [
    { name: "mode", label: "Effect", type: "select", value: "sharpen", options: [["sharpen", "Sharpen"], ["blur", "Blur"]] },
    { name: "amount", label: "Strength", type: "range", value: 0.5, min: 0.05, max: 1, step: 0.05 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    small = ctx.fitCanvas(src, 320);
    ctx.extra.innerHTML = `
      <p class="hint">Live preview of the effect (sharpen is calculated on the preview, then applied at full resolution).</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
        <div><div class="hint" style="margin:0 0 5px">Original</div><canvas id="pvA" style="max-width:280px;border:1px solid var(--line);border-radius:8px;display:block"></canvas></div>
        <div><div class="hint" style="margin:0 0 5px">Result</div><canvas id="pvB" style="max-width:280px;border:1px solid var(--line);border-radius:8px;display:block"></canvas></div>
      </div>`;
    const a = ctx.extra.querySelector("#pvA");
    a.width = small.width; a.height = small.height;
    a.getContext("2d").drawImage(small, 0, 0);

    const update = () => {
      const mode = document.getElementById("opt-mode")?.value || "sharpen";
      const amount = Number(document.getElementById("opt-amount")?.value ?? 0.5);
      const out = processCanvas(ctx, small, mode, amount);
      const b = ctx.extra.querySelector("#pvB");
      b.width = out.width; b.height = out.height;
      b.getContext("2d").drawImage(out, 0, 0);
    };
    ["mode", "amount"].forEach((n) => {
      const el = document.getElementById("opt-" + n);
      if (el) { el.addEventListener("input", update); el.addEventListener("change", update); }
    });
    update();
  },
  onReset() { src = null; small = null; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    const o = ctx.options;
    const amount = Number(o.amount) || 0.5;
    ctx.toast(o.mode === "sharpen" ? "Sharpening at full resolution…" : "Blurring…");
    const out = processCanvas(ctx, src, o.mode, amount);
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(out, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `${o.mode === "sharpen" ? "sharpened" : "blurred"}.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ ${o.mode === "sharpen" ? "Sharpened" : "Blurred"} — ${out.width}×${out.height}px, ${ctx.fmtSize(blob.size)}.</p>`;
  },
  help: "<p>Sharpening uses a 3×3 unsharp mask, which increases local contrast at edges. Blur softens the whole image. Both run on your device; sharpening a very large photo takes a moment.</p>",
});
