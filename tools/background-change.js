import { mountTool } from "../app.js";

let src = null, bg = null, bgImage = null, view = null;

function borderColor(canvas) {
  const g = canvas.getContext("2d");
  const w = canvas.width, h = canvas.height;
  const pts = [];
  const step = Math.max(1, Math.floor(Math.min(w, h) / 60));
  for (let x = 0; x < w; x += step) { pts.push([x, 1]); pts.push([x, h - 2]); }
  for (let y = 0; y < h; y += step) { pts.push([1, y]); pts.push([w - 2, y]); }
  let r = 0, gg = 0, b = 0;
  for (const [x, y] of pts) { const d = g.getImageData(x, y, 1, 1).data; r += d[0]; gg += d[1]; b += d[2]; }
  return { r: r / pts.length, g: gg / pts.length, b: b / pts.length };
}

function cutout(ctx, canvas, colour, tol) {
  const t = tol * tol * 3;
  return ctx.pixelMap(canvas, (r, g, b, a) => {
    const dr = r - colour.r, dg = g - colour.g, db = b - colour.b;
    const dist = dr * dr + dg * dg + db * db;
    if (dist < t) return [r, g, b, Math.round(255 * Math.max(0, Math.min(1, dist / t)))];
    return null;
  });
}

mountTool({
  id: "background-change",
  title: "Change background",
  desc: "Replace a plain background with a solid colour, a gradient, or one of your own photos.",
  accept: "image/*",
  multiple: true,
  action: "Change background",
  options: [
    { name: "type", label: "New background", type: "select", value: "color", options: [["color", "Solid colour"], ["gradient", "Gradient"], ["image", "My own image"]] },
    { name: "color1", label: "Colour 1", type: "text", value: "#ffffff" },
    { name: "color2", label: "Colour 2 (gradient)", type: "text", value: "#2dd4bf" },
    { name: "tol", label: "Background tolerance", type: "range", value: 0.18, min: 0.02, max: 0.6, step: 0.02 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]] },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    bgImage = null;
    let main = null;
    for (const f of ctx.files) {
      const b = new Uint8Array(await f.slice(0, 4).arrayBuffer());
      if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) continue;  // a PDF was added by mistake
      if (!main) main = f; else bgImage = await ctx.fileToImage(f);
    }
    if (!main) throw new Error("Add a photo to edit.");
    const img = await ctx.fileToImage(main);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    bg = borderColor(src);
    ctx.extra.innerHTML = `<p class="hint">Add a second image to use it as the new background, or just pick a colour/gradient above. The background colour is sampled from the edges of your photo.</p>
      <div id="stage" style="position:relative;display:inline-block;border:1px solid var(--line);border-radius:8px;overflow:hidden;max-width:100%"></div>`;
    const stage = ctx.extra.querySelector("#stage");
    const c = ctx.canvasOf(1, 1);
    c.style.display = "block";
    stage.appendChild(c);
    view = ctx.fitCanvas(src, 560);
    c.width = view.width; c.height = view.height;
    c.getContext("2d").drawImage(view, 0, 0);
    c.addEventListener("click", (e) => {
      const r = c.getBoundingClientRect();
      const x = Math.round((e.clientX - r.left) * view.width / r.width);
      const y = Math.round((e.clientY - r.top) * view.height / r.height);
      const d = view.getContext("2d").getImageData(x, y, 1, 1).data;
      bg = { r: d[0], g: d[1], b: d[2] };
      ctx.toast(`Background colour set to ${ctx.rgbToHex(bg.r, bg.g, bg.b)}`);
    });
  },
  onReset() { src = null; bg = null; bgImage = null; },
  async run(ctx) {
    if (!src) throw new Error("Add a photo to edit.");
    const o = ctx.options;
    const cut = cutout(ctx, src, bg, Number(o.tol) || 0.18);
    const out = ctx.canvasOf(src.width, src.height);
    const g = out.getContext("2d");
    if (o.type === "gradient") {
      const grad = g.createLinearGradient(0, 0, out.width, out.height);
      grad.addColorStop(0, o.color1 || "#ffffff");
      grad.addColorStop(1, o.color2 || "#2dd4bf");
      g.fillStyle = grad;
    } else if (o.type === "image" && bgImage) {
      const r = Math.max(out.width / bgImage.naturalWidth, out.height / bgImage.naturalHeight);
      const w = bgImage.naturalWidth * r, h = bgImage.naturalHeight * r;
      g.drawImage(bgImage, (out.width - w) / 2, (out.height - h) / 2, w, h);
    } else {
      g.fillStyle = o.color1 || "#ffffff";
    }
    if (o.type !== "image" || !bgImage) g.fillRect(0, 0, out.width, out.height);
    g.drawImage(cut, 0, 0);

    const mime = o.format === "png" ? "image/png" : o.format === "webp" ? "image/webp" : "image/jpeg";
    const blob = await ctx.canvasBlob(out, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `new-background.${o.format === "jpeg" ? "jpg" : o.format}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Replaced the background with ${o.type === "image" && bgImage ? "your image" : o.type === "gradient" ? "a gradient" : "a solid colour"}.</p>`;
  },
  help: "<p>The subject is kept by matching the background colour sampled from the photo's edges — so this works best when the original background is fairly plain. Click the preview to choose a different colour to remove.</p>",
});
