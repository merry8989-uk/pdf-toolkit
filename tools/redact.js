import { mountTool } from "../app.js";

let boxes = {};      // page -> [{x,y,w,h}] in canvas pixels
let scales = {};     // page -> preview scale (canvas px per PDF pt)
let doc = null, pageNum = 1, scale = 1;
let pageCanvas, boxCanvas, label;

mountTool({
  id: "redact",
  title: "Redact PDF",
  desc: "Black out sensitive areas. Drag on the page preview to draw a box over anything you want hidden.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Apply redaction",
  options: [
    { name: "fill", label: "Box colour", type: "select", value: "black", options: [["black", "Black"], ["white", "White"]] },
  ],
  async onFiles(ctx) {
    boxes = {}; pageNum = 1;
    doc = await ctx.openDocument(await ctx.files[0].arrayBuffer());
    ctx.extra.innerHTML = `
      <div class="row" style="margin:12px 0">
        <button class="btn ghost sm" type="button" id="prev">◀ Prev</button>
        <span class="hint" id="plabel" style="margin:0">Page 1</span>
        <button class="btn ghost sm" type="button" id="next">Next ▶</button>
        <button class="btn ghost sm" type="button" id="clrpage" style="margin-left:auto">Clear page</button>
        <button class="btn ghost sm" type="button" id="clrall">Clear all</button>
      </div>
      <p class="hint">Drag on the page to draw a black box. Boxes are saved per page.</p>
      <div id="stage" style="position:relative;display:inline-block;border:1px solid var(--line);border-radius:8px;overflow:hidden;max-width:100%"></div>`;
    const stage = ctx.extra.querySelector("#stage");
    pageCanvas = ctx.canvasOf(10, 10);
    boxCanvas = ctx.canvasOf(10, 10);
    pageCanvas.style.display = "block";
    boxCanvas.style.position = "absolute";
    boxCanvas.style.left = "0";
    boxCanvas.style.top = "0";
    boxCanvas.style.cursor = "crosshair";
    boxCanvas.style.touchAction = "none";
    stage.append(pageCanvas, boxCanvas);
    label = ctx.extra.querySelector("#plabel");

    const redraw = () => {
      const g = boxCanvas.getContext("2d");
      g.clearRect(0, 0, boxCanvas.width, boxCanvas.height);
      g.fillStyle = "#111";
      (boxes[pageNum] || []).forEach((b) => g.fillRect(b.x, b.y, b.w, b.h));
    };

    const show = async (n) => {
      pageNum = Math.min(Math.max(1, n), doc.numPages);
      const page = await doc.getPage(pageNum);
      const base = page.getViewport({ scale: 1 });
      scale = Math.min(1.6, 680 / base.width);
      scales[pageNum] = scale;
      const vp = page.getViewport({ scale });
      for (const c of [pageCanvas, boxCanvas]) { c.width = Math.round(vp.width); c.height = Math.round(vp.height); }
      const g = pageCanvas.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      redraw();
      label.textContent = `Page ${pageNum} of ${doc.numPages}`;
    };

    let sx = 0, sy = 0, dragging = false;
    const pos = (e) => {
      const r = boxCanvas.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (cx - r.left) * boxCanvas.width / r.width, y: (cy - r.top) * boxCanvas.height / r.height };
    };
    const down = (e) => { e.preventDefault(); dragging = true; const p = pos(e); sx = p.x; sy = p.y; };
    const move = (e) => {
      if (!dragging) return;
      e.preventDefault();
      const p = pos(e);
      redraw();
      const g = boxCanvas.getContext("2d");
      g.fillStyle = "rgba(0,0,0,.55)";
      g.fillRect(Math.min(sx, p.x), Math.min(sy, p.y), Math.abs(p.x - sx), Math.abs(p.y - sy));
    };
    const up = (e) => {
      if (!dragging) return;
      dragging = false;
      const p = e.changedTouches ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY } : { x: e.clientX, y: e.clientY };
      const r = boxCanvas.getBoundingClientRect();
      const x2 = (p.x - r.left) * boxCanvas.width / r.width;
      const y2 = (p.y - r.top) * boxCanvas.height / r.height;
      const x = Math.min(sx, x2), y = Math.min(sy, y2), w = Math.abs(x2 - sx), h = Math.abs(y2 - sy);
      if (w > 4 && h > 4) { (boxes[pageNum] = boxes[pageNum] || []).push({ x, y, w, h }); }
      redraw();
    };
    boxCanvas.addEventListener("mousedown", down);
    boxCanvas.addEventListener("mousemove", move);
    if (ctx._redactUp) window.removeEventListener("mouseup", ctx._redactUp);
    ctx._redactUp = up;
    window.addEventListener("mouseup", up);
    boxCanvas.addEventListener("touchstart", down, { passive: false });
    boxCanvas.addEventListener("touchmove", move, { passive: false });
    boxCanvas.addEventListener("touchend", up);

    ctx.extra.querySelector("#prev").addEventListener("click", () => show(pageNum - 1));
    ctx.extra.querySelector("#next").addEventListener("click", () => show(pageNum + 1));
    ctx.extra.querySelector("#clrpage").addEventListener("click", () => { delete boxes[pageNum]; redraw(); });
    ctx.extra.querySelector("#clrall").addEventListener("click", () => { boxes = {}; redraw(); });

    await show(1);
  },
  async run(ctx) {
    if (!doc) throw new Error("Add a PDF first.");
    const total = Object.values(boxes).reduce((n, b) => n + b.length, 0);
    if (!total) throw new Error("Draw at least one box to redact.");
    const { PDFDocument, rgb } = await ctx.loadPdfLib();
    const out = await ctx.loadPdf(ctx.files[0]);
    const col = ctx.options.fill === "white" ? rgb(1, 1, 1) : rgb(0, 0, 0);
    const pages = out.getPages();
    for (const key of Object.keys(boxes)) {
      const pi = parseInt(key, 10) - 1;
      const page = pages[pi];
      if (!page) continue;
      const { height } = page.getSize();
      const sc = scales[pi + 1] || 1;
      for (const b of boxes[key]) {
        const x = b.x / sc, w = b.w / sc, h = b.h / sc;
        const y = height - (b.y + b.h) / sc;
        page.drawRectangle({ x, y, width: w, height: h, color: col });
      }
    }
    const bytes = await out.save();
    ctx.download(bytes, "redacted.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Applied ${total} redaction box(es) across ${Object.keys(boxes).length} page(s).</p>`;
  },
  help: "<p>Boxes are drawn as filled rectangles over the page, which permanently hides the area visually. To also remove the underlying text, run the result through <b>Compress</b> in image mode, which re-renders each page without any text layer.</p>",
});
