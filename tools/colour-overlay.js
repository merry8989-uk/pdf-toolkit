import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null, view = null;

mountTool({
  id: "colour-overlay",
  title: "Colour overlay",
  desc: "Wash a solid colour over a photo — for tinting, mood and colour grading. Control the strength and the blend mode.",
  accept: "image/*",
  multiple: false,
  action: "Apply overlay",
  options: [
    { name: "color", label: "Overlay colour", type: "text", value: "#ff7a18" },
    { name: "opacity", label: "Opacity", type: "range", value: 0.3, min: 0.05, max: 1, step: 0.05 },
    { name: "blend", label: "Blend mode", type: "select", value: "source-over", options: [
      ["source-over", "Normal"], ["multiply", "Multiply"], ["screen", "Screen"], ["overlay", "Overlay"],
      ["soft-light", "Soft light"], ["hard-light", "Hard light"], ["color-burn", "Colour burn"], ["color-dodge", "Colour dodge"],
    ] },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    ctx.extra.innerHTML = `<p class="hint">Live preview — change the colour, opacity or blend mode to see the effect.</p><div id="stage"></div>`;
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
      g.globalAlpha = Number(document.getElementById("opt-opacity")?.value ?? 0.3);
      g.globalCompositeOperation = document.getElementById("opt-blend")?.value || "source-over";
      g.fillStyle = document.getElementById("opt-color")?.value || "#ff7a18";
      g.fillRect(0, 0, c.width, c.height);
      g.globalAlpha = 1;
      g.globalCompositeOperation = "source-over";
    };
    ["color", "opacity", "blend"].forEach((n) => {
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
    g.globalAlpha = Number(o.opacity) || 0.3;
    g.globalCompositeOperation = o.blend || "source-over";
    g.fillStyle = o.color || "#ff7a18";
    g.fillRect(0, 0, out.width, out.height);
    g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `overlay.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Applied a ${Math.round((Number(o.opacity) || 0.3) * 100)}% colour overlay.</p>`;
  },
  help: "<p>Blend modes change how the colour interacts with the photo — <b>Multiply</b> darkens and tints, <b>Screen</b> lightens, <b>Soft light</b> gives a subtle grade, <b>Colour burn</b> deepens shadows.</p>",
});
