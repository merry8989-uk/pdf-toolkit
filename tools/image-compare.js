import { mountTool } from "../app.js";

const FMT = [["jpeg", "JPG"], ["png", "PNG"], ["webp", "WebP"]];
const mimeOf = (f) => f === "png" ? "image/png" : f === "webp" ? "image/webp" : "image/jpeg";
const extOf = (f) => f === "jpeg" ? "jpg" : f;

mountTool({
  id: "image-compare",
  title: "Compare images",
  desc: "Put two versions of a photo side by side, stacked, or as a difference map — for retouching and before/after checks.",
  accept: "image/*",
  multiple: true,
  reorder: true,
  action: "Build comparison",
  options: [
    { name: "mode", label: "Layout", type: "select", value: "side", options: [["side", "Side by side"], ["stack", "Stacked top/bottom"], ["diff", "Difference map"]] },
    { name: "labels", label: "Add A / B labels", type: "checkbox", value: true },
    { name: "size", label: "Each image width (px)", type: "number", value: 900, min: 200, max: 3000 },
    { name: "format", label: "Output format", type: "select", value: "jpeg", options: FMT },
    { name: "quality", label: "Quality", type: "range", value: 0.92, min: 0.3, max: 1, step: 0.05 },
  ],
  async run(ctx) {
    if (ctx.files.length < 2) throw new Error("Add two images to compare.");
    const o = ctx.options;
    const a = await ctx.fileToImage(ctx.files[0]);
    const b = await ctx.fileToImage(ctx.files[1]);
    const target = Number(o.size) || 900;

    if (o.mode === "diff") {
      const W = target, H = Math.round(target * a.naturalHeight / a.naturalWidth);
      const ca = ctx.canvasOf(W, H), cb = ctx.canvasOf(W, H);
      ca.getContext("2d").drawImage(a, 0, 0, W, H);
      cb.getContext("2d").drawImage(b, 0, 0, W, H);
      const da = ca.getContext("2d").getImageData(0, 0, W, H).data;
      const db = cb.getContext("2d").getImageData(0, 0, W, H).data;
      const out = ctx.canvasOf(W, H);
      const g = out.getContext("2d");
      const d = g.createImageData(W, H);
      for (let i = 0; i < da.length; i += 4) {
        d.data[i] = Math.abs(da[i] - db[i]);
        d.data[i + 1] = Math.abs(da[i + 1] - db[i + 1]);
        d.data[i + 2] = Math.abs(da[i + 2] - db[i + 2]);
        d.data[i + 3] = 255;
      }
      g.putImageData(d, 0, 0);
      const mime = mimeOf(o.format);
      const blob = await ctx.canvasBlob(o.format === "png" ? out : ctx.canvasFrom(out, "#fff"), mime, Number(o.quality) || 0.92);
      ctx.download(blob, `difference.${extOf(o.format)}`, mime);
      ctx.out.innerHTML = `<p class="hint">✓ Built a difference map — black means identical, brighter means more different.</p>`;
      return;
    }

    const ra = target / a.naturalWidth, rb = target / b.naturalWidth;
    const wa = Math.round(target), ha = Math.round(a.naturalHeight * ra);
    const wb = Math.round(target), hb = Math.round(b.naturalHeight * rb);
    const gap = 16;
    const W = o.mode === "side" ? wa + wb + gap * 3 : Math.max(wa, wb) + gap * 2;
    const H = o.mode === "side" ? Math.max(ha, hb) + gap * 2 : ha + hb + gap * 3;
    const out = ctx.canvasOf(W, H);
    const g = out.getContext("2d");
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, W, H);
    const ax = o.mode === "side" ? gap : (W - wa) / 2;
    const ay = gap;
    const bx = o.mode === "side" ? gap * 2 + wa : (W - wb) / 2;
    const by = o.mode === "side" ? gap : gap * 2 + ha;
    g.drawImage(a, ax, ay, wa, ha);
    g.drawImage(b, bx, by, wb, hb);
    if (o.labels) {
      const fs = Math.max(16, Math.round(W * 0.022));
      g.font = `700 ${fs}px system-ui, sans-serif`;
      g.fillStyle = "rgba(0,0,0,.65)";
      g.fillText("A", ax + 8, ay + fs);
      g.fillText("B", bx + 8, by + fs);
    }
    const mime = mimeOf(o.format);
    const blob = await ctx.canvasBlob(o.format === "png" ? out : ctx.canvasFrom(out, "#fff"), mime, Number(o.quality) || 0.92);
    ctx.download(blob, `comparison.${extOf(o.format)}`, mime);
    ctx.out.innerHTML = `<p class="hint">✓ Built a ${o.mode === "side" ? "side-by-side" : "stacked"} comparison — ${W}×${H}px.</p>`;
  },
  help: "<p>The first image in the list is <b>A</b> and the second is <b>B</b> — reorder them with the ↑ ↓ buttons if needed. The difference map is the quickest way to confirm that a retouch changed only what you intended.</p>",
});
