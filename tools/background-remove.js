import { mountTool } from "../app.js";

let src = null, bg = null, view = null;

/** Sample the average colour around the image border. */
function borderColor(canvas) {
  const g = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const pts = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 60));
  for (let x = 0; x < w; x += step) { pts.push([x, 1]); pts.push([x, h - 2]); }
  for (let y = 0; y < h; y += step) { pts.push([1, y]); pts.push([w - 2, y]); }
  let r = 0, gg = 0, b = 0;
  for (const [x, y] of pts) {
    const d = g.getImageData(x, y, 1, 1).data;
    r += d[0]; gg += d[1]; b += d[2];
  }
  return { r: r / pts.length, g: gg / pts.length, b: b / pts.length };
}

function removeBg(ctx, canvas, colour, tol) {
  const t = tol * tol * 3;
  return ctx.pixelMap(canvas, (r, g, b, a) => {
    const dr = r - colour.r, dg = g - colour.g, db = b - colour.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < t) {
      const soft = dist / t;                       // soft edge
      return [r, g, b, Math.round(255 * Math.max(0, Math.min(1, soft)))];
    }
    return null;
  });
}

mountTool({
  id: "background-remove",
  title: "Remove background",
  desc: "Make a plain or solid background transparent. Best on product shots and logos with an even backdrop — you can also click the photo to pick the exact colour to remove.",
  accept: "image/*",
  multiple: false,
  action: "Remove background",
  options: [
    { name: "tol", label: "Tolerance", type: "range", value: 0.18, min: 0.02, max: 0.6, step: 0.02 },
    { name: "quality", label: "PNG quality", type: "range", value: 0.95, min: 0.5, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    bg = borderColor(src);
    ctx.extra.innerHTML = `
      <p class="hint">The background colour is sampled from the edges. Click anywhere on the photo to pick a different colour, then press <b>Remove background</b>.</p>
      <div id="stage" style="position:relative;display:inline-block;border:1px solid var(--line);border-radius:8px;overflow:hidden;max-width:100%;background:
        repeating-conic-gradient(#e9edf3 0% 25%, #ffffff 0% 50%) 50% / 18px 18px"></div>
      <p class="hint" id="bgstat"></p>`;
    const stage = ctx.extra.querySelector("#stage");
    const c = ctx.canvasOf(1, 1);
    c.style.display = "block";
    stage.appendChild(c);
    view = ctx.fitCanvas(src, 560);
    c.width = view.width; c.height = view.height;
    const show = () => {
      const g = c.getContext("2d");
      g.clearRect(0, 0, c.width, c.height);
      g.drawImage(view, 0, 0);
      ctx.extra.querySelector("#bgstat").textContent = `Removing ${ctx.rgbToHex(bg.r, bg.g, bg.b)} — press the button to apply.`;
    };
    c.addEventListener("click", (e) => {
      const r = c.getBoundingClientRect();
      const x = Math.round((e.clientX - r.left) * view.width / r.width);
      const y = Math.round((e.clientY - r.top) * view.height / r.height);
      const d = view.getContext("2d").getImageData(x, y, 1, 1).data;
      bg = { r: d[0], g: d[1], b: d[2] };
      show();
    });
    show();
  },
  onReset() { src = null; bg = null; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    const tol = Number(ctx.options.tol) || 0.18;
    const out = removeBg(ctx, src, bg, tol);
    const blob = await ctx.canvasBlob(out, "image/png", Number(ctx.options.quality) || 0.95);
    ctx.download(blob, "no-background.png", "image/png");
    ctx.out.innerHTML = `<p class="hint">✓ Background removed and saved as a transparent PNG (${out.width}×${out.height}px).</p>`;
  },
  help: "<p>This is a colour-distance matcher, not an AI model: it works beautifully on solid or near-solid backgrounds and struggles on busy ones. Raise the tolerance if traces of the background remain; lower it if parts of the subject disappear.</p>",
});
