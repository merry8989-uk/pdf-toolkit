import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null, shapes = [], view = null;

function paint(ctx, canvas, list) {
  const g = canvas.getContext("2d");
  g.clearRect(0, 0, canvas.width, canvas.height);
  for (const s of list) {
    const w = canvas.width * s.size / 100;
    const x = canvas.width * s.x / 100, y = canvas.height * s.y / 100;
    g.strokeStyle = s.color; g.fillStyle = s.color;
    g.lineWidth = Math.max(2, canvas.width * s.width / 100);
    g.lineCap = "round";
    if (s.shape === "rect") {
      if (s.filled) g.fillRect(x, y, w, w * 0.6); else g.strokeRect(x, y, w, w * 0.6);
    } else if (s.shape === "ellipse") {
      g.beginPath(); g.ellipse(x + w / 2, y + w * 0.3, w / 2, w * 0.3, 0, 0, Math.PI * 2);
      s.filled ? g.fill() : g.stroke();
    } else if (s.shape === "line") {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + w * 0.6); g.stroke();
    } else if (s.shape === "arrow") {
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + w * 0.6); g.stroke();
      const ang = Math.atan2(w * 0.6, w);
      const hl = Math.max(12, canvas.width * 0.03);
      g.beginPath();
      g.moveTo(x + w, y + w * 0.6);
      g.lineTo(x + w - hl * Math.cos(ang - 0.4), y + w * 0.6 - hl * Math.sin(ang - 0.4));
      g.lineTo(x + w - hl * Math.cos(ang + 0.4), y + w * 0.6 - hl * Math.sin(ang + 0.4));
      g.closePath(); g.fill();
    } else if (s.shape === "circle") {
      g.beginPath(); g.arc(x, y, w / 2, 0, Math.PI * 2);
      s.filled ? g.fill() : g.stroke();
    }
  }
}

mountTool({
  id: "add-shapes",
  title: "Add shapes",
  desc: "Draw arrows, rectangles, ellipses and lines on a photo — for annotations, instructions and callouts.",
  accept: "image/*",
  multiple: false,
  action: "Save image",
  options: [
    { name: "shape", label: "Shape", type: "select", value: "arrow", options: [["arrow", "Arrow"], ["rect", "Rectangle"], ["ellipse", "Ellipse"], ["circle", "Circle"], ["line", "Line"]] },
    { name: "color", label: "Colour", type: "text", value: "#ff3b30" },
    { name: "width", label: "Line thickness (% of width)", type: "number", value: 1, min: 0.2, max: 6, step: 0.2 },
    { name: "size", label: "Size (% of width)", type: "number", value: 28, min: 5, max: 100 },
    { name: "x", label: "Position X (%)", type: "number", value: 20, min: 0, max: 100 },
    { name: "y", label: "Position Y (%)", type: "number", value: 20, min: 0, max: 100 },
    { name: "filled", label: "Filled", type: "checkbox", value: false },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    shapes = [];
    ctx.extra.innerHTML = `
      <p class="hint">Set the shape, colour, size and position, then press <b>Add shape</b>. Add as many as you like.</p>
      <div id="stage" style="position:relative;display:inline-block;border:1px solid var(--line);border-radius:8px;overflow:hidden;max-width:100%"></div>
      <div class="row" style="margin-top:10px">
        <button class="btn sm" id="add" type="button">Add shape</button>
        <button class="btn ghost sm" id="undo" type="button">Undo</button>
        <button class="btn ghost sm" id="clear" type="button">Clear all</button>
      </div>`;
    const stage = ctx.extra.querySelector("#stage");
    const base = ctx.canvasOf(1, 1), over = ctx.canvasOf(1, 1);
    base.style.display = "block";
    over.style.cssText = "position:absolute;left:0;top:0";
    stage.append(base, over);
    view = ctx.fitCanvas(src, 620);
    base.width = over.width = view.width;
    base.height = over.height = view.height;
    base.getContext("2d").drawImage(view, 0, 0);
    const redraw = () => paint(ctx, over, shapes);
    ctx.extra.querySelector("#add").addEventListener("click", () => {
      const v = (id, d) => { const el = document.getElementById(id); return el ? (el.type === "checkbox" ? el.checked : el.value) : d; };
      shapes.push({
        shape: v("opt-shape", "arrow"), color: v("opt-color", "#ff3b30"),
        width: Number(v("opt-width", 1)), size: Number(v("opt-size", 28)),
        x: Number(v("opt-x", 20)), y: Number(v("opt-y", 20)), filled: !!v("opt-filled", false),
      });
      redraw();
    });
    ctx.extra.querySelector("#undo").addEventListener("click", () => { shapes.pop(); redraw(); });
    ctx.extra.querySelector("#clear").addEventListener("click", () => { shapes = []; redraw(); });
    redraw();
  },
  onReset() { src = null; shapes = []; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    if (!shapes.length) throw new Error("Add at least one shape first.");
    const o = ctx.options;
    const out = ctx.canvasFrom(src);
    const layer = ctx.canvasOf(out.width, out.height);
    paint(ctx, layer, shapes);
    out.getContext("2d").drawImage(layer, 0, 0);
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `shapes.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Saved the photo with ${shapes.length} shape(s).</p>`;
  },
  help: "<p>Positions and sizes are percentages of the image width, so the same settings look right on any photo size. Shapes are redrawn at full resolution on export.</p>",
});
