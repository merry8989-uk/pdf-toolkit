import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null, view = null;

function makeGradient(g, w, h, o) {
  const ang = (Number(o.angle) || 0) * Math.PI / 180;
  const cx = w / 2, cy = h / 2;
  const len = Math.abs(w * Math.cos(ang)) + Math.abs(h * Math.sin(ang));
  const dx = Math.cos(ang) * len / 2, dy = Math.sin(ang) * len / 2;
  const grad = o.type === "radial"
    ? g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.7)
    : g.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  grad.addColorStop(0, o.color1 || "#ff7a18");
  grad.addColorStop(1, o.color2 || "#2dd4bf");
  return grad;
}

mountTool({
  id: "gradient-overlay",
  title: "Gradient overlay",
  desc: "Lay a linear or radial colour gradient over a photo — the classic way to make text readable on top of an image.",
  accept: "image/*",
  multiple: false,
  action: "Apply gradient",
  options: [
    { name: "type", label: "Gradient", type: "select", value: "linear", options: [["linear", "Linear"], ["radial", "Radial"]] },
    { name: "color1", label: "Start colour", type: "text", value: "#ff7a18" },
    { name: "color2", label: "End colour", type: "text", value: "#2dd4bf" },
    { name: "angle", label: "Angle (°)", type: "number", value: 45, min: 0, max: 360 },
    { name: "opacity", label: "Opacity", type: "range", value: 0.45, min: 0.05, max: 1, step: 0.05 },
    { name: "blend", label: "Blend mode", type: "select", value: "source-over", options: [["source-over", "Normal"], ["multiply", "Multiply"], ["screen", "Screen"], ["overlay", "Overlay"], ["soft-light", "Soft light"]] },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    ctx.extra.innerHTML = `<p class="hint">Live preview of the gradient.</p><div id="stage"></div>`;
    const stage = ctx.extra.querySelector("#stage");
    const c = ctx.canvasOf(1, 1);
    c.style.cssText = "display:block;border:1px solid var(--line);border-radius:8px;max-width:100%";
    stage.appendChild(c);
    view = ctx.fitCanvas(src, 520);
    const paint = () => {
      c.width = view.width; c.height = view.height;
      const g = c.getContext("2d");
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(view, 0, 0);
      g.globalAlpha = Number(document.getElementById("opt-opacity")?.value ?? 0.45);
      g.globalCompositeOperation = document.getElementById("opt-blend")?.value || "source-over";
      g.fillStyle = makeGradient(g, c.width, c.height, {
        type: document.getElementById("opt-type")?.value,
        color1: document.getElementById("opt-color1")?.value,
        color2: document.getElementById("opt-color2")?.value,
        angle: document.getElementById("opt-angle")?.value,
      });
      g.fillRect(0, 0, c.width, c.height);
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    };
    ["type", "color1", "color2", "angle", "opacity", "blend"].forEach((n) => {
      const el = document.getElementById("opt-" + n);
      if (el) { el.addEventListener("input", paint); el.addEventListener("change", paint); }
    });
    paint();
  },
  onReset() { src = null; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    const o = ctx.options;
    const out = ctx.canvasFrom(src);
    const g = out.getContext("2d");
    g.globalAlpha = Number(o.opacity) || 0.45;
    g.globalCompositeOperation = o.blend || "source-over";
    g.fillStyle = makeGradient(g, out.width, out.height, o);
    g.fillRect(0, 0, out.width, out.height);
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `gradient.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Applied a ${o.type} gradient overlay.</p>`;
  },
  help: "<p>For text legibility, use a linear gradient with a dark colour and raise the opacity. Radial gradients give a spotlight or vignette feel.</p>",
});
