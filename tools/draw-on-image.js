import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let src = null, strokes = [], view = null;

mountTool({
  id: "draw-on-image",
  title: "Draw on image",
  desc: "Draw freehand on a photo, or use the highlighter to mark parts of it up. Undo a stroke if you go wrong.",
  accept: "image/*",
  multiple: false,
  action: "Save image",
  options: [
    { name: "mode", label: "Tool", type: "select", value: "pen", options: [["pen", "Pen"], ["highlight", "Highlighter"], ["erase", "Eraser"]] },
    { name: "color", label: "Colour", type: "text", value: "#ff3b30" },
    { name: "width", label: "Brush size", type: "range", value: 4, min: 1, max: 20, step: 1 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    src = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    src.getContext("2d").drawImage(img, 0, 0);
    strokes = [];
    ctx.extra.innerHTML = `
      <p class="hint">Draw on the photo below. Use the options to change tool, colour and brush size.</p>
      <div id="stage" style="position:relative;display:inline-block;border:1px solid var(--line);border-radius:8px;overflow:hidden;max-width:100%"></div>
      <div class="row" style="margin-top:10px">
        <button class="btn ghost sm" id="undo" type="button">Undo stroke</button>
        <button class="btn ghost sm" id="clear" type="button">Clear all</button>
      </div>`;
    const stage = ctx.extra.querySelector("#stage");
    const base = ctx.canvasOf(1, 1), over = ctx.canvasOf(1, 1);
    base.style.display = "block";
    over.style.cssText = "position:absolute;left:0;top:0;cursor:crosshair;touch-action:none";
    stage.append(base, over);
    view = ctx.fitCanvas(src, 620);
    base.width = over.width = view.width;
    base.height = over.height = view.height;
    base.getContext("2d").drawImage(view, 0, 0);

    const paint = () => {
      const g = over.getContext("2d");
      g.clearRect(0, 0, over.width, over.height);
      for (const s of strokes) {
        const size = over.width * s.w / 100;
        g.strokeStyle = s.mode === "erase" ? "rgba(0,0,0,1)" : s.color;
        g.globalCompositeOperation = s.mode === "erase" ? "destination-out" : "source-over";
        g.globalAlpha = s.mode === "highlight" ? 0.4 : 1;
        g.lineWidth = s.mode === "highlight" ? size * 2.6 : size;
        g.lineCap = "round";
        g.lineJoin = "round";
        if (s.pts.length < 2) continue;
        g.beginPath();
        g.moveTo(s.pts[0][0] * over.width, s.pts[0][1] * over.height);
        for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i][0] * over.width, s.pts[i][1] * over.height);
        g.stroke();
      }
      g.globalCompositeOperation = "source-over";
      g.globalAlpha = 1;
    };

    let drawing = false, cur = null;
    const norm = (e) => {
      const r = over.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return [(cx - r.left) / r.width, (cy - r.top) / r.height];
    };
    const dn = (e) => {
      e.preventDefault();
      const mode = document.getElementById("opt-mode")?.value || "pen";
      const color = document.getElementById("opt-color")?.value || "#ff3b30";
      const w = Number(document.getElementById("opt-width")?.value || 4);
      drawing = true;
      cur = { mode, color, w, pts: [norm(e)] };
      strokes.push(cur);
    };
    const mv = (e) => { if (!drawing) return; e.preventDefault(); cur.pts.push(norm(e)); paint(); };
    const up = () => { drawing = false; cur = null; };
    over.addEventListener("mousedown", dn); over.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    over.addEventListener("touchstart", dn, { passive: false }); over.addEventListener("touchmove", mv, { passive: false });
    over.addEventListener("touchend", up);
    ctx.extra.querySelector("#undo").addEventListener("click", () => { strokes.pop(); paint(); });
    ctx.extra.querySelector("#clear").addEventListener("click", () => { strokes = []; paint(); });
    ctx._strokes = () => strokes;
  },
  onReset() { src = null; strokes = []; },
  async run(ctx) {
    if (!src) throw new Error("Add an image first.");
    if (!strokes.length) throw new Error("Draw something on the photo first.");
    const o = ctx.options;
    const out = ctx.canvasFrom(src);
    const g = out.getContext("2d");
    for (const s of strokes) {
      const size = out.width * s.w / 100;
      g.strokeStyle = s.color;
      g.globalCompositeOperation = s.mode === "erase" ? "destination-out" : "source-over";
      g.globalAlpha = s.mode === "highlight" ? 0.4 : 1;
      g.lineWidth = s.mode === "highlight" ? size * 2.6 : size;
      g.lineCap = "round"; g.lineJoin = "round";
      if (s.pts.length < 2) continue;
      g.beginPath();
      g.moveTo(s.pts[0][0] * out.width, s.pts[0][1] * out.height);
      for (let i = 1; i < s.pts.length; i++) g.lineTo(s.pts[i][0] * out.width, s.pts[i][1] * out.height);
      g.stroke();
    }
    g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
    const mime = mimeOf(o.format);
    const final = o.format === "png" ? out : ctx.canvasFrom(out, "#fff");
    const blob = await ctx.canvasBlob(final, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `drawing.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Saved the photo with ${strokes.length} stroke(s).</p>`;
  },
  help: "<p>Strokes are stored as paths and drawn at full resolution when you save, so lines stay sharp. The eraser removes drawn strokes (it does not erase the photo itself).</p>",
});
