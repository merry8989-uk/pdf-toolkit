import { mountTool, PHOTO_FILTERS } from "../app.js";

/* A small non-destructive photo editor: every edit is pushed onto an op list
   and the whole stack is replayed from the original image. */

const FILTER_OPTS = Object.entries(PHOTO_FILTERS).map(([k, v]) => [k, v.label]);
const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

let original = null, ops = [], strokes = [], drawMode = false, strokeColor = "#ff3b30", strokeWidth = 6;

function render(ctx) {
  let c = ctx.canvasFrom(original);
  for (const op of ops) {
    if (op.kind === "rotate") c = ctx.rotCanvas(c, op.deg);
    else if (op.kind === "flip") c = ctx.flipCanvas(c, op.h, op.v);
    else if (op.kind === "filter") c = ctx.applyFilter(c, op.name);
    else if (op.kind === "adjust") c = ctx.adjustCanvas(c, op.params);
    else if (op.kind === "vignette") {
      const g = c.getContext("2d");
      const grad = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.25, c.width / 2, c.height / 2, Math.max(c.width, c.height) * 0.72);
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(0,0,0,${op.amount})`);
      g.fillStyle = grad;
      g.fillRect(0, 0, c.width, c.height);
    } else if (op.kind === "grain") {
      c = ctx.pixelMap(c, (r, g, b, a) => {
        const n = (Math.random() - 0.5) * 255 * op.amount;
        return [r + n, g + n, b + n, a];
      });
    } else if (op.kind === "border") {
      const g = c.getContext("2d");
      g.strokeStyle = op.color;
      g.lineWidth = op.width;
      g.strokeRect(op.width / 2, op.width / 2, c.width - op.width, c.height - op.width);
    } else if (op.kind === "text") {
      const g = c.getContext("2d");
      const size = Math.round(c.width * op.size / 100);
      g.font = `800 ${size}px system-ui, sans-serif`;
      g.textBaseline = "top";
      g.lineWidth = Math.max(2, size * 0.08);
      g.strokeStyle = "rgba(0,0,0,.65)";
      g.lineJoin = "round";
      const x = c.width * op.x / 100, y = c.height * op.y / 100;
      g.strokeText(op.text, x, y);
      g.fillStyle = op.color;
      g.fillText(op.text, x, y);
    } else if (op.kind === "shape") {
      const g = c.getContext("2d");
      const w = c.width * op.size / 100;
      const x = c.width * op.x / 100, y = c.height * op.y / 100;
      g.strokeStyle = op.color;
      g.fillStyle = op.color;
      g.lineWidth = Math.max(3, c.width * 0.006);
      if (op.shape === "rect") g.strokeRect(x, y, w, w * 0.6);
      else if (op.shape === "ellipse") { g.beginPath(); g.ellipse(x + w / 2, y + w * 0.3, w / 2, w * 0.3, 0, 0, Math.PI * 2); g.stroke(); }
      else if (op.shape === "line") { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + w * 0.6); g.stroke(); }
      else if (op.shape === "arrow") {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y + w * 0.6); g.stroke();
        const ang = Math.atan2(w * 0.6, w);
        const hl = Math.max(12, c.width * 0.03);
        g.beginPath();
        g.moveTo(x + w, y + w * 0.6);
        g.lineTo(x + w - hl * Math.cos(ang - 0.4), y + w * 0.6 - hl * Math.sin(ang - 0.4));
        g.lineTo(x + w - hl * Math.cos(ang + 0.4), y + w * 0.6 - hl * Math.sin(ang + 0.4));
        g.closePath(); g.fill();
      }
    } else if (op.kind === "draw") {
      const g = c.getContext("2d");
      g.strokeStyle = op.color;
      g.lineWidth = Math.max(1, c.width * op.width / 100);
      g.lineCap = "round";
      g.lineJoin = "round";
      for (const s of op.strokes) {
        if (s.length < 2) continue;
        g.beginPath();
        g.moveTo(s[0][0] * c.width, s[0][1] * c.height);
        for (let i = 1; i < s.length; i++) g.lineTo(s[i][0] * c.width, s[i][1] * c.height);
        g.stroke();
      }
    }
  }
  return c;
}

mountTool({
  id: "photo-editor",
  title: "Photo editor",
  desc: "A full editor in one place: rotate, flip, filters, brightness/contrast/saturation, vignette, grain, border, text, shapes and freehand drawing — with undo. Nothing is applied until you export.",
  accept: "image/*",
  multiple: false,
  action: "Export image",
  options: [
    { name: "filter", label: "Filter (applies when you press Apply)", type: "select", value: "none", options: FILTER_OPTS },
    { name: "brightness", label: "Brightness", type: "range", value: 100, min: 40, max: 180, step: 5 },
    { name: "contrast", label: "Contrast", type: "range", value: 100, min: 40, max: 180, step: 5 },
    { name: "saturation", label: "Saturation", type: "range", value: 100, min: 0, max: 200, step: 5 },
    { name: "text", label: "Text to add", type: "text", placeholder: "e.g. Summer 2026" },
    { name: "textSize", label: "Text size (% of width)", type: "number", value: 8, min: 2, max: 40 },
    { name: "color", label: "Text / shape / pen colour", type: "text", value: "#ffffff" },
    { name: "shape", label: "Shape", type: "select", value: "arrow", options: [["arrow", "Arrow"], ["rect", "Rectangle"], ["ellipse", "Ellipse"], ["line", "Line"]] },
    { name: "vignette", label: "Vignette strength", type: "range", value: 0.4, min: 0.1, max: 0.9, step: 0.05 },
    { name: "grain", label: "Film grain", type: "range", value: 0.12, min: 0.02, max: 0.5, step: 0.02 },
    { name: "format", label: "Export format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async onFiles(ctx) {
    const img = await ctx.fileToImage(ctx.files[0]);
    original = ctx.canvasOf(img.naturalWidth, img.naturalHeight);
    original.getContext("2d").drawImage(img, 0, 0);
    ops = []; strokes = []; drawMode = false;

    ctx.extra.innerHTML = `
      <div class="row" style="margin:14px 0 10px;flex-wrap:wrap">
        <button class="btn ghost sm" data-op="rotl" type="button">↺ Rotate</button>
        <button class="btn ghost sm" data-op="rotr" type="button">↻ Rotate</button>
        <button class="btn ghost sm" data-op="fliph" type="button">⇋ Flip H</button>
        <button class="btn ghost sm" data-op="flipv" type="button">⇵ Flip V</button>
        <button class="btn ghost sm" data-op="applyfilter" type="button">Apply filter</button>
        <button class="btn ghost sm" data-op="applyadjust" type="button">Apply adjust</button>
        <button class="btn ghost sm" data-op="vignette" type="button">Vignette</button>
        <button class="btn ghost sm" data-op="grain" type="button">Grain</button>
        <button class="btn ghost sm" data-op="border" type="button">Border</button>
        <button class="btn ghost sm" data-op="text" type="button">Add text</button>
        <button class="btn ghost sm" data-op="shape" type="button">Add shape</button>
        <button class="btn ghost sm" data-op="draw" type="button">✏️ Draw: off</button>
        <button class="btn ghost sm" data-op="undo" type="button">Undo</button>
        <button class="btn ghost sm" data-op="reset" type="button">Reset</button>
      </div>
      <div id="stage" style="position:relative;display:inline-block;border:1px solid var(--line);border-radius:8px;overflow:hidden;max-width:100%"></div>
      <p class="hint" id="stat"></p>`;

    const stage = ctx.extra.querySelector("#stage");
    const baseC = ctx.canvasOf(1, 1), overC = ctx.canvasOf(1, 1);
    baseC.style.display = "block";
    overC.style.cssText = "position:absolute;left:0;top:0;touch-action:none";
    stage.append(baseC, overC);

    let view = null;

    function redraw() {
      const out = render(ctx);
      view = ctx.fitCanvas(out, 620);
      baseC.width = overC.width = view.width;
      baseC.height = overC.height = view.height;
      baseC.getContext("2d").drawImage(view, 0, 0);
      drawStrokes();
      ctx.extra.querySelector("#stat").textContent = ops.length ? `${ops.length} edit(s) applied` : "No edits yet — use the buttons above.";
      ctx._edited = out;
    }

    function drawStrokes() {
      const g = overC.getContext("2d");
      g.clearRect(0, 0, overC.width, overC.height);
      if (!drawMode) return;
      g.strokeStyle = strokeColor;
      g.lineWidth = Math.max(1, overC.width * strokeWidth / 100);
      g.lineCap = "round";
      g.lineJoin = "round";
      for (const s of strokes) {
        if (s.length < 2) continue;
        g.beginPath();
        g.moveTo(s[0][0] * overC.width, s[0][1] * overC.height);
        for (let i = 1; i < s.length; i++) g.lineTo(s[i][0] * overC.width, s[i][1] * overC.height);
        g.stroke();
      }
    }

    // freehand drawing
    let drawing = false, cur = null;
    const norm = (e) => {
      const r = overC.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return [(cx - r.left) / r.width, (cy - r.top) / r.height];
    };
    const dn = (e) => { if (!drawMode) return; e.preventDefault(); drawing = true; cur = [norm(e)]; strokes.push(cur); };
    const mv = (e) => { if (!drawMode || !drawing) return; e.preventDefault(); cur.push(norm(e)); drawStrokes(); };
    const upH = () => { drawing = false; cur = null; };
    overC.addEventListener("mousedown", dn); overC.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", upH);
    overC.addEventListener("touchstart", dn, { passive: false }); overC.addEventListener("touchmove", mv, { passive: false });
    overC.addEventListener("touchend", upH);

    const colorOf = () => document.getElementById("opt-color")?.value || "#ffffff";
    const val = (id, d) => Number(document.getElementById(id)?.value ?? d);

    stage.parentElement.addEventListener("click", (e) => {
      const b = e.target.closest("[data-op]");
      if (!b) return;
      const k = b.dataset.op;
      if (k === "rotl") ops.push({ kind: "rotate", deg: 270 });
      else if (k === "rotr") ops.push({ kind: "rotate", deg: 90 });
      else if (k === "fliph") ops.push({ kind: "flip", h: true, v: false });
      else if (k === "flipv") ops.push({ kind: "flip", h: false, v: true });
      else if (k === "applyfilter") {
        const name = document.getElementById("opt-filter")?.value || "none";
        if (name !== "none") ops.push({ kind: "filter", name });
      } else if (k === "applyadjust") {
        ops.push({ kind: "adjust", params: { brightness: val("opt-brightness", 100), contrast: val("opt-contrast", 100), saturation: val("opt-saturation", 100) } });
      } else if (k === "vignette") ops.push({ kind: "vignette", amount: val("opt-vignette", 0.4) });
      else if (k === "grain") ops.push({ kind: "grain", amount: val("opt-grain", 0.12) });
      else if (k === "border") ops.push({ kind: "border", width: Math.max(4, Math.round(original.width * 0.012)), color: colorOf() });
      else if (k === "text") {
        const t = document.getElementById("opt-text")?.value || "";
        if (!t.trim()) { ctx.toast("Type some text first.", true); return; }
        ops.push({ kind: "text", text: t, size: val("opt-textSize", 8), x: 8, y: 8, color: colorOf() });
      } else if (k === "shape") {
        ops.push({ kind: "shape", shape: document.getElementById("opt-shape")?.value || "arrow", size: 26, x: 30, y: 30, color: colorOf() });
      } else if (k === "draw") {
        if (drawMode && strokes.length) ops.push({ kind: "draw", strokes: strokes.map((s) => s.slice()), color: strokeColor, width: strokeWidth });
        strokes = [];
        drawMode = !drawMode;
        strokeColor = colorOf();
        b.textContent = drawMode ? "✏️ Draw: on" : "✏️ Draw: off";
        b.classList.toggle("btn", drawMode);
        ctx.toast(drawMode ? "Draw on the image, then press Draw again to keep it." : "Drawing committed.");
      } else if (k === "undo") ops.pop();
      else if (k === "reset") { ops = []; strokes = []; drawMode = false; }
      redraw();
    });

    redraw();
  },
  onReset() { original = null; ops = []; strokes = []; drawMode = false; },
  async run(ctx) {
    if (!original) throw new Error("Add an image first.");
    const o = ctx.options;
    const out = ctx._edited || render(ctx);
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(out, mime, Number(o.quality) || 0.92);
    ctx.download(blob, `edited.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Exported the edited photo — ${out.width}×${out.height}px, ${ctx.fmtSize(blob.size)}.</p>`;
  },
  help: "<p>Edits are stored as a list and replayed from the original, so nothing is degraded by editing repeatedly and <b>Undo</b> always works. Press <b>Draw</b> to draw on the image, then press it again to commit the stroke.</p>",
});
