import { mountTool } from "../app.js";

const ANCHOR_OPTS = [
  ["bottom-right", "Bottom right"], ["bottom-center", "Bottom centre"], ["bottom-left", "Bottom left"],
  ["middle-right", "Middle right"], ["middle-left", "Middle left"], ["top-right", "Top right"], ["top-left", "Top left"],
];

function pdfAnchor(anchor, W, H, w, h, m) {
  const x = anchor.includes("left") ? m : anchor.includes("right") ? W - w - m : (W - w) / 2;
  const y = anchor.startsWith("top") ? H - h - m : anchor.startsWith("bottom") ? m : (H - h) / 2;
  return { x, y };
}

/** Crop a signature canvas to the inked area (with padding). */
function cropInk(canvas, pad = 10) {
  const g = canvas.getContext("2d");
  const { width: W, height: H } = canvas;
  const d = g.getImageData(0, 0, W, H).data;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (d[i + 3] > 10 && (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad); maxY = Math.min(H - 1, maxY + pad);
  const out = document.createElement("canvas");
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext("2d").drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

mountTool({
  id: "sign",
  title: "Sign PDF",
  desc: "Draw your signature below, then place it on the pages you choose. Your signature never leaves your device.",
  accept: ".pdf,application/pdf",
  multiple: false,
  action: "Place signature",
  options: [
    { name: "pages", label: "Pages (blank = last page)", type: "text", placeholder: "1, 3-5" },
    { name: "width", label: "Width (% of page)", type: "number", value: 28, min: 5, max: 80 },
    { name: "anchor", label: "Position", type: "select", value: "bottom-right", options: ANCHOR_OPTS },
    { name: "margin", label: "Margin (pt)", type: "number", value: 36, min: 0, max: 150 },
  ],
  onInit(ctx) {
    ctx.extra.innerHTML = `
      <p class="hint">Draw your signature in the box with a mouse or your finger.</p>
      <canvas id="pad" width="640" height="220" style="width:100%;max-width:640px;background:#fff;border:1px solid var(--line);border-radius:9px;touch-action:none;display:block"></canvas>
      <div class="row" style="margin-top:8px"><button class="btn ghost sm" id="clr" type="button">Clear signature</button></div>`;
    const pad = ctx.extra.querySelector("#pad");
    const g = pad.getContext("2d");
    let empty = true, drawing = false;
    const clear = () => { g.clearRect(0, 0, pad.width, pad.height); empty = true; };
    clear();
    g.strokeStyle = "#101418";
    g.lineWidth = 3.2;
    g.lineCap = "round";
    g.lineJoin = "round";
    const at = (e) => {
      const r = pad.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (cx - r.left) * pad.width / r.width, y: (cy - r.top) * pad.height / r.height };
    };
    const start = (e) => { e.preventDefault(); drawing = true; empty = false; const p = at(e); g.beginPath(); g.moveTo(p.x, p.y); };
    const move = (e) => { if (!drawing) return; e.preventDefault(); const p = at(e); g.lineTo(p.x, p.y); g.stroke(); };
    const stop = () => { drawing = false; };
    pad.addEventListener("mousedown", start);
    pad.addEventListener("mousemove", move);
    window.addEventListener("mouseup", stop);
    pad.addEventListener("touchstart", start, { passive: false });
    pad.addEventListener("touchmove", move, { passive: false });
    pad.addEventListener("touchend", stop);
    ctx.extra.querySelector("#clr").addEventListener("click", clear);
    ctx._pad = pad;
    ctx._padEmpty = () => empty;
  },
  async run(ctx) {
    if (!ctx._pad || ctx._padEmpty()) throw new Error("Draw your signature in the box first.");
    const cropped = cropInk(ctx._pad);
    if (!cropped) throw new Error("The signature box looks empty — draw something first.");
    const blob = await ctx.canvasBlob(cropped, "image/png");
    const { PDFDocument } = await ctx.loadPdfLib();
    const doc = await PDFDocument.load(await ctx.files[0].arrayBuffer(), { ignoreEncryption: true });
    const png = await doc.embedPng(new Uint8Array(await blob.arrayBuffer()));
    const o = ctx.options;
    const total = doc.getPageCount();
    let sel = ctx.parseRanges(o.pages, total);
    if (!sel.length) sel = [total];
    const pct = Number(o.width) || 28, m = Number(o.margin) || 36;

    doc.getPages().forEach((p, i) => {
      if (!sel.includes(i + 1)) return;
      const { width, height } = p.getSize();
      const w = width * pct / 100;
      const h = w * png.height / png.width;
      const { x, y } = pdfAnchor(o.anchor, width, height, w, h, m);
      p.drawImage(png, { x, y, width: w, height: h });
    });
    const bytes = await doc.save();
    ctx.download(bytes, "signed.pdf");
    ctx.out.innerHTML = `<p class="hint">✓ Placed your signature on page(s) ${sel.join(", ")}.</p>`;
  },
  help: "<p>The signature is drawn on a canvas in your browser and embedded as a transparent image. This is a visual signature, not a cryptographic digital certificate.</p>",
});
