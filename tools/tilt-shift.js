import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "tilt-shift",
  title: "Tilt-shift",
  desc: "Keep a horizontal band sharp and blur the rest — the miniature-model effect used in photography.",
  accept: "image/*",
  multiple: false,
  action: "Apply tilt-shift",
  options: [
    { name: "position", label: "Focus band position (%)", type: "range", value: 50, min: 5, max: 95, step: 5 },
    { name: "band", label: "Band height (%)", type: "range", value: 25, min: 5, max: 80, step: 5 },
    { name: "blur", label: "Blur strength (px)", type: "range", value: 9, min: 2, max: 30, step: 1 },
    { name: "saturate", label: "Boost saturation (miniature look)", type: "checkbox", value: true },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    const base = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    base.getContext("2d").drawImage(img, 0, 0);
    const o = ctx.options;
    const w = base.width, h = base.height;

    const blurred = ctx.canvasOf(w, h);
    const bg = blurred.getContext("2d");
    bg.filter = `blur(${Number(o.blur) || 9}px)`;
    bg.drawImage(base, 0, 0);

    const out = ctx.canvasOf(w, h);
    const g = out.getContext("2d");
    g.drawImage(blurred, 0, 0);

    // sharp band, feathered with a vertical gradient mask
    const centre = h * (Number(o.position) || 50) / 100;
    const half = h * (Number(o.band) || 25) / 200;
    const top = Math.max(0, centre - half), bottom = Math.min(h, centre + half);
    const feather = Math.max(8, half * 0.6);
    const mask = ctx.canvasOf(w, h);
    const mg = mask.getContext("2d");
    const grad = mg.createLinearGradient(0, Math.max(0, top - feather), 0, Math.min(h, bottom + feather));
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(Math.min(0.49, (top - (top - feather)) / ((bottom + feather) - (top - feather))), "rgba(0,0,0,1)");
    grad.addColorStop(Math.min(0.51, (bottom - (top - feather)) / ((bottom + feather) - (top - feather))), "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    mg.fillStyle = grad;
    mg.fillRect(0, 0, w, h);
    mg.globalCompositeOperation = "source-in";
    mg.drawImage(base, 0, 0);
    g.drawImage(mask, 0, 0);

    let final = out;
    if (o.saturate) final = ctx.adjustCanvas(out, { saturation: 135, contrast: 108 });
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(o.format === "png" ? final : ctx.canvasFrom(final, "#fff"), mime, Number(o.quality) || 0.92);
    ctx.download(blob, `tilt-shift.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Kept a ${o.band}% band at ${o.position}% sharp and blurred the rest.</p>`;
  },
  help: "<p>The sharp band is blended over a blurred copy with a soft vertical gradient, so the transition looks natural. A slight saturation boost completes the miniature look.</p>",
});
